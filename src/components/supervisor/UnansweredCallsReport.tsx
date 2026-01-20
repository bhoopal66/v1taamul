import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PhoneMissed, Calendar, Clock, RefreshCw, User, Building2 } from 'lucide-react';
import { useUnansweredCallsReport, UnansweredPeriod } from '@/hooks/useUnansweredCallsReport';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface UnansweredCallsReportProps {
  teamId?: string;
}

export const UnansweredCallsReport: React.FC<UnansweredCallsReportProps> = ({ teamId }) => {
  const [period, setPeriod] = useState<UnansweredPeriod>('today');
  
  const { data, isLoading, refetch } = useUnansweredCallsReport(period, teamId);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return format(date, 'h:mm a');
  };

  const formatDate = (timestamp: string) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return format(date, 'MMM d');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <PhoneMissed className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Unanswered Calls</CardTitle>
              <CardDescription>{data.periodLabel}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <PhoneMissed className="w-3 h-3" />
              {data.totalCount} calls
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as UnansweredPeriod)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today" className="gap-2">
              <Clock className="w-4 h-4" />
              Today
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-2">
              <Calendar className="w-4 h-4" />
              This Week
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar className="w-4 h-4" />
              This Month
            </TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data.records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PhoneMissed className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No unanswered calls</p>
                <p className="text-sm">Great job! All calls are being answered.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Time
                        </div>
                      </TableHead>
                      {period !== 'today' && (
                        <TableHead className="w-[80px]">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Date
                          </div>
                        </TableHead>
                      )}
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Agent
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          Company
                        </div>
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden lg:table-cell">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {formatTime(record.callTimestamp)}
                        </TableCell>
                        {period !== 'today' && (
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(record.callTimestamp)}
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="font-medium">{record.agentName}</span>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {record.companyName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.contactPerson || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.phoneNumber}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground text-sm">
                          {record.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
