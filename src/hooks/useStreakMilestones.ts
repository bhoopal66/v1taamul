import { useMemo } from 'react';
import { GoalStreak, GoalMetric } from './useAgentGoals';

export interface StreakMilestone {
  id: string;
  threshold: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface EarnedMilestone extends StreakMilestone {
  metric: GoalMetric;
  goalType: 'weekly' | 'monthly';
  currentStreak: number;
  earnedAt?: string;
}

// Weekly streak milestones
export const WEEKLY_MILESTONES: StreakMilestone[] = [
  {
    id: 'weekly-3',
    threshold: 3,
    name: 'Hat Trick',
    description: '3 weeks in a row',
    icon: '🎯',
    color: 'green',
    rarity: 'common',
  },
  {
    id: 'weekly-5',
    threshold: 5,
    name: 'High Five',
    description: '5 week streak',
    icon: '✋',
    color: 'blue',
    rarity: 'uncommon',
  },
  {
    id: 'weekly-10',
    threshold: 10,
    name: 'Perfect 10',
    description: '10 week streak',
    icon: '🔟',
    color: 'purple',
    rarity: 'rare',
  },
  {
    id: 'weekly-25',
    threshold: 25,
    name: 'Quarter Master',
    description: '25 week streak',
    icon: '👑',
    color: 'amber',
    rarity: 'epic',
  },
  {
    id: 'weekly-52',
    threshold: 52,
    name: 'Year of Excellence',
    description: 'Full year streak',
    icon: '🏆',
    color: 'yellow',
    rarity: 'legendary',
  },
];

// Monthly streak milestones
export const MONTHLY_MILESTONES: StreakMilestone[] = [
  {
    id: 'monthly-3',
    threshold: 3,
    name: 'Quarter Crusher',
    description: '3 months in a row',
    icon: '📅',
    color: 'green',
    rarity: 'common',
  },
  {
    id: 'monthly-6',
    threshold: 6,
    name: 'Half Year Hero',
    description: '6 month streak',
    icon: '⭐',
    color: 'blue',
    rarity: 'uncommon',
  },
  {
    id: 'monthly-12',
    threshold: 12,
    name: 'Annual Ace',
    description: '12 month streak',
    icon: '💎',
    color: 'purple',
    rarity: 'rare',
  },
  {
    id: 'monthly-24',
    threshold: 24,
    name: 'Two Year Titan',
    description: '24 month streak',
    icon: '🌟',
    color: 'amber',
    rarity: 'epic',
  },
  {
    id: 'monthly-36',
    threshold: 36,
    name: 'Three Year Legend',
    description: '36 month streak',
    icon: '🎖️',
    color: 'yellow',
    rarity: 'legendary',
  },
];

export const useStreakMilestones = (streaks: GoalStreak[]) => {
  return useMemo(() => {
    const earnedMilestones: EarnedMilestone[] = [];
    const upcomingMilestones: (StreakMilestone & { metric: GoalMetric; goalType: 'weekly' | 'monthly'; currentStreak: number; remaining: number })[] = [];

    streaks.forEach((streak) => {
      const milestones = streak.goalType === 'weekly' ? WEEKLY_MILESTONES : MONTHLY_MILESTONES;
      const useStreak = Math.max(streak.currentStreak, streak.longestStreak);

      milestones.forEach((milestone) => {
        if (useStreak >= milestone.threshold) {
          // Earned this milestone
          earnedMilestones.push({
            ...milestone,
            metric: streak.metric,
            goalType: streak.goalType,
            currentStreak: useStreak,
          });
        } else if (streak.currentStreak > 0) {
          // Could earn this one next
          const remaining = milestone.threshold - streak.currentStreak;
          if (remaining <= milestone.threshold * 0.5) {
            // Only show if within 50% of reaching it
            upcomingMilestones.push({
              ...milestone,
              metric: streak.metric,
              goalType: streak.goalType,
              currentStreak: streak.currentStreak,
              remaining,
            });
          }
        }
      });
    });

    // Sort earned by rarity (legendary first)
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
    earnedMilestones.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

    // Get next milestone for each active streak
    const nextMilestones = upcomingMilestones
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 3);

    // Stats
    const totalBadges = earnedMilestones.length;
    const legendaryCount = earnedMilestones.filter(m => m.rarity === 'legendary').length;
    const epicCount = earnedMilestones.filter(m => m.rarity === 'epic').length;

    return {
      earnedMilestones,
      nextMilestones,
      totalBadges,
      legendaryCount,
      epicCount,
    };
  }, [streaks]);
};
