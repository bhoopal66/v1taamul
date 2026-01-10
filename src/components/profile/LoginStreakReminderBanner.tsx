import React from 'react';
import { AlertTriangle, Clock, Flame, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLoginStreakReminder } from '@/hooks/useLoginStreakReminder';

interface LoginStreakReminderBannerProps {
  currentStreak: number;
  lastLoginDate: string | null;
  isNewDay: boolean;
  className?: string;
}

const urgencyStyles = {
  low: {
    container: 'border-amber-500/50 bg-amber-500/10',
    icon: 'text-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  medium: {
    container: 'border-orange-500/50 bg-orange-500/10',
    icon: 'text-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
  },
  high: {
    container: 'border-red-500/50 bg-red-500/15',
    icon: 'text-red-500',
    text: 'text-red-700 dark:text-red-300',
  },
  critical: {
    container: 'border-red-600/60 bg-red-500/20 animate-pulse',
    icon: 'text-red-600',
    text: 'text-red-800 dark:text-red-200',
  },
};

export const LoginStreakReminderBanner: React.FC<LoginStreakReminderBannerProps> = ({
  currentStreak,
  lastLoginDate,
  isNewDay,
  className,
}) => {
  const {
    shouldShowReminder,
    hoursRemaining,
    minutesRemaining,
    urgencyLevel,
    dismissReminder,
  } = useLoginStreakReminder(currentStreak, lastLoginDate, isNewDay);

  if (!shouldShowReminder) {
    return null;
  }

  const styles = urgencyStyles[urgencyLevel];

  const timeDisplay = hoursRemaining > 0 
    ? `${hoursRemaining}h ${minutesRemaining}m` 
    : `${minutesRemaining} minutes`;

  const getMessage = () => {
    if (urgencyLevel === 'critical') {
      return `Only ${timeDisplay} left! Your ${currentStreak}-day streak will reset at midnight!`;
    }
    if (urgencyLevel === 'high') {
      return `${timeDisplay} remaining to save your ${currentStreak}-day streak!`;
    }
    if (urgencyLevel === 'medium') {
      return `Don't forget! Log in to maintain your ${currentStreak}-day streak. ${timeDisplay} left today.`;
    }
    return `Reminder: Keep your ${currentStreak}-day streak going! ${timeDisplay} left today.`;
  };

  const getTitle = () => {
    if (urgencyLevel === 'critical') return '🚨 Login Streak at Risk!';
    if (urgencyLevel === 'high') return '⚠️ Streak Warning!';
    return '🔔 Streak Reminder';
  };

  return (
    <Alert
      className={cn(
        'relative border-2',
        styles.container,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', styles.icon)}>
          {urgencyLevel === 'critical' || urgencyLevel === 'high' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Flame className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <AlertTitle className={cn('font-semibold', styles.text)}>
            {getTitle()}
          </AlertTitle>
          <AlertDescription className={cn('mt-1', styles.text)}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {getMessage()}
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-transparent"
          onClick={dismissReminder}
        >
          <X className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </Alert>
  );
};
