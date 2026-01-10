import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, Flame, CheckCircle2 } from 'lucide-react';
import { PerformanceStats } from '@/hooks/usePerformanceData';

interface DailyGoalProgressProps {
  stats: PerformanceStats;
  isLoading: boolean;
}

// Default daily goals - could be made configurable
const DAILY_GOALS = {
  calls: 50,
  interested: 10,
  leads: 5,
};

export const DailyGoalProgress: React.FC<DailyGoalProgressProps> = ({ stats, isLoading }) => {
  const callsProgress = Math.min((stats.totalCalls / DAILY_GOALS.calls) * 100, 100);
  const interestedProgress = Math.min((stats.interested / DAILY_GOALS.interested) * 100, 100);
  const leadsProgress = Math.min((stats.leadsGenerated / DAILY_GOALS.leads) * 100, 100);

  const overallProgress = Math.round((callsProgress + interestedProgress + leadsProgress) / 3);
  const isOnFire = overallProgress >= 80;
  const isComplete = overallProgress >= 100;

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Daily Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Daily Goals
          </CardTitle>
          <div className="flex items-center gap-2">
            {isOnFire && !isComplete && (
              <div className="flex items-center gap-1 text-warning animate-pulse-subtle">
                <Flame className="w-5 h-5" />
                <span className="text-sm font-medium">On Fire!</span>
              </div>
            )}
            {isComplete && (
              <div className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Complete!</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall Progress Ring */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={isComplete ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${overallProgress * 2.51} 251`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{overallProgress}%</span>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-lg">Overall Progress</h4>
            <p className="text-sm text-muted-foreground">
              {isComplete 
                ? "Amazing work! You've crushed all your goals!" 
                : isOnFire 
                  ? "You're almost there, keep pushing!"
                  : "Keep making calls to hit your targets"}
            </p>
          </div>
        </div>

        {/* Individual Goals */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Calls Made</span>
              <span className="text-muted-foreground">
                {stats.totalCalls} / {DAILY_GOALS.calls}
              </span>
            </div>
            <Progress 
              value={callsProgress} 
              className="h-2.5"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Interested Contacts</span>
              <span className="text-muted-foreground">
                {stats.interested} / {DAILY_GOALS.interested}
              </span>
            </div>
            <Progress 
              value={interestedProgress} 
              className="h-2.5 [&>div]:bg-success"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Leads Generated</span>
              <span className="text-muted-foreground">
                {stats.leadsGenerated} / {DAILY_GOALS.leads}
              </span>
            </div>
            <Progress 
              value={leadsProgress} 
              className="h-2.5 [&>div]:bg-info"
            />
          </div>
        </div>

        {/* Motivation Tip */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Pro tip:</span> Agents who complete their daily goals are 3x more likely to hit monthly targets.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
