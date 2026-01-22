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
  Building,
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
import { BANK_GROUPS } from '@/hooks/useAgentSubmissions';

type FilterMode = 'single' | 'range' | null;

interface SubmissionRow {
  date: string;
  bankName: string;
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
}

// Available banks from the BANK_GROUPS
const ALL_BANKS = [...BANK_GROUPS.group1, ...BANK_GROUPS.group2];

export const BankSubmissionReport: React.FC = () => {
  const { ledTeamId, user } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>('all');

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
      setAppliedBank(selectedBank);
    } else if (filterMode === 'range' && startDate && endDate) {
      setAppliedMode('range');
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedSingleDate(null);
      setAppliedBank(selectedBank);
    }
  };

  const handleClearAll = () => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedBank('all');
    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setAppliedBank('all');
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

      const memberIds = profiles.map(p => p.id);

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

  const calculateApprovalRate = (approved: number, submitted: number): string => {
    return submitted > 0 ? ((approved / submitted) * 100).toFixed(2) : '0.00';
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
      doc.text('Bank Submission Report', margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${teamInfo?.name || 'Team'} | ${getPeriodLabel()}`, margin, yPos);
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

      // Table data
      const tableData = reportData.rows.map(row => [
        row.date,
        row.bankName,
        row.submitted.toString(),
        row.approved.toString(),
        row.rejected.toString(),
        row.pending.toString(),
        `${calculateApprovalRate(row.approved, row.submitted)}%`,
      ]);

      // Add totals row
      tableData.push([
        'TOTAL',
        appliedBank === 'all' ? 'All Banks' : appliedBank,
        reportData.totals.submitted.toString(),
        reportData.totals.approved.toString(),
        reportData.totals.rejected.toString(),
        reportData.totals.pending.toString(),
        `${calculateApprovalRate(reportData.totals.approved, reportData.totals.submitted)}%`,
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

      const fileName = `Bank_Submission_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
                Bank Submission Report
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

          {/* Data Table */}
          {hasAppliedFilter && !isLoading && reportData && reportData.rows.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead className="text-center">Submitted</TableHead>
                    <TableHead className="text-center text-green-600">Approved</TableHead>
                    <TableHead className="text-center text-red-600">Rejected</TableHead>
                    <TableHead className="text-center text-yellow-600">Pending</TableHead>
                    <TableHead className="text-center">Approval %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell>{row.bankName}</TableCell>
                      <TableCell className="text-center font-semibold">{row.submitted}</TableCell>
                      <TableCell className="text-center text-green-600">{row.approved}</TableCell>
                      <TableCell className="text-center text-red-600">{row.rejected}</TableCell>
                      <TableCell className="text-center text-yellow-600">{row.pending}</TableCell>
                      <TableCell className="text-center">
                        {calculateApprovalRate(row.approved, row.submitted)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-center">{reportData.totals.submitted}</TableCell>
                    <TableCell className="text-center text-green-600">{reportData.totals.approved}</TableCell>
                    <TableCell className="text-center text-red-600">{reportData.totals.rejected}</TableCell>
                    <TableCell className="text-center text-yellow-600">{reportData.totals.pending}</TableCell>
                    <TableCell className="text-center">
                      {calculateApprovalRate(reportData.totals.approved, reportData.totals.submitted)}%
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Empty State */}
          {hasAppliedFilter && !isLoading && reportData && reportData.rows.length === 0 && (
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Submissions Found</h3>
              <p className="text-sm text-muted-foreground">
                No bank submissions found for the selected date range
                {appliedBank !== 'all' && ` and bank (${appliedBank})`}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
