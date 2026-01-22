import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Users,
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
import { cn } from '@/lib/utils';

type FilterMode = 'single' | 'range' | null;

interface HourlyData {
  [hour: number]: number;
}

interface AgentHourlyStats {
  agentId: string;
  agentName: string;
  hourlyData: HourlyData;
  totalCalls: number;
}

// Hours from 8 AM to 8 PM
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const formatHour = (hour: number): string => {
  if (hour === 12) return '12PM';
  if (hour > 12) return `${hour - 12}PM`;
  return `${hour}AM`;
};

export const AgentHourlyCallReport: React.FC = () => {
  const { ledTeamId, user } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleApplyFilter = () => {
    if (filterMode === 'single' && singleDate) {
      setAppliedMode('single');
      setAppliedSingleDate(singleDate);
      setAppliedStartDate(null);
      setAppliedEndDate(null);
    } else if (filterMode === 'range' && startDate && endDate) {
      setAppliedMode('range');
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedSingleDate(null);
    }
  };

  const handleClearAll = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
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

  // Fetch hourly call data
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      'agent-hourly-report',
      ledTeamId,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
    ],
    queryFn: async (): Promise<{ agents: AgentHourlyStats[]; hourlyTotals: HourlyData; grandTotal: number }> => {
      if (!ledTeamId || !hasAppliedFilter) {
        return { agents: [], hourlyTotals: {}, grandTotal: 0 };
      }

      const dateRange = getAppliedDateRange();
      if (!dateRange) {
        return { agents: [], hourlyTotals: {}, grandTotal: 0 };
      }

      // Get team members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        return { agents: [], hourlyTotals: {}, grandTotal: 0 };
      }

      const memberIds = profiles.map(p => p.id);

      // Get call feedback with timestamps
      const { data: feedback, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('agent_id, call_timestamp')
        .in('agent_id', memberIds)
        .gte('call_timestamp', dateRange.start.toISOString())
        .lte('call_timestamp', dateRange.end.toISOString());

      if (feedbackError) throw feedbackError;

      // Aggregate by agent and hour
      const agentMap = new Map<string, AgentHourlyStats>();

      profiles.forEach(profile => {
        agentMap.set(profile.id, {
          agentId: profile.id,
          agentName: profile.full_name || profile.username || 'Unknown',
          hourlyData: {},
          totalCalls: 0,
        });
      });

      feedback?.forEach(f => {
        if (f.call_timestamp) {
          const callDate = new Date(f.call_timestamp);
          const hour = callDate.getHours();
          
          const agent = agentMap.get(f.agent_id);
          if (agent && hour >= 8 && hour <= 20) {
            agent.hourlyData[hour] = (agent.hourlyData[hour] || 0) + 1;
            agent.totalCalls++;
          }
        }
      });

      const agents = Array.from(agentMap.values())
        .filter(a => a.totalCalls > 0)
        .sort((a, b) => b.totalCalls - a.totalCalls);

      // Calculate hourly totals
      const hourlyTotals: HourlyData = {};
      let grandTotal = 0;

      agents.forEach(agent => {
        HOURS.forEach(hour => {
          const count = agent.hourlyData[hour] || 0;
          hourlyTotals[hour] = (hourlyTotals[hour] || 0) + count;
        });
        grandTotal += agent.totalCalls;
      });

      return { agents, hourlyTotals, grandTotal };
    },
    enabled: !!ledTeamId && !!user?.id && hasAppliedFilter,
  });

  const getPeriodLabel = () => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return format(appliedSingleDate, 'MMMM d, yyyy');
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  const downloadPDF = () => {
    if (!reportData || reportData.agents.length === 0) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      let yPos = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 98, 255);
      doc.text('Agent Performance Report - Hour-wise Call Volume', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${teamInfo?.name || 'Team'} | ${getPeriodLabel()}`, margin, yPos);
      yPos += 5;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 10;

      // Table headers
      const headers = ['Agent Name', ...HOURS.map(formatHour), 'Total'];

      // Table data
      const tableData = reportData.agents.map(agent => [
        agent.agentName,
        ...HOURS.map(hour => (agent.hourlyData[hour] || 0).toString()),
        agent.totalCalls.toString(),
      ]);

      // Add totals row
      tableData.push([
        'TOTAL',
        ...HOURS.map(hour => (reportData.hourlyTotals[hour] || 0).toString()),
        reportData.grandTotal.toString(),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [41, 98, 255],
          textColor: 255,
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 7,
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 40 },
        },
        footStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          // Style the totals row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });

      const fileName = `Agent_Hourly_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
                <Users className="h-5 w-5 text-primary" />
                Agent Performance Report - Hour-wise Call Volume
              </CardTitle>
              <CardDescription>
                Hourly breakdown of calls from 8 AM to 8 PM for {teamInfo?.name || 'your team'}
              </CardDescription>
            </div>
            {hasAppliedFilter && reportData && reportData.agents.length > 0 && (
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
                <div className="w-full max-w-xs">
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
                
                {singleDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(singleDate, 'MMMM d, yyyy')}
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleApplyFilter}
                    disabled={!canApplyFilter}
                  >
                    Apply Filter & Show Data
                  </Button>
                  <Button variant="outline" onClick={handleClearAll}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Date Range Selection */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">From Date:</label>
                    <DatePicker
                      selected={startDate}
                      onChange={(date) => {
                        setStartDate(date);
                        if (endDate && date && date > endDate) {
                          setEndDate(null);
                        }
                      }}
                      selectsStart
                      startDate={startDate}
                      endDate={endDate}
                      maxDate={endDate || new Date()}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Select start date"
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
                      selectsEnd
                      startDate={startDate}
                      endDate={endDate}
                      minDate={startDate}
                      maxDate={new Date()}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Select end date"
                      disabled={!startDate}
                      isClearable
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      className={cn(
                        "w-full px-3 py-2 border border-input rounded-md bg-background text-sm",
                        !startDate && "opacity-50 cursor-not-allowed"
                      )}
                    />
                    {!startDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Select From Date first
                      </p>
                    )}
                  </div>
                </div>
                
                {startDate && endDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={handleApplyFilter}
                    disabled={!canApplyFilter}
                  >
                    Apply Filter & Show Data
                  </Button>
                  <Button variant="outline" onClick={handleClearAll}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && hasAppliedFilter && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {/* Results Table */}
          {hasAppliedFilter && !isLoading && reportData && (
            <div className="space-y-4">
              {/* Filter Info & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{getPeriodLabel()}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Change Date Filter
                </Button>
              </div>

              {reportData.agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Call Data Found</h3>
                  <p className="text-sm text-muted-foreground">
                    No calls were recorded for this date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold sticky left-0 bg-muted/50 z-10 min-w-[140px]">
                          Agent Name
                        </TableHead>
                        {HOURS.map(hour => (
                          <TableHead key={hour} className="text-center font-bold min-w-[50px]">
                            {formatHour(hour)}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold bg-primary/10 min-w-[80px]">
                          Total Calls
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.agents.map((agent, index) => (
                        <TableRow key={agent.agentId} className={index === 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">
                            {agent.agentName}
                          </TableCell>
                          {HOURS.map(hour => (
                            <TableCell key={hour} className="text-center">
                              <span className={cn(
                                (agent.hourlyData[hour] || 0) > 0 ? 'font-medium' : 'text-muted-foreground'
                              )}>
                                {agent.hourlyData[hour] || 0}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold bg-primary/5">
                            {agent.totalCalls}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted font-bold">
                        <TableCell className="sticky left-0 bg-muted z-10">TOTAL</TableCell>
                        {HOURS.map(hour => (
                          <TableCell key={hour} className="text-center">
                            {reportData.hourlyTotals[hour] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-primary/10 text-lg">
                          {reportData.grandTotal}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
