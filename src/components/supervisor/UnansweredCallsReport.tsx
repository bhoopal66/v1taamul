import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneMissed, Calendar, Clock, RefreshCw, User, Building2, ThumbsDown, Users } from 'lucide-react';
import { useUnansweredCallsReport, UnansweredPeriod, CallFeedbackType } from '@/hooks/useUnansweredCallsReport';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface UnansweredCallsReportProps {
  teamId?: string;
}

export const UnansweredCallsReport: React.FC<UnansweredCallsReportProps> = ({ teamId }) => {
  const [period, setPeriod] = useState<UnansweredPeriod>('today');
  const [feedbackType, setFeedbackType] = useState<CallFeedbackType>('not_answered');
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  
  const { data, isLoading, refetch, teamAgents } = useUnansweredCallsReport(period, teamId, feedbackType, selectedAgentId);

  const feedbackTypeConfig = {
    not_answered: {
      label: 'Unanswered',
      icon: PhoneMissed,
      color: 'destructive' as const,
      emptyTitle: 'No unanswered calls',
      emptySubtitle: 'Great job! All calls are being answered.',
    },
    not_interested: {
      label: 'Not Interested',
      icon: ThumbsDown,
      color: 'secondary' as const,
      emptyTitle: 'No "Not Interested" calls',
      emptySubtitle: 'No rejections recorded for this period.',
    },
  };

  const config = feedbackTypeConfig[feedbackType];

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

  const IconComponent = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${feedbackType === 'not_answered' ? 'bg-destructive/10' : 'bg-muted'}`}>
              <IconComponent className={`w-5 h-5 ${feedbackType === 'not_answered' ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Call Feedback Report</CardTitle>
              <CardDescription>{data.periodLabel}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Agent Filter */}
            <Select 
              value={selectedAgentId || '__all__'} 
              onValueChange={(v) => setSelectedAgentId(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className="w-[180px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Agents</SelectItem>
                {teamAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant={config.color} className="gap-1">
              <IconComponent className="w-3 h-3" />
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
        {/* Feedback Type Tabs */}
        <Tabs value={feedbackType} onValueChange={(v) => setFeedbackType(v as CallFeedbackType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="not_answered" className="gap-2">
              <PhoneMissed className="w-4 h-4" />
              Unanswered
            </TabsTrigger>
            <TabsTrigger value="not_interested" className="gap-2">
              <ThumbsDown className="w-4 h-4" />
              Not Interested
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Period Tabs */}
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
        </Tabs>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data.records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <IconComponent className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">{config.emptyTitle}</p>
                <p className="text-sm">{config.emptySubtitle}</p>
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
      </CardContent>
    </Card>
  );
};
