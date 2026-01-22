import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Phone,
  AlertTriangle,
  CalendarIcon,
  FileDown,
  Loader2,
  CalendarDays,
  CalendarRange,
  ArrowLeft,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

type FilterMode = 'single' | 'range' | null;

interface DailyCallRow {
  date: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  wrongNumber: number;
  callBack: number;
  whatsappSent: number;
}

interface DailyCallTotals {
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  wrongNumber: number;
  callBack: number;
  whatsappSent: number;
}

interface AgentOption {
  id: string;
  name: string;
}

export const TeamDailyCallStatusReport: React.FC = () => {
  const { ledTeamId, user } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Filter mode selection
  const [filterMode, setFilterMode] = useState<FilterMode>(null);
  
  // Draft date selections (not applied yet)
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Applied filter values (triggers query)
  const [appliedMode, setAppliedMode] = useState<FilterMode>(null);
  const [appliedSingleDate, setAppliedSingleDate] = useState<Date | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState<Date | null>(null);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | null>(null);
  const [appliedAgent, setAppliedAgent] = useState<string>('all');

  const hasAppliedFilter = appliedMode === 'single' 
    ? !!appliedSingleDate 
    : appliedMode === 'range' 
      ? !!appliedStartDate && !!appliedEndDate 
      : false;

  const canApplyFilter = filterMode === 'single'
    ? !!singleDate
    : filterMode === 'range'
      ? !!startDate && !!endDate
      : false;

  // Fetch team agents
  const { data: teamAgents } = useQuery({
    queryKey: ['team-agents-for-daily-report', ledTeamId],
    queryFn: async (): Promise<AgentOption[]> => {
      if (!ledTeamId) return [];

      const { data: profiles, error } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('team_id', ledTeamId)
        .eq('is_active', true);

      if (error) throw error;

      return (profiles || []).map(p => ({
        id: p.id!,
        name: p.full_name || p.username || 'Unknown',
      }));
    },
    enabled: !!ledTeamId,
  });

  const handleApplyFilter = () => {
    if (filterMode === 'single' && singleDate) {
      setAppliedMode('single');
      setAppliedSingleDate(singleDate);
      setAppliedStartDate(null);
      setAppliedEndDate(null);
      setAppliedAgent(selectedAgent);
    } else if (filterMode === 'range' && startDate && endDate) {
      setAppliedMode('range');
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedSingleDate(null);
      setAppliedAgent(selectedAgent);
    }
  };

  const handleClearAll = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedAgent('all');
    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setAppliedAgent('all');
  };

  const handleChangeFilterType = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
  };

  const getAppliedDateRange = () => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return {
        start: startOfDay(appliedSingleDate),
        end: endOfDay(appliedSingleDate),
      };
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return {
        start: startOfDay(appliedStartDate),
        end: endOfDay(appliedEndDate),
      };
    }
    return null;
  };

  // Fetch daily call data
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      'team-daily-call-status-report',
      ledTeamId,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
      appliedAgent,
    ],
    queryFn: async (): Promise<{ rows: DailyCallRow[]; totals: DailyCallTotals }> => {
      if (!ledTeamId || !hasAppliedFilter) {
        return { 
          rows: [], 
          totals: { 
            totalCalls: 0, interested: 0, notInterested: 0, 
            notAnswered: 0, wrongNumber: 0, callBack: 0, whatsappSent: 0 
          } 
        };
      }

      const dateRange = getAppliedDateRange();
      if (!dateRange) {
        return { 
          rows: [], 
          totals: { 
            totalCalls: 0, interested: 0, notInterested: 0, 
            notAnswered: 0, wrongNumber: 0, callBack: 0, whatsappSent: 0 
          } 
        };
      }

      // Get team members (scoped to supervisor's team only)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        return { 
          rows: [], 
          totals: { 
            totalCalls: 0, interested: 0, notInterested: 0, 
            notAnswered: 0, wrongNumber: 0, callBack: 0, whatsappSent: 0 
          } 
        };
      }

      let memberIds = profiles.map(p => p.id);
      
      // Filter by specific agent if selected
      if (appliedAgent !== 'all') {
        memberIds = memberIds.filter(id => id === appliedAgent);
      }

      // Build query for call feedback - only for team members
      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('*')
        .in('agent_id', memberIds)
        .gte('call_timestamp', dateRange.start.toISOString())
        .lte('call_timestamp', dateRange.end.toISOString());

      if (error) throw error;

      // Group by date
      const dailyMap = new Map<string, DailyCallRow>();

      feedback?.forEach(call => {
        const callDate = call.call_timestamp 
          ? format(new Date(call.call_timestamp), 'yyyy-MM-dd')
          : format(new Date(call.created_at!), 'yyyy-MM-dd');
        
        if (!dailyMap.has(callDate)) {
          dailyMap.set(callDate, {
            date: format(new Date(callDate), 'dd/MM/yyyy'),
            totalCalls: 0,
            interested: 0,
            notInterested: 0,
            notAnswered: 0,
            wrongNumber: 0,
            callBack: 0,
            whatsappSent: 0,
          });
        }

        const row = dailyMap.get(callDate)!;
        row.totalCalls++;

        // Count WhatsApp sent
        if (call.whatsapp_sent) {
          row.whatsappSent++;
        }

        // Map feedback status to columns
        switch (call.feedback_status?.toLowerCase()) {
          case 'interested':
            row.interested++;
            break;
          case 'not_interested':
            row.notInterested++;
            break;
          case 'not_answered':
            row.notAnswered++;
            break;
          case 'wrong_number':
            row.wrongNumber++;
            break;
          case 'call_back':
            row.callBack++;
            break;
        }
      });

      // Sort by date
      const rows = Array.from(dailyMap.values()).sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return dateA.localeCompare(dateB);
      });

      // Calculate totals
      const totals = rows.reduce(
        (acc, row) => ({
          totalCalls: acc.totalCalls + row.totalCalls,
          interested: acc.interested + row.interested,
          notInterested: acc.notInterested + row.notInterested,
          notAnswered: acc.notAnswered + row.notAnswered,
          wrongNumber: acc.wrongNumber + row.wrongNumber,
          callBack: acc.callBack + row.callBack,
          whatsappSent: acc.whatsappSent + row.whatsappSent,
        }),
        { 
          totalCalls: 0, interested: 0, notInterested: 0, 
          notAnswered: 0, wrongNumber: 0, callBack: 0, whatsappSent: 0 
        }
      );

      return { rows, totals };
    },
    enabled: !!ledTeamId && !!user?.id && hasAppliedFilter,
  });

  const calculateConversionRate = (interested: number, totalCalls: number): string => {
    return totalCalls > 0 ? ((interested / totalCalls) * 100).toFixed(2) : '0.00';
  };

  const getPeriodLabel = () => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return format(appliedSingleDate, 'MMMM d, yyyy');
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  const getAgentName = () => {
    if (appliedAgent === 'all') return 'All Team Members';
    const agent = teamAgents?.find(a => a.id === appliedAgent);
    return agent?.name || 'Unknown';
  };

  const downloadPDF = () => {
    if (!reportData || reportData.rows.length === 0) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const margin = 14;
      let yPos = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(39, 174, 96);
      doc.text('Team Daily Call Status Report', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${teamInfo?.name || 'Team'} | ${getPeriodLabel()}`, margin, yPos);
      yPos += 5;

      doc.text(`Agent: ${getAgentName()}`, margin, yPos);
      yPos += 5;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 10;

      // Table headers
      const headers = [
        'Date', 'Total Calls', 'Interested', 'Not Interested', 
        'Not Answered', 'Wrong Number', 'Call Back', 'WhatsApp', 'Conversion %'
      ];

      // Table data
      const tableData = reportData.rows.map(row => [
        row.date,
        row.totalCalls.toString(),
        row.interested.toString(),
        row.notInterested.toString(),
        row.notAnswered.toString(),
        row.wrongNumber.toString(),
        row.callBack.toString(),
        row.whatsappSent.toString(),
        `${calculateConversionRate(row.interested, row.totalCalls)}%`,
      ]);

      // Add totals row
      tableData.push([
        'TEAM TOTAL',
        reportData.totals.totalCalls.toString(),
        reportData.totals.interested.toString(),
        reportData.totals.notInterested.toString(),
        reportData.totals.notAnswered.toString(),
        reportData.totals.wrongNumber.toString(),
        reportData.totals.callBack.toString(),
        reportData.totals.whatsappSent.toString(),
        `${calculateConversionRate(reportData.totals.interested, reportData.totals.totalCalls)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [39, 174, 96],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 9,
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left' },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          // Style the totals row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [52, 73, 94];
            data.cell.styles.textColor = [255, 255, 255];
          }
          // Color code columns
          const col = data.column.index;
          if (data.section === 'body' && data.row.index !== tableData.length - 1) {
            if (col === 2) data.cell.styles.textColor = [39, 174, 96]; // Interested - green
            if (col === 3) data.cell.styles.textColor = [231, 76, 60]; // Not Interested - red
            if (col === 4) data.cell.styles.textColor = [243, 156, 18]; // Not Answered - orange
          }
        },
      });

      const fileName = `Team_Daily_Call_Status_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate PDF');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isTeamLeader) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Team Leader Access Required</AlertTitle>
        <AlertDescription>
          This report is only available to team leaders. Contact your administrator if you believe this is an error.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Team Daily Call Status
              </CardTitle>
              <CardDescription>
                Date-wise breakdown of call statuses for {teamInfo?.name || 'your team'}
              </CardDescription>
            </div>
            {hasAppliedFilter && reportData && reportData.rows.length > 0 && (
              <Button onClick={downloadPDF} disabled={isLoading || isDownloading}>
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                <span className="ml-2">Download PDF</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Filter Mode Selection */}
          {filterMode === null && (
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Select Date Filter Type</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                Choose how you want to filter the report data
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setFilterMode('single')}
                  className="gap-2 min-w-[200px] h-16"
                >
                  <CalendarDays className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Single Day</div>
                    <div className="text-xs text-muted-foreground">Pick a specific date</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setFilterMode('range')}
                  className="gap-2 min-w-[200px] h-16"
                >
                  <CalendarRange className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Date Range</div>
                    <div className="text-xs text-muted-foreground">From - To dates</div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Single Date Selection */}
          {filterMode === 'single' && !hasAppliedFilter && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Change Filter Type
              </Button>
              
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-full max-w-md space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select a Date:</label>
                    <DatePicker
                      selected={singleDate}
                      onChange={(date) => setSingleDate(date)}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Click to select a date"
                      maxDate={new Date()}
                      isClearable
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Agent (Optional):</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Team Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Team Members</SelectItem>
                        {teamAgents?.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {singleDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(singleDate, 'MMMM d, yyyy')}
                    {selectedAgent !== 'all' && ` | Agent: ${teamAgents?.find(a => a.id === selectedAgent)?.name}`}
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleApplyFilter}
                    disabled={!canApplyFilter}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Date Range Selection */}
          {filterMode === 'range' && !hasAppliedFilter && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Change Filter Type
              </Button>
              
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-full max-w-md space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">From Date:</label>
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Start date"
                        maxDate={new Date()}
                        isClearable
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">To Date:</label>
                      <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="End date"
                        minDate={startDate || undefined}
                        maxDate={new Date()}
                        isClearable
                        disabled={!startDate}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Agent (Optional):</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Team Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Team Members</SelectItem>
                        {teamAgents?.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {startDate && endDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                    {selectedAgent !== 'all' && ` | Agent: ${teamAgents?.find(a => a.id === selectedAgent)?.name}`}
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleApplyFilter}
                    disabled={!canApplyFilter}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Applied Filter Summary & Clear */}
          {hasAppliedFilter && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing data for: <strong>{getPeriodLabel()}</strong>
                {appliedAgent !== 'all' && (
                  <> | Agent: <strong>{getAgentName()}</strong></>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-7 px-2">
                Clear All
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && hasAppliedFilter && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {/* Data Table */}
          {!isLoading && hasAppliedFilter && reportData && reportData.rows.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="text-center min-w-[80px]">Total Calls</TableHead>
                    <TableHead className="text-center min-w-[80px] text-green-600">Interested</TableHead>
                    <TableHead className="text-center min-w-[90px]">Not Interested</TableHead>
                    <TableHead className="text-center min-w-[90px] text-orange-500">Not Answered</TableHead>
                    <TableHead className="text-center min-w-[90px]">Wrong Number</TableHead>
                    <TableHead className="text-center min-w-[80px]">Call Back</TableHead>
                    <TableHead className="text-center min-w-[80px]">WhatsApp</TableHead>
                    <TableHead className="text-center min-w-[90px]">Conversion %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell className="text-center font-semibold">{row.totalCalls}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{row.interested}</TableCell>
                      <TableCell className="text-center">{row.notInterested}</TableCell>
                      <TableCell className="text-center text-orange-500">{row.notAnswered}</TableCell>
                      <TableCell className="text-center">{row.wrongNumber}</TableCell>
                      <TableCell className="text-center">{row.callBack}</TableCell>
                      <TableCell className="text-center">{row.whatsappSent}</TableCell>
                      <TableCell className="text-center font-medium">
                        {calculateConversionRate(row.interested, row.totalCalls)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TEAM TOTAL</TableCell>
                    <TableCell className="text-center">{reportData.totals.totalCalls}</TableCell>
                    <TableCell className="text-center text-green-600">{reportData.totals.interested}</TableCell>
                    <TableCell className="text-center">{reportData.totals.notInterested}</TableCell>
                    <TableCell className="text-center text-orange-500">{reportData.totals.notAnswered}</TableCell>
                    <TableCell className="text-center">{reportData.totals.wrongNumber}</TableCell>
                    <TableCell className="text-center">{reportData.totals.callBack}</TableCell>
                    <TableCell className="text-center">{reportData.totals.whatsappSent}</TableCell>
                    <TableCell className="text-center">
                      {calculateConversionRate(reportData.totals.interested, reportData.totals.totalCalls)}%
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && hasAppliedFilter && reportData && reportData.rows.length === 0 && (
            <div className="text-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Available</h3>
              <p className="text-sm text-muted-foreground">
                No call data found for the selected period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
