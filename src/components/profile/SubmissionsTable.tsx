import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAgentSubmissions, SubmissionPeriod, SubmissionStatus, BANK_GROUPS } from '@/hooks/useAgentSubmissions';
import { Calendar, ClipboardList, Trash2, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO } from 'date-fns';

export const SubmissionsTable: React.FC = () => {
  const [period, setPeriod] = useState<SubmissionPeriod>('weekly');
  const { submissions, isLoading, deleteSubmission, isMissingToday } = useAgentSubmissions(period);

  const getGroupLabel = (group: string) => {
    if (group === 'group1') return 'Group 1';
    if (group === 'group2') return 'Group 2';
    return group;
  };

  const getStatusBadge = (status: SubmissionStatus, reviewNotes?: string | null) => {
    const badge = (() => {
      switch (status) {
        case 'approved':
          return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
        case 'rejected':
          return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
        default:
          return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      }
    })();

    if (reviewNotes) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-[200px]">{reviewNotes}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return badge;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            My Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <ClipboardList className="w-5 h-5 text-primary" />
              My Submissions
            </CardTitle>
            <CardDescription>
              {submissions.length} submissions {period === 'weekly' ? 'this week' : 'this month'}
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
        {/* Missing submission alert */}
        {isMissingToday && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Submission Required</AlertTitle>
            <AlertDescription>
              You haven't submitted your daily work yet. Please submit before end of day.
            </AlertDescription>
          </Alert>
        )}

        {submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No submissions found for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(submission.submission_date), 'EEE, MMM d')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={submission.submission_group === 'group1' ? 'default' : 'secondary'}>
                        {getGroupLabel(submission.submission_group)}
                      </Badge>
                    </TableCell>
                    <TableCell>{submission.bank_name}</TableCell>
                    <TableCell>
                      {getStatusBadge(submission.status, submission.review_notes)}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {submission.notes || '-'}
                    </TableCell>
                    <TableCell>
                      {submission.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSubmission.mutate(submission.id)}
                          disabled={deleteSubmission.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
  );
};
