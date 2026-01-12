import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHourlyCallHeatmap, HeatmapPeriod, HourlyHeatmapCell, CallOutcomeBreakdown } from '@/hooks/useHourlyCallHeatmap';
import { Calendar, Grid3X3, ThumbsUp, ThumbsDown, PhoneMissed, Phone, PhoneOff, Trophy } from 'lucide-react';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

interface HeatmapCellTooltipProps {
  day: string;
  hour: number;
  value: number;
  breakdown: CallOutcomeBreakdown;
  children: React.ReactNode;
}

const HeatmapCellTooltip: React.FC<HeatmapCellTooltipProps> = ({ day, hour, value, breakdown, children }) => {
  const formatHour = (h: number) => {
    if (h === 12) return '12:00 PM';
    return h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="p-3 max-w-[200px]">
        <div className="space-y-2">
          <div className="font-semibold text-sm border-b pb-1">
            {day} at {formatHour(hour)}
          </div>
          <div className="text-sm font-medium">
            Total: {value} calls
          </div>
          {value > 0 && (
            <div className="space-y-1 text-xs">
              {breakdown.interested > 0 && (
                <div className="flex items-center gap-2 text-success">
                  <ThumbsUp className="w-3 h-3" />
                  <span>Interested: {breakdown.interested}</span>
                </div>
              )}
              {breakdown.notInterested > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <ThumbsDown className="w-3 h-3" />
                  <span>Not Interested: {breakdown.notInterested}</span>
                </div>
              )}
              {breakdown.notAnswered > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PhoneMissed className="w-3 h-3" />
                  <span>Not Answered: {breakdown.notAnswered}</span>
                </div>
              )}
              {breakdown.callback > 0 && (
                <div className="flex items-center gap-2 text-warning">
                  <Phone className="w-3 h-3" />
                  <span>Callback: {breakdown.callback}</span>
                </div>
              )}
              {breakdown.wrongNumber > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PhoneOff className="w-3 h-3" />
                  <span>Wrong Number: {breakdown.wrongNumber}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export const HourlyCallHeatmap: React.FC = () => {
  const [period, setPeriod] = useState<HeatmapPeriod>('weekly');
  const { heatmapData, isLoading } = useHourlyCallHeatmap(period);

  const maxValue = Math.max(...heatmapData.map(d => d.value), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = value / maxValue;
    if (intensity > 0.75) return 'bg-primary';
    if (intensity > 0.5) return 'bg-primary/75';
    if (intensity > 0.25) return 'bg-primary/50';
    return 'bg-primary/25';
  };

  const getTextColor = (value: number) => {
    if (value === 0) return '';
    const intensity = value / maxValue;
    if (intensity > 0.5) return 'text-primary-foreground';
    return 'text-primary font-semibold';
  };

  const getCell = (day: number, hour: number): HourlyHeatmapCell | undefined => {
    return heatmapData.find(d => d.day === day && d.hour === hour);
  };

  const totalCalls = heatmapData.reduce((sum, cell) => sum + cell.value, 0);

  const getDayTotal = (dayIndex: number): number => {
    return heatmapData
      .filter(d => d.day === dayIndex)
      .reduce((sum, cell) => sum + cell.value, 0);
  };

  // Find best performing day
  const dayTotals = days.map((_, idx) => getDayTotal(idx));
  const maxDayTotal = Math.max(...dayTotals);
  const bestDayIndex = maxDayTotal > 0 ? dayTotals.indexOf(maxDayTotal) : -1;

  const emptyBreakdown: CallOutcomeBreakdown = {
    interested: 0,
    notInterested: 0,
    notAnswered: 0,
    callback: 0,
    wrongNumber: 0,
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Call Volume Heatmap
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Grid3X3 className="w-5 h-5 text-primary" />
              Call Volume Heatmap
            </CardTitle>
            <CardDescription>
              {totalCalls} calls {period === 'weekly' ? 'this week' : 'this month'}
            </CardDescription>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as HeatmapPeriod)}>
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
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                  {hour > 12 ? `${hour - 12}p` : hour === 12 ? '12p' : `${hour}a`}
                </div>
              ))}
              <div className="w-12 text-center text-xs text-muted-foreground font-medium">Total</div>
            </div>
            
            {/* Heatmap grid */}
            {days.map((day, dayIndex) => {
              const dayTotal = getDayTotal(dayIndex);
              const isBestDay = dayIndex === bestDayIndex && dayTotal > 0;
              return (
                <div key={day} className={`flex items-center gap-1 mb-1 ${isBestDay ? 'relative' : ''}`}>
                  <div className="w-10 text-xs text-muted-foreground font-medium flex items-center gap-1">
                    {isBestDay && <Trophy className="w-3 h-3 text-yellow-500" />}
                    <span className={isBestDay ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : ''}>{day}</span>
                  </div>
                  {hours.map(hour => {
                    const cell = getCell(dayIndex, hour);
                    const value = cell?.value || 0;
                    const breakdown = cell?.breakdown || emptyBreakdown;
                    
                    return (
                      <HeatmapCellTooltip
                        key={`${dayIndex}-${hour}`}
                        day={day}
                        hour={hour}
                        value={value}
                        breakdown={breakdown}
                      >
                        <div
                          className={`flex-1 h-8 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center ${isBestDay ? 'ring-1 ring-yellow-500/30' : ''}`}
                        >
                          <span className={`text-[11px] font-bold ${getTextColor(value)}`}>
                            {value > 0 ? value : ''}
                          </span>
                        </div>
                      </HeatmapCellTooltip>
                    );
                  })}
                  {/* Daily total */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`w-12 h-8 rounded-sm flex items-center justify-center gap-1 ${isBestDay ? 'bg-yellow-500/20 ring-2 ring-yellow-500' : 'bg-secondary'}`}>
                        {isBestDay && <Trophy className="w-3 h-3 text-yellow-500" />}
                        <span className={`text-xs font-bold ${isBestDay ? 'text-yellow-600 dark:text-yellow-400' : 'text-secondary-foreground'}`}>
                          {dayTotal}
                        </span>
                      </div>
                    </TooltipTrigger>
                    {isBestDay && (
                      <TooltipContent side="right">
                        <p className="text-xs font-medium">🏆 Best performing day!</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              );
            })}
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
  );
};
