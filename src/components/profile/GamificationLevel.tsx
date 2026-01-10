import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Star, TrendingUp, Lock, Unlock, ChevronRight, Zap } from 'lucide-react';
import { useAgentLevel, LEVEL_TIERS, AgentLevelData } from '@/hooks/useAgentLevel';
import { useLevelUpCelebration } from '@/hooks/useLevelUpCelebration';
import { GoalStreak } from '@/hooks/useAgentGoals';
import { cn } from '@/lib/utils';

interface GamificationLevelProps {
  completedCount: number;
  streaks: GoalStreak[];
  loginStreak?: number;
}

const levelColorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  slate: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/30', gradient: 'from-slate-500 to-slate-600' },
  green: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/30', gradient: 'from-green-500 to-emerald-600' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/30', gradient: 'from-blue-500 to-indigo-600' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/30', gradient: 'from-purple-500 to-violet-600' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30', gradient: 'from-amber-500 to-orange-600' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30', gradient: 'from-orange-500 to-red-500' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/30', gradient: 'from-rose-500 to-pink-600' },
  red: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30', gradient: 'from-red-500 to-rose-600' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/30', gradient: 'from-indigo-500 to-purple-600' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30', gradient: 'from-yellow-400 to-amber-500' },
};

const LevelBadge: React.FC<{ levelData: AgentLevelData }> = ({ levelData }) => {
  const { currentLevel } = levelData;
  const colors = levelColorClasses[currentLevel.color] || levelColorClasses.slate;

  return (
    <div className={cn(
      'relative flex items-center gap-3 p-4 rounded-xl border-2',
      colors.bg,
      colors.border
    )}>
      <div className={cn(
        'flex items-center justify-center w-16 h-16 rounded-xl text-3xl',
        'bg-gradient-to-br shadow-lg',
        colors.gradient
      )}>
        <span className="drop-shadow-md">{currentLevel.icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', colors.text)}>
            Level {currentLevel.level}
          </span>
          <Badge variant="outline" className={cn('font-semibold', colors.text, colors.border)}>
            {currentLevel.name}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {currentLevel.title}
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold">{levelData.totalXP.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Total XP</p>
      </div>
    </div>
  );
};

const XPProgressBar: React.FC<{ levelData: AgentLevelData }> = ({ levelData }) => {
  const { currentLevel, nextLevel, progressPercentage, xpProgress, xpToNextLevel } = levelData;
  const colors = levelColorClasses[currentLevel.color] || levelColorClasses.slate;

  if (!nextLevel) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
        <div className="flex items-center gap-2 text-yellow-600">
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">Maximum Level Achieved!</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          You've reached the pinnacle of sales excellence. Legendary status unlocked!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Zap className={cn('w-4 h-4', colors.text)} />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{xpProgress}</span> / {currentLevel.maxXP - currentLevel.minXP} XP
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span>{xpToNextLevel} XP to</span>
          <span className="font-medium text-foreground">{nextLevel.name}</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
      <Progress 
        value={progressPercentage} 
        className="h-3"
      />
    </div>
  );
};

const LevelPerks: React.FC<{ levelData: AgentLevelData }> = ({ levelData }) => {
  const { currentLevel } = levelData;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
        <Unlock className="w-4 h-4" />
        Unlocked Perks
      </h4>
      <div className="flex flex-wrap gap-2">
        {currentLevel.perks.map((perk, idx) => (
          <Badge key={idx} variant="secondary" className="gap-1">
            <Star className="w-3 h-3" />
            {perk}
          </Badge>
        ))}
      </div>
    </div>
  );
};

const LevelRoadmap: React.FC<{ levelData: AgentLevelData }> = ({ levelData }) => {
  const { currentLevel } = levelData;

  // Show current level and next 2 levels
  const currentIndex = LEVEL_TIERS.findIndex(t => t.level === currentLevel.level);
  const visibleLevels = LEVEL_TIERS.slice(
    Math.max(0, currentIndex - 1),
    Math.min(LEVEL_TIERS.length, currentIndex + 3)
  );

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4" />
        Level Roadmap
      </h4>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {visibleLevels.map((tier, idx) => {
          const isUnlocked = tier.level <= currentLevel.level;
          const isCurrent = tier.level === currentLevel.level;
          const colors = levelColorClasses[tier.color] || levelColorClasses.slate;

          return (
            <TooltipProvider key={tier.level}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'relative flex flex-col items-center p-3 rounded-lg border-2 min-w-[80px] transition-all',
                      isCurrent && 'ring-2 ring-primary ring-offset-2',
                      isUnlocked ? [colors.bg, colors.border] : 'bg-muted/50 border-muted opacity-60'
                    )}
                  >
                    <span className="text-2xl mb-1">{tier.icon}</span>
                    <span className={cn(
                      'text-xs font-medium',
                      isUnlocked ? colors.text : 'text-muted-foreground'
                    )}>
                      Lv.{tier.level}
                    </span>
                    <span className={cn(
                      'text-[10px]',
                      isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {tier.name}
                    </span>
                    {!isUnlocked && (
                      <Lock className="absolute -top-1 -right-1 w-3 h-3 text-muted-foreground" />
                    )}
                    {isCurrent && (
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="font-medium">{tier.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tier.minXP.toLocaleString()} XP required
                  </p>
                  <div className="mt-1 text-xs">
                    {tier.perks.map((perk, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Star className="w-2 h-2" />
                        {perk}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};

export const GamificationLevel: React.FC<GamificationLevelProps> = ({ completedCount, streaks, loginStreak = 0 }) => {
  const levelData = useAgentLevel({ completedCount, streaks, loginStreak });
  
  // Hook to detect level-ups and trigger celebrations
  useLevelUpCelebration({ 
    currentLevel: levelData.currentLevel, 
    totalXP: levelData.totalXP 
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Agent Level
        </CardTitle>
        <CardDescription>
          Earn XP by completing goals and maintaining streaks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LevelBadge levelData={levelData} />
        <XPProgressBar levelData={levelData} />
        <LevelPerks levelData={levelData} />
        <LevelRoadmap levelData={levelData} />
      </CardContent>
    </Card>
  );
};
