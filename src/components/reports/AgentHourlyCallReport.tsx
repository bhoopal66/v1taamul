import React, { useState } from 'react';
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
  Users,
  AlertTriangle,
  CalendarIcon,
  FileDown,
  Loader2,
  CalendarDays,
  CalendarRange,
  ArrowLeft,
  Phone,
  TrendingUp,
  Clock,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
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

interface DateRowData {
  date: string;
  dateLabel: string;
  dayName: string;
  hourlyData: HourlyData;
  totalCalls: number;
}

interface AgentOption {
  id: string;
  name: string;
}

interface SummaryStats {
  totalCalls: number;
  totalDays: number;
  peakHour: number;
  peakHourCalls: number;
  avgCallsPerDay: number;
  bestDay: string;
  bestDayCalls: number;
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

  // Fetch team agents for filter dropdown
  const { data: teamAgents } = useQuery({
    queryKey: ['team-agents-for-hourly-report', ledTeamId],
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

  const getAgentName = () => {
    if (appliedAgent === 'all') return 'All Agents';
    const agent = teamAgents?.find(a => a.id === appliedAgent);
    return agent?.name || 'Unknown';
  };

  // Fetch hourly call data - date-wise rows
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      'agent-hourly-report-datewise',
      ledTeamId,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
      appliedAgent,
    ],
    queryFn: async (): Promise<{
      dateRows: DateRowData[];
      hourlyTotals: HourlyData;
      grandTotal: number;
      summary: SummaryStats;
    }> => {
      if (!ledTeamId || !hasAppliedFilter) {
        return { 
          dateRows: [], 
          hourlyTotals: {}, 
          grandTotal: 0, 
          summary: { totalCalls: 0, totalDays: 0, peakHour: 0, peakHourCalls: 0, avgCallsPerDay: 0, bestDay: '', bestDayCalls: 0 } 
        };
      }

      const dateRange = getAppliedDateRange();
      if (!dateRange) {
        return { 
          dateRows: [], 
          hourlyTotals: {}, 
          grandTotal: 0, 
          summary: { totalCalls: 0, totalDays: 0, peakHour: 0, peakHourCalls: 0, avgCallsPerDay: 0, bestDay: '', bestDayCalls: 0 } 
        };
      }

      // Get team members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('team_id', ledTeamId)
        .eq('is_active', true);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        return { 
          dateRows: [], 
          hourlyTotals: {}, 
          grandTotal: 0, 
          summary: { totalCalls: 0, totalDays: 0, peakHour: 0, peakHourCalls: 0, avgCallsPerDay: 0, bestDay: '', bestDayCalls: 0 } 
        };
      }

      // Filter by specific agent if selected
      let filteredProfiles = profiles;
      if (appliedAgent !== 'all') {
        filteredProfiles = profiles.filter(p => p.id === appliedAgent);
      }

      const memberIds = filteredProfiles.map(p => p.id);

      // Get call feedback with timestamps
      const { data: feedback, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('agent_id, call_timestamp')
        .in('agent_id', memberIds)
        .gte('call_timestamp', dateRange.start.toISOString())
        .lte('call_timestamp', dateRange.end.toISOString());

      if (feedbackError) throw feedbackError;

      // Group by date and hour
      const dateMap = new Map<string, HourlyData>();

      feedback?.forEach(f => {
        if (f.call_timestamp) {
          const callDate = new Date(f.call_timestamp);
          const dateKey = format(callDate, 'yyyy-MM-dd');
          const hour = callDate.getHours();

          if (hour >= 8 && hour <= 20) {
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, {});
            }
            const hourlyData = dateMap.get(dateKey)!;
            hourlyData[hour] = (hourlyData[hour] || 0) + 1;
          }
        }
      });

      // Convert to DateRowData array
      const dateRows: DateRowData[] = [];
      const hourlyTotals: HourlyData = {};
      let grandTotal = 0;
      let bestDay = '';
      let bestDayCalls = 0;

      // Sort dates in descending order (most recent first)
      const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

