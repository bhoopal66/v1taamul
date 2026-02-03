import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMyAttendanceHistory, AttendancePeriod, MyAttendanceRecord } from '@/hooks/useMyAttendanceHistory';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

// Data starts from Feb 4, 2025
const DATA_START_DATE = new Date('2025-02-04');

export const MyAttendanceHistory: React.FC = () => {
  const [period, setPeriod] = useState<AttendancePeriod>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: attendanceRecords, isLoading } = useMyAttendanceHistory({
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

  const exportToCSV = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'First Login', 'Last Logout', 'Work Time', 'Status'];
    const rows = attendanceRecords.map(record => [
      format(new Date(record.date), 'yyyy-MM-dd'),
      record.firstLogin ? format(new Date(record.firstLogin), 'HH:mm:ss') : '',
      record.lastLogout ? format(new Date(record.lastLogout), 'HH:mm:ss') : '',
      record.totalWorkMinutes ? `${Math.floor(record.totalWorkMinutes / 60)}h ${Math.round(record.totalWorkMinutes % 60)}m` : '',
      record.isLate ? 'Late' : (record.status || 'Present'),
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-attendance-${getDateRangeLabel().replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance exported to CSV');
  };

  // Calculate summary for week/month view
  const summary = React.useMemo(() => {
    if (!attendanceRecords || period === 'day') return null;
    
    const totalDays = attendanceRecords.length;
    const lateDays = attendanceRecords.filter(r => r.isLate).length;
    const totalWorkMinutes = attendanceRecords.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0);
    
    const loginTimes = attendanceRecords
      .filter(r => r.firstLogin)
      .map(r => new Date(r.firstLogin!).getTime());
    const logoutTimes = attendanceRecords
      .filter(r => r.lastLogout)
      .map(r => new Date(r.lastLogout!).getTime());

    const avgLoginTime = loginTimes.length > 0 
      ? new Date(loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length)
      : null;
    const avgLogoutTime = logoutTimes.length > 0
      ? new Date(logoutTimes.reduce((a, b) => a + b, 0) / logoutTimes.length)
      : null;

    return { totalDays, lateDays, totalWorkMinutes, avgLoginTime, avgLogoutTime };
  }, [attendanceRecords, period]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-primary" />
            My Attendance History
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
                  Download CSV
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
                  <Button variant="outline" size="sm" className="gap-2 min-w-[160px]">
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
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : attendanceRecords && attendanceRecords.length > 0 ? (
          <div className="space-y-4">
            {/* Summary Cards for Week/Month */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{summary.totalDays}</p>
                  <p className="text-xs text-muted-foreground">Days Present</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{summary.lateDays}</p>
                  <p className="text-xs text-muted-foreground">Late Days</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{formatWorkDuration(summary.totalWorkMinutes)}</p>
                  <p className="text-xs text-muted-foreground">Total Work Time</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold font-mono">
                    {summary.avgLoginTime ? format(summary.avgLoginTime, 'hh:mm a') : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Login</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold font-mono">
                    {summary.avgLogoutTime ? format(summary.avgLogoutTime, 'hh:mm a') : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Logout</p>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
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
                    <TableRow key={`${record.date}-${idx}`}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), 'EEE, MMM d')}
                      </TableCell>
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
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No attendance records found for this period</p>
            <p className="text-sm mt-1">Data available from Feb 4, 2025</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
