import React from 'react';
import { useAgentLevel, LEVEL_TIERS } from '@/hooks/useAgentLevel';
import { useAgentGoals } from '@/hooks/useAgentGoals';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const levelColorClasses: Record<string, { bg: string; text: string; border: string }> = {
  slate: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  rose: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/40' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
};

export const CompactLevelBadge: React.FC = () => {
  const { completedCount, streaks, isLoading } = useAgentGoals();
  const { streakData } = useLoginStreak();
  const levelData = useAgentLevel({ 
    completedCount, 
    streaks, 
    loginStreak: streakData?.currentStreak || 0 
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/30 animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-sidebar-accent" />
        <div className="flex-1 space-y-1">
          <div className="h-3 w-12 bg-sidebar-accent rounded" />
          <div className="h-2 w-full bg-sidebar-accent rounded" />
        </div>
      </div>
    );
  }

  const { currentLevel, nextLevel, progressPercentage, totalXP, xpToNextLevel } = levelData;
  const colors = levelColorClasses[currentLevel.color] || levelColorClasses.slate;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:opacity-90',
            colors.bg,
            colors.border
          )}>
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg text-lg',
              colors.bg
            )}>
              {currentLevel.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={cn('text-xs font-semibold', colors.text)}>
                  Lv.{currentLevel.level}
                </span>
                <span className="text-[10px] text-sidebar-muted">
                  {totalXP} XP
                </span>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-1.5 mt-1"
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{currentLevel.icon}</span>
              <div>
                <p className="font-semibold">{currentLevel.title}</p>
                <p className="text-xs text-muted-foreground">Level {currentLevel.level}</p>
              </div>
            </div>
            {nextLevel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>{xpToNextLevel} XP to {nextLevel.name}</span>
              </div>
            )}
            {!nextLevel && (
              <p className="text-xs text-yellow-500 font-medium">
                ✨ Maximum level reached!
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
