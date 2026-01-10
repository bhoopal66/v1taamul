import { useMemo } from 'react';
import { GoalStreak } from './useAgentGoals';

export interface LevelTier {
  level: number;
  name: string;
  title: string;
  minXP: number;
  maxXP: number;
  color: string;
  icon: string;
  perks: string[];
}

export interface AgentLevelData {
  currentLevel: LevelTier;
  nextLevel: LevelTier | null;
  totalXP: number;
  xpToNextLevel: number;
  xpProgress: number;
  progressPercentage: number;
}

// XP rewards for different achievements
const XP_REWARDS = {
  goalCompleted: 50,
  weeklyStreakBonus: 25, // per streak week
  monthlyStreakBonus: 100, // per streak month
  longestStreakBonus: 10, // per unit in longest streak
};

// Level tiers with increasing XP requirements
export const LEVEL_TIERS: LevelTier[] = [
  {
    level: 1,
    name: 'Rookie',
    title: 'Sales Rookie',
    minXP: 0,
    maxXP: 100,
    color: 'slate',
    icon: '🌱',
    perks: ['Access to goal tracking', 'Basic performance stats'],
  },
  {
    level: 2,
    name: 'Apprentice',
    title: 'Sales Apprentice',
    minXP: 100,
    maxXP: 300,
    color: 'green',
    icon: '📈',
    perks: ['Streak tracking unlocked', 'Weekly reports'],
  },
  {
    level: 3,
    name: 'Associate',
    title: 'Sales Associate',
    minXP: 300,
    maxXP: 600,
    color: 'blue',
    icon: '⭐',
    perks: ['Performance badges', 'Team leaderboard visibility'],
  },
  {
    level: 4,
    name: 'Professional',
    title: 'Sales Professional',
    minXP: 600,
    maxXP: 1000,
    color: 'purple',
    icon: '🏆',
    perks: ['Achievement certificates', 'Priority support'],
  },
  {
    level: 5,
    name: 'Expert',
    title: 'Sales Expert',
    minXP: 1000,
    maxXP: 1500,
    color: 'amber',
    icon: '💎',
    perks: ['Mentor badge', 'Custom goal templates'],
  },
  {
    level: 6,
    name: 'Master',
    title: 'Sales Master',
    minXP: 1500,
    maxXP: 2200,
    color: 'orange',
    icon: '🔥',
    perks: ['Featured on leaderboard', 'Exclusive insights'],
  },
  {
    level: 7,
    name: 'Champion',
    title: 'Sales Champion',
    minXP: 2200,
    maxXP: 3000,
    color: 'rose',
    icon: '👑',
    perks: ['Champion badge', 'Early feature access'],
  },
  {
    level: 8,
    name: 'Legend',
    title: 'Sales Legend',
    minXP: 3000,
    maxXP: 4000,
    color: 'red',
    icon: '🌟',
    perks: ['Legend status', 'VIP recognition'],
  },
  {
    level: 9,
    name: 'Elite',
    title: 'Sales Elite',
    minXP: 4000,
    maxXP: 5500,
    color: 'indigo',
    icon: '💫',
    perks: ['Elite badge', 'Team mentorship tools'],
  },
  {
    level: 10,
    name: 'Grandmaster',
    title: 'Sales Grandmaster',
    minXP: 5500,
    maxXP: Infinity,
    color: 'yellow',
    icon: '🎖️',
    perks: ['Grandmaster title', 'Hall of Fame eligibility'],
  },
];

interface UseAgentLevelProps {
  completedCount: number;
  streaks: GoalStreak[];
  loginStreak?: number;
}

export const useAgentLevel = ({ completedCount, streaks, loginStreak = 0 }: UseAgentLevelProps): AgentLevelData => {
  return useMemo(() => {
    // Calculate total XP
    let totalXP = 0;

    // XP from completed goals
    totalXP += completedCount * XP_REWARDS.goalCompleted;

    // XP from goal streaks
    streaks.forEach((streak) => {
      if (streak.goalType === 'weekly') {
        totalXP += streak.currentStreak * XP_REWARDS.weeklyStreakBonus;
      } else {
        totalXP += streak.currentStreak * XP_REWARDS.monthlyStreakBonus;
      }
      // Bonus for longest streak
      totalXP += streak.longestStreak * XP_REWARDS.longestStreakBonus;
    });

    // XP from login streak (10 XP base per day logged)
    if (loginStreak > 0) {
      let loginXP = loginStreak * 10;
      // Bonus tiers
      if (loginStreak >= 7) loginXP += loginStreak * 2;   // Week bonus
      if (loginStreak >= 30) loginXP += loginStreak * 3;  // Month bonus
      if (loginStreak >= 100) loginXP += loginStreak * 5; // Century bonus
      totalXP += loginXP;
    }

    // Find current level
    let currentLevel = LEVEL_TIERS[0];
    let nextLevel: LevelTier | null = LEVEL_TIERS[1];

    for (let i = 0; i < LEVEL_TIERS.length; i++) {
      const tier = LEVEL_TIERS[i];
      if (totalXP >= tier.minXP && totalXP < tier.maxXP) {
        currentLevel = tier;
        nextLevel = LEVEL_TIERS[i + 1] || null;
        break;
      }
      // Handle max level
      if (i === LEVEL_TIERS.length - 1 && totalXP >= tier.minXP) {
        currentLevel = tier;
        nextLevel = null;
      }
    }

    // Calculate XP progress
    const xpInCurrentLevel = totalXP - currentLevel.minXP;
    const xpToNextLevel = nextLevel ? nextLevel.minXP - totalXP : 0;
    const levelXPRange = currentLevel.maxXP - currentLevel.minXP;
    const progressPercentage = nextLevel 
      ? Math.min(Math.round((xpInCurrentLevel / levelXPRange) * 100), 100)
      : 100;

    return {
      currentLevel,
      nextLevel,
      totalXP,
      xpToNextLevel,
      xpProgress: xpInCurrentLevel,
      progressPercentage,
    };
  }, [completedCount, streaks]);
};
