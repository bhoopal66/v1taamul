import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { FileSpreadsheet, Check, X, Clock, AlertTriangle, FileCheck } from 'lucide-react';
import { PendingUpload } from '@/hooks/useSupervisorData';
import { format } from 'date-fns';
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

interface UploadApprovalQueueProps {
  data: PendingUpload[];
  isLoading: boolean;
  onApprove: (uploadId: string) => void;
  onReject: (uploadId: string) => void;
}

export const UploadApprovalQueue: React.FC<UploadApprovalQueueProps> = ({
  data,
  isLoading,
  onApprove,
  onReject,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            Upload Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={data.length > 0 ? 'border-warning/50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Upload Approval Queue
            </CardTitle>
            <CardDescription>
              Review and approve agent call sheet uploads
            </CardDescription>
          </div>
          {data.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {data.length} Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pending uploads</p>
              <p className="text-sm">All uploads have been reviewed</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-center">Upload Date</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Valid</TableHead>
                  <TableHead className="text-center">Invalid</TableHead>
                  <TableHead className="text-center">Duplicates</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((upload) => (
                  <TableRow key={upload.id} className="bg-warning/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {upload.agentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{upload.agentName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[150px]" title={upload.fileName}>
                          {upload.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {upload.uploadDate ? format(new Date(upload.uploadDate), 'MMM d, HH:mm') : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {upload.totalEntries}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        {upload.validEntries}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {upload.invalidEntries > 0 ? (
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                          {upload.invalidEntries}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {upload.duplicateEntries > 0 ? (
                        <Badge variant="secondary" className="bg-warning/10 text-warning">
                          {upload.duplicateEntries}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="default" className="gap-1 bg-success hover:bg-success/90">
                              <Check className="w-4 h-4" />
                              Approve
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Approve Upload?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will approve {upload.validEntries} contacts from {upload.agentName}'s upload.
                                These contacts will be added to the call list.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onApprove(upload.id)}
                                className="bg-success hover:bg-success/90"
                              >
                                Approve
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                              <X className="w-4 h-4" />
                              Reject
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject Upload?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will reject the upload from {upload.agentName}. The agent will need to submit a new file.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onReject(upload.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Reject
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
