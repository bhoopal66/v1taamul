import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, format, subDays } from 'date-fns';

export interface TeamMemberPerformance {
  agentId: string;
  agentName: string;
  username: string;
  isActive: boolean;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  conversionRate: number;
  leadsGenerated: number;
  talkTimeMinutes: number;
  loginStreak: number;
}

export interface TeamLeaderStats {
  teamName: string;
  totalMembers: number;
  activeMembers: number;
  totalCallsToday: number;
  totalLeadsToday: number;
  avgConversionRate: number;
  totalTalkTimeToday: number;
  weeklyCallsTotal: number;
  weeklyLeadsTotal: number;
}

export interface DailyTrend {
  date: string;
  totalCalls: number;
  interested: number;
  leads: number;
}

export const useTeamLeaderData = () => {
  const { user, ledTeamId } = useAuth();
  const today = new Date();

  const isTeamLeader = !!ledTeamId;

  // Fetch team info
  const { data: teamInfo } = useQuery({
    queryKey: ['team-leader-team-info', ledTeamId],
    queryFn: async () => {
      if (!ledTeamId) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, team_type')
        .eq('id', ledTeamId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isTeamLeader,
  });

  // Fetch team members with their performance
  const { data: teamMembers, isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['team-leader-members', ledTeamId],
    queryFn: async (): Promise<TeamMemberPerformance[]> => {
      if (!ledTeamId) return [];

      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Get team members - only from the team the user leads
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, is_active, login_streak_current')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) return [];

      const memberIds = profiles.map(p => p.id);

      // Get today's feedback for team members
      const { data: feedback } = await supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .in('agent_id', memberIds)
        .gte('call_timestamp', todayStart)
        .lte('call_timestamp', todayEnd);

      // Get today's leads
      const { data: leads } = await supabase
        .from('leads')
        .select('agent_id')
        .in('agent_id', memberIds)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Get today's talk time
      const todayDate = format(today, 'yyyy-MM-dd');
      const { data: talkTime } = await supabase
        .from('agent_talk_time')
        .select('agent_id, talk_time_minutes')
        .in('agent_id', memberIds)
        .eq('date', todayDate);

      // Aggregate by agent
      return profiles.map(profile => {
        const agentFeedback = feedback?.filter(f => f.agent_id === profile.id) || [];
        const agentLeads = leads?.filter(l => l.agent_id === profile.id) || [];
        const agentTalkTime = talkTime?.find(t => t.agent_id === profile.id);
        
        const totalCalls = agentFeedback.length;
        const interested = agentFeedback.filter(f => f.feedback_status === 'interested').length;
        const notInterested = agentFeedback.filter(f => f.feedback_status === 'not_interested').length;
        const notAnswered = agentFeedback.filter(f => f.feedback_status === 'not_answered').length;

        return {
          agentId: profile.id,
          agentName: profile.full_name || profile.username || 'Unknown',
          username: profile.username || '',
          isActive: profile.is_active ?? true,
          totalCalls,
          interested,
          notInterested,
          notAnswered,
          conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
          leadsGenerated: agentLeads.length,
          talkTimeMinutes: agentTalkTime?.talk_time_minutes || 0,
          loginStreak: profile.login_streak_current || 0,
        };
      });
    },
    enabled: isTeamLeader,
    refetchInterval: 30000,
  });

  // Fetch weekly trends
  const { data: weeklyTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['team-leader-weekly-trends', ledTeamId],
    queryFn: async (): Promise<DailyTrend[]> => {
      if (!ledTeamId) return [];

      // Get team member IDs first
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', ledTeamId);

      if (!profiles || profiles.length === 0) return [];

      const memberIds = profiles.map(p => p.id);
      const trends: DailyTrend[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = endOfDay(date).toISOString();

        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('feedback_status')
          .in('agent_id', memberIds)
          .gte('call_timestamp', dayStart)
          .lte('call_timestamp', dayEnd);

        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .in('agent_id', memberIds)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd);

        trends.push({
          date: format(date, 'EEE'),
          totalCalls: feedback?.length || 0,
          interested: feedback?.filter(f => f.feedback_status === 'interested').length || 0,
          leads: leads?.length || 0,
        });
      }

      return trends;
    },
    enabled: isTeamLeader,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Calculate team stats
  const teamStats: TeamLeaderStats = {
    teamName: teamInfo?.name || 'My Team',
    totalMembers: teamMembers?.length || 0,
    activeMembers: teamMembers?.filter(m => m.isActive).length || 0,
    totalCallsToday: teamMembers?.reduce((sum, m) => sum + m.totalCalls, 0) || 0,
    totalLeadsToday: teamMembers?.reduce((sum, m) => sum + m.leadsGenerated, 0) || 0,
    avgConversionRate: teamMembers && teamMembers.length > 0
      ? Math.round(teamMembers.reduce((sum, m) => sum + m.conversionRate, 0) / teamMembers.length)
      : 0,
    totalTalkTimeToday: teamMembers?.reduce((sum, m) => sum + m.talkTimeMinutes, 0) || 0,
    weeklyCallsTotal: weeklyTrends?.reduce((sum, d) => sum + d.totalCalls, 0) || 0,
    weeklyLeadsTotal: weeklyTrends?.reduce((sum, d) => sum + d.leads, 0) || 0,
  };

  return {
    teamInfo,
    teamMembers: teamMembers || [],
    teamStats,
    weeklyTrends: weeklyTrends || [],
    isLoading: membersLoading || trendsLoading,
    isTeamLeader,
    refetch: refetchMembers,
  };
};
