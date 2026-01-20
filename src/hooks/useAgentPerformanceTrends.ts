import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

export interface AgentDailyTrend {
  date: string;
  displayDate: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
}

export interface AgentTrendSummary {
  agentId: string;
  agentName: string;
  totalCalls: number;
  totalInterested: number;
  totalLeads: number;
  avgConversionRate: number;
  avgCallsPerDay: number;
  bestDay: string;
  bestDayCalls: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export interface AgentOption {
  id: string;
  name: string;
}

interface UseAgentPerformanceTrendsOptions {
  agentId: string | null;
  days?: number;
}

export const useAgentPerformanceTrends = (options: UseAgentPerformanceTrendsOptions) => {
  const { user, userRole, ledTeamId } = useAuth();
  const { agentId, days = 14 } = options;

  const isSupervisor = userRole === 'supervisor' || userRole === 'operations_head' || userRole === 'admin' || userRole === 'super_admin';
  
  // Check if user can see all agents (admin, super_admin, operations_head)
  const canSeeAllAgents = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');

  // Fetch list of agents - filtered by team for supervisors
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agent-list-for-trends', ledTeamId, canSeeAllAgents, user?.id],
    queryFn: async (): Promise<AgentOption[]> => {
      let query = supabase
        .from('profiles_public')
        .select('id, full_name, username, team_id, supervisor_id')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      // If supervisor role (not admin/ops_head), filter by their team or direct reports
      if (!canSeeAllAgents) {
        if (ledTeamId) {
          query = query.or(`team_id.eq.${ledTeamId},supervisor_id.eq.${user?.id}`);
        } else if (user?.id) {
          query = query.eq('supervisor_id', user.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: p.full_name || p.username || 'Unknown',
      }));
    },
    enabled: !!user && isSupervisor,
  });

  // Fetch agent trends
  const { data: trendData, isLoading: trendsLoading, refetch } = useQuery({
    queryKey: ['agent-performance-trends', agentId, days],
    queryFn: async (): Promise<{ dailyTrends: AgentDailyTrend[]; summary: AgentTrendSummary }> => {
      if (!agentId) throw new Error('No agent selected');

      const endDate = new Date();
      const startDate = subDays(endDate, days - 1);

      // Get agent profile (using profiles_public for non-sensitive data)
      const { data: profile } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('id', agentId)
        .single();

      const agentName = profile?.full_name || profile?.username || 'Unknown';

      // Get feedback for this agent
      const { data: feedback, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('feedback_status, call_timestamp')
        .eq('agent_id', agentId)
        .gte('call_timestamp', startOfDay(startDate).toISOString())
        .lte('call_timestamp', endOfDay(endDate).toISOString());

      if (feedbackError) throw feedbackError;

      // Get leads for this agent
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('created_at')
        .eq('agent_id', agentId)
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (leadsError) throw leadsError;

      // Create array of all days
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });

      // Aggregate by day
      const dailyTrends: AgentDailyTrend[] = allDays.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

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

        return {
          date: format(day, 'yyyy-MM-dd'),
          displayDate: format(day, 'MMM d'),
          totalCalls,
          interested,
          notInterested,
          notAnswered,
          leadsGenerated: dayLeads.length,
          conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
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

      // Calculate trend
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
          agentId,
          agentName,
          totalCalls,
          totalInterested,
          totalLeads,
          avgConversionRate,
          avgCallsPerDay,
          bestDay: bestDayData?.displayDate || 'N/A',
          bestDayCalls: bestDayData?.totalCalls || 0,
          trend,
          trendPercentage: Math.abs(trendPercentage),
        },
      };
    },
    enabled: !!user && isSupervisor && !!agentId,
  });

  return {
    agents: agents || [],
    agentsLoading,
    dailyTrends: trendData?.dailyTrends || [],
    summary: trendData?.summary || null,
    isLoading: trendsLoading,
    refetch,
  };
};
