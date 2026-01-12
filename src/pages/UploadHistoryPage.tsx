import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  History,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Download,
  Eye,
  RotateCcw,
  Users,
  FileUp,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadRecord {
  id: string;
  agent_id: string;
  file_name: string | null;
  upload_timestamp: string | null;
  total_entries_submitted: number | null;
  valid_entries: number | null;
  invalid_entries: number | null;
  duplicate_entries: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'supplemented';
  approved_count: number | null;
  rejected_count: number | null;
}

interface RejectionDetail {
  id: string;
  row_number: number | null;
  company_name: string | null;
  phone_number: string | null;
  rejection_reason: string | null;
}

type DateRange = '7days' | '30days' | 'thisMonth' | 'all';

export const UploadHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [selectedUpload, setSelectedUpload] = useState<UploadRecord | null>(null);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionDetails, setRejectionDetails] = useState<RejectionDetail[]>([]);
  const [loadingRejections, setLoadingRejections] = useState(false);

  // Calculate date filter
  const dateFilter = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '7days':
        return subDays(now, 7).toISOString();
      case '30days':
        return subDays(now, 30).toISOString();
      case 'thisMonth':
        return startOfMonth(now).toISOString();
      default:
        return null;
    }
  }, [dateRange]);

  // Fetch upload history
  const { data: uploads, isLoading } = useQuery({
    queryKey: ['upload-history-full', user?.id, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('call_sheet_uploads')
        .select('*')
        .eq('agent_id', user?.id)
        .order('upload_timestamp', { ascending: false });

      if (dateFilter) {
        query = query.gte('upload_timestamp', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UploadRecord[];
    },
    enabled: !!user?.id,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!uploads || uploads.length === 0) {
      return {
        totalUploads: 0,
        totalContacts: 0,
        totalValid: 0,
        totalInvalid: 0,
        totalDuplicates: 0,
        approvedUploads: 0,
        rejectedUploads: 0,
        pendingUploads: 0,
        successRate: 0,
        avgValidRate: 0,
        trend: 0,
      };
    }

    const totalUploads = uploads.length;
    const totalContacts = uploads.reduce((sum, u) => sum + (u.total_entries_submitted || 0), 0);
    const totalValid = uploads.reduce((sum, u) => sum + (u.valid_entries || 0), 0);
    const totalInvalid = uploads.reduce((sum, u) => sum + (u.invalid_entries || 0), 0);
    const totalDuplicates = uploads.reduce((sum, u) => sum + (u.duplicate_entries || 0), 0);
    const approvedUploads = uploads.filter(u => u.status === 'approved').length;
    const rejectedUploads = uploads.filter(u => u.status === 'rejected').length;
    const pendingUploads = uploads.filter(u => u.status === 'pending').length;
    const successRate = totalContacts > 0 ? (totalValid / totalContacts) * 100 : 0;
    const avgValidRate = totalContacts > 0 ? (totalValid / totalContacts) * 100 : 0;

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(uploads.length / 2);
    const recentHalf = uploads.slice(0, midpoint);
    const olderHalf = uploads.slice(midpoint);
    
    const recentRate = recentHalf.length > 0
      ? recentHalf.reduce((sum, u) => sum + ((u.valid_entries || 0) / Math.max(u.total_entries_submitted || 1, 1)), 0) / recentHalf.length
      : 0;
    const olderRate = olderHalf.length > 0
      ? olderHalf.reduce((sum, u) => sum + ((u.valid_entries || 0) / Math.max(u.total_entries_submitted || 1, 1)), 0) / olderHalf.length
      : 0;
    
    const trend = olderRate > 0 ? ((recentRate - olderRate) / olderRate) * 100 : 0;

    return {
      totalUploads,
      totalContacts,
      totalValid,
      totalInvalid,
      totalDuplicates,
      approvedUploads,
      rejectedUploads,
      pendingUploads,
      successRate,
      avgValidRate,
      trend,
    };
  }, [uploads]);

  // Fetch rejection details
  const handleViewRejections = async (upload: UploadRecord) => {
    setSelectedUpload(upload);
    setRejectionDialogOpen(true);
    setLoadingRejections(true);

    try {
      const { data, error } = await supabase
        .from('upload_rejections')
        .select('*')
        .eq('upload_id', upload.id)
        .order('row_number', { ascending: true });

      if (error) throw error;
      setRejectionDetails(data || []);
    } catch (error) {
      console.error('Failed to fetch rejection details:', error);
      setRejectionDetails([]);
    } finally {
      setLoadingRejections(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'supplemented':
        return <Badge variant="outline"><FileCheck className="w-3 h-3 mr-1" /> Supplemented</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getValidRate = (upload: UploadRecord) => {
    const total = upload.total_entries_submitted || 0;
    const valid = upload.valid_entries || 0;
    return total > 0 ? (valid / total) * 100 : 0;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <History className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Upload History</h1>
            <p className="text-muted-foreground mt-1">
              View detailed statistics and history of your call sheet uploads
            </p>
          </div>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="thisMonth">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Uploads</p>
                <p className="text-3xl font-bold mt-1">{stats.totalUploads}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <FileUp className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                {stats.approvedUploads} approved
              </Badge>
              {stats.pendingUploads > 0 && (
                <Badge variant="secondary">{stats.pendingUploads} pending</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <p className="text-3xl font-bold mt-1">{stats.totalContacts.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              <span className="text-green-600 font-medium">{stats.totalValid.toLocaleString()}</span> valid
              {stats.totalInvalid > 0 && (
                <span className="ml-2 text-destructive">{stats.totalInvalid.toLocaleString()} invalid</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold mt-1">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                stats.successRate >= 80 ? "bg-green-500/10" : stats.successRate >= 60 ? "bg-amber-500/10" : "bg-destructive/10"
              )}>
                <BarChart3 className={cn(
                  "w-6 h-6",
                  stats.successRate >= 80 ? "text-green-500" : stats.successRate >= 60 ? "text-amber-500" : "text-destructive"
                )} />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={stats.successRate} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quality Trend</p>
                <p className="text-3xl font-bold mt-1 flex items-center gap-2">
                  {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(1)}%
                  {stats.trend >= 0 ? (
                    <ArrowUpRight className="w-5 h-5 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-destructive" />
                  )}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-full",
                stats.trend >= 0 ? "bg-green-500/10" : "bg-destructive/10"
              )}>
                {stats.trend >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-destructive" />
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Compared to previous period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valid Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalValid.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalContacts > 0 ? ((stats.totalValid / stats.totalContacts) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invalid Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalInvalid.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalContacts > 0 ? ((stats.totalInvalid / stats.totalContacts) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duplicates Found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDuplicates.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalContacts > 0 ? ((stats.totalDuplicates / stats.totalContacts) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Upload History
          </CardTitle>
          <CardDescription>
            Detailed list of all your call sheet uploads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !uploads || uploads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No uploads found</p>
              <p className="text-sm mt-1">Start by uploading a call sheet</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Valid</TableHead>
                    <TableHead className="text-right">Invalid</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => {
                    const validRate = getValidRate(upload);
                    return (
                      <TableRow key={upload.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{upload.file_name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {upload.upload_timestamp ? format(new Date(upload.upload_timestamp), 'MMM d, yyyy') : '-'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {upload.upload_timestamp ? formatDistanceToNow(new Date(upload.upload_timestamp), { addSuffix: true }) : ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(upload.status)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {upload.total_entries_submitted?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {upload.valid_entries?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {upload.invalid_entries?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress 
                              value={validRate} 
                              className="w-16 h-2" 
                            />
                            <span className={cn(
                              "text-sm font-medium w-12 text-right",
                              validRate >= 80 ? "text-green-600" : validRate >= 60 ? "text-amber-600" : "text-destructive"
                            )}>
                              {validRate.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {(upload.invalid_entries || 0) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewRejections(upload)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Issues
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Rejection Details Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Rejected Entries - {selectedUpload?.file_name}
            </DialogTitle>
            <DialogDescription>
              Details of entries that were rejected during upload validation
            </DialogDescription>
          </DialogHeader>
          
          {loadingRejections ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : rejectionDetails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>No rejection details found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectionDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell className="font-mono text-sm">{detail.row_number}</TableCell>
                      <TableCell className="truncate max-w-[150px]">{detail.company_name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{detail.phone_number || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-normal">
                          {detail.rejection_reason || 'Unknown'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UploadHistoryPage;
