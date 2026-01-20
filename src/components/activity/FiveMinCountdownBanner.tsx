import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FiveMinCountdownBannerProps {
  remainingSeconds: number;
  activityLabel: string;
  totalSeconds?: number;
}

export const FiveMinCountdownBanner: React.FC<FiveMinCountdownBannerProps> = ({
  remainingSeconds,
  activityLabel,
  totalSeconds = 300, // 5 minutes
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progressPercent = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  
  // Determine urgency level
  const isUrgent = remainingSeconds <= 60; // Last minute
  const isCritical = remainingSeconds <= 30; // Last 30 seconds

  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      isCritical 
        ? "border-destructive bg-destructive/10 animate-pulse" 
        : isUrgent 
          ? "border-warning bg-warning/10" 
          : "border-amber-500/50 bg-amber-500/5"
    )}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            "p-3 rounded-full",
            isCritical 
              ? "bg-destructive/20" 
              : isUrgent 
                ? "bg-warning/20" 
                : "bg-amber-500/20"
          )}>
            {isCritical ? (
              <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
            ) : (
              <Clock className={cn(
                "w-6 h-6",
                isUrgent ? "text-warning" : "text-amber-600"
              )} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "font-semibold",
                  isCritical ? "text-destructive" : isUrgent ? "text-warning" : "text-amber-700"
                )}>
                  ⚠️ 5-Minute Auto-Logout Active
                </p>
                <p className="text-sm text-muted-foreground">
                  You will be automatically logged out when the timer ends ({activityLabel})
                </p>
              </div>

              {/* Countdown Timer */}
              <div className={cn(
                "text-3xl font-mono font-bold tabular-nums px-4 py-2 rounded-lg",
                isCritical 
                  ? "bg-destructive text-destructive-foreground" 
                  : isUrgent 
                    ? "bg-warning text-warning-foreground" 
                    : "bg-amber-500 text-white"
              )}>
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
            </div>

            {/* Progress Bar */}
            <Progress 
              value={progressPercent} 
              className={cn(
                "h-2",
                isCritical 
                  ? "[&>div]:bg-destructive" 
                  : isUrgent 
                    ? "[&>div]:bg-warning" 
                    : "[&>div]:bg-amber-500"
              )}
            />

            <p className="text-xs text-muted-foreground text-center">
              {isCritical 
                ? "⚠️ LOGGING OUT SOON - Switch activity to continue working"
                : isUrgent 
                  ? "Less than 1 minute remaining"
                  : "Switch to another activity to cancel auto-logout"
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
