import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHourlyCallHeatmap, HeatmapPeriod, HourlyHeatmapCell } from '@/hooks/useHourlyCallHeatmap';
import { Calendar, Grid3X3 } from 'lucide-react';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

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

  const getValue = (day: number, hour: number) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  const totalCalls = heatmapData.reduce((sum, cell) => sum + cell.value, 0);

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
            </div>
            
            {/* Heatmap grid */}
            {days.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-10 text-xs text-muted-foreground font-medium">{day}</div>
                {hours.map(hour => {
                  const value = getValue(dayIndex, hour);
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`flex-1 h-7 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center`}
                      title={`${day} ${hour}:00 - ${value} calls`}
                    >
                      {value > 0 && (
                        <span className="text-[10px] font-medium text-primary-foreground">
                          {value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            
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
