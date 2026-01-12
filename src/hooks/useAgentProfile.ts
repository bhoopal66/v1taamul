import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface MonthlyPerformance {
  month: string;
  calls: number;
  interested: number;
  leads: number;
  conversionRate: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string | null;
  progress: number;
  target: number;
  category: 'calls' | 'conversion' | 'leads' | 'streak' | 'milestone';
}

export interface ProfileStats {
  totalCallsAllTime: number;
  totalInterestedAllTime: number;
  totalLeadsAllTime: number;
  averageConversionRate: number;
  bestDay: { date: string; calls: number } | null;
  currentStreak: number;
  longestStreak: number;
  daysActive: number;
  rank: number;
  totalAgents: number;
}

export interface DailyPerformance {
  date: string;
  calls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
}

export const useAgentProfile = (agentId?: string) => {
  const { user, profile } = useAuth();
  const targetUserId = agentId || user?.id;

  const { data: profileStats, isLoading: statsLoading } = useQuery({
    queryKey: ['agent-profile-stats', targetUserId],
    queryFn: async (): Promise<ProfileStats> => {
      const params = agentId ? { agentId } : {};
      return api.get<ProfileStats>('/performance/profile-stats', params);
    },
    enabled: !!targetUserId,
  });

  const { data: monthlyPerformance, isLoading: monthlyLoading } = useQuery({
    queryKey: ['agent-monthly-performance', targetUserId],
    queryFn: async (): Promise<MonthlyPerformance[]> => {
      const params = agentId ? { agentId } : {};
      return api.get<MonthlyPerformance[]>('/performance/monthly', params);
    },
    enabled: !!targetUserId,
  });

  const { data: dailyPerformance, isLoading: dailyLoading } = useQuery({
    queryKey: ['agent-daily-performance', targetUserId],
    queryFn: async (): Promise<DailyPerformance[]> => {
      const params = agentId ? { agentId } : {};
      return api.get<DailyPerformance[]>('/performance/daily', params);
    },
    enabled: !!targetUserId,
  });

  const achievements: Achievement[] = profileStats ? [
    {
      id: 'first-call',
      title: 'First Steps',
      description: 'Make your first call',
      icon: '📞',
      earnedAt: profileStats.totalCallsAllTime >= 1 ? 'Earned' : null,
      progress: Math.min(profileStats.totalCallsAllTime, 1),
      target: 1,
      category: 'calls',
    },
    {
      id: 'century',
      title: 'Century Club',
      description: 'Make 100 calls',
      icon: '💯',
      earnedAt: profileStats.totalCallsAllTime >= 100 ? 'Earned' : null,
      progress: Math.min(profileStats.totalCallsAllTime, 100),
      target: 100,
      category: 'calls',
    },
    {
      id: 'thousand',
      title: 'Call Champion',
      description: 'Make 1,000 calls',
      icon: '🏆',
      earnedAt: profileStats.totalCallsAllTime >= 1000 ? 'Earned' : null,
      progress: Math.min(profileStats.totalCallsAllTime, 1000),
      target: 1000,
      category: 'calls',
    },
    {
      id: 'five-thousand',
      title: 'Phone Warrior',
      description: 'Make 5,000 calls',
      icon: '⚔️',
      earnedAt: profileStats.totalCallsAllTime >= 5000 ? 'Earned' : null,
      progress: Math.min(profileStats.totalCallsAllTime, 5000),
      target: 5000,
      category: 'calls',
    },
    {
      id: 'high-converter',
      title: 'High Converter',
      description: 'Achieve 25%+ conversion rate',
      icon: '📈',
      earnedAt: profileStats.averageConversionRate >= 25 ? 'Earned' : null,
      progress: Math.min(profileStats.averageConversionRate, 25),
      target: 25,
      category: 'conversion',
    },
    {
      id: 'elite-converter',
      title: 'Elite Performer',
      description: 'Achieve 40%+ conversion rate',
      icon: '🌟',
      earnedAt: profileStats.averageConversionRate >= 40 ? 'Earned' : null,
      progress: Math.min(profileStats.averageConversionRate, 40),
      target: 40,
      category: 'conversion',
    },
    {
      id: 'first-lead',
      title: 'Lead Generator',
      description: 'Generate your first lead',
      icon: '🎯',
      earnedAt: profileStats.totalLeadsAllTime >= 1 ? 'Earned' : null,
      progress: Math.min(profileStats.totalLeadsAllTime, 1),
      target: 1,
      category: 'leads',
    },
    {
      id: 'fifty-leads',
      title: 'Lead Machine',
      description: 'Generate 50 leads',
      icon: '🔥',
      earnedAt: profileStats.totalLeadsAllTime >= 50 ? 'Earned' : null,
      progress: Math.min(profileStats.totalLeadsAllTime, 50),
      target: 50,
      category: 'leads',
    },
    {
      id: 'week-streak',
      title: 'Consistent',
      description: 'Maintain a 7-day calling streak',
      icon: '📅',
      earnedAt: profileStats.longestStreak >= 7 ? 'Earned' : null,
      progress: Math.min(profileStats.longestStreak, 7),
      target: 7,
      category: 'streak',
    },
    {
      id: 'month-streak',
      title: 'Unstoppable',
      description: 'Maintain a 30-day calling streak',
      icon: '🚀',
      earnedAt: profileStats.longestStreak >= 30 ? 'Earned' : null,
      progress: Math.min(profileStats.longestStreak, 30),
      target: 30,
      category: 'streak',
    },
    {
      id: 'best-day-50',
      title: 'Power Day',
      description: 'Make 50+ calls in a single day',
      icon: '⚡',
      earnedAt: (profileStats.bestDay?.calls || 0) >= 50 ? 'Earned' : null,
      progress: Math.min(profileStats.bestDay?.calls || 0, 50),
      target: 50,
      category: 'milestone',
    },
    {
      id: 'top-rank',
      title: 'Top Performer',
      description: 'Reach #1 ranking',
      icon: '👑',
      earnedAt: profileStats.rank === 1 ? 'Earned' : null,
      progress: profileStats.rank === 1 ? 1 : 0,
      target: 1,
      category: 'milestone',
    },
  ] : [];

  const earnedAchievements = achievements.filter(a => a.earnedAt);
  const inProgressAchievements = achievements.filter(a => !a.earnedAt);

  return {
    profile,
    profileStats: profileStats || {
      totalCallsAllTime: 0,
      totalInterestedAllTime: 0,
      totalLeadsAllTime: 0,
      averageConversionRate: 0,
      bestDay: null,
      currentStreak: 0,
      longestStreak: 0,
      daysActive: 0,
      rank: 1,
      totalAgents: 1,
    },
    monthlyPerformance: monthlyPerformance || [],
    dailyPerformance: dailyPerformance || [],
    achievements,
    earnedAchievements,
    inProgressAchievements,
    isLoading: statsLoading || monthlyLoading || dailyLoading,
  };
};
