import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Trash2, AlertTriangle, FileWarning, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useRetryUpload, FailedUpload, RetryProgress } from '@/hooks/useRetryUpload';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const FailedUploadsRetryPanel: React.FC = () => {
  const {
    failedUploads,
    isLoading,
    refetch,
    retryUpload,
    isRetrying,
    retryProgress,
    deleteFailedUpload,
    isDeleting,
  } = useRetryUpload();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-warning" />
            Failed Uploads Recovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (failedUploads.length === 0) {
    return null; // Don't show panel if no failed uploads
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-warning" />
              Failed Uploads Recovery
            </CardTitle>
            <CardDescription>
              These uploads were approved but failed to create call list entries
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="animate-pulse">
              {failedUploads.length} Need Attention
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {retryProgress && (
          <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{retryProgress.message}</span>
              <span className="text-sm text-muted-foreground">{retryProgress.percentage}%</span>
            </div>
            <Progress value={retryProgress.percentage} className="h-2" />
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-center">Upload Time</TableHead>
                <TableHead className="text-center">Expected</TableHead>
                <TableHead className="text-center">Actual</TableHead>
                <TableHead className="text-center">Missing</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedUploads.map((upload) => (
                <FailedUploadRow
                  key={upload.id}
                  upload={upload}
                  onRetry={retryUpload}
                  onDelete={deleteFailedUpload}
                  isRetrying={isRetrying}
                  isDeleting={isDeleting}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

interface FailedUploadRowProps {
  upload: FailedUpload;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  isRetrying: boolean;
  isDeleting: boolean;
}

const FailedUploadRow: React.FC<FailedUploadRowProps> = ({
  upload,
  onRetry,
  onDelete,
  isRetrying,
  isDeleting,
}) => {
  const missingCount = upload.approvedCount - upload.actualEntries;

  return (
    <TableRow className="bg-warning/5">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-warning/10 text-warning text-xs">
              {upload.agentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{upload.agentName}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="text-sm truncate max-w-[150px]" title={upload.fileName}>
            {upload.fileName}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {upload.uploadDate ? format(new Date(upload.uploadDate), 'HH:mm') : 'N/A'}
      </TableCell>
      <TableCell className="text-center font-medium">
        {upload.approvedCount}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="bg-destructive/10 text-destructive">
          {upload.actualEntries}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="destructive">
          {missingCount}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="gap-1"
            onClick={() => onRetry(upload.id)}
            disabled={isRetrying || isDeleting}
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isRetrying || isDeleting}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Upload Record?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the upload record for {upload.agentName}. 
                  They will need to re-upload their call sheet file.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(upload.id)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};
