import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, subDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

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
  isTeamView?: boolean;
  teamMemberCount?: number;
}

export interface DailyPerformance {
  date: string;
  calls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
}

export const useAgentProfile = (agentId?: string) => {
  const { user, profile, userRole, ledTeamId } = useAuth();
  const targetUserId = agentId || user?.id;
  const today = new Date();

  // Check if user should see team aggregated data
  const isTeamViewer = !agentId && (
    userRole === 'supervisor' || userRole === 'operations_head' || 
    userRole === 'admin' || userRole === 'super_admin' || 
    userRole === 'sales_controller' || !!ledTeamId
  );

  // Fetch all-time stats
  const { data: profileStats, isLoading: statsLoading } = useQuery({
    queryKey: ['agent-profile-stats', targetUserId, isTeamViewer, ledTeamId, profile?.team_id],
    queryFn: async (): Promise<ProfileStats> => {
      if (!targetUserId) throw new Error('No user');

      // Get team member IDs if team viewer
      let teamMemberIds: string[] = [targetUserId];
      
      if (isTeamViewer) {
        const teamIdToFetch = ledTeamId || profile?.team_id;
        if (teamIdToFetch) {
          const { data: teamMembers } = await supabase
            .from('profiles')
            .select('id')
            .eq('team_id', teamIdToFetch);
          
          if (teamMembers && teamMembers.length > 0) {
            teamMemberIds = teamMembers.map(m => m.id);
          }
        }
      }

      // Get all feedback for team members
      const { data: allFeedback, error } = await supabase
        .from('call_feedback')
        .select('feedback_status, call_timestamp, agent_id')
        .in('agent_id', teamMemberIds)
        .order('call_timestamp', { ascending: true });

      if (error) throw error;

      // Get all leads for team members
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, created_at')
        .in('agent_id', teamMemberIds);

      const totalCalls = allFeedback?.length || 0;
      const interested = allFeedback?.filter(f => f.feedback_status === 'interested').length || 0;
      const totalLeads = allLeads?.length || 0;

      // Calculate best day (combined for team)
      const dailyMap = new Map<string, number>();
      allFeedback?.forEach(f => {
        if (f.call_timestamp) {
          const day = format(new Date(f.call_timestamp), 'yyyy-MM-dd');
          dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
        }
      });

      let bestDay: { date: string; calls: number } | null = null;
      dailyMap.forEach((calls, date) => {
        if (!bestDay || calls > bestDay.calls) {
          bestDay = { date, calls };
        }
      });

      // Calculate streaks (days with at least 1 call from team)
      const uniqueDays = Array.from(dailyMap.keys()).sort();
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      for (let i = 0; i < uniqueDays.length; i++) {
        if (i === 0) {
          tempStreak = 1;
        } else {
          const prevDate = new Date(uniqueDays[i - 1]);
          const currDate = new Date(uniqueDays[i]);
          const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      }

      // Check if today or yesterday is in the streak
      const todayStr = format(today, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
      
      if (dailyMap.has(todayStr) || dailyMap.has(yesterdayStr)) {
        currentStreak = tempStreak;
      }

      // Get ranking (based on individual or team performance)
      const { data: allAgentsFeedback } = await supabase
        .from('call_feedback')
        .select('agent_id');

      const agentCallCounts = new Map<string, number>();
      allAgentsFeedback?.forEach(f => {
        agentCallCounts.set(f.agent_id, (agentCallCounts.get(f.agent_id) || 0) + 1);
      });

      const sortedAgents = Array.from(agentCallCounts.entries())
        .sort((a, b) => b[1] - a[1]);
      
      // For team view, find the best ranking team member
      let rank = sortedAgents.length + 1;
      if (isTeamViewer) {
        for (const memberId of teamMemberIds) {
          const memberRank = sortedAgents.findIndex(([id]) => id === memberId) + 1;
          if (memberRank > 0 && memberRank < rank) {
            rank = memberRank;
          }
        }
      } else {
        rank = sortedAgents.findIndex(([id]) => id === targetUserId) + 1 || sortedAgents.length + 1;
      }

      return {
        totalCallsAllTime: totalCalls,
        totalInterestedAllTime: interested,
        totalLeadsAllTime: totalLeads,
        averageConversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
        bestDay,
        currentStreak,
        longestStreak,
        daysActive: uniqueDays.length,
        rank: rank || sortedAgents.length + 1,
        totalAgents: sortedAgents.length || 1,
        isTeamView: isTeamViewer,
        teamMemberCount: isTeamViewer ? teamMemberIds.length : undefined,
      };
    },
    enabled: !!targetUserId,
  });

  // Fetch monthly performance (last 6 months)
  const { data: monthlyPerformance, isLoading: monthlyLoading } = useQuery({
    queryKey: ['agent-monthly-performance', targetUserId, isTeamViewer, ledTeamId, profile?.team_id],
    queryFn: async (): Promise<MonthlyPerformance[]> => {
      if (!targetUserId) throw new Error('No user');

      // Get team member IDs if team viewer
      let teamMemberIds: string[] = [targetUserId];
      
      if (isTeamViewer) {
        const teamIdToFetch = ledTeamId || profile?.team_id;
        if (teamIdToFetch) {
          const { data: teamMembers } = await supabase
            .from('profiles')
            .select('id')
            .eq('team_id', teamIdToFetch);
          
          if (teamMembers && teamMembers.length > 0) {
            teamMemberIds = teamMembers.map(m => m.id);
          }
        }
      }

      const months: MonthlyPerformance[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const monthStart = startOfMonth(monthDate).toISOString();
        const monthEnd = endOfMonth(monthDate).toISOString();

        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('feedback_status')
          .in('agent_id', teamMemberIds)
          .gte('call_timestamp', monthStart)
          .lte('call_timestamp', monthEnd);

        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .in('agent_id', teamMemberIds)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        const calls = feedback?.length || 0;
        const interested = feedback?.filter(f => f.feedback_status === 'interested').length || 0;

        months.push({
          month: format(monthDate, 'MMM'),
          calls,
          interested,
          leads: leads?.length || 0,
          conversionRate: calls > 0 ? Math.round((interested / calls) * 100) : 0,
        });
      }

      return months;
    },
    enabled: !!targetUserId,
  });

  // Fetch daily performance (last 30 days)
  const { data: dailyPerformance, isLoading: dailyLoading } = useQuery({
    queryKey: ['agent-daily-performance', targetUserId, isTeamViewer, ledTeamId, profile?.team_id],
    queryFn: async (): Promise<DailyPerformance[]> => {
      if (!targetUserId) throw new Error('No user');

      // Get team member IDs if team viewer
      let teamMemberIds: string[] = [targetUserId];
      
      if (isTeamViewer) {
        const teamIdToFetch = ledTeamId || profile?.team_id;
        if (teamIdToFetch) {
          const { data: teamMembers } = await supabase
            .from('profiles')
            .select('id')
            .eq('team_id', teamIdToFetch);
          
          if (teamMembers && teamMembers.length > 0) {
            teamMemberIds = teamMembers.map(m => m.id);
          }
        }
      }

      const thirtyDaysAgo = subDays(today, 30);
      
      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('feedback_status, call_timestamp')
        .in('agent_id', teamMemberIds)
        .gte('call_timestamp', startOfDay(thirtyDaysAgo).toISOString())
        .order('call_timestamp', { ascending: true });

      if (error) throw error;

      // Group by day
      const dailyMap = new Map<string, DailyPerformance>();

      // Initialize all 30 days
      for (let i = 29; i >= 0; i--) {
        const day = subDays(today, i);
        const dateStr = format(day, 'MMM d');
        dailyMap.set(dateStr, {
          date: dateStr,
          calls: 0,
          interested: 0,
          notInterested: 0,
          notAnswered: 0,
        });
      }

      feedback?.forEach(f => {
        if (f.call_timestamp) {
          const dateStr = format(new Date(f.call_timestamp), 'MMM d');
          const current = dailyMap.get(dateStr);
          if (current) {
            current.calls++;
            if (f.feedback_status === 'interested') current.interested++;
            if (f.feedback_status === 'not_interested') current.notInterested++;
            if (f.feedback_status === 'not_answered') current.notAnswered++;
          }
        }
      });

      return Array.from(dailyMap.values());
    },
    enabled: !!targetUserId,
  });

  // Calculate achievements
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
