import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdleCountdownBannerProps {
  remainingSeconds: number;
  totalSeconds?: number;
  hasActivity?: boolean; // Whether user has an activity selected
}

export const IdleCountdownBanner: React.FC<IdleCountdownBannerProps> = ({
  remainingSeconds,
  totalSeconds = 900, // 15 minutes
  hasActivity = false,
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progressPercent = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  
  // Determine urgency level
  const isUrgent = remainingSeconds <= 120; // Last 2 minutes
  const isCritical = remainingSeconds <= 60; // Last minute

  // Different messaging based on whether activity is selected or not
  const getTitle = () => {
    if (isCritical) return '⚠️ Auto-Logout Imminent!';
    if (isUrgent) return hasActivity ? '⚠️ Confirm Activity Soon' : '⚠️ Select an Activity Soon';
    return hasActivity ? '🕐 Inactivity Warning' : '🕐 Idle - Please Select an Activity';
  };

  const getDescription = () => {
    if (hasActivity) {
      return 'You will be automatically logged out if you don\'t confirm your activity';
    }
    return 'You will be automatically logged out if no activity is selected';
  };

  const getBottomText = () => {
    if (isCritical) {
      return hasActivity 
        ? "⚠️ LOGGING OUT IN LESS THAN 1 MINUTE - Confirm your activity NOW!"
        : "⚠️ LOGGING OUT IN LESS THAN 1 MINUTE - Select an activity NOW!";
    }
    if (isUrgent) {
      return hasActivity
        ? "Less than 2 minutes remaining - confirm activity to continue"
        : "Less than 2 minutes remaining - select an activity to continue";
    }
    return hasActivity
      ? "Confirm your activity when prompted to stay logged in"
      : "Select an activity from the panel to start working";
  };

  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      isCritical 
        ? "border-destructive bg-destructive/10 animate-pulse" 
        : isUrgent 
          ? "border-orange-500 bg-orange-500/10" 
          : "border-blue-500/50 bg-blue-500/5"
    )}>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            "p-3 rounded-full",
            isCritical 
              ? "bg-destructive/20" 
              : isUrgent 
                ? "bg-orange-500/20" 
                : "bg-blue-500/20"
          )}>
            {isCritical ? (
              <UserX className="w-6 h-6 text-destructive animate-pulse" />
            ) : isUrgent ? (
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            ) : (
              <Clock className="w-6 h-6 text-blue-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "font-semibold",
                  isCritical ? "text-destructive" : isUrgent ? "text-orange-600" : "text-blue-700"
                )}>
                  {getTitle()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getDescription()}
                </p>
              </div>

              {/* Countdown Timer */}
              <div className={cn(
                "text-3xl font-mono font-bold tabular-nums px-4 py-2 rounded-lg",
                isCritical 
                  ? "bg-destructive text-destructive-foreground" 
                  : isUrgent 
                    ? "bg-orange-500 text-white" 
                    : "bg-blue-500 text-white"
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
                    ? "[&>div]:bg-orange-500" 
                    : "[&>div]:bg-blue-500"
              )}
            />

            <p className="text-xs text-muted-foreground text-center">
              {getBottomText()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
