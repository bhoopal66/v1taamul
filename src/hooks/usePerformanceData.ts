import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type DashboardTimePeriod = 'today' | 'this_week' | 'this_month' | 'six_months';
export type DashboardLeadStatusFilter = 'all' | 'matched' | 'unmatched';

interface UsePerformanceDataOptions {
  timePeriod?: DashboardTimePeriod;
  leadStatusFilter?: DashboardLeadStatusFilter;
}

export interface PerformanceStats {
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  whatsappSent: number;
  conversionRate: number;
}

export interface HourlyCallData {
  hour: string;
  calls: number;
  interested: number;
  notInterested: number;
}

export interface LeaderboardEntry {
  agentId: string;
  agentName: string;
  totalCalls: number;
  interested: number;
  conversionRate: number;
  rank: number;
}

export interface WeeklyTrendData {
  day: string;
  date: string;
  calls: number;
  interested: number;
  notInterested: number;
  conversionRate: number;
}

export interface RecentActivity {
  id: string;
  companyName: string;
  contactName: string;
  status: string;
  timestamp: string;
}

export const usePerformanceData = (options: UsePerformanceDataOptions = {}) => {
  const { timePeriod = 'today', leadStatusFilter = 'all' } = options;
  const { user } = useAuth();

  const { data: myStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['my-performance', user?.id, timePeriod, leadStatusFilter],
    queryFn: async (): Promise<PerformanceStats> => {
      return api.get<PerformanceStats>('/performance/stats', { period: timePeriod, leadStatus: leadStatusFilter });
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: hourlyData, isLoading: hourlyLoading, refetch: refetchHourly } = useQuery({
    queryKey: ['hourly-calls', user?.id],
    queryFn: async (): Promise<HourlyCallData[]> => {
      return api.get<HourlyCallData[]>('/performance/hourly');
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = useQuery({
    queryKey: ['weekly-trend', user?.id],
    queryFn: async (): Promise<WeeklyTrendData[]> => {
      return api.get<WeeklyTrendData[]>('/performance/weekly');
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async (): Promise<RecentActivity[]> => {
      return api.get<RecentActivity[]>('/performance/activity');
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['team-leaderboard', timePeriod, leadStatusFilter],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      return api.get<LeaderboardEntry[]>('/performance/leaderboard', { period: timePeriod, leadStatus: leadStatusFilter });
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const refetchAll = () => {
    refetchStats();
    refetchHourly();
    refetchWeekly();
    refetchActivity();
    refetchLeaderboard();
  };

  return {
    myStats: myStats || {
      totalCalls: 0,
      interested: 0,
      notInterested: 0,
      notAnswered: 0,
      leadsGenerated: 0,
      whatsappSent: 0,
      conversionRate: 0,
    },
    hourlyData: hourlyData || [],
    weeklyData: weeklyData || [],
    recentActivity: recentActivity || [],
    leaderboard: leaderboard || [],
    isLoading: statsLoading || hourlyLoading || weeklyLoading || activityLoading || leaderboardLoading,
    refetch: refetchAll,
  };
};
