import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Gauge, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallVelocityGaugeProps {
  currentCallsPerHour: number;
  targetCallsPerHour: number;
  previousCallsPerHour?: number;
  isLoading: boolean;
}

export const CallVelocityGauge: React.FC<CallVelocityGaugeProps> = ({
  currentCallsPerHour,
  targetCallsPerHour,
  previousCallsPerHour,
  isLoading,
}) => {
  const percentage = Math.min((currentCallsPerHour / targetCallsPerHour) * 100, 100);
  const isOnTrack = currentCallsPerHour >= targetCallsPerHour;
  const trend = previousCallsPerHour !== undefined 
    ? currentCallsPerHour - previousCallsPerHour 
    : 0;

  const getVelocityStatus = () => {
    if (percentage >= 100) return { label: 'Excellent', color: 'text-green-500', bg: 'bg-green-500' };
    if (percentage >= 75) return { label: 'Good', color: 'text-blue-500', bg: 'bg-blue-500' };
    if (percentage >= 50) return { label: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { label: 'Low', color: 'text-red-500', bg: 'bg-red-500' };
  };

  const status = getVelocityStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="w-4 h-4 text-primary" />
            Call Velocity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="w-4 h-4 text-primary" />
          Call Velocity
        </CardTitle>
        <CardDescription className="text-xs">
          Calls per hour performance
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Main Gauge Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">{currentCallsPerHour}</span>
            <span className="text-muted-foreground text-sm">/hr</span>
          </div>
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            status.color,
            status.bg + '/10'
          )}>
            {status.label}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress 
            value={percentage} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(percentage)}% of target</span>
            <span>Target: {targetCallsPerHour}/hr</span>
          </div>
        </div>

        {/* Trend Indicator */}
        {previousCallsPerHour !== undefined && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : trend < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-muted-foreground" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {trend > 0 ? '+' : ''}{trend} from last hour
            </span>
          </div>
        )}

        {/* Quick tip */}
        {!isOnTrack && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs">
            <Zap className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">
              Increase your pace to hit your hourly target
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
