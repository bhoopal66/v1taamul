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
    if (intensity > 0.75) return 'bg-primary';
    if (intensity > 0.5) return 'bg-primary/75';
    if (intensity > 0.25) return 'bg-primary/50';
    return 'bg-primary/25';
  };

  const getValue = (day: number, hour: number) => {
    const cell = data.find(d => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

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
        <CardDescription>Calls by day and hour (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10" />
              {hours.map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                  {hour > 12 ? `${hour - 12}p` : `${hour}a`}
                </div>
              ))}
            </div>
            
            {/* Heatmap grid */}
            {days.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
                {hours.map(hour => {
                  const value = getValue(dayIndex, hour);
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`flex-1 h-6 rounded-sm ${getColor(value)} transition-colors cursor-default`}
                      title={`${day} ${hour}:00 - ${value} calls`}
                    />
                  );
                })}
              </div>
            ))}
            
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
