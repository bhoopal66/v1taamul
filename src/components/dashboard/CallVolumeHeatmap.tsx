import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDay, getHours, format, startOfDay, endOfDay, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarIcon, ChevronLeft, CalendarRange, Calendar as CalendarWeekIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface HeatmapData {
  day: number;
  hour: number;
  value: number;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
const todayIndex = getDay(new Date()); // Get today's day index (0-6)

type FilterMode = 'single' | 'range' | 'week';

export const CallVolumeHeatmap = () => {
  const { user, userRole, ledTeamId, profile } = useAuth();

  // Draft filter state (user inputs)
  const [filterMode, setFilterMode] = useState<FilterMode | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0); // 0 = this week, 1 = last week, etc.

  // Agent filter state
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  // Applied filter state (data fetch)
  const [appliedMode, setAppliedMode] = useState<FilterMode | null>(null);
  const [appliedSingleDate, setAppliedSingleDate] = useState<Date | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState<Date | null>(null);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | null>(null);
  const [appliedAgentId, setAppliedAgentId] = useState<string>('all');

  // Calculate week dates based on offset
  const getWeekDates = (offset: number) => {
    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, offset), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(subWeeks(now, offset), { weekStartsOn: 0 });
    return { weekStart, weekEnd };
  };

  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = ledTeamId || (userRole === 'supervisor' ? profile?.team_id : null);

  // Fetch agents for dropdown
  const { data: agents = [] } = useQuery({
    queryKey: ['heatmap-agents', effectiveTeamId, canSeeAllData, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('is_active', true)
        .order('full_name');

      if (!canSeeAllData) {
        if (effectiveTeamId) {
          query = query.eq('team_id', effectiveTeamId);
        } else if (user?.id) {
          query = query.eq('supervisor_id', user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const canApplyFilter = useCallback(() => {
    if (filterMode === 'single') return !!selectedDate;
    if (filterMode === 'range') return !!startDate && !!endDate;
    if (filterMode === 'week') return true; // Week is always valid
    return false;
  }, [filterMode, selectedDate, startDate, endDate]);

  const hasAppliedFilter = useMemo(() => {
    if (appliedMode === 'single') return !!appliedSingleDate;
    if (appliedMode === 'range') return !!appliedStartDate && !!appliedEndDate;
    if (appliedMode === 'week') return !!appliedStartDate && !!appliedEndDate;
    return false;
  }, [appliedMode, appliedSingleDate, appliedStartDate, appliedEndDate]);

  const getAppliedDateLabel = useCallback(() => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return format(appliedSingleDate, 'MMM d, yyyy');
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    if (appliedMode === 'week' && appliedStartDate && appliedEndDate) {
      return `Week: ${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    return null;
  }, [appliedMode, appliedSingleDate, appliedStartDate, appliedEndDate]);

  const handleApply = useCallback(() => {
    if (!canApplyFilter() || !filterMode) return;

    setAppliedMode(filterMode);

    if (filterMode === 'single') {
      setAppliedSingleDate(selectedDate);
      setAppliedStartDate(null);
      setAppliedEndDate(null);
    } else if (filterMode === 'range') {
      setAppliedSingleDate(null);
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
    } else if (filterMode === 'week') {
      const { weekStart, weekEnd } = getWeekDates(selectedWeekOffset);
      setAppliedSingleDate(null);
      setAppliedStartDate(weekStart);
      setAppliedEndDate(weekEnd);
    }
    setAppliedAgentId(selectedAgentId);
  }, [canApplyFilter, endDate, filterMode, selectedDate, startDate, selectedWeekOffset, selectedAgentId]);

  const handleClearAll = useCallback(() => {
    setFilterMode(null);
    setSelectedDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedWeekOffset(0);
    setSelectedAgentId('all');

    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setAppliedAgentId('all');
  }, []);

  const handleChangeFilterType = useCallback(() => {
    setFilterMode(null);
    setSelectedDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedWeekOffset(0);
  }, []);

  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: [
      'call-heatmap',
      user?.id,
      effectiveTeamId,
      canSeeAllData,
      appliedMode,
      appliedSingleDate?.toISOString(),
      appliedStartDate?.toISOString(),
      appliedEndDate?.toISOString(),
      appliedAgentId,
    ],
    queryFn: async (): Promise<HeatmapData[]> => {
      if (!hasAppliedFilter) return [];

      const rangeStart =
        appliedMode === 'single' && appliedSingleDate
          ? appliedSingleDate
          : (appliedMode === 'range' || appliedMode === 'week') && appliedStartDate
            ? appliedStartDate
            : null;
      const rangeEnd =
        appliedMode === 'single' && appliedSingleDate
          ? appliedSingleDate
          : (appliedMode === 'range' || appliedMode === 'week') && appliedEndDate
            ? appliedEndDate
            : null;

      if (!rangeStart || !rangeEnd) return [];
      
      // For week mode, use the already calculated week dates
      const queryStartDate = startOfDay(rangeStart);
      const queryEndDate = endOfDay(rangeEnd);
      
      console.log('[Heatmap] Query range:', {
        mode: appliedMode,
        start: queryStartDate.toISOString(),
        end: queryEndDate.toISOString(),
      });

      // Get agent IDs for team filtering
      let agentIds: string[] | null = null;

      if (!canSeeAllData) {
        if (appliedAgentId !== 'all') {
          agentIds = [appliedAgentId];
        } else if (effectiveTeamId) {
          const { data } = await supabase
            .from('profiles_public')
            .select('id')
            .eq('team_id', effectiveTeamId)
            .eq('is_active', true);
          agentIds = data?.map(p => p.id) || [];
        } else if (user?.id) {
          const { data } = await supabase
            .from('profiles_public')
            .select('id')
            .eq('supervisor_id', user.id)
            .eq('is_active', true);
          agentIds = data?.map(p => p.id) || [];
        } else {
          agentIds = [];
        }
      } else if (appliedAgentId !== 'all') {
        // Global access but specific agent selected
        agentIds = [appliedAgentId];
      }

      let query = supabase
        .from('call_feedback')
        .select('call_timestamp')
        .gte('call_timestamp', queryStartDate.toISOString())
        .lte('call_timestamp', queryEndDate.toISOString());

      if (agentIds !== null && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;

      // Initialize heatmap grid
      const heatmap: Map<string, number> = new Map();
      for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 20; hour++) {
          heatmap.set(`${day}-${hour}`, 0);
        }
      }

      // Aggregate calls by day and hour
      data?.forEach(call => {
        if (call.call_timestamp) {
          const date = new Date(call.call_timestamp);
          const day = getDay(date);
          const hour = getHours(date);
          if (hour >= 8 && hour <= 20) {
            const key = `${day}-${hour}`;
            heatmap.set(key, (heatmap.get(key) || 0) + 1);
          }
        }
      });

      return Array.from(heatmap.entries()).map(([key, value]) => {
        const [day, hour] = key.split('-').map(Number);
        return { day, hour, value };
      });
    },
    enabled: !!user?.id && hasAppliedFilter,
  });

  const maxValue = Math.max(...heatmapData.map(d => d.value), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = value / maxValue;
    if (intensity > 0.75) return 'bg-primary text-primary-foreground';
    if (intensity > 0.5) return 'bg-primary/75 text-primary-foreground';
    if (intensity > 0.25) return 'bg-primary/50 text-foreground';
    return 'bg-primary/25 text-foreground';
  };

  const getValue = (day: number, hour: number) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  const getDayTotal = (day: number) => {
    return hours.reduce((sum, hour) => sum + getValue(day, hour), 0);
  };

  const getHourTotal = (hour: number) => {
    return days.reduce((sum, _, dayIndex) => sum + getValue(dayIndex, hour), 0);
  };

  const grandTotal = heatmapData.reduce((sum, d) => sum + d.value, 0);
  const appliedDateLabel = getAppliedDateLabel();

  // Generate day labels with dates based on applied filter
  const dayLabels = useMemo(() => {
    if (!hasAppliedFilter || !appliedStartDate || !appliedEndDate) {
      return days.map((day, i) => ({ dayIndex: i, dayName: day, dateLabel: '' }));
    }

    if (appliedMode === 'single' && appliedSingleDate) {
      const dayIndex = getDay(appliedSingleDate);
      return days.map((day, i) => ({
        dayIndex: i,
        dayName: day,
        dateLabel: i === dayIndex ? format(appliedSingleDate, 'dd MMM') : '',
      }));
    }

    // For week or range: show dates for each day
    const daysInRange = eachDayOfInterval({ start: appliedStartDate, end: appliedEndDate });
    const dateMap = new Map<number, string[]>();
    
    daysInRange.forEach(date => {
      const dayIdx = getDay(date);
      if (!dateMap.has(dayIdx)) {
        dateMap.set(dayIdx, []);
      }
      dateMap.get(dayIdx)!.push(format(date, 'd MMM'));
    });

    return days.map((day, i) => ({
      dayIndex: i,
      dayName: day,
      dateLabel: dateMap.get(i)?.join(', ') || '',
    }));
  }, [hasAppliedFilter, appliedMode, appliedSingleDate, appliedStartDate, appliedEndDate]);

  // Export to Excel handler
  const exportToExcel = useCallback(() => {
    if (heatmapData.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Create header row with hours
    const headerRow = ['Day', ...hours.map(h => h > 12 ? `${h - 12} PM` : `${h} AM`), 'Total'];

    // Create data rows for each day
    const dataRows = dayLabels.map((dl) => {
      const dayValues = hours.map(hour => getValue(dl.dayIndex, hour));
      const dayTotal = dayValues.reduce((sum, v) => sum + v, 0);
      const label = dl.dateLabel ? `${dl.dayName} (${dl.dateLabel})` : dl.dayName;
      return [label, ...dayValues, dayTotal];
    });

    // Create totals row
    const hourTotals = hours.map(hour => getHourTotal(hour));
    const totalsRow = ['Total', ...hourTotals, grandTotal];

    // Combine all rows
    const exportData = [headerRow, ...dataRows, totalsRow];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 16 }, // Day column (wider for dates)
      ...hours.map(() => ({ wch: 6 })), // Hour columns
      { wch: 8 }, // Total column
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Call Heatmap');

    // Generate filename with date range
    const dateLabel = appliedDateLabel?.replace(/[,\s]+/g, '_') || new Date().toISOString().split('T')[0];
    const filename = `call_heatmap_${dateLabel}.xlsx`;

    XLSX.writeFile(wb, filename);
    toast.success('Heatmap exported to Excel');
  }, [heatmapData, appliedDateLabel, grandTotal, dayLabels]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Call Volume Heatmap</CardTitle>
          {hasAppliedFilter && heatmapData.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          )}
        </div>
        <CardDescription>
          Calls by day and hour • Total: {grandTotal}
          {appliedDateLabel ? ` • ${appliedDateLabel}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Choose filter mode (NO CALENDAR on initial load) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-sm font-semibold">Select Date Filter Type</h3>
            
            {/* Agent Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Agent:</span>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filterMode === null && (
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-center py-6">
              <Button
                variant="outline"
                onClick={() => setFilterMode('single')}
                className={cn(
                  'h-auto px-8 py-5 text-sm font-medium border-2 transition-all',
                  'hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Pick a Single Day
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilterMode('range')}
                className={cn(
                  'h-auto px-8 py-5 text-sm font-medium border-2 transition-all',
                  'hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5'
                )}
              >
                <CalendarRange className="mr-2 h-4 w-4" />
                Select Date Range (From - To)
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilterMode('week')}
                className={cn(
                  'h-auto px-8 py-5 text-sm font-medium border-2 transition-all',
                  'hover:bg-primary hover:text-primary-foreground hover:-translate-y-0.5'
                )}
              >
                <CalendarWeekIcon className="mr-2 h-4 w-4" />
                Filter by Week
              </Button>
            </div>
          )}

          {/* Step 2a: Single date */}
          {filterMode === 'single' && (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeFilterType}
                className="w-fit gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Change Filter Type
              </Button>

              <div className="space-y-2">
                <p className="text-sm font-medium">Select a Single Date:</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP') : 'Click here to select a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="single"
                      selected={selectedDate ?? undefined}
                      onSelect={(d) => setSelectedDate(d ?? null)}
                      disabled={(date) => date > new Date()}
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedDate && (
                <div className="rounded-md border border-border bg-accent/30 p-3 text-sm text-foreground">
                  Selected: {selectedDate.toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Step 2b: Range (From / To) */}
          {filterMode === 'range' && (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeFilterType}
                className="w-fit gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Change Filter Type
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">From Date:</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Select start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="single"
                        selected={startDate ?? undefined}
                        onSelect={(d) => {
                          const next = d ?? null;
                          setStartDate(next);
                          if (next && endDate && endDate < next) {
                            setEndDate(null);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">To Date:</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!startDate}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Select end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="single"
                        selected={endDate ?? undefined}
                        onSelect={(d) => setEndDate(d ?? null)}
                        disabled={(date) => {
                          if (date > new Date()) return true;
                          if (startDate && date < startDate) return true;
                          return false;
                        }}
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  {!startDate && (
                    <p className="text-xs text-muted-foreground">Please select From Date first</p>
                  )}
                </div>
              </div>

              {startDate && endDate && (
                <div className="rounded-md border border-border bg-accent/30 p-3 text-sm text-foreground">
                  Selected Range: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {/* Step 2c: Week filter */}
          {filterMode === 'week' && (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeFilterType}
                className="w-fit gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Change Filter Type
              </Button>

              <div className="space-y-2">
                <p className="text-sm font-medium">Select a Week:</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((offset) => {
                    const { weekStart, weekEnd } = getWeekDates(offset);
                    const label = offset === 0 
                      ? 'This Week' 
                      : offset === 1 
                        ? 'Last Week' 
                        : `${offset} Weeks Ago`;
                    return (
                      <Button
                        key={offset}
                        variant={selectedWeekOffset === offset ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedWeekOffset(offset)}
                        className="text-xs"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-border bg-accent/30 p-3 text-sm text-foreground">
                {(() => {
                  const { weekStart, weekEnd } = getWeekDates(selectedWeekOffset);
                  return `Selected: ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
                })()}
              </div>
            </div>
          )}

          {/* Step 3: Apply / Clear */}
          {filterMode !== null && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleApply} disabled={!canApplyFilter()} className="sm:w-auto">
                Apply Filter & Show Data
              </Button>
              <Button variant="outline" onClick={handleClearAll} className="sm:w-auto">
                Clear All & Start Over
              </Button>
            </div>
          )}
        </div>

        {/* Heatmap only shows after Apply */}
        {hasAppliedFilter && (
          isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-24" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground font-medium">
                  {hour > 12 ? `${hour - 12}p` : `${hour}a`}
                </div>
              ))}
              <div className="w-14 text-center text-xs text-muted-foreground font-semibold">Total</div>
            </div>
            
            {/* Heatmap grid */}
            {dayLabels.map((dl) => {
              const dayTotal = getDayTotal(dl.dayIndex);
              const isToday = dl.dayIndex === todayIndex;
              return (
                <div key={dl.dayIndex} className={cn("flex items-center gap-1 mb-1", isToday && "bg-accent/30 rounded-md -mx-1 px-1")}>
                  <div className={cn("w-24 text-xs font-medium", isToday ? "text-primary font-semibold" : "text-muted-foreground")}>
                    <span>{dl.dayName}{isToday && " •"}</span>
                    {dl.dateLabel && (
                      <span className="ml-1 text-[10px] text-muted-foreground/70">({dl.dateLabel})</span>
                    )}
                  </div>
                  {hours.map(hour => {
                    const value = getValue(dl.dayIndex, hour);
                    return (
                      <div
                        key={`${dl.dayIndex}-${hour}`}
                        className={`flex-1 h-7 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center`}
                        title={`${dl.dayName}${dl.dateLabel ? ` (${dl.dateLabel})` : ''} ${hour}:00 - ${value} calls`}
                      >
                        <span className="text-[10px] font-medium">
                          {value > 0 ? value : ''}
                        </span>
                      </div>
                    );
                  })}
                  <div className="w-14 h-7 rounded-sm bg-accent/50 flex items-center justify-center">
                    <span className="text-xs font-semibold text-foreground">{dayTotal}</span>
                  </div>
                </div>
              );
            })}

            {/* Hour totals row */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
              <div className="w-24 text-xs text-muted-foreground font-semibold">Total</div>
              {hours.map(hour => {
                const hourTotal = getHourTotal(hour);
                return (
                  <div
                    key={`total-${hour}`}
                    className="flex-1 h-7 rounded-sm bg-accent/50 flex items-center justify-center"
                  >
                    <span className="text-[10px] font-semibold text-foreground">{hourTotal}</span>
                  </div>
                );
              })}
              <div className="w-14 h-7 rounded-sm bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{grandTotal}</span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm bg-muted" />
                <div className="w-4 h-4 rounded-sm bg-primary/25" />
                <div className="w-4 h-4 rounded-sm bg-primary/50" />
                <div className="w-4 h-4 rounded-sm bg-primary/75" />
                <div className="w-4 h-4 rounded-sm bg-primary" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
          )
        )}
      </CardContent>
    </Card>
  );
};
