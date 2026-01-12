import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTeamSubmissions, SubmissionPeriod, SubmissionStatus, TeamSubmission } from '@/hooks/useTeamSubmissions';
import { Calendar, ClipboardCheck, Check, X, Clock, Users, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const TeamSubmissionsView: React.FC = () => {
  const [period, setPeriod] = useState<SubmissionPeriod>('weekly');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TeamSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');

  const { submissions, isLoading, updateSubmissionStatus, stats } = useTeamSubmissions(period);

  const filteredSubmissions = statusFilter === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === statusFilter);

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getGroupLabel = (group: string) => {
    if (group === 'group1') return 'Group 1';
    if (group === 'group2') return 'Group 2';
    return group;
  };

  const openReviewDialog = (submission: TeamSubmission, action: 'approved' | 'rejected') => {
    setSelectedSubmission(submission);
    setReviewAction(action);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const handleReview = () => {
    if (!selectedSubmission) return;
    
    updateSubmissionStatus.mutate({
      id: selectedSubmission.id,
      status: reviewAction,
      review_notes: reviewNotes,
    });
    
    setReviewDialogOpen(false);
    setSelectedSubmission(null);
    setReviewNotes('');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Team Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                Team Submissions
              </CardTitle>
              <CardDescription>
                Review and approve agent submissions
              </CardDescription>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as SubmissionPeriod)}>
              <TabsList className="grid grid-cols-2 w-[180px]">
                <TabsTrigger value="weekly" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Weekly
                </TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Monthly
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('all')}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('pending')}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" />
                  <span className="text-sm text-muted-foreground">Pending</span>
                </div>
                <p className="text-2xl font-bold text-warning">{stats.pending}</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('approved')}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="text-sm text-muted-foreground">Approved</span>
                </div>
                <p className="text-2xl font-bold text-success">{stats.approved}</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStatusFilter('rejected')}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Rejected</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter indicator */}
          {statusFilter !== 'all' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Filtered: {statusFilter}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                Clear filter
              </Button>
            </div>
          )}

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No submissions found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {submission.agent?.full_name || submission.agent?.username || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(submission.submission_date), 'EEE, MMM d')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={submission.submission_group === 'group1' ? 'default' : 'secondary'}>
                          {getGroupLabel(submission.submission_group)}
                        </Badge>
                      </TableCell>
                      <TableCell>{submission.bank_name}</TableCell>
                      <TableCell>{getStatusBadge(submission.status)}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {submission.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {submission.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-success hover:text-success hover:bg-success/10"
                              onClick={() => openReviewDialog(submission, 'approved')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openReviewDialog(submission, 'rejected')}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {submission.reviewed_at && format(parseISO(submission.reviewed_at), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} Submission
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission && (
                <>
                  Submission by {selectedSubmission.agent?.full_name || 'Unknown'} for {selectedSubmission.bank_name} on {format(parseISO(selectedSubmission.submission_date), 'MMM d, yyyy')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Review Notes (Optional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about your review..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approved' ? 'default' : 'destructive'}
              onClick={handleReview}
              disabled={updateSubmissionStatus.isPending}
            >
              {reviewAction === 'approved' ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
