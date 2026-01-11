import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export interface TeamPerformanceData {
  teamId: string;
  teamName: string;
  teamType: 'remote' | 'office';
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
  memberCount: number;
  avgCallsPerAgent: number;
}

export interface TeamPerformanceSummary {
  totalCalls: number;
  totalLeads: number;
  avgConversionRate: number;
  bestTeam: string | null;
  worstTeam: string | null;
}

interface UseTeamPerformanceOptions {
  days?: number;
}

export const useTeamPerformance = (options: UseTeamPerformanceOptions = {}) => {
  const { user, userRole } = useAuth();
  const { days = 30 } = options;

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['team-performance-comparison', days],
    queryFn: async () => {
      const start = startOfDay(subDays(new Date(), days - 1)).toISOString();
      const end = endOfDay(new Date()).toISOString();

      // Get all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, team_type');

      if (teamsError) throw teamsError;

      // Get all profiles with team assignments
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, team_id')
        .not('team_id', 'is', null);

      // Create map of team_id to agent_ids
      const teamAgentsMap = new Map<string, string[]>();
      profilesData?.forEach(p => {
        if (p.team_id) {
          const existing = teamAgentsMap.get(p.team_id) || [];
          teamAgentsMap.set(p.team_id, [...existing, p.id]);
        }
      });

      // Get call feedback data
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .gte('call_timestamp', start)
        .lte('call_timestamp', end);

      if (feedbackError) throw feedbackError;

      // Get leads data
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('agent_id')
        .gte('created_at', start)
        .lte('created_at', end);

      if (leadsError) throw leadsError;

      // Create agent to team map
      const agentTeamMap = new Map<string, string>();
      profilesData?.forEach(p => {
        if (p.team_id) {
          agentTeamMap.set(p.id, p.team_id);
        }
      });

      // Aggregate data by team
      const teamStatsMap = new Map<string, {
        totalCalls: number;
        interested: number;
        notInterested: number;
        notAnswered: number;
        leadsGenerated: number;
      }>();

      // Initialize all teams
      teamsData?.forEach(team => {
        teamStatsMap.set(team.id, {
          totalCalls: 0,
          interested: 0,
          notInterested: 0,
          notAnswered: 0,
          leadsGenerated: 0,
        });
      });

      // Aggregate feedback
      feedbackData?.forEach(f => {
        const teamId = agentTeamMap.get(f.agent_id);
        if (teamId && teamStatsMap.has(teamId)) {
          const stats = teamStatsMap.get(teamId)!;
          stats.totalCalls++;
          if (f.feedback_status === 'interested') stats.interested++;
          else if (f.feedback_status === 'not_interested') stats.notInterested++;
          else if (f.feedback_status === 'not_answered') stats.notAnswered++;
        }
      });

      // Aggregate leads
      leadsData?.forEach(l => {
        const teamId = agentTeamMap.get(l.agent_id);
        if (teamId && teamStatsMap.has(teamId)) {
          const stats = teamStatsMap.get(teamId)!;
          stats.leadsGenerated++;
        }
      });

      // Build final performance data
      const performanceData: TeamPerformanceData[] = (teamsData || []).map(team => {
        const stats = teamStatsMap.get(team.id) || {
          totalCalls: 0,
          interested: 0,
          notInterested: 0,
          notAnswered: 0,
          leadsGenerated: 0,
        };
        const memberCount = teamAgentsMap.get(team.id)?.length || 0;
        const conversionRate = stats.totalCalls > 0 
          ? Math.round((stats.interested / stats.totalCalls) * 100) 
          : 0;
        const avgCallsPerAgent = memberCount > 0 
          ? Math.round(stats.totalCalls / memberCount) 
          : 0;

        return {
          teamId: team.id,
          teamName: team.name,
          teamType: team.team_type as 'remote' | 'office',
          ...stats,
          conversionRate,
          memberCount,
          avgCallsPerAgent,
        };
      }).sort((a, b) => b.totalCalls - a.totalCalls);

      // Calculate summary
      const totalCalls = performanceData.reduce((sum, t) => sum + t.totalCalls, 0);
      const totalLeads = performanceData.reduce((sum, t) => sum + t.leadsGenerated, 0);
      const avgConversionRate = performanceData.length > 0
        ? Math.round(performanceData.reduce((sum, t) => sum + t.conversionRate, 0) / performanceData.length)
        : 0;

      const teamsWithCalls = performanceData.filter(t => t.totalCalls > 0);
      const bestTeam = teamsWithCalls.length > 0
        ? teamsWithCalls.reduce((best, t) => t.conversionRate > best.conversionRate ? t : best).teamName
        : null;
      const worstTeam = teamsWithCalls.length > 0
        ? teamsWithCalls.reduce((worst, t) => t.conversionRate < worst.conversionRate ? t : worst).teamName
        : null;

      const summary: TeamPerformanceSummary = {
        totalCalls,
        totalLeads,
        avgConversionRate,
        bestTeam,
        worstTeam,
      };

      return {
        performanceData,
        summary,
      };
    },
    enabled: !!user?.id && isAdmin,
    refetchInterval: 60000, // Refresh every minute
  });

  return {
    teamPerformance: data?.performanceData || [],
    summary: data?.summary || {
      totalCalls: 0,
      totalLeads: 0,
      avgConversionRate: 0,
      bestTeam: null,
      worstTeam: null,
    },
    isLoading,
    refetch,
  };
};
