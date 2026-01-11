import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Flame, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { GoalWithProgress, GoalStreak, GoalMetric } from '@/hooks/useAgentGoals';
import { cn } from '@/lib/utils';

const metricLabels: Record<GoalMetric, string> = {
  calls: 'Calls',
  interested: 'Interested',
  leads: 'Leads',
  conversion: 'Conversion',
  talk_time: 'Talk Time',
};

interface StreakReminderBannerProps {
  goals: GoalWithProgress[];
  streaks: GoalStreak[];
}

export const StreakReminderBanner: React.FC<StreakReminderBannerProps> = ({ goals, streaks }) => {
  // Find goals that are at risk of breaking streaks
  const atRiskGoals = goals.filter((goal) => {
    if (goal.isCompleted) return false;

    const isWeekly = goal.goal_type === 'weekly';
    const warningThreshold = isWeekly ? 2 : 7;

    const matchingStreak = streaks.find(
      s => s.metric === goal.metric && s.goalType === goal.goal_type
    );

    return (
      goal.daysRemaining <= warningThreshold &&
      goal.progressPercentage < 100 &&
      matchingStreak &&
      matchingStreak.currentStreak > 0
    );
  });

  if (atRiskGoals.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {atRiskGoals.map((goal) => {
        const isWeekly = goal.goal_type === 'weekly';
        const matchingStreak = streaks.find(
          s => s.metric === goal.metric && s.goalType === goal.goal_type
        );
        const isUrgent = goal.daysRemaining <= (isWeekly ? 1 : 3);
        const remaining = goal.target_value - goal.currentValue;

        return (
          <Alert
            key={goal.id}
            variant={isUrgent ? 'destructive' : 'default'}
            className={cn(
              'border-2 transition-all',
              isUrgent 
                ? 'border-destructive/50 bg-destructive/5 animate-pulse' 
                : 'border-warning/50 bg-warning/5'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'p-2 rounded-full',
                isUrgent ? 'bg-destructive/20' : 'bg-warning/20'
              )}>
                {isUrgent ? (
                  <AlertTriangle className={cn('h-5 w-5', isUrgent ? 'text-destructive' : 'text-warning')} />
                ) : (
                  <Flame className="h-5 w-5 text-warning" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <AlertTitle className="flex items-center gap-2 mb-0">
                    {isUrgent ? 'Streak at Risk!' : 'Streak Reminder'}
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'gap-1',
                        isUrgent ? 'border-destructive text-destructive' : 'border-warning text-warning'
                      )}
                    >
                      <Flame className="w-3 h-3" />
                      {matchingStreak?.currentStreak} {isWeekly ? 'week' : 'month'} streak
                    </Badge>
                  </AlertTitle>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {goal.daysRemaining} day{goal.daysRemaining === 1 ? '' : 's'} left
                  </Badge>
                </div>

                <AlertDescription className="text-sm">
                  You need <span className="font-bold">{remaining} more {metricLabels[goal.metric].toLowerCase()}</span> to 
                  complete your {goal.goal_type} goal and keep your streak alive!
                </AlertDescription>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {goal.currentValue}/{goal.target_value} {metricLabels[goal.metric].toLowerCase()}
                    </span>
                    <span className="font-medium">{goal.progressPercentage}%</span>
                  </div>
                  <Progress 
                    value={goal.progressPercentage} 
                    className={cn(
                      'h-2',
                      isUrgent ? '[&>div]:bg-destructive' : '[&>div]:bg-warning'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  {isUrgent 
                    ? `Complete ${Math.ceil(remaining / goal.daysRemaining)} per day to stay on track`
                    : `You're making progress - keep it up!`
                  }
                </div>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
};
