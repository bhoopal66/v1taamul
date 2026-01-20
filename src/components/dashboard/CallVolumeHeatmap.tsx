import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HeatmapData } from '@/hooks/useDashboardWidgets';

interface CallVolumeHeatmapProps {
  data: HeatmapData[];
  isLoading: boolean;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export const CallVolumeHeatmap = ({ data, isLoading }: CallVolumeHeatmapProps) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = value / maxValue;
    if (intensity > 0.75) return 'bg-primary text-primary-foreground';
    if (intensity > 0.5) return 'bg-primary/75 text-primary-foreground';
    if (intensity > 0.25) return 'bg-primary/50 text-foreground';
    return 'bg-primary/25 text-foreground';
  };

  const getValue = (day: number, hour: number) => {
    const cell = data.find(d => d.day === day && d.hour === hour);
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
  const grandTotal = data.reduce((sum, d) => sum + d.value, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Volume Heatmap</CardTitle>
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
        <CardTitle className="text-base font-medium">Call Volume Heatmap</CardTitle>
        <CardDescription>Calls by day and hour (last 30 days) • Total: {grandTotal}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-12" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground font-medium">
                  {hour > 12 ? `${hour - 12}p` : `${hour}a`}
                </div>
              ))}
              <div className="w-12 text-center text-xs text-muted-foreground font-semibold">Total</div>
            </div>
            
            {/* Heatmap grid */}
            {days.map((day, dayIndex) => {
              const dayTotal = getDayTotal(dayIndex);
              return (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <div className="w-12 text-xs text-muted-foreground font-medium">{day}</div>
                  {hours.map(hour => {
                    const value = getValue(dayIndex, hour);
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className={`flex-1 h-7 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center`}
                        title={`${day} ${hour}:00 - ${value} calls`}
                      >
                        <span className="text-[10px] font-medium">
                          {value > 0 ? value : ''}
                        </span>
                      </div>
                    );
                  })}
                  <div className="w-12 h-7 rounded-sm bg-accent/50 flex items-center justify-center">
                    <span className="text-xs font-semibold text-foreground">{dayTotal}</span>
                  </div>
                </div>
              );
            })}

            {/* Hour totals row */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
              <div className="w-12 text-xs text-muted-foreground font-semibold">Total</div>
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
              <div className="w-12 h-7 rounded-sm bg-primary/20 flex items-center justify-center">
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
      </CardContent>
    </Card>
  );
};
