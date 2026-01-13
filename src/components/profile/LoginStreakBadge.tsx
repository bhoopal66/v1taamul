import React, { forwardRef } from 'react';
import { Flame, Zap, Trophy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LoginStreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
  variant?: 'compact' | 'full';
  className?: string;
}

const getStreakTier = (streak: number) => {
  if (streak >= 100) return { name: 'Legendary', color: 'yellow', icon: '🏆' };
  if (streak >= 30) return { name: 'Epic', color: 'purple', icon: '💎' };
  if (streak >= 7) return { name: 'Hot', color: 'orange', icon: '🔥' };
  if (streak >= 3) return { name: 'Warm', color: 'amber', icon: '✨' };
  return { name: 'Starting', color: 'slate', icon: '🌱' };
};

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', border: 'border-yellow-500/40' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-500', border: 'border-purple-500/40' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-500', border: 'border-orange-500/40' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-500', border: 'border-amber-500/40' },
  slate: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
};

// Forwarded ref component for the tooltip trigger
const StreakBadgeContent = forwardRef<
  HTMLDivElement,
  { currentStreak: number; tier: ReturnType<typeof getStreakTier>; colors: typeof tierColors[string]; className?: string }
>(({ currentStreak, tier, colors, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-full border cursor-pointer transition-all hover:scale-105',
      colors.bg,
      colors.border,
      className
    )}
    {...props}
  >
    <Flame className={cn('w-3.5 h-3.5', colors.text)} />
    <span className={cn('text-xs font-bold', colors.text)}>
      {currentStreak}
    </span>
  </div>
));

StreakBadgeContent.displayName = 'StreakBadgeContent';

export const LoginStreakBadge: React.FC<LoginStreakBadgeProps> = ({
  currentStreak,
  longestStreak,
  variant = 'compact',
  className,
}) => {
  const tier = getStreakTier(currentStreak);
  const colors = tierColors[tier.color];

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <StreakBadgeContent
              currentStreak={currentStreak}
              tier={tier}
              colors={colors}
              className={className}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <span>{tier.icon}</span>
                {currentStreak}-Day Login Streak
              </p>
              <p className="text-xs text-muted-foreground">
                Best: {longestStreak} days
              </p>
              <p className="text-xs text-muted-foreground">
                Log in daily to maintain your streak!
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        colors.bg,
        colors.border,
        className
      )}
    >
      <div className={cn('p-2 rounded-full', colors.bg)}>
        <Flame className={cn('w-5 h-5', colors.text)} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-bold', colors.text)}>
            {currentStreak}
          </span>
          <span className="text-sm text-muted-foreground">day streak</span>
          <span className="text-lg">{tier.icon}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            Best: {longestStreak}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            +{10 + (currentStreak >= 7 ? 5 : 0) + (currentStreak >= 30 ? 10 : 0) + (currentStreak >= 100 ? 25 : 0)} XP/day
          </span>
        </div>
      </div>
    </div>
  );
};
