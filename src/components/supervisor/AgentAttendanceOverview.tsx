import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAgentAttendanceOverview, AttendancePeriod } from '@/hooks/useAgentAttendanceOverview';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Users } from 'lucide-react';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface AgentAttendanceOverviewProps {
  teamId?: string;
}

// Data starts from Feb 4, 2025
const DATA_START_DATE = new Date('2025-02-04');

export const AgentAttendanceOverview: React.FC<AgentAttendanceOverviewProps> = ({ teamId }) => {
  const [period, setPeriod] = useState<AttendancePeriod>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: attendanceRecords, isLoading } = useAgentAttendanceOverview({
    teamId,
    period,
    selectedDate,
  });

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      return format(new Date(isoString), 'hh:mm a');
    } catch {
      return '—';
    }
  };

  const formatWorkDuration = (minutes: number | null) => {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const getDateRangeLabel = () => {
    switch (period) {
      case 'day':
        return format(selectedDate, 'EEEE, MMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(selectedDate, 'MMMM yyyy');
    }
  };

  const navigatePrevious = () => {
    switch (period) {
      case 'day':
        setSelectedDate(prev => subDays(prev, 1));
        break;
      case 'week':
        setSelectedDate(prev => subWeeks(prev, 1));
        break;
      case 'month':
        setSelectedDate(prev => subMonths(prev, 1));
        break;
    }
  };

  const navigateNext = () => {
    const today = new Date();
    switch (period) {
      case 'day':
        const nextDay = addDays(selectedDate, 1);
        if (nextDay <= today) setSelectedDate(nextDay);
        break;
      case 'week':
        const nextWeek = addWeeks(selectedDate, 1);
        if (startOfWeek(nextWeek) <= today) setSelectedDate(nextWeek);
        break;
      case 'month':
        const nextMonth = addMonths(selectedDate, 1);
        if (startOfMonth(nextMonth) <= today) setSelectedDate(nextMonth);
        break;
    }
  };

  const canNavigateNext = () => {
    const today = new Date();
    switch (period) {
      case 'day':
        return addDays(selectedDate, 1) <= today;
      case 'week':
        return startOfWeek(addWeeks(selectedDate, 1)) <= today;
      case 'month':
        return startOfMonth(addMonths(selectedDate, 1)) <= today;
    }
  };

  const canNavigatePrevious = () => {
    switch (period) {
      case 'day':
        return subDays(selectedDate, 1) >= DATA_START_DATE;
      case 'week':
        return endOfWeek(subWeeks(selectedDate, 1)) >= DATA_START_DATE;
      case 'month':
        return endOfMonth(subMonths(selectedDate, 1)) >= DATA_START_DATE;
    }
  };

  // Group records by agent for week/month view
  const groupedByAgent = React.useMemo(() => {
    if (!attendanceRecords || period === 'day') return null;

    const grouped = new Map<string, typeof attendanceRecords>();
    attendanceRecords.forEach(record => {
      const existing = grouped.get(record.agentId) || [];
      existing.push(record);
      grouped.set(record.agentId, existing);
    });

    return Array.from(grouped.entries()).map(([agentId, records]) => ({
      agentId,
      agentName: records[0]?.agentName || 'Unknown',
      records,
      totalDays: records.length,
      lateDays: records.filter(r => r.isLate).length,
      totalWorkMinutes: records.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0),
    }));
  }, [attendanceRecords, period]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Agent Attendance Overview
          </CardTitle>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period Toggle */}
            <ToggleGroup 
              type="single" 
              value={period} 
              onValueChange={(v) => v && setPeriod(v as AttendancePeriod)}
              className="border rounded-md"
            >
              <ToggleGroupItem value="day" size="sm">Day</ToggleGroupItem>
              <ToggleGroupItem value="week" size="sm">Week</ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm">Month</ToggleGroupItem>
            </ToggleGroup>

            {/* Date Navigation */}
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={navigatePrevious}
                disabled={!canNavigatePrevious()}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 min-w-[180px]">
                    <CalendarDays className="w-4 h-4" />
                    {getDateRangeLabel()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={(date) => date > new Date() || date < DATA_START_DATE}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={navigateNext}
                disabled={!canNavigateNext()}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : attendanceRecords && attendanceRecords.length > 0 ? (
          period === 'day' ? (
            // Daily View - Simple table
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <LogIn className="w-4 h-4" /> First Login
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <LogOut className="w-4 h-4" /> Last Logout
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4" /> Work Time
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record, idx) => (
                    <TableRow key={`${record.agentId}-${record.date}-${idx}`}>
                      <TableCell className="font-medium">{record.agentName}</TableCell>
                      <TableCell className="text-center font-mono">
                        {formatTime(record.firstLogin)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {formatTime(record.lastLogout)}
                      </TableCell>
                      <TableCell className="text-center">
                        {formatWorkDuration(record.totalWorkMinutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.isLate ? (
                          <Badge variant="destructive" className="text-xs">Late</Badge>
                        ) : record.status === 'present' ? (
                          <Badge className="bg-emerald-600 text-white text-xs">Present</Badge>
                        ) : record.status ? (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {record.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">—</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            // Week/Month View - Grouped by agent with summary
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Days Present</TableHead>
                    <TableHead className="text-center">Late Days</TableHead>
                    <TableHead className="text-center">Total Work Time</TableHead>
                    <TableHead className="text-center">Avg. First Login</TableHead>
                    <TableHead className="text-center">Avg. Last Logout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedByAgent?.map((agent) => {
                    // Calculate average login/logout times
                    const loginTimes = agent.records
                      .filter(r => r.firstLogin)
                      .map(r => new Date(r.firstLogin!).getTime());
                    const logoutTimes = agent.records
                      .filter(r => r.lastLogout)
                      .map(r => new Date(r.lastLogout!).getTime());

                    const avgLoginTime = loginTimes.length > 0 
                      ? new Date(loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length)
                      : null;
                    const avgLogoutTime = logoutTimes.length > 0
                      ? new Date(logoutTimes.reduce((a, b) => a + b, 0) / logoutTimes.length)
                      : null;

                    return (
                      <TableRow key={agent.agentId}>
                        <TableCell className="font-medium">{agent.agentName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{agent.totalDays}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {agent.lateDays > 0 ? (
                            <Badge variant="destructive">{agent.lateDays}</Badge>
                          ) : (
                            <Badge className="bg-emerald-600 text-white">0</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {formatWorkDuration(agent.totalWorkMinutes)}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {avgLoginTime ? format(avgLoginTime, 'hh:mm a') : '—'}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {avgLogoutTime ? format(avgLogoutTime, 'hh:mm a') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No attendance records found for this period</p>
            <p className="text-sm mt-1">Data available from Feb 4, 2025</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
