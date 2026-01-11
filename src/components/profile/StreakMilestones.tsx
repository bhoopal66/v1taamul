import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award, Lock, Sparkles, TrendingUp } from 'lucide-react';
import { useStreakMilestones, EarnedMilestone, StreakMilestone } from '@/hooks/useStreakMilestones';
import { useMilestoneNotifications } from '@/hooks/useMilestoneNotifications';
import { GoalStreak, GoalMetric } from '@/hooks/useAgentGoals';
import { cn } from '@/lib/utils';

interface StreakMilestonesProps {
  streaks: GoalStreak[];
}

const metricLabels: Record<GoalMetric, string> = {
  calls: 'Calls',
  interested: 'Interested',
  leads: 'Leads',
  conversion: 'Conversion',
  talk_time: 'Talk Time',
};

const rarityColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-600',
    glow: '',
  },
  uncommon: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
    glow: '',
  },
  rare: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
    glow: 'shadow-blue-500/20',
  },
  epic: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600',
    glow: 'shadow-lg shadow-purple-500/20',
  },
  legendary: {
    bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-600',
    glow: 'shadow-lg shadow-yellow-500/30 ring-1 ring-yellow-500/20',
  },
};

const MilestoneBadge: React.FC<{ milestone: EarnedMilestone }> = ({ milestone }) => {
  const colors = rarityColors[milestone.rarity];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'relative flex flex-col items-center p-3 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer min-w-[100px]',
              colors.bg,
              colors.border,
              colors.glow
            )}
          >
            {milestone.rarity === 'legendary' && (
              <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500 animate-pulse" />
            )}
            <span className="text-3xl mb-1">{milestone.icon}</span>
            <span className={cn('text-xs font-semibold text-center', colors.text)}>
              {milestone.name}
            </span>
            <Badge variant="outline" className="mt-1 text-[10px] capitalize">
              {milestone.rarity}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1">
              {milestone.icon} {milestone.name}
            </p>
            <p className="text-xs text-muted-foreground">{milestone.description}</p>
            <div className="flex items-center gap-2 text-xs pt-1 border-t">
              <span className="text-muted-foreground">Earned for:</span>
              <Badge variant="secondary" className="text-[10px]">
                {metricLabels[milestone.metric]} ({milestone.goalType})
              </Badge>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const UpcomingMilestone: React.FC<{
  milestone: StreakMilestone & { metric: GoalMetric; goalType: 'weekly' | 'monthly'; currentStreak: number; remaining: number };
}> = ({ milestone }) => {
  const progress = (milestone.currentStreak / milestone.threshold) * 100;
  const colors = rarityColors[milestone.rarity];

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      colors.bg,
      colors.border,
      'opacity-75'
    )}>
      <div className="relative">
        <span className="text-2xl grayscale">{milestone.icon}</span>
        <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{milestone.name}</span>
          <span className="text-xs text-muted-foreground">
            {milestone.remaining} {milestone.goalType === 'weekly' ? 'weeks' : 'months'} to go
          </span>
        </div>
        <Progress value={progress} className="h-1.5 mt-1" />
        <p className="text-xs text-muted-foreground mt-1">
          {metricLabels[milestone.metric]} • {milestone.currentStreak}/{milestone.threshold}
        </p>
      </div>
    </div>
  );
};

export const StreakMilestones: React.FC<StreakMilestonesProps> = ({ streaks }) => {
  const { earnedMilestones, nextMilestones, totalBadges, legendaryCount, epicCount } = useStreakMilestones(streaks);
  
  // Initialize milestone notifications - will show toast when new badges are earned
  useMilestoneNotifications(earnedMilestones);

  if (streaks.length === 0 && earnedMilestones.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Streak Milestones
            </CardTitle>
            <CardDescription className="mt-1">
              Earn badges by maintaining your goal streaks
            </CardDescription>
          </div>
          {totalBadges > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold">{totalBadges}</span>
                <span className="text-muted-foreground">badges</span>
              </div>
              {legendaryCount > 0 && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0">
                  {legendaryCount} Legendary
                </Badge>
              )}
              {epicCount > 0 && (
                <Badge className="bg-purple-500 text-white border-0">
                  {epicCount} Epic
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Earned Badges */}
        {earnedMilestones.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Earned Badges
            </h4>
            <div className="flex flex-wrap gap-3">
              {earnedMilestones.map((milestone, idx) => (
                <MilestoneBadge key={`${milestone.id}-${milestone.metric}-${idx}`} milestone={milestone} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No badges earned yet</p>
            <p className="text-sm mt-1">Complete goals consistently to earn milestone badges!</p>
          </div>
        )}

        {/* Upcoming Milestones */}
        {nextMilestones.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Next Milestones
            </h4>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {nextMilestones.map((milestone, idx) => (
                <UpcomingMilestone key={`upcoming-${milestone.id}-${idx}`} milestone={milestone} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
