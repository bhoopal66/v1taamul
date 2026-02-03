import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';

export interface AgentDailyStats {
  agentId: string;
  agentName: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
}

export interface AllAgentsSummary {
  totalAgents: number;
  totalCalls: number;
  totalInterested: number;
  totalNotInterested: number;
  totalNotAnswered: number;
  totalLeads: number;
  avgConversionRate: number;
}

export interface AgentOption {
  id: string;
  name: string;
}

interface UseAllAgentsPerformanceOptions {
  selectedAgentId?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
}

export const useAllAgentsPerformance = (options: UseAllAgentsPerformanceOptions = {}) => {
  const { user, userRole, ledTeamId, profile } = useAuth();
  const { 
    selectedAgentId = null, 
    dateFrom = startOfMonth(new Date()), 
    dateTo = endOfMonth(new Date()) 
  } = options;

  // Admin and super_admin can see ALL agents across ALL teams (global view)
  // operations_head also has global view
  // Supervisors and team leaders only see their team
  const canSeeAllAgents = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  
  // Determine the team ID to filter by (for supervisors and team leaders only)
  // Admins don't need team filtering - they see everyone
  const effectiveTeamId = canSeeAllAgents ? null : (ledTeamId || (userRole === 'supervisor' ? profile?.team_id : null));

  // Fetch all agents (filtered by team for supervisors and team leaders)
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['all-agents-list', effectiveTeamId, canSeeAllAgents, user?.id],
    queryFn: async (): Promise<AgentOption[]> => {
      let query = supabase
        .from('profiles_public')
        .select('id, full_name, username, team_id')
        .eq('is_active', true)
        .order('full_name');

      // If not admin/super_admin/ops_head, filter by their team
      if (!canSeeAllAgents && effectiveTeamId) {
        query = query.eq('team_id', effectiveTeamId);
      } else if (!canSeeAllAgents && !effectiveTeamId && user?.id) {
        // Supervisor without team - show directly supervised agents
        query = query.eq('supervisor_id', user.id);
      }

      const { data: profiles, error } = await query;

      if (error) throw error;

      return (profiles || []).map(p => ({
        id: p.id,
        name: p.full_name || p.username || 'Unknown Agent',
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch performance data for all agents or selected agent
  const { data: performanceData, isLoading: performanceLoading, refetch } = useQuery({
    queryKey: ['all-agents-performance', selectedAgentId, dateFrom?.toISOString(), dateTo?.toISOString(), ledTeamId, canSeeAllAgents],
    queryFn: async () => {
      const start = startOfDay(dateFrom).toISOString();
      const end = endOfDay(dateTo).toISOString();

      // Get list of agent IDs we can view (for team filtering)
      let agentIds: string[] | null = null;
      if (!canSeeAllAgents && effectiveTeamId) {
        const { data: teamProfiles } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        agentIds = teamProfiles?.map(p => p.id) || [];
      } else if (!canSeeAllAgents && !effectiveTeamId && user?.id) {
        // Supervisor without team - get directly supervised agents
        const { data: supervisedProfiles } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        agentIds = supervisedProfiles?.map(p => p.id) || [];
      }

      // Build the query for call feedback
      let feedbackQuery = supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .gte('call_timestamp', start)
        .lte('call_timestamp', end);

      if (selectedAgentId) {
        feedbackQuery = feedbackQuery.eq('agent_id', selectedAgentId);
      } else if (agentIds && agentIds.length > 0) {
        feedbackQuery = feedbackQuery.in('agent_id', agentIds);
      }

      const { data: feedback, error: feedbackError } = await feedbackQuery;
      if (feedbackError) throw feedbackError;

      // Build the query for leads
      let leadsQuery = supabase
        .from('leads')
        .select('agent_id')
        .gte('created_at', start)
        .lte('created_at', end);

      if (selectedAgentId) {
        leadsQuery = leadsQuery.eq('agent_id', selectedAgentId);
      } else if (agentIds && agentIds.length > 0) {
        leadsQuery = leadsQuery.in('agent_id', agentIds);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Get profiles for agent names (filtered by team if needed) - using profiles_public
      let profilesQuery = supabase
        .from('profiles_public')
        .select('id, full_name, username');
      
      if (agentIds && agentIds.length > 0) {
        profilesQuery = profilesQuery.in('id', agentIds);
      }
      
      const { data: profiles } = await profilesQuery;

      // Aggregate data by agent
      const agentMap = new Map<string, AgentDailyStats>();

      feedback?.forEach(f => {
        if (!agentMap.has(f.agent_id)) {
          const profile = profiles?.find(p => p.id === f.agent_id);
          agentMap.set(f.agent_id, {
            agentId: f.agent_id,
            agentName: profile?.full_name || profile?.username || 'Unknown Agent',
            totalCalls: 0,
            interested: 0,
            notInterested: 0,
            notAnswered: 0,
            leadsGenerated: 0,
            conversionRate: 0,
          });
        }
        
        const stats = agentMap.get(f.agent_id)!;
        stats.totalCalls++;
        
        if (f.feedback_status === 'interested') stats.interested++;
        else if (f.feedback_status === 'not_interested') stats.notInterested++;
        else if (f.feedback_status === 'not_answered') stats.notAnswered++;
      });

      // Add leads count
      leads?.forEach(l => {
        const stats = agentMap.get(l.agent_id);
        if (stats) {
          stats.leadsGenerated++;
        }
      });

      // Calculate conversion rates
      const agentStats: AgentDailyStats[] = Array.from(agentMap.values()).map(stats => ({
        ...stats,
        conversionRate: stats.totalCalls > 0 
          ? Math.round((stats.interested / stats.totalCalls) * 100) 
          : 0,
      }));

      // Calculate summary
      const summary: AllAgentsSummary = {
        totalAgents: agentStats.length,
        totalCalls: agentStats.reduce((sum, a) => sum + a.totalCalls, 0),
        totalInterested: agentStats.reduce((sum, a) => sum + a.interested, 0),
        totalNotInterested: agentStats.reduce((sum, a) => sum + a.notInterested, 0),
        totalNotAnswered: agentStats.reduce((sum, a) => sum + a.notAnswered, 0),
        totalLeads: agentStats.reduce((sum, a) => sum + a.leadsGenerated, 0),
        avgConversionRate: agentStats.length > 0
          ? Math.round(agentStats.reduce((sum, a) => sum + a.conversionRate, 0) / agentStats.length)
          : 0,
      };

      return {
        agentStats: agentStats.sort((a, b) => b.totalCalls - a.totalCalls),
        summary,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  return {
    agents: agents || [],
    agentStats: performanceData?.agentStats || [],
    summary: performanceData?.summary || {
      totalAgents: 0,
      totalCalls: 0,
      totalInterested: 0,
      totalNotInterested: 0,
      totalNotAnswered: 0,
      totalLeads: 0,
      avgConversionRate: 0,
    },
    isLoading: agentsLoading || performanceLoading,
    refetch,
  };
};
