import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AgentActivity } from '@/components/supervisor/AgentActivityMonitor';

interface UseAgentActivityOptions {
  teamId?: string;
  refreshInterval?: number;
}

export const useAgentActivity = ({ teamId, refreshInterval = 60000 }: UseAgentActivityOptions = {}) => {
  const { userRole, ledTeamId, user } = useAuth();

  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || (!canSeeAllTeams ? ledTeamId : undefined);

  const { data: agents = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-activity', effectiveTeamId, user?.id],
    queryFn: async (): Promise<AgentActivity[]> => {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // First, get the agents based on team filter
      let agentsQuery = supabase
        .from('profiles')
        .select('id, full_name, username, is_active')
        .eq('is_active', true);

      if (effectiveTeamId) {
        agentsQuery = agentsQuery.eq('team_id', effectiveTeamId);
      }

      const { data: profilesData, error: profilesError } = await agentsQuery;
      if (profilesError) throw profilesError;

      if (!profilesData || profilesData.length === 0) {
        return [];
      }

      const agentIds = profilesData.map(p => p.id);

      // Get today's call feedback for these agents
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('agent_id, feedback_status, call_timestamp')
        .in('agent_id', agentIds)
        .gte('call_timestamp', `${today}T00:00:00`)
        .order('call_timestamp', { ascending: false });

      if (feedbackError) throw feedbackError;

      // Process the data to get activity metrics per agent
      const agentMetrics: Record<string, {
        lastCallTime: string | null;
        todayCalls: number;
        todayInterested: number;
      }> = {};

      // Initialize metrics for all agents
      agentIds.forEach(id => {
        agentMetrics[id] = {
          lastCallTime: null,
          todayCalls: 0,
          todayInterested: 0,
        };
      });

      // Process feedback data
      (feedbackData || []).forEach(feedback => {
        const metrics = agentMetrics[feedback.agent_id];
        if (metrics) {
          metrics.todayCalls++;
          if (feedback.feedback_status === 'interested') {
            metrics.todayInterested++;
          }
          // Set last call time (first one we encounter is the most recent due to ordering)
          if (!metrics.lastCallTime && feedback.call_timestamp) {
            metrics.lastCallTime = feedback.call_timestamp;
          }
        }
      });

      // Map to AgentActivity format
      return profilesData.map(profile => ({
        agentId: profile.id,
        agentName: profile.full_name || 'Unknown',
        username: profile.username || profile.id.slice(0, 8),
        lastCallTime: agentMetrics[profile.id]?.lastCallTime || null,
        todayCalls: agentMetrics[profile.id]?.todayCalls || 0,
        todayInterested: agentMetrics[profile.id]?.todayInterested || 0,
        isActive: profile.is_active || false,
      }));
    },
    refetchInterval: refreshInterval,
    staleTime: 30000,
  });

  return {
    agents,
    isLoading,
    refetch,
  };
};
