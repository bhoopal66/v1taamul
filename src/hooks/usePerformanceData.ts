import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, format, subDays, startOfWeek, addDays } from 'date-fns';

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

export const usePerformanceData = () => {
  const { user, userRole } = useAuth();
  const today = new Date();

  // Fetch today's stats for current user
  const { data: myStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['my-performance', user?.id],
    queryFn: async (): Promise<PerformanceStats> => {
      if (!user?.id) throw new Error('No user');

      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Get call feedback for today
      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('feedback_status, whatsapp_sent')
        .eq('agent_id', user.id)
        .gte('call_timestamp', todayStart)
        .lte('call_timestamp', todayEnd);

      if (error) throw error;

      const stats = {
        totalCalls: feedback?.length || 0,
        interested: feedback?.filter(f => f.feedback_status === 'interested').length || 0,
        notInterested: feedback?.filter(f => f.feedback_status === 'not_interested').length || 0,
        notAnswered: feedback?.filter(f => f.feedback_status === 'not_answered').length || 0,
        whatsappSent: feedback?.filter(f => f.whatsapp_sent).length || 0,
        leadsGenerated: 0,
        conversionRate: 0,
      };

      // Get leads generated today
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('agent_id', user.id)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      stats.leadsGenerated = leads?.length || 0;
      stats.conversionRate = stats.totalCalls > 0 
        ? Math.round((stats.interested / stats.totalCalls) * 100) 
        : 0;

      return stats;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time feel
  });

  // Fetch hourly call data for chart
  const { data: hourlyData, isLoading: hourlyLoading, refetch: refetchHourly } = useQuery({
    queryKey: ['hourly-calls', user?.id],
    queryFn: async (): Promise<HourlyCallData[]> => {
      if (!user?.id) throw new Error('No user');

      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('call_timestamp, feedback_status')
        .eq('agent_id', user.id)
        .gte('call_timestamp', todayStart)
        .lte('call_timestamp', todayEnd)
        .order('call_timestamp', { ascending: true });

      if (error) throw error;

      // Group by hour
      const hourlyMap = new Map<string, { calls: number; interested: number; notInterested: number }>();
      
      // Initialize all hours from 8 AM to 8 PM
      for (let h = 8; h <= 20; h++) {
        const hourKey = `${h.toString().padStart(2, '0')}:00`;
        hourlyMap.set(hourKey, { calls: 0, interested: 0, notInterested: 0 });
      }

      feedback?.forEach(f => {
        if (f.call_timestamp) {
          const hour = format(new Date(f.call_timestamp), 'HH:00');
          const current = hourlyMap.get(hour) || { calls: 0, interested: 0, notInterested: 0 };
          current.calls++;
          if (f.feedback_status === 'interested') current.interested++;
          if (f.feedback_status === 'not_interested') current.notInterested++;
          hourlyMap.set(hour, current);
        }
      });

      return Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        hour,
        ...data,
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Fetch weekly trend data
  const { data: weeklyData, isLoading: weeklyLoading, refetch: refetchWeekly } = useQuery({
    queryKey: ['weekly-trend', user?.id],
    queryFn: async (): Promise<WeeklyTrendData[]> => {
      if (!user?.id) throw new Error('No user');

      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const days: WeeklyTrendData[] = [];

      for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i);
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = endOfDay(day).toISOString();

        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('feedback_status')
          .eq('agent_id', user.id)
          .gte('call_timestamp', dayStart)
          .lte('call_timestamp', dayEnd);

        const calls = feedback?.length || 0;
        const interested = feedback?.filter(f => f.feedback_status === 'interested').length || 0;
        const notInterested = feedback?.filter(f => f.feedback_status === 'not_interested').length || 0;

        days.push({
          day: format(day, 'EEE'),
          date: format(day, 'MMM d'),
          calls,
          interested,
          notInterested,
          conversionRate: calls > 0 ? Math.round((interested / calls) * 100) : 0,
        });
      }

      return days;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async (): Promise<RecentActivity[]> => {
      if (!user?.id) throw new Error('No user');

      const todayStart = startOfDay(today).toISOString();

      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select(`
          id,
          feedback_status,
          call_timestamp,
          contact_id,
          master_contacts!call_feedback_contact_id_fkey (
            company_name,
            contact_person_name
          )
        `)
        .eq('agent_id', user.id)
        .gte('call_timestamp', todayStart)
        .order('call_timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (feedback || []).map(f => ({
        id: f.id,
        companyName: (f.master_contacts as any)?.company_name || 'Unknown Company',
        contactName: (f.master_contacts as any)?.contact_person_name || 'Unknown Contact',
        status: f.feedback_status || 'called',
        timestamp: f.call_timestamp || new Date().toISOString(),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Refetch every 15 seconds for near real-time
  });

  // Fetch team leaderboard (for supervisors and above, or all agents)
  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useQuery({
    queryKey: ['team-leaderboard', userRole],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Get all feedback for today grouped by agent
      const { data: feedback, error } = await supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .gte('call_timestamp', todayStart)
        .lte('call_timestamp', todayEnd);

      if (error) throw error;

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username');

      // Aggregate by agent
      const agentStats = new Map<string, { calls: number; interested: number }>();
      
      feedback?.forEach(f => {
        const current = agentStats.get(f.agent_id) || { calls: 0, interested: 0 };
        current.calls++;
        if (f.feedback_status === 'interested') current.interested++;
        agentStats.set(f.agent_id, current);
      });

      // Convert to leaderboard entries
      const entries: LeaderboardEntry[] = Array.from(agentStats.entries())
        .map(([agentId, stats]) => {
          const profile = profiles?.find(p => p.id === agentId);
          return {
            agentId,
            agentName: profile?.full_name || profile?.username || 'Unknown Agent',
            totalCalls: stats.calls,
            interested: stats.interested,
            conversionRate: stats.calls > 0 
              ? Math.round((stats.interested / stats.calls) * 100) 
              : 0,
            rank: 0,
          };
        })
        .sort((a, b) => b.totalCalls - a.totalCalls);

      // Assign ranks
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
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
