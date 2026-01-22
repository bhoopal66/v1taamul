import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, getDay, getHours, format, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface SupervisorCallVolumeHeatmapProps {
  teamId?: string;
}

interface HeatmapData {
  day: number;
  hour: number;
  value: number;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export const SupervisorCallVolumeHeatmap = ({ teamId }: SupervisorCallVolumeHeatmapProps) => {
  const { user, userRole, ledTeamId } = useAuth();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || ledTeamId;

  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: ['supervisor-call-heatmap', user?.id, effectiveTeamId, canSeeAllData, dateRange?.from, dateRange?.to],
    queryFn: async (): Promise<HeatmapData[]> => {
      const startDate = dateRange?.from ? startOfDay(dateRange.from) : subDays(new Date(), 30);
      const endDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();
      
      // Get agent IDs for team filtering
      let agentIds: string[] | null = null;
      
      if (!canSeeAllData && effectiveTeamId) {
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        agentIds = teamMembers?.map(p => p.id) || [];
      } else if (!canSeeAllData && user?.id) {
        // Supervisor without team - get directly supervised agents
        const { data: supervised } = await supabase
          .from('profiles')
          .select('id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        agentIds = supervised?.map(p => p.id) || [];
      }

      let query = supabase
        .from('call_feedback')
        .select('call_timestamp')
        .gte('call_timestamp', startDate.toISOString())
        .lte('call_timestamp', endDate.toISOString());

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
    enabled: !!user?.id,
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

  // Calculate row totals (per day)
  const getDayTotal = (day: number) => {
    return hours.reduce((sum, hour) => sum + getValue(day, hour), 0);
  };

  // Calculate column totals (per hour)
  const getHourTotal = (hour: number) => {
    return days.reduce((sum, _, dayIndex) => sum + getValue(dayIndex, hour), 0);
  };

  // Calculate grand total
  const grandTotal = heatmapData.reduce((sum, d) => sum + d.value, 0);

  // Format date range for display
  const getDateRangeText = () => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    if (dateRange?.from) {
      return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Volume Heatmap</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold">Call Volume Heatmap</CardTitle>
            <CardDescription>Team calls by day and hour • Total: {grandTotal}</CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-14" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground font-medium">
                  {hour > 12 ? `${hour - 12}p` : `${hour}a`}
                </div>
              ))}
              <div className="w-14 text-center text-xs text-muted-foreground font-semibold">Total</div>
            </div>
            
            {/* Heatmap grid */}
            {days.map((day, dayIndex) => {
              const dayTotal = getDayTotal(dayIndex);
              return (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <div className="w-14 text-xs text-muted-foreground font-medium">{day}</div>
                  {hours.map(hour => {
                    const value = getValue(dayIndex, hour);
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className={`flex-1 h-8 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center`}
                        title={`${day} ${hour}:00 - ${value} calls`}
                      >
                        <span className="text-[11px] font-medium">
                          {value > 0 ? value : ''}
                        </span>
                      </div>
                    );
                  })}
                  <div className="w-14 h-8 rounded-sm bg-accent/50 flex items-center justify-center">
                    <span className="text-xs font-semibold text-foreground">{dayTotal}</span>
                  </div>
                </div>
              );
            })}

            {/* Hour totals row */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
              <div className="w-14 text-xs text-muted-foreground font-semibold">Total</div>
              {hours.map(hour => {
                const hourTotal = getHourTotal(hour);
                return (
                  <div
                    key={`total-${hour}`}
                    className="flex-1 h-8 rounded-sm bg-accent/50 flex items-center justify-center"
                  >
                    <span className="text-[11px] font-semibold text-foreground">{hourTotal}</span>
                  </div>
                );
              })}
              <div className="w-14 h-8 rounded-sm bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{grandTotal}</span>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-5 h-5 rounded-sm bg-muted" />
                <div className="w-5 h-5 rounded-sm bg-primary/25" />
                <div className="w-5 h-5 rounded-sm bg-primary/50" />
                <div className="w-5 h-5 rounded-sm bg-primary/75" />
                <div className="w-5 h-5 rounded-sm bg-primary" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
