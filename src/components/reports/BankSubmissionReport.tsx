import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building,
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
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  PieChart,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { BANK_GROUPS } from '@/hooks/useAgentSubmissions';

type FilterMode = 'single' | 'range' | null;
type SortField = 'date' | 'bankName' | 'submitted' | 'approved' | 'rejected' | 'pending' | 'approvalRate';
type SortDirection = 'asc' | 'desc';

interface SubmissionRow {
  date: string;
  bankName: string;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
}

interface AgentOption {
  id: string;
  name: string;
}

// Available banks from the BANK_GROUPS
const ALL_BANKS = [...BANK_GROUPS.group1, ...BANK_GROUPS.group2];

// Summary Card Component
const SummaryCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  percentage?: number;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, icon, color, percentage, trend }) => (
  <div className={`p-4 rounded-lg border bg-gradient-to-br ${color} transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-default`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      {trend && trend !== 'neutral' && (
        <TrendingUp className={`h-4 w-4 ${trend === 'up' ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
      )}
    </div>
    <div className="mt-2 flex items-end gap-2">
      <span className="text-2xl font-bold">{value}</span>
      {percentage !== undefined && (
        <span className="text-sm text-muted-foreground mb-0.5">({percentage.toFixed(1)}%)</span>
      )}
    </div>
  </div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: 'approved' | 'rejected' | 'pending'; count: number }> = ({ status, count }) => {
  const config = {
    approved: { icon: CheckCircle2, class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' },
    rejected: { icon: XCircle, class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
    pending: { icon: Clock, class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200' },
  };
  
  const Icon = config[status].icon;
  
  return (
    <Badge variant="outline" className={`${config[status].class} gap-1 font-medium`}>
      <Icon className="h-3 w-3" />
      {count}
    </Badge>
  );
};

// Approval Rate Bar Component
const ApprovalRateBar: React.FC<{ rate: number }> = ({ rate }) => {
  const getColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    if (rate >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(rate)} transition-all duration-500 ease-out`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className="text-sm font-medium w-12 text-right">{rate.toFixed(1)}%</span>
    </div>
  );
};

// Expandable Row Component
const ExpandableRow: React.FC<{
  row: SubmissionRow;
  isExpanded: boolean;
  onToggle: () => void;
  approvalRate: number;
}> = ({ row, isExpanded, onToggle, approvalRate }) => {
  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
            )}
            {row.date}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-medium">
            {row.bankName}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <span className="font-semibold text-lg">{row.submitted}</span>
        </TableCell>
        <TableCell className="text-center">
          <StatusBadge status="approved" count={row.approved} />
        </TableCell>
        <TableCell className="text-center">
          <StatusBadge status="rejected" count={row.rejected} />
        </TableCell>
        <TableCell className="text-center">
          <StatusBadge status="pending" count={row.pending} />
        </TableCell>
        <TableCell>
          <ApprovalRateBar rate={approvalRate} />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={7} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-background rounded-lg border">
                <div className="text-xs text-muted-foreground mb-1">Total Submitted</div>
                <div className="text-xl font-bold">{row.submitted}</div>
                <Progress value={100} className="h-1 mt-2" />
              </div>
              <div className="p-3 bg-background rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">Approved</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{row.approved}</div>
                <Progress value={row.submitted > 0 ? (row.approved / row.submitted) * 100 : 0} className="h-1 mt-2 [&>div]:bg-green-500" />
              </div>
              <div className="p-3 bg-background rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Rejected</div>
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{row.rejected}</div>
                <Progress value={row.submitted > 0 ? (row.rejected / row.submitted) * 100 : 0} className="h-1 mt-2 [&>div]:bg-red-500" />
              </div>
              <div className="p-3 bg-background rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Pending</div>
                <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{row.pending}</div>
                <Progress value={row.submitted > 0 ? (row.pending / row.submitted) * 100 : 0} className="h-1 mt-2 [&>div]:bg-yellow-500" />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export const BankSubmissionReport: React.FC = () => {
  const { ledTeamId, user } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
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
  const [appliedBank, setAppliedBank] = useState<string>('all');
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
    queryKey: ['team-agents-for-bank-report', ledTeamId],
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
      setAppliedBank(selectedBank);
      setAppliedAgent(selectedAgent);
    } else if (filterMode === 'range' && startDate && endDate) {
      setAppliedMode('range');
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedSingleDate(null);
      setAppliedBank(selectedBank);
      setAppliedAgent(selectedAgent);
    }
    setExpandedRows(new Set());
  };

  const handleClearAll = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedBank('all');
    setSelectedAgent('all');
    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setAppliedBank('all');
    setAppliedAgent('all');
    setExpandedRows(new Set());
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

  // Fetch submission data
  const { data: reportData, isLoading } = useQuery({
    queryKey: [
      'bank-submission-report',
      ledTeamId,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
      appliedBank,
      appliedAgent,
    ],
    queryFn: async (): Promise<{ rows: SubmissionRow[]; totals: Omit<SubmissionRow, 'date' | 'bankName'> }> => {
      if (!ledTeamId || !hasAppliedFilter) {
        return { rows: [], totals: { submitted: 0, approved: 0, rejected: 0, pending: 0 } };
      }

      const dateRange = getAppliedDateRange();
      if (!dateRange) {
        return { rows: [], totals: { submitted: 0, approved: 0, rejected: 0, pending: 0 } };
      }

      // Get team members first (scoped to supervisor's team only)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        return { rows: [], totals: { submitted: 0, approved: 0, rejected: 0, pending: 0 } };
      }

      let memberIds = profiles.map(p => p.id);

      // Filter by specific agent if selected
      if (appliedAgent !== 'all') {
        memberIds = memberIds.filter(id => id === appliedAgent);
      }

      // Build query for submissions - only for team members
      let query = supabase
        .from('agent_submissions')
        .select('*')
        .in('agent_id', memberIds)
        .gte('submission_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('submission_date', format(dateRange.end, 'yyyy-MM-dd'));

      // Filter by bank if not 'all'
      if (appliedBank !== 'all') {
        query = query.eq('bank_name', appliedBank);
      }

      const { data: submissions, error } = await query;
      if (error) throw error;

      // Group by date and bank
      const submissionMap = new Map<string, SubmissionRow>();

      submissions?.forEach(sub => {
        const dateKey = sub.submission_date;
        const mapKey = `${dateKey}_${sub.bank_name}`;

        if (!submissionMap.has(mapKey)) {
          submissionMap.set(mapKey, {
            date: format(new Date(dateKey), 'dd/MM/yyyy'),
            bankName: sub.bank_name,
            submitted: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
          });
        }

        const row = submissionMap.get(mapKey)!;
        row.submitted++;

        switch (sub.status?.toLowerCase()) {
          case 'approved':
            row.approved++;
            break;
          case 'rejected':
            row.rejected++;
            break;
          case 'pending':
          default:
            row.pending++;
            break;
        }
      });

      // Sort by date then bank
      const rows = Array.from(submissionMap.values()).sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.bankName.localeCompare(b.bankName);
      });

      // Calculate totals
      const totals = rows.reduce(
        (acc, row) => ({
          submitted: acc.submitted + row.submitted,
          approved: acc.approved + row.approved,
          rejected: acc.rejected + row.rejected,
          pending: acc.pending + row.pending,
        }),
        { submitted: 0, approved: 0, rejected: 0, pending: 0 }
      );

      return { rows, totals };
    },
    enabled: !!ledTeamId && !!user?.id && hasAppliedFilter,
  });

  const calculateApprovalRate = (approved: number, submitted: number): number => {
    return submitted > 0 ? (approved / submitted) * 100 : 0;
  };

  // Sorted data
  const sortedRows = useMemo(() => {
    if (!reportData?.rows) return [];
    
    return [...reportData.rows].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;
      
      switch (sortField) {
        case 'date':
          aValue = a.date.split('/').reverse().join('-');
          bValue = b.date.split('/').reverse().join('-');
          break;
        case 'bankName':
          aValue = a.bankName;
          bValue = b.bankName;
          break;
        case 'approvalRate':
          aValue = calculateApprovalRate(a.approved, a.submitted);
          bValue = calculateApprovalRate(b.approved, b.submitted);
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
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (rowKey: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey);
      } else {
        newSet.add(rowKey);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (!reportData?.rows) return;
    setExpandedRows(new Set(reportData.rows.map(r => `${r.date}_${r.bankName}`)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
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
      doc.setTextColor(142, 68, 173);
      doc.text('Team Bank Submission Report', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${teamInfo?.name || 'Team'} | ${getPeriodLabel()}`, margin, yPos);
      yPos += 5;

      doc.text(`Agent: ${getAgentName()}`, margin, yPos);
      yPos += 5;

      if (appliedBank !== 'all') {
        doc.text(`Bank: ${appliedBank}`, margin, yPos);
        yPos += 5;
      }

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 10;

      // Table headers
      const headers = ['Date', 'Bank Name', 'Submitted', 'Approved', 'Rejected', 'Pending', 'Approval %'];

      // Table data (use sorted rows)
      const tableData = sortedRows.map(row => [
        row.date,
        row.bankName,
        row.submitted.toString(),
        row.approved.toString(),
        row.rejected.toString(),
        row.pending.toString(),
        `${calculateApprovalRate(row.approved, row.submitted).toFixed(2)}%`,
      ]);

      // Add totals row
      tableData.push([
        'TEAM TOTAL',
        appliedBank === 'all' ? 'All Banks' : appliedBank,
        reportData.totals.submitted.toString(),
        reportData.totals.approved.toString(),
        reportData.totals.rejected.toString(),
        reportData.totals.pending.toString(),
        `${calculateApprovalRate(reportData.totals.approved, reportData.totals.submitted).toFixed(2)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [142, 68, 173],
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
          1: { halign: 'left' },
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
            if (col === 3) data.cell.styles.textColor = [39, 174, 96]; // Approved - green
            if (col === 4) data.cell.styles.textColor = [231, 76, 60]; // Rejected - red
            if (col === 5) data.cell.styles.textColor = [243, 156, 18]; // Pending - orange
          }
        },
      });

      const fileName = `Team_Bank_Submission_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
                <Building className="h-5 w-5 text-primary" />
                Team Bank Submission Report
              </CardTitle>
              <CardDescription>
                Date-wise and bank-wise submission status for {teamInfo?.name || 'your team'}
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
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Bank (Optional):</label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Banks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Banks</SelectItem>
                        {ALL_BANKS.map(bank => (
                          <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {singleDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(singleDate, 'MMMM d, yyyy')}
                    {selectedAgent !== 'all' && ` | Agent: ${teamAgents?.find(a => a.id === selectedAgent)?.name}`}
                    {selectedBank !== 'all' && ` | Bank: ${selectedBank}`}
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
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Filter by Bank (Optional):</label>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Banks" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Banks</SelectItem>
                        {ALL_BANKS.map(bank => (
                          <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {startDate && endDate && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Selected: {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                    {selectedAgent !== 'all' && ` | Agent: ${teamAgents?.find(a => a.id === selectedAgent)?.name}`}
                    {selectedBank !== 'all' && ` | Bank: ${selectedBank}`}
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
                <span className="text-muted-foreground">
                  {getPeriodLabel()}
                  {appliedAgent !== 'all' && ` | Agent: ${getAgentName()}`}
                  {appliedBank !== 'all' && ` | Bank: ${appliedBank}`}
                </span>
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
          {hasAppliedFilter && !isLoading && reportData && reportData.rows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title="Total Submitted"
                value={reportData.totals.submitted}
                icon={<BarChart3 className="h-4 w-4" />}
                color="from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20"
              />
              <SummaryCard
                title="Approved"
                value={reportData.totals.approved}
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                color="from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20"
                percentage={calculateApprovalRate(reportData.totals.approved, reportData.totals.submitted)}
                trend={reportData.totals.approved > 0 ? 'up' : 'neutral'}
              />
              <SummaryCard
                title="Rejected"
                value={reportData.totals.rejected}
                icon={<XCircle className="h-4 w-4 text-red-500" />}
                color="from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20"
                percentage={calculateApprovalRate(reportData.totals.rejected, reportData.totals.submitted)}
              />
              <SummaryCard
                title="Pending"
                value={reportData.totals.pending}
                icon={<Clock className="h-4 w-4 text-yellow-500" />}
                color="from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20"
                percentage={calculateApprovalRate(reportData.totals.pending, reportData.totals.submitted)}
              />
            </div>
          )}

          {/* Data Table */}
          {hasAppliedFilter && !isLoading && reportData && reportData.rows.length > 0 && (
            <>
              {/* Table Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {sortedRows.length} record{sortedRows.length !== 1 ? 's' : ''} found
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
                      <SortableHeader field="date">Date</SortableHeader>
                      <SortableHeader field="bankName">Bank Name</SortableHeader>
                      <SortableHeader field="submitted" className="text-center">Submitted</SortableHeader>
                      <SortableHeader field="approved" className="text-center">Approved</SortableHeader>
                      <SortableHeader field="rejected" className="text-center">Rejected</SortableHeader>
                      <SortableHeader field="pending" className="text-center">Pending</SortableHeader>
                      <SortableHeader field="approvalRate">Approval Rate</SortableHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row, idx) => (
                      <ExpandableRow
                        key={`${row.date}_${row.bankName}`}
                        row={row}
                        isExpanded={expandedRows.has(`${row.date}_${row.bankName}`)}
                        onToggle={() => toggleRowExpansion(`${row.date}_${row.bankName}`)}
                        approvalRate={calculateApprovalRate(row.approved, row.submitted)}
                      />
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>
                        <div className="flex items-center gap-2">
                          <PieChart className="h-4 w-4" />
                          TEAM TOTAL
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-lg">{reportData.totals.submitted}</TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status="approved" count={reportData.totals.approved} />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status="rejected" count={reportData.totals.rejected} />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status="pending" count={reportData.totals.pending} />
                      </TableCell>
                      <TableCell>
                        <ApprovalRateBar rate={calculateApprovalRate(reportData.totals.approved, reportData.totals.submitted)} />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}

          {/* Empty State */}
          {hasAppliedFilter && !isLoading && reportData && reportData.rows.length === 0 && (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Submissions Found</h3>
              <p className="text-sm text-muted-foreground">
                No bank submissions found for the selected date range
                {appliedAgent !== 'all' && ` and agent (${getAgentName()})`}
                {appliedBank !== 'all' && ` and bank (${appliedBank})`}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
