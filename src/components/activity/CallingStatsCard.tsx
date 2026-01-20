import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Phone, List, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallingStatsCardProps {
  stats: {
    totalCallingMinutes: number;
    callListMovementMinutes: number;
    callListMovementPercentage: number;
    isCallListMovementOverCap: boolean;
  };
  isLoading?: boolean;
}

export const CallingStatsCard: React.FC<CallingStatsCardProps> = ({
  stats,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Calling Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Calling Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Calling Time */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Total Calling Time
          </span>
          <span className="text-xl font-bold">
            {formatTime(stats.totalCallingMinutes)}
          </span>
        </div>

        {/* Call List Movement Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <List className="w-4 h-4" />
              Call List Movement
            </span>
            <span className="font-medium">
              {formatTime(stats.callListMovementMinutes)}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">% of Calling Time</span>
              <span className={cn(
                "font-medium",
                stats.isCallListMovementOverCap ? "text-red-500" : "text-green-500"
              )}>
                {stats.callListMovementPercentage.toFixed(1)}% / 15%
              </span>
            </div>
            <Progress 
              value={Math.min(100, (stats.callListMovementPercentage / 15) * 100)} 
              className={cn(
                "h-2",
                stats.isCallListMovementOverCap && "[&>div]:bg-red-500"
              )}
            />
          </div>

          {stats.isCallListMovementOverCap && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Call List Movement exceeds 15% cap. Supervisor has been notified.
              </span>
            </div>
          )}
        </div>

        {/* Info note */}
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          💡 All calling activities (Tele Calling, Cold Calling, Call List Movement) 
          are counted as Calling for KPIs and scoring.
        </p>
      </CardContent>
    </Card>
  );
};