      sortedDates.forEach(dateKey => {
        const hourlyData = dateMap.get(dateKey)!;
        let totalCalls = 0;

        HOURS.forEach(hour => {
          const count = hourlyData[hour] || 0;
          totalCalls += count;
          hourlyTotals[hour] = (hourlyTotals[hour] || 0) + count;
        });

        grandTotal += totalCalls;

        if (totalCalls > bestDayCalls) {
          bestDayCalls = totalCalls;
          bestDay = format(parseISO(dateKey), 'EEE, MMM d');
        }

        dateRows.push({
          date: dateKey,
          dateLabel: format(parseISO(dateKey), 'dd/MM/yyyy'),
          dayName: format(parseISO(dateKey), 'EEE'),
          hourlyData,
          totalCalls,
        });
      });

      // Calculate summary statistics
      let peakHour = 0;
      let peakHourCalls = 0;
      HOURS.forEach(hour => {
        if ((hourlyTotals[hour] || 0) > peakHourCalls) {
          peakHour = hour;
          peakHourCalls = hourlyTotals[hour] || 0;
        }
      });

      const summary: SummaryStats = {
        totalCalls: grandTotal,
        totalDays: dateRows.length,
        peakHour,
        peakHourCalls,
        avgCallsPerDay: dateRows.length > 0 ? Math.round(grandTotal / dateRows.length) : 0,
        bestDay,
        bestDayCalls,
      };

