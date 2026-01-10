import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns';

export type TimePeriod = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'six_months' | 'all_time';

export interface LeaderboardAgent {
  id: string;
  rank: number;
  name: string;
  username: string;
  avatarUrl: string | null;
  totalCalls: number;
  interestedCalls: number;
  leadsGenerated: number;
  conversionRate: number;
  supervisorId: string | null;
  supervisorName?: string;
  trend: 'up' | 'down' | 'stable' | 'new';
  previousRank: number | null;
}

export interface TeamStats {
  teamName: string;
  supervisorId: string;
  supervisorName: string;
  totalAgents: number;
  totalCalls: number;
  totalInterested: number;
  totalLeads: number;
  avgConversionRate: number;
}

interface UseLeaderboardOptions {
  timePeriod: TimePeriod;
  teamFilter?: string | null;
}

const getDateRange = (period: TimePeriod): { start: Date | null; end: Date | null } => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      return {
        start: startOfDay(today),
        end: endOfDay(today),
      };
    case 'this_week':
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      };
    case 'last_week':
      const lastWeek = subWeeks(today, 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    case 'this_month':
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    case 'six_months':
      return {
        start: subMonths(today, 6),
        end: today,
      };
    case 'all_time':
    default:
      return { start: null, end: null };
  }
};

export const useLeaderboard = ({ timePeriod, teamFilter }: UseLeaderboardOptions) => {
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['leaderboard', timePeriod, teamFilter],
    queryFn: async () => {
      const { start, end } = getDateRange(timePeriod);
      
      // Fetch all agents with their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, supervisor_id')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch supervisors for team names
      const supervisorIds = [...new Set(profiles?.map(p => p.supervisor_id).filter(Boolean))];
      const { data: supervisors } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', supervisorIds);

      const supervisorMap = new Map(supervisors?.map(s => [s.id, s.full_name]) || []);

      // Build feedback query
      let feedbackQuery = supabase
        .from('call_feedback')
        .select('agent_id, feedback_status');

      if (start && end) {
        feedbackQuery = feedbackQuery
          .gte('call_timestamp', start.toISOString())
          .lte('call_timestamp', end.toISOString());
      }

      const { data: feedback } = await feedbackQuery;

      // Build leads query
      let leadsQuery = supabase
        .from('leads')
        .select('agent_id');

      if (start && end) {
        leadsQuery = leadsQuery
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
      }

      const { data: leads } = await leadsQuery;

      // Get previous period data for trend calculation
      let previousPeriodFeedback: typeof feedback = [];
      if (timePeriod !== 'all_time') {
        const previousRange = getPreviousDateRange(timePeriod);
        if (previousRange.start && previousRange.end) {
          const { data: prevFeedback } = await supabase
            .from('call_feedback')
            .select('agent_id, feedback_status')
            .gte('call_timestamp', previousRange.start.toISOString())
            .lte('call_timestamp', previousRange.end.toISOString());
          previousPeriodFeedback = prevFeedback || [];
        }
      }

      // Aggregate stats per agent
      const agentStats = new Map<string, {
        totalCalls: number;
        interestedCalls: number;
        leadsGenerated: number;
      }>();

      const previousAgentStats = new Map<string, { totalCalls: number }>();

      feedback?.forEach(f => {
        const current = agentStats.get(f.agent_id) || { totalCalls: 0, interestedCalls: 0, leadsGenerated: 0 };
        current.totalCalls++;
        if (f.feedback_status === 'interested') current.interestedCalls++;
        agentStats.set(f.agent_id, current);
      });

      leads?.forEach(l => {
        const current = agentStats.get(l.agent_id) || { totalCalls: 0, interestedCalls: 0, leadsGenerated: 0 };
        current.leadsGenerated++;
        agentStats.set(l.agent_id, current);
      });

      previousPeriodFeedback?.forEach(f => {
        const current = previousAgentStats.get(f.agent_id) || { totalCalls: 0 };
        current.totalCalls++;
        previousAgentStats.set(f.agent_id, current);
      });

      // Calculate previous rankings
      const previousRankings = Array.from(previousAgentStats.entries())
        .sort((a, b) => b[1].totalCalls - a[1].totalCalls)
        .map(([id], index) => ({ id, rank: index + 1 }));
      const previousRankMap = new Map(previousRankings.map(r => [r.id, r.rank]));

      // Build leaderboard
      let agents: LeaderboardAgent[] = profiles
        ?.filter(p => {
          if (teamFilter && teamFilter !== 'all') {
            return p.supervisor_id === teamFilter;
          }
          return true;
        })
        .map(p => {
          const stats = agentStats.get(p.id) || { totalCalls: 0, interestedCalls: 0, leadsGenerated: 0 };
          const conversionRate = stats.totalCalls > 0 
            ? Math.round((stats.interestedCalls / stats.totalCalls) * 100) 
            : 0;

          const previousRank = previousRankMap.get(p.id) || null;

          return {
            id: p.id,
            rank: 0,
            name: p.full_name || p.username || 'Unknown',
            username: p.username,
            avatarUrl: p.avatar_url,
            totalCalls: stats.totalCalls,
            interestedCalls: stats.interestedCalls,
            leadsGenerated: stats.leadsGenerated,
            conversionRate,
            supervisorId: p.supervisor_id,
            supervisorName: p.supervisor_id ? supervisorMap.get(p.supervisor_id) || 'Unknown' : undefined,
            trend: 'stable' as const,
            previousRank,
          };
        }) || [];

      // Sort by total calls and assign ranks
      agents.sort((a, b) => b.totalCalls - a.totalCalls);
      agents = agents.map((agent, index) => {
        const rank = index + 1;
        let trend: 'up' | 'down' | 'stable' | 'new' = 'stable';
        
        if (agent.previousRank === null) {
          trend = agent.totalCalls > 0 ? 'new' : 'stable';
        } else if (rank < agent.previousRank) {
          trend = 'up';
        } else if (rank > agent.previousRank) {
          trend = 'down';
        }

        return { ...agent, rank, trend };
      });

      // Calculate team stats
      const teamStatsMap = new Map<string, TeamStats>();
      
      profiles?.forEach(p => {
        if (p.supervisor_id) {
          const stats = agentStats.get(p.id) || { totalCalls: 0, interestedCalls: 0, leadsGenerated: 0 };
          const existing = teamStatsMap.get(p.supervisor_id) || {
            teamName: supervisorMap.get(p.supervisor_id) || 'Unknown Team',
            supervisorId: p.supervisor_id,
            supervisorName: supervisorMap.get(p.supervisor_id) || 'Unknown',
            totalAgents: 0,
            totalCalls: 0,
            totalInterested: 0,
            totalLeads: 0,
            avgConversionRate: 0,
          };

          existing.totalAgents++;
          existing.totalCalls += stats.totalCalls;
          existing.totalInterested += stats.interestedCalls;
          existing.totalLeads += stats.leadsGenerated;
          teamStatsMap.set(p.supervisor_id, existing);
        }
      });

      // Calculate average conversion for teams
      const teamStats = Array.from(teamStatsMap.values()).map(team => ({
        ...team,
        avgConversionRate: team.totalCalls > 0 
          ? Math.round((team.totalInterested / team.totalCalls) * 100) 
          : 0,
      }));

      teamStats.sort((a, b) => b.totalCalls - a.totalCalls);

      return {
        agents,
        teamStats,
        totalAgents: agents.length,
        periodLabel: getPeriodLabel(timePeriod),
      };
    },
  });

  return {
    agents: leaderboardData?.agents || [],
    teamStats: leaderboardData?.teamStats || [],
    totalAgents: leaderboardData?.totalAgents || 0,
    periodLabel: leaderboardData?.periodLabel || '',
    isLoading,
  };
};

