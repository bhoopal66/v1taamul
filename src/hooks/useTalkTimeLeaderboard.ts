import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns';

export type TimePeriod = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all_time';

export interface TalkTimeAgent {
  id: string;
  rank: number;
  name: string;
  username: string;
  avatarUrl: string | null;
  talkTimeMinutes: number;
  teamId: string | null;
  teamName: string | null;
  trend: 'up' | 'down' | 'stable' | 'new';
  previousRank: number | null;
}

export interface TeamTalkTimeStats {
  teamId: string;
  teamName: string;
  totalTalkTime: number;
  agentCount: number;
  avgTalkTime: number;
}

interface UseTalkTimeLeaderboardOptions {
  timePeriod: TimePeriod;
  teamFilter?: string | null;
}

const getDateRange = (period: TimePeriod): { start: string | null; end: string | null } => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      return {
        start: format(startOfDay(today), 'yyyy-MM-dd'),
        end: format(endOfDay(today), 'yyyy-MM-dd'),
      };
    case 'this_week':
      return {
        start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'last_week':
      const lastWeek = subWeeks(today, 1);
      return {
        start: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'this_month':
      return {
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      };
    case 'last_month':
      const lastMonth = subMonths(today, 1);
      return {
        start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    case 'all_time':
    default:
      return { start: null, end: null };
  }
};

const getPreviousDateRange = (period: TimePeriod): { start: string | null; end: string | null } => {
  const today = new Date();
  
  switch (period) {
    case 'today':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: format(yesterday, 'yyyy-MM-dd'),
        end: format(yesterday, 'yyyy-MM-dd'),
      };
    case 'this_week':
      const prevWeek = subWeeks(today, 1);
      return {
        start: format(startOfWeek(prevWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(prevWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'last_week':
      const twoWeeksAgo = subWeeks(today, 2);
      return {
        start: format(startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(twoWeeksAgo, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'this_month':
      const prevMonth = subMonths(today, 1);
      return {
        start: format(startOfMonth(prevMonth), 'yyyy-MM-dd'),
        end: format(endOfMonth(prevMonth), 'yyyy-MM-dd'),
      };
    case 'last_month':
      const twoMonthsAgo = subMonths(today, 2);
      return {
        start: format(startOfMonth(twoMonthsAgo), 'yyyy-MM-dd'),
        end: format(endOfMonth(twoMonthsAgo), 'yyyy-MM-dd'),
      };
    default:
      return { start: null, end: null };
  }
};

export const useTalkTimeLeaderboard = ({ timePeriod, teamFilter }: UseTalkTimeLeaderboardOptions) => {
  const { data, isLoading } = useQuery({
    queryKey: ['talk-time-leaderboard', timePeriod, teamFilter],
    queryFn: async () => {
      const { start, end } = getDateRange(timePeriod);
      const previousRange = getPreviousDateRange(timePeriod);

      // Fetch all active agents with their profiles and team info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, team_id, teams:team_id(id, name)')
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Fetch talk time data for current period
      let talkTimeQuery = supabase
        .from('agent_talk_time')
        .select('agent_id, talk_time_minutes, date');

      if (start && end) {
        talkTimeQuery = talkTimeQuery.gte('date', start).lte('date', end);
      }

      const { data: talkTimeData } = await talkTimeQuery;

      // Fetch previous period talk time for trend calculation
      let previousTalkTimeData: { agent_id: string; talk_time_minutes: number }[] = [];
      if (previousRange.start && previousRange.end) {
        const { data: prevData } = await supabase
          .from('agent_talk_time')
          .select('agent_id, talk_time_minutes')
          .gte('date', previousRange.start)
          .lte('date', previousRange.end);
        previousTalkTimeData = prevData || [];
      }

      // Aggregate talk time per agent
      const agentTalkTime = new Map<string, number>();
      const previousAgentTalkTime = new Map<string, number>();

      talkTimeData?.forEach(t => {
        const current = agentTalkTime.get(t.agent_id) || 0;
        agentTalkTime.set(t.agent_id, current + (t.talk_time_minutes || 0));
      });

      previousTalkTimeData?.forEach(t => {
        const current = previousAgentTalkTime.get(t.agent_id) || 0;
        previousAgentTalkTime.set(t.agent_id, current + (t.talk_time_minutes || 0));
      });

      // Calculate previous rankings
      const previousRankings = Array.from(previousAgentTalkTime.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id], index) => ({ id, rank: index + 1 }));
      const previousRankMap = new Map(previousRankings.map(r => [r.id, r.rank]));

      // Build leaderboard
      let agents: TalkTimeAgent[] = profiles
        ?.filter(p => {
          if (teamFilter && teamFilter !== 'all') {
            return p.team_id === teamFilter;
          }
          return true;
        })
        .map(p => {
          const talkTime = agentTalkTime.get(p.id) || 0;
          const previousRank = previousRankMap.get(p.id) || null;
          const team = p.teams as { id: string; name: string } | null;

          return {
            id: p.id,
            rank: 0,
            name: p.full_name || p.username || 'Unknown',
            username: p.username,
            avatarUrl: p.avatar_url,
            talkTimeMinutes: talkTime,
            teamId: p.team_id,
            teamName: team?.name || null,
            trend: 'stable' as const,
            previousRank,
          };
        }) || [];

      // Sort by talk time and assign ranks
      agents.sort((a, b) => b.talkTimeMinutes - a.talkTimeMinutes);
      agents = agents.map((agent, index) => {
        const rank = index + 1;
        let trend: 'up' | 'down' | 'stable' | 'new' = 'stable';

        if (agent.previousRank === null) {
          trend = agent.talkTimeMinutes > 0 ? 'new' : 'stable';
        } else if (rank < agent.previousRank) {
          trend = 'up';
        } else if (rank > agent.previousRank) {
          trend = 'down';
        }

        return { ...agent, rank, trend };
      });

      // Calculate team stats
      const teamStatsMap = new Map<string, TeamTalkTimeStats>();

      profiles?.forEach(p => {
        if (p.team_id) {
          const talkTime = agentTalkTime.get(p.id) || 0;
          const team = p.teams as { id: string; name: string } | null;
          const existing = teamStatsMap.get(p.team_id) || {
            teamId: p.team_id,
            teamName: team?.name || 'Unknown Team',
            totalTalkTime: 0,
            agentCount: 0,
            avgTalkTime: 0,
          };

          existing.totalTalkTime += talkTime;
          existing.agentCount++;
          teamStatsMap.set(p.team_id, existing);
        }
      });

      // Calculate averages
      const teamStats = Array.from(teamStatsMap.values()).map(team => ({
        ...team,
        avgTalkTime: team.agentCount > 0 ? Math.round(team.totalTalkTime / team.agentCount) : 0,
      }));

      teamStats.sort((a, b) => b.totalTalkTime - a.totalTalkTime);

      return {
        agents,
        teamStats,
        totalAgents: agents.length,
      };
    },
  });

  return {
    agents: data?.agents || [],
    teamStats: data?.teamStats || [],
    totalAgents: data?.totalAgents || 0,
    isLoading,
  };
};
