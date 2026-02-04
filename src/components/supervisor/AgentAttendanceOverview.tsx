import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAgentAttendanceOverview, AttendancePeriod } from '@/hooks/useAgentAttendanceOverview';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Users, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, isSaturday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AgentAttendanceOverviewProps {
  teamId?: string;
}

// Data starts from Feb 4, 2025
const DATA_START_DATE = new Date('2025-02-04');

// Work hours configuration
const WORK_HOURS = {
  weekday: { start: '10:00 AM', end: '07:00 PM', startHour: 10, endHour: 19 },
  saturday: { start: '10:00 AM', end: '02:00 PM', startHour: 10, endHour: 14 },
};

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

  const getExpectedWorkHours = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayOfWeek = getDay(date);
    
    // Sunday = 0, skip Sundays (no work)
    if (dayOfWeek === 0) {
      return { start: 'Off', end: 'Off', expectedMinutes: 0, isWorkDay: false };
    }
    
    // Saturday = 6: 10 AM to 2 PM (4 hours)
    if (dayOfWeek === 6) {
      return { 
        start: WORK_HOURS.saturday.start, 
        end: WORK_HOURS.saturday.end, 
        expectedMinutes: 4 * 60,
        isWorkDay: true 
      };
    }
    
    // Weekdays (Mon-Fri): 10 AM to 7 PM (9 hours)
    return { 
      start: WORK_HOURS.weekday.start, 
      end: WORK_HOURS.weekday.end, 
      expectedMinutes: 9 * 60,
      isWorkDay: true 
    };
  };

  const exportToCSV = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      toast.error('No data to export');
      return;
    }

    if (period === 'day') {
      // Daily export
      const headers = ['Agent', 'Date', 'First Login', 'Last Logout', 'Work Time', 'Status'];
      const rows = attendanceRecords.map(record => [
        record.agentName,
        format(new Date(record.date), 'yyyy-MM-dd'),
        record.firstLogin ? format(new Date(record.firstLogin), 'HH:mm:ss') : '',
        record.lastLogout ? format(new Date(record.lastLogout), 'HH:mm:ss') : '',
        record.totalWorkMinutes ? `${Math.floor(record.totalWorkMinutes / 60)}h ${Math.round(record.totalWorkMinutes % 60)}m` : '',
        record.isLate ? 'Late' : (record.status || 'Present'),
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      downloadCSV(csvContent, `attendance-daily-${format(selectedDate, 'yyyy-MM-dd')}.csv`);
    } else {
      // Week/Month summary export
      if (!groupedByAgent) return;

      const headers = ['Agent', 'Days Present', 'Late Days', 'Total Work Time', 'Avg Login', 'Avg Logout'];
      const rows = groupedByAgent.map(agent => {
        const loginTimes = agent.records.filter(r => r.firstLogin).map(r => new Date(r.firstLogin!).getTime());
        const logoutTimes = agent.records.filter(r => r.lastLogout).map(r => new Date(r.lastLogout!).getTime());
        const avgLogin = loginTimes.length > 0 ? new Date(loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length) : null;
        const avgLogout = logoutTimes.length > 0 ? new Date(logoutTimes.reduce((a, b) => a + b, 0) / logoutTimes.length) : null;

        return [
          agent.agentName,
          agent.totalDays.toString(),
          agent.lateDays.toString(),
          `${Math.floor(agent.totalWorkMinutes / 60)}h ${Math.round(agent.totalWorkMinutes % 60)}m`,
          avgLogin ? format(avgLogin, 'HH:mm') : '',
          avgLogout ? format(avgLogout, 'HH:mm') : '',
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      downloadCSV(csvContent, `attendance-${period}-${getDateRangeLabel().replace(/[^a-zA-Z0-9]/g, '-')}.csv`);
    }
    toast.success('Attendance exported to CSV');
  };

  const exportDetailedCSV = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Detailed export with expected work hours
    const headers = [
      'Agent Name',
      'Date',
      'Day',
      'Expected Start',
      'Expected End',
      'Expected Hours',
      'Actual First Login',
      'Actual Last Logout',
      'Actual Work Time',
      'Difference (mins)',
      'Status',
      'Is Late',
      'Late By (mins)',
      'Remarks'
    ];

    const rows = attendanceRecords.map(record => {
      const recordDate = new Date(record.date);
      const dayName = format(recordDate, 'EEEE');
      const workHours = getExpectedWorkHours(record.date);
      
      const actualMinutes = record.totalWorkMinutes || 0;
      const differenceMinutes = actualMinutes - workHours.expectedMinutes;
      
      let remarks = '';
      if (!workHours.isWorkDay) {
        remarks = 'Non-working day (Sunday)';
      } else if (!record.firstLogin) {
        remarks = 'Absent / No login recorded';
      } else if (differenceMinutes < -30) {
        remarks = 'Undertime';
      } else if (differenceMinutes > 30) {
        remarks = 'Overtime';
      } else {
        remarks = 'On time';
      }

      return [
        `"${record.agentName}"`,
        format(recordDate, 'yyyy-MM-dd'),
        dayName,
        workHours.start,
        workHours.end,
        workHours.isWorkDay ? `${workHours.expectedMinutes / 60}h` : 'Off',
        record.firstLogin ? format(new Date(record.firstLogin), 'hh:mm:ss a') : 'No Login',
        record.lastLogout ? format(new Date(record.lastLogout), 'hh:mm:ss a') : 'No Logout',
        actualMinutes > 0 ? `${Math.floor(actualMinutes / 60)}h ${Math.round(actualMinutes % 60)}m` : '0h 0m',
        workHours.isWorkDay ? differenceMinutes.toString() : 'N/A',
        record.status || 'Unknown',
        record.isLate ? 'Yes' : 'No',
        record.isLate && record.firstLogin ? 
          Math.round((new Date(record.firstLogin).getHours() * 60 + new Date(record.firstLogin).getMinutes()) - (10 * 60)).toString() : 
          '0',
        `"${remarks}"`
      ];
    });

    // Add summary section
    const summaryRows: string[][] = [];
    summaryRows.push([]);
    summaryRows.push(['--- SUMMARY ---']);
    summaryRows.push(['Total Records', attendanceRecords.length.toString()]);
    summaryRows.push(['Total Late Days', attendanceRecords.filter(r => r.isLate).length.toString()]);
    
    const totalWorkedMinutes = attendanceRecords.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0);
    summaryRows.push(['Total Work Time', `${Math.floor(totalWorkedMinutes / 60)}h ${Math.round(totalWorkedMinutes % 60)}m`]);
    
    summaryRows.push([]);
    summaryRows.push(['Work Hours Schedule:']);
    summaryRows.push(['Sunday', 'Off']);
    summaryRows.push(['Monday - Friday', '10:00 AM - 7:00 PM (9 hours)']);
    summaryRows.push(['Saturday', '10:00 AM - 2:00 PM (4 hours)']);

    const csvContent = [
      headers.join(','), 
      ...rows.map(row => row.join(',')),
      ...summaryRows.map(row => row.join(','))
    ].join('\n');
    
    const filename = period === 'day' 
      ? `attendance-detailed-${format(selectedDate, 'yyyy-MM-dd')}.csv`
      : `attendance-detailed-${period}-${getDateRangeLabel().replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    
    downloadCSV(csvContent, filename);
    toast.success('Detailed attendance exported to CSV');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Agent Attendance Overview
          </CardTitle>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Download Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Quick Export (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportDetailedCSV} className="gap-2">
                  <FileText className="w-4 h-4" />
                  Detailed Export (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
