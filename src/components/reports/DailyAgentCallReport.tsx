import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  MessageCircle,
  TrendingUp,
  BarChart3,
  User,
  Award,
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
type SortField = 'agentName' | 'totalCalls' | 'interested' | 'notInterested' | 'notAnswered' | 'wrongNumber' | 'callBack' | 'whatsappSent' | 'conversionRate';
type SortDirection = 'asc' | 'desc';

interface AgentCallRow {
  agentId: string;
  agentName: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  wrongNumber: number;
  callBack: number;
  whatsappSent: number;
}

interface AgentCallTotals {
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

// Summary Card Component
const SummaryCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subValue?: string;
}> = ({ title, value, icon, color, subValue }) => (
  <div className={`p-4 rounded-lg border bg-gradient-to-br ${color} transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-default`}>
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-sm font-medium">{title}</span>
    </div>
    <div className="mt-2 flex items-end gap-2">
      <span className="text-2xl font-bold">{value}</span>
      {subValue && (
        <span className="text-sm text-muted-foreground mb-0.5">{subValue}</span>
      )}
    </div>
  </div>
);

// Conversion Rate Bar Component
const ConversionRateBar: React.FC<{ rate: number }> = ({ rate }) => {
  const getColor = (rate: number) => {
    if (rate >= 15) return 'bg-green-500';
    if (rate >= 10) return 'bg-yellow-500';
    if (rate >= 5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(rate)} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(rate * 5, 100)}%` }}
        />
      </div>
      <span className="text-sm font-medium w-12 text-right">{rate.toFixed(1)}%</span>
    </div>
  );
};

// Agent Row with expansion
const AgentRow: React.FC<{
  row: AgentCallRow;
  isExpanded: boolean;
  onToggle: () => void;
  conversionRate: number;
  rank: number;
}> = ({ row, isExpanded, onToggle, conversionRate, rank }) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-white">🥇 1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 text-white">🥈 2nd</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-white">🥉 3rd</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
            )}
            {getRankBadge(rank)}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium">{row.agentName}</span>
          </div>
        </TableCell>
        <TableCell className="text-center">
          <span className="font-bold text-lg">{row.totalCalls}</span>
        </TableCell>
        <TableCell className="text-center">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
            {row.interested}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">
            {row.notInterested}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200">
            {row.notAnswered}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant="outline">{row.callBack}</Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200">
            <MessageCircle className="h-3 w-3 mr-1" />
            {row.whatsappSent}
          </Badge>
        </TableCell>
        <TableCell>
          <ConversionRateBar rate={conversionRate} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3 bg-background rounded-lg border text-center">
                <Phone className="h-5 w-5 mx-auto mb-1 text-primary" />
                <div className="text-xs text-muted-foreground mb-1">Total Calls</div>
                <div className="text-xl font-bold">{row.totalCalls}</div>
              </div>
              <div className="p-3 bg-background rounded-lg border border-green-200 dark:border-green-800 text-center">
                <PhoneCall className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">Interested</div>
                <div className="text-xl font-bold text-green-600">{row.interested}</div>
                <div className="text-xs text-muted-foreground">
                  {row.totalCalls > 0 ? ((row.interested / row.totalCalls) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="p-3 bg-background rounded-lg border border-red-200 dark:border-red-800 text-center">
                <PhoneOff className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Not Interested</div>
                <div className="text-xl font-bold text-red-600">{row.notInterested}</div>
                <div className="text-xs text-muted-foreground">
                  {row.totalCalls > 0 ? ((row.notInterested / row.totalCalls) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="p-3 bg-background rounded-lg border border-yellow-200 dark:border-yellow-800 text-center">
                <PhoneMissed className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Not Answered</div>
                <div className="text-xl font-bold text-yellow-600">{row.notAnswered}</div>
                <div className="text-xs text-muted-foreground">
                  {row.totalCalls > 0 ? ((row.notAnswered / row.totalCalls) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="p-3 bg-background rounded-lg border text-center">
                <Phone className="h-5 w-5 mx-auto mb-1 text-gray-500" />
                <div className="text-xs text-muted-foreground mb-1">Wrong Number</div>
                <div className="text-xl font-bold">{row.wrongNumber}</div>
              </div>
              <div className="p-3 bg-background rounded-lg border text-center">
                <Phone className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <div className="text-xs text-muted-foreground mb-1">Call Back</div>
                <div className="text-xl font-bold">{row.callBack}</div>
              </div>
              <div className="p-3 bg-background rounded-lg border border-blue-200 dark:border-blue-800 text-center">
                <MessageCircle className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">WhatsApp</div>
                <div className="text-xl font-bold text-blue-600">{row.whatsappSent}</div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export const DailyAgentCallReport: React.FC = () => {
  const { ledTeamId, user } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('totalCalls');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
    queryKey: ['team-agents-for-daily-agent-report', ledTeamId],
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

  // Fetch team agents with call data
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      'daily-agent-call-report',
      ledTeamId,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
      appliedAgent,
    ],
    queryFn: async (): Promise<{ rows: AgentCallRow[]; totals: AgentCallTotals }> => {
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
        .select('id, full_name, username')
        .eq('team_id', ledTeamId)
        .eq('is_active', true);

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

      // Filter by specific agent if selected
      let filteredProfiles = profiles;
      if (appliedAgent !== 'all') {
        filteredProfiles = profiles.filter(p => p.id === appliedAgent);
      }

      const memberIds = filteredProfiles.map(p => p.id);
      const agentMap = new Map(filteredProfiles.map(p => [p.id, p.full_name || p.username || 'Unknown']));

      // Fetch call feedback for filtered team members
      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('*')
        .in('agent_id', memberIds)
        .gte('call_timestamp', dateRange.start.toISOString())
        .lte('call_timestamp', dateRange.end.toISOString());

      if (error) throw error;

      // Group by agent
      const agentDataMap = new Map<string, AgentCallRow>();

      // Initialize filtered agents with zero values
      filteredProfiles.forEach(p => {
        agentDataMap.set(p.id!, {
          agentId: p.id!,
          agentName: p.full_name || p.username || 'Unknown',
          totalCalls: 0,
          interested: 0,
          notInterested: 0,
          notAnswered: 0,
          wrongNumber: 0,
          callBack: 0,
          whatsappSent: 0,
        });
      });

      // Aggregate call data
      feedback?.forEach(call => {
        const agentId = call.agent_id;
        const row = agentDataMap.get(agentId);
        if (!row) return;

        row.totalCalls++;

        if (call.whatsapp_sent) {
          row.whatsappSent++;
        }

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

      const rows = Array.from(agentDataMap.values());

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

  const calculateConversionRate = (interested: number, totalCalls: number): number => {
    return totalCalls > 0 ? (interested / totalCalls) * 100 : 0;
  };

  // Sorted data
  const sortedRows = useMemo(() => {
    if (!reportData?.rows) return [];

    return [...reportData.rows].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'agentName':
          aValue = a.agentName;
          bValue = b.agentName;
          break;
        case 'conversionRate':
          aValue = calculateConversionRate(a.interested, a.totalCalls);
          bValue = calculateConversionRate(b.interested, b.totalCalls);
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [reportData?.rows, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRowExpansion = (agentId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (!reportData?.rows) return;
    setExpandedRows(new Set(reportData.rows.map(r => r.agentId)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

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
    setExpandedRows(new Set());
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
    setExpandedRows(new Set());
  };

  const handleChangeFilterType = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
  };

  const getAgentName = () => {
    if (appliedAgent === 'all') return 'All Agents';
    const agent = teamAgents?.find(a => a.id === appliedAgent);
    return agent?.name || 'Unknown';
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({
    field,
    children,
    className = ''
  }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const getPeriodLabel = () => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return format(appliedSingleDate, 'MMMM d, yyyy');
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date';
  };

  const downloadPDF = () => {
    if (!reportData || sortedRows.length === 0) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const margin = 14;
      let yPos = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Daily Agent Call Report', margin, yPos);
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
      const headers = [
        'Rank', 'Agent Name', 'Total Calls', 'Interested', 'Not Interested',
        'Not Answered', 'Wrong No.', 'Call Back', 'WhatsApp', 'Conv %'
      ];

      // Table data
      const tableData = sortedRows.map((row, idx) => [
        `#${idx + 1}`,
        row.agentName,
        row.totalCalls.toString(),
        row.interested.toString(),
        row.notInterested.toString(),
        row.notAnswered.toString(),
        row.wrongNumber.toString(),
        row.callBack.toString(),
        row.whatsappSent.toString(),
        `${calculateConversionRate(row.interested, row.totalCalls).toFixed(1)}%`,
      ]);

      // Add totals row
      tableData.push([
        '',
        'TEAM TOTAL',
        reportData.totals.totalCalls.toString(),
        reportData.totals.interested.toString(),
        reportData.totals.notInterested.toString(),
        reportData.totals.notAnswered.toString(),
        reportData.totals.wrongNumber.toString(),
        reportData.totals.callBack.toString(),
        reportData.totals.whatsappSent.toString(),
        `${calculateConversionRate(reportData.totals.interested, reportData.totals.totalCalls).toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 8,
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'left', cellWidth: 35 },
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
            if (col === 3) data.cell.styles.textColor = [39, 174, 96]; // Interested - green
            if (col === 4) data.cell.styles.textColor = [231, 76, 60]; // Not Interested - red
            if (col === 5) data.cell.styles.textColor = [243, 156, 18]; // Not Answered - orange
          }
        },
      });

      const fileName = `Daily_Agent_Call_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
                Daily Agent Call Report
              </CardTitle>
              <CardDescription>
                Agent-wise call performance breakdown for {teamInfo?.name || 'your team'}
              </CardDescription>
            </div>
            {hasAppliedFilter && reportData && sortedRows.length > 0 && (
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
                    <label className="block text-sm font-medium mb-2">Filter by Agent:</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {teamAgents?.map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
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
                <div className="w-full max-w-lg space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm disabled:opacity-50"
                      />
                      {!startDate && (
                        <p className="text-xs text-muted-foreground mt-1">Please select From Date first</p>
                      )}
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
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
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

          {/* Applied Filter - Show Change Filter Button */}
          {hasAppliedFilter && (
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm">
                <span className="font-medium">Showing data for:</span>{' '}
                <span className="text-muted-foreground">{getPeriodLabel()}</span>
                <span className="mx-2 text-muted-foreground">|</span>
                <span className="font-medium">Agent:</span>{' '}
                <span className="text-muted-foreground">{getAgentName()}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Change Filter
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && hasAppliedFilter && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Summary Cards */}
          {hasAppliedFilter && !isLoading && reportData && sortedRows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title="Total Calls"
                value={reportData.totals.totalCalls}
                icon={<Phone className="h-4 w-4" />}
                color="from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
                subValue={`by ${sortedRows.length} agents`}
              />
              <SummaryCard
                title="Interested"
                value={reportData.totals.interested}
                icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                color="from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20"
                subValue={`${calculateConversionRate(reportData.totals.interested, reportData.totals.totalCalls).toFixed(1)}%`}
              />
              <SummaryCard
                title="Not Answered"
                value={reportData.totals.notAnswered}
                icon={<PhoneMissed className="h-4 w-4 text-yellow-500" />}
                color="from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20"
                subValue={`${calculateConversionRate(reportData.totals.notAnswered, reportData.totals.totalCalls).toFixed(1)}%`}
              />
              <SummaryCard
                title="WhatsApp Sent"
                value={reportData.totals.whatsappSent}
                icon={<MessageCircle className="h-4 w-4 text-blue-500" />}
                color="from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20"
              />
            </div>
          )}

          {/* Data Table */}
          {hasAppliedFilter && !isLoading && reportData && sortedRows.length > 0 && (
            <>
              {/* Table Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {sortedRows.length} agent{sortedRows.length !== 1 ? 's' : ''} in team
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll}>
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll}>
                    Collapse All
                  </Button>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <SortableHeader field="agentName">Agent Name</SortableHeader>
                      <SortableHeader field="totalCalls" className="text-center">Total Calls</SortableHeader>
                      <SortableHeader field="interested" className="text-center">Interested</SortableHeader>
                      <SortableHeader field="notInterested" className="text-center">Not Interested</SortableHeader>
                      <SortableHeader field="notAnswered" className="text-center">Not Answered</SortableHeader>
                      <SortableHeader field="callBack" className="text-center">Call Back</SortableHeader>
                      <SortableHeader field="whatsappSent" className="text-center">WhatsApp</SortableHeader>
                      <SortableHeader field="conversionRate">Conversion</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row, idx) => (
                      <AgentRow
                        key={row.agentId}
                        row={row}
                        isExpanded={expandedRows.has(row.agentId)}
                        onToggle={() => toggleRowExpansion(row.agentId)}
                        conversionRate={calculateConversionRate(row.interested, row.totalCalls)}
                        rank={idx + 1}
                      />
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>
                        <Award className="h-4 w-4" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          TEAM TOTAL
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-lg">{reportData.totals.totalCalls}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {reportData.totals.interested}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {reportData.totals.notInterested}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {reportData.totals.notAnswered}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{reportData.totals.callBack}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {reportData.totals.whatsappSent}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ConversionRateBar rate={calculateConversionRate(reportData.totals.interested, reportData.totals.totalCalls)} />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}

          {/* Empty State */}
          {hasAppliedFilter && !isLoading && reportData && sortedRows.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Call Data Found</h3>
              <p className="text-sm text-muted-foreground">
                No call records found for your team in the selected period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
