import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

export interface DailyTeamTrend {
  date: string;
  displayDate: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
  activeAgents: number;
}

export interface TeamTrendSummary {
  totalCalls: number;
  totalInterested: number;
  totalLeads: number;
  avgConversionRate: number;
  avgCallsPerDay: number;
  bestDay: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface UseTeamPerformanceTrendsOptions {
  days?: number;
  teamId?: string;
}

export const useTeamPerformanceTrends = (options: UseTeamPerformanceTrendsOptions = {}) => {
  const { user, userRole } = useAuth();
  const { days = 14, teamId } = options;

  const isSupervisor = userRole === 'supervisor' || userRole === 'operations_head' || userRole === 'admin' || userRole === 'super_admin';

  const { data: trendData, isLoading, refetch } = useQuery({
    queryKey: ['team-performance-trends', days, teamId],
    queryFn: async (): Promise<{ dailyTrends: DailyTeamTrend[]; summary: TeamTrendSummary }> => {
      const endDate = new Date();
      const startDate = subDays(endDate, days - 1);

      // Get agent IDs for the team if filtering by team
      let agentIds: string[] | null = null;
      if (teamId) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', teamId);
        agentIds = profiles?.map(p => p.id) || [];
      }

      // Get all feedback in date range
      let feedbackQuery = supabase
        .from('call_feedback')
        .select('agent_id, feedback_status, call_timestamp')
        .gte('call_timestamp', startOfDay(startDate).toISOString())
        .lte('call_timestamp', endOfDay(endDate).toISOString());

      if (agentIds && agentIds.length > 0) {
        feedbackQuery = feedbackQuery.in('agent_id', agentIds);
      } else if (agentIds && agentIds.length === 0) {
        // No agents in team, return empty
        return {
          dailyTrends: [],
          summary: {
            totalCalls: 0,
            totalInterested: 0,
            totalLeads: 0,
            avgConversionRate: 0,
            avgCallsPerDay: 0,
            bestDay: 'N/A',
            trend: 'stable',
            trendPercentage: 0,
          },
        };
      }

      const { data: feedback, error: feedbackError } = await feedbackQuery;

      if (feedbackError) throw feedbackError;

      // Get all leads in date range
      let leadsQuery = supabase
        .from('leads')
        .select('agent_id, created_at')
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (agentIds && agentIds.length > 0) {
        leadsQuery = leadsQuery.in('agent_id', agentIds);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      // Create array of all days in range
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      // Aggregate by day
      const dailyTrends: DailyTeamTrend[] = allDays.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dateStr = format(day, 'yyyy-MM-dd');

        const dayFeedback = feedback?.filter(f => {
          const ts = new Date(f.call_timestamp!);
          return ts >= dayStart && ts <= dayEnd;
        }) || [];

        const dayLeads = leads?.filter(l => {
          const ts = new Date(l.created_at!);
          return ts >= dayStart && ts <= dayEnd;
        }) || [];

        const totalCalls = dayFeedback.length;
        const interested = dayFeedback.filter(f => f.feedback_status === 'interested').length;
        const notInterested = dayFeedback.filter(f => f.feedback_status === 'not_interested').length;
        const notAnswered = dayFeedback.filter(f => f.feedback_status === 'not_answered').length;
        const activeAgents = new Set(dayFeedback.map(f => f.agent_id)).size;

        return {
          date: dateStr,
          displayDate: format(day, 'MMM d'),
          totalCalls,
          interested,
          notInterested,
          notAnswered,
          leadsGenerated: dayLeads.length,
          conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
          activeAgents,
        };
      });

      // Calculate summary
      const totalCalls = dailyTrends.reduce((sum, d) => sum + d.totalCalls, 0);
      const totalInterested = dailyTrends.reduce((sum, d) => sum + d.interested, 0);
      const totalLeads = dailyTrends.reduce((sum, d) => sum + d.leadsGenerated, 0);
      const avgConversionRate = totalCalls > 0 ? Math.round((totalInterested / totalCalls) * 100) : 0;
      const avgCallsPerDay = Math.round(totalCalls / days);

      const bestDayData = dailyTrends.reduce((best, day) => 
        day.totalCalls > best.totalCalls ? day : best
      , dailyTrends[0]);

      // Calculate trend by comparing last 7 days to previous 7 days
      const midpoint = Math.floor(dailyTrends.length / 2);
      const recentCalls = dailyTrends.slice(midpoint).reduce((sum, d) => sum + d.totalCalls, 0);
      const earlierCalls = dailyTrends.slice(0, midpoint).reduce((sum, d) => sum + d.totalCalls, 0);

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (earlierCalls > 0) {
        trendPercentage = Math.round(((recentCalls - earlierCalls) / earlierCalls) * 100);
        if (trendPercentage > 5) trend = 'up';
        else if (trendPercentage < -5) trend = 'down';
      }

      return {
        dailyTrends,
        summary: {
          totalCalls,
          totalInterested,
          totalLeads,
          avgConversionRate,
          avgCallsPerDay,
          bestDay: bestDayData?.displayDate || 'N/A',
          trend,
          trendPercentage: Math.abs(trendPercentage),
        },
      };
    },
    enabled: !!user && isSupervisor,
    refetchInterval: 60000, // Refresh every minute
  });

  return {
    dailyTrends: trendData?.dailyTrends || [],
    summary: trendData?.summary || {
      totalCalls: 0,
      totalInterested: 0,
      totalLeads: 0,
      avgConversionRate: 0,
      avgCallsPerDay: 0,
      bestDay: 'N/A',
      trend: 'stable' as const,
      trendPercentage: 0,
    },
    isLoading,
    refetch,
  };
};