const getPreviousDateRange = (period: TimePeriod): { start: Date | null; end: Date | null } => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      const yesterday = subWeeks(today, 0);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    case 'this_week':
      const prevWeek = subWeeks(today, 1);
      return {
        start: startOfWeek(prevWeek, { weekStartsOn: 1 }),
        end: endOfWeek(prevWeek, { weekStartsOn: 1 }),
      };
    case 'last_week':
      const twoWeeksAgo = subWeeks(today, 2);
      return {
        start: startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }),
        end: endOfWeek(twoWeeksAgo, { weekStartsOn: 1 }),
      };
    case 'this_month':
      const prevMonth = subMonths(today, 1);
      return {
        start: startOfMonth(prevMonth),
        end: endOfMonth(prevMonth),
      };
    case 'last_month':
      const twoMonthsAgo = subMonths(today, 2);
      return {
        start: startOfMonth(twoMonthsAgo),
        end: endOfMonth(twoMonthsAgo),
      };
    case 'six_months':
      return {
        start: subMonths(today, 12),
        end: subMonths(today, 6),
      };
    default:
      return { start: null, end: null };
  }
};

const getPeriodLabel = (period: TimePeriod): string => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      return format(today, 'EEEE, MMMM d, yyyy');
    case 'this_week':
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    case 'last_week':
      const lastWeek = subWeeks(today, 1);
      const lwStart = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const lwEnd = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return `${format(lwStart, 'MMM d')} - ${format(lwEnd, 'MMM d, yyyy')}`;
    case 'this_month':
      return format(today, 'MMMM yyyy');
    case 'last_month':
      return format(subMonths(today, 1), 'MMMM yyyy');
    case 'six_months':
      return `${format(subMonths(today, 6), 'MMM yyyy')} - ${format(today, 'MMM yyyy')}`;
    case 'all_time':
      return 'All Time';
    default:
      return '';
  }
};
