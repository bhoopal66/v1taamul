import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, format, getDay, getHours } from 'date-fns';

export interface HeatmapData {
  day: number; // 0-6 (Sun-Sat)
  hour: number; // 8-20
  value: number;
}

export interface FunnelStage {
  stage: string;
  value: number;
  fill: string;
}

export interface StreakData {
  currentStreak: number;
  bestDay: string;
  daysAboveTarget: number;
  isHotStreak: boolean;
}

export interface TimelineActivity {
  id: string;
  type: 'call' | 'lead' | 'interested';
  agentName: string;
  companyName: string;
  timestamp: Date;
}

export const useDashboardWidgets = () => {
  const { user, userRole, ledTeamId, profile } = useAuth();

  // Only admin, super_admin, operations_head can see ALL data
  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = ledTeamId || (userRole === 'supervisor' ? profile?.team_id : null);

  // Helper to get agent IDs for team filtering
  const getTeamAgentIds = async (): Promise<string[] | null> => {
    if (canSeeAllData) return null; // No filtering needed
    
    if (effectiveTeamId) {
      const { data } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('team_id', effectiveTeamId)
        .eq('is_active', true);
      return data?.map(p => p.id) || [];
    }
    
    if (user?.id) {
      // Supervisor without team - get directly supervised agents
      const { data } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('supervisor_id', user.id)
        .eq('is_active', true);
      return data?.map(p => p.id) || [];
    }
    
    return [];
  };

  // Call Volume Heatmap Data
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['call-heatmap', user?.id, effectiveTeamId, canSeeAllData],
    queryFn: async (): Promise<HeatmapData[]> => {
      const startDate = subDays(new Date(), 30);
      const agentIds = await getTeamAgentIds();
      
      let query = supabase
        .from('call_feedback')
        .select('call_timestamp')
        .gte('call_timestamp', startDate.toISOString());

      if (agentIds !== null && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        // No agents to show
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;

      // Initialize heatmap grid
      const heatmap: Map<string, number> = new Map();
      for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 20; hour++) {
          heatmap.set(`${day}-${hour}`, 0);
        }
      }

      // Aggregate calls by day and hour
      data?.forEach(call => {
        if (call.call_timestamp) {
          const date = new Date(call.call_timestamp);
          const day = getDay(date);
          const hour = getHours(date);
          if (hour >= 8 && hour <= 20) {
            const key = `${day}-${hour}`;
            heatmap.set(key, (heatmap.get(key) || 0) + 1);
          }
        }
      });

      return Array.from(heatmap.entries()).map(([key, value]) => {
        const [day, hour] = key.split('-').map(Number);
        return { day, hour, value };
      });
    },
    enabled: !!user?.id,
  });

  // Lead Pipeline Funnel Data
  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ['lead-funnel', user?.id, effectiveTeamId, canSeeAllData],
    queryFn: async (): Promise<FunnelStage[]> => {
      const startDate = startOfWeek(new Date());
      const endDate = endOfWeek(new Date());
      const agentIds = await getTeamAgentIds();

      // Get call feedback counts
      let callsQuery = supabase
        .from('call_feedback')
        .select('feedback_status')
        .gte('call_timestamp', startDate.toISOString())
        .lte('call_timestamp', endDate.toISOString());

      if (agentIds !== null && agentIds.length > 0) {
        callsQuery = callsQuery.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        return [
          { stage: 'Calls Made', value: 0, fill: 'hsl(var(--primary))' },
          { stage: 'Interested', value: 0, fill: 'hsl(var(--chart-2))' },
          { stage: 'Leads', value: 0, fill: 'hsl(var(--chart-3))' },
          { stage: 'Qualified', value: 0, fill: 'hsl(var(--chart-4))' },
          { stage: 'Converted', value: 0, fill: 'hsl(var(--chart-5))' },
        ];
      }

      const { data: calls } = await callsQuery;

      // Get leads by status
      let leadsQuery = supabase
        .from('leads')
        .select('lead_status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (agentIds !== null && agentIds.length > 0) {
        leadsQuery = leadsQuery.in('agent_id', agentIds);
      }

      const { data: leads } = await leadsQuery;

      const totalCalls = calls?.length || 0;
      const interested = calls?.filter(c => c.feedback_status === 'interested').length || 0;
      const leadsGenerated = leads?.length || 0;
      const qualified = leads?.filter(l => l.lead_status === 'qualified' || l.lead_status === 'converted').length || 0;
      const converted = leads?.filter(l => l.lead_status === 'converted').length || 0;

      return [
        { stage: 'Calls Made', value: totalCalls, fill: 'hsl(var(--primary))' },
        { stage: 'Interested', value: interested, fill: 'hsl(var(--chart-2))' },
        { stage: 'Leads', value: leadsGenerated, fill: 'hsl(var(--chart-3))' },
        { stage: 'Qualified', value: qualified, fill: 'hsl(var(--chart-4))' },
        { stage: 'Converted', value: converted, fill: 'hsl(var(--chart-5))' },
      ];
    },
    enabled: !!user?.id,
  });

  // Performance Streak Data
  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['performance-streak', user?.id, effectiveTeamId, canSeeAllData],
    queryFn: async (): Promise<StreakData> => {
      const days = 14;
      const dailyCounts: { [key: string]: number } = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayTotals: { [key: number]: number } = {};
      const agentIds = await getTeamAgentIds();

      for (let i = 0; i < days; i++) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date);
        const end = endOfDay(date);

        let query = supabase
          .from('call_feedback')
          .select('*', { count: 'exact', head: true })
          .gte('call_timestamp', start.toISOString())
          .lte('call_timestamp', end.toISOString());

        if (agentIds !== null && agentIds.length > 0) {
          query = query.in('agent_id', agentIds);
        } else if (agentIds !== null && agentIds.length === 0) {
          dailyCounts[format(date, 'yyyy-MM-dd')] = 0;
          continue;
        }

        const { count } = await query;

        dailyCounts[format(date, 'yyyy-MM-dd')] = count || 0;
        const dayOfWeek = getDay(date);
        dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + (count || 0);
      }

      // Calculate streak (days with 10+ calls)
      let streak = 0;
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        if (dailyCounts[date] >= 10) {
          streak++;
        } else {
          break;
        }
      }

      // Find best day
      let bestDayIndex = 0;
      let maxDayTotal = 0;
      Object.entries(dayTotals).forEach(([day, total]) => {
        if (total > maxDayTotal) {
          maxDayTotal = total;
          bestDayIndex = Number(day);
        }
      });

      // Count days above target (20 calls)
      const daysAboveTarget = Object.values(dailyCounts).filter(c => c >= 20).length;

      return {
        currentStreak: streak,
        bestDay: dayNames[Number(bestDayIndex)] || 'Mon',
        daysAboveTarget,
        isHotStreak: streak >= 3,
      };
    },
    enabled: !!user?.id,
  });

  // Team Activity Timeline
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['team-timeline', user?.id, effectiveTeamId, canSeeAllData],
    queryFn: async (): Promise<TimelineActivity[]> => {
      const agentIds = await getTeamAgentIds();

      let query = supabase
        .from('call_feedback')
        .select(`
          id,
          feedback_status,
          call_timestamp,
          agent_id,
          master_contacts!call_feedback_contact_id_fkey(company_name)
        `)
        .order('call_timestamp', { ascending: false })
        .limit(20);

      if (agentIds !== null && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        return [];
      }

      const { data: calls } = await query;

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, full_name, username');

      const activities: TimelineActivity[] = [];

      calls?.forEach(call => {
        const agent = profiles?.find(p => p.id === call.agent_id);
        const agentName = agent?.full_name || agent?.username || 'Unknown';
        const companyName = (call.master_contacts as any)?.company_name || 'Unknown Company';

        activities.push({
          id: call.id,
          type: call.feedback_status === 'interested' ? 'interested' : 'call',
          agentName,
          companyName,
          timestamp: new Date(call.call_timestamp || new Date()),
        });
      });

      return activities.slice(0, 15);
    },
    enabled: !!user?.id,
  });

  return {
    heatmapData: heatmapData || [],
    funnelData: funnelData || [],
    streakData: streakData || { currentStreak: 0, bestDay: 'Mon', daysAboveTarget: 0, isHotStreak: false },
    timelineData: timelineData || [],
    isLoading: heatmapLoading || funnelLoading || streakLoading || timelineLoading,
  };
};