      return { dateRows, hourlyTotals, grandTotal, summary };
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
    if (!reportData || reportData.dateRows.length === 0) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const margin = 10;
      let yPos = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 98, 255);
      doc.text('Hour-wise Call Volume Report', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${teamInfo?.name || 'Team'} | ${getPeriodLabel()} | Agent: ${getAgentName()}`, margin, yPos);
      yPos += 5;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 10;

      // Summary section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Summary:', margin, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Calls: ${reportData.summary.totalCalls} | Days: ${reportData.summary.totalDays} | Avg/Day: ${reportData.summary.avgCallsPerDay} | Peak Hour: ${formatHour(reportData.summary.peakHour)} (${reportData.summary.peakHourCalls} calls) | Best Day: ${reportData.summary.bestDay} (${reportData.summary.bestDayCalls} calls)`, margin, yPos);
      yPos += 10;

      // Table headers
      const headers = ['Date', 'Day', ...HOURS.map(formatHour), 'Total'];

      // Table data
      const tableData = reportData.dateRows.map(row => [
        row.dateLabel,
        row.dayName,
        ...HOURS.map(hour => (row.hourlyData[hour] || 0).toString()),
        row.totalCalls.toString(),
      ]);

      // Add totals row
      tableData.push([
        'TOTAL',
        '',
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
          0: { halign: 'left', cellWidth: 22 },
          1: { halign: 'center', cellWidth: 12 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        },
      });

      const fileName = `Hourly_Call_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate PDF');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Get cell background based on value intensity
  const getCellClass = (value: number, maxValue: number): string => {
    if (value === 0) return 'text-muted-foreground';
    const intensity = maxValue > 0 ? value / maxValue : 0;
    if (intensity >= 0.8) return 'bg-primary/30 font-bold';
    if (intensity >= 0.5) return 'bg-primary/20 font-medium';
    if (intensity >= 0.2) return 'bg-primary/10';
    return '';
  };

  if (!isTeamLeader) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Team Leader Access Required</AlertTitle>
        <AlertDescription>
          This report is only available to team leaders.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate max value for heatmap coloring
  const maxCellValue = reportData?.dateRows.reduce((max, row) => {
    HOURS.forEach(hour => {
      const val = row.hourlyData[hour] || 0;
      if (val > max) max = val;
    });
    return max;
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Hour-wise Call Volume Report
              </CardTitle>
              <CardDescription>
                Date-wise hourly call breakdown (8 AM - 8 PM) for {teamInfo?.name || 'your team'}
              </CardDescription>
            </div>
            {hasAppliedFilter && reportData && reportData.dateRows.length > 0 && (
              <Button onClick={downloadPDF} disabled={isLoading || isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
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
              <Button variant="ghost" size="sm" onClick={handleChangeFilterType} className="gap-1">
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
                    <label className="block text-sm font-medium mb-2">Filter by Agent:</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
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
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button onClick={handleApplyFilter} disabled={!canApplyFilter}>
                    Apply Filter & Show Data
                  </Button>
                  <Button variant="outline" onClick={handleClearAll}>Clear</Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Date Range Selection */}
          {filterMode === 'range' && !hasAppliedFilter && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={handleChangeFilterType} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Change Filter Type
              </Button>
              
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-full max-w-lg space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">From Date:</label>
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => {
                          setStartDate(date);
                          if (endDate && date && date > endDate) setEndDate(null);
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
                      {!startDate && <p className="text-xs text-muted-foreground mt-1">Select From Date first</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Agent:</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
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
                  </p>
                )}
                
                <div className="flex gap-2 mt-6">
                  <Button onClick={handleApplyFilter} disabled={!canApplyFilter}>
                    Apply Filter & Show Data
                  </Button>
                  <Button variant="outline" onClick={handleClearAll}>Clear</Button>
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

          {/* Results */}
          {hasAppliedFilter && !isLoading && reportData && (
            <div className="space-y-6">
              {/* Filter Info */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{getPeriodLabel()}</span>
                  <span className="mx-2">|</span>
                  <Users className="h-4 w-4" />
                  <span>{getAgentName()}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearAll}>Change Filter</Button>
              </div>

              {reportData.dateRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Call Data Found</h3>
                  <p className="text-sm text-muted-foreground">No calls were recorded for this date range.</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="rounded-lg p-3 bg-primary/10">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                        <Phone className="h-3 w-3" />
                        Total Calls
                      </div>
                      <div className="text-xl font-bold">{reportData.summary.totalCalls}</div>
                    </div>
                    <div className="rounded-lg p-3 bg-muted/50">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                        <CalendarDays className="h-3 w-3" />
                        Days
                      </div>
                      <div className="text-xl font-bold">{reportData.summary.totalDays}</div>
                    </div>
                    <div className="rounded-lg p-3 bg-muted/50">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Avg/Day
                      </div>
                      <div className="text-xl font-bold">{reportData.summary.avgCallsPerDay}</div>
                    </div>
                    <div className="rounded-lg p-3 bg-muted/50">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                        <Clock className="h-3 w-3" />
                        Peak Hour
                      </div>
                      <div className="text-xl font-bold">{formatHour(reportData.summary.peakHour)}</div>
                      <div className="text-xs text-muted-foreground">{reportData.summary.peakHourCalls} calls</div>
                    </div>
                    <div className="rounded-lg p-3 bg-muted/50">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Best Day
                      </div>
                      <div className="text-xl font-bold">{reportData.summary.bestDayCalls}</div>
                      <div className="text-xs text-muted-foreground">{reportData.summary.bestDay}</div>
                    </div>
                  </div>

                  {/* Main Table */}
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold sticky left-0 bg-muted/50 z-10 min-w-[90px]">Date</TableHead>
                          <TableHead className="font-bold text-center min-w-[40px]">Day</TableHead>
                          {HOURS.map(hour => (
                            <TableHead key={hour} className="text-center font-bold min-w-[45px]">
                              {formatHour(hour)}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold bg-primary/10 min-w-[70px]">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.dateRows.map((row, idx) => (
                          <TableRow key={row.date} className={idx === 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10">
                              {row.dateLabel}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-sm">
                              {row.dayName}
                            </TableCell>
                            {HOURS.map(hour => (
                              <TableCell key={hour} className={cn("text-center", getCellClass(row.hourlyData[hour] || 0, maxCellValue))}>
                                {row.hourlyData[hour] || 0}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-bold bg-primary/5">
                              {row.totalCalls}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-muted font-bold">
                          <TableCell className="sticky left-0 bg-muted z-10">TOTAL</TableCell>
                          <TableCell></TableCell>
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
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
