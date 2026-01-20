import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, differenceInDays, format } from 'date-fns';

export interface PeriodPerformance {
  label: string;
  dateRange: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
  activeAgents: number;
  avgCallsPerDay: number;
}

export interface ComparisonMetric {
  metric: string;
  period1Value: number;
  period2Value: number;
  difference: number;
  percentChange: number;
  isPositive: boolean;
}

interface DateRange {
  from: Date;
  to: Date;
}

interface UseTeamPerformanceComparisonOptions {
  period1: DateRange | null;
  period2: DateRange | null;
}

const fetchPeriodData = async (
  from: Date, 
  to: Date, 
  agentIds: string[] | null
): Promise<Omit<PeriodPerformance, 'label' | 'dateRange'>> => {
  const startDate = startOfDay(from).toISOString();
  const endDate = endOfDay(to).toISOString();
  const dayCount = differenceInDays(to, from) + 1;

  // Build feedback query
  let feedbackQuery = supabase
    .from('call_feedback')
    .select('agent_id, feedback_status')
    .gte('call_timestamp', startDate)
    .lte('call_timestamp', endDate);
  
  // Build leads query  
  let leadsQuery = supabase
    .from('leads')
    .select('agent_id')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Filter by agent IDs if provided (for team scoping)
  if (agentIds && agentIds.length > 0) {
    feedbackQuery = feedbackQuery.in('agent_id', agentIds);
    leadsQuery = leadsQuery.in('agent_id', agentIds);
  }

  const [feedbackResult, leadsResult] = await Promise.all([
    feedbackQuery,
    leadsQuery,
  ]);

  const feedback = feedbackResult.data || [];
  const leads = leadsResult.data || [];

  const totalCalls = feedback.length;
  const interested = feedback.filter(f => f.feedback_status === 'interested').length;
  const notInterested = feedback.filter(f => f.feedback_status === 'not_interested').length;
  const notAnswered = feedback.filter(f => f.feedback_status === 'not_answered').length;
  const activeAgents = new Set(feedback.map(f => f.agent_id)).size;

  return {
    totalCalls,
    interested,
    notInterested,
    notAnswered,
    leadsGenerated: leads.length,
    conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
    activeAgents,
    avgCallsPerDay: dayCount > 0 ? Math.round(totalCalls / dayCount) : 0,
  };
};

export const useTeamPerformanceComparison = (options: UseTeamPerformanceComparisonOptions) => {
  const { user, userRole, ledTeamId } = useAuth();
  const { period1, period2 } = options;

  const isSupervisor = userRole === 'supervisor' || userRole === 'operations_head' || userRole === 'admin' || userRole === 'super_admin';
  
  // Check if user can see all teams (admin, super_admin, operations_head)
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['team-performance-comparison', period1?.from, period1?.to, period2?.from, period2?.to, ledTeamId, canSeeAllTeams, user?.id],
    queryFn: async () => {
      if (!period1 || !period2) return null;

      // Get team member IDs for scoping (if not admin/ops_head)
      let agentIds: string[] | null = null;
      if (!canSeeAllTeams) {
        let query = supabase
          .from('profiles_public')
          .select('id')
          .eq('is_active', true);
        
        if (ledTeamId) {
          query = query.or(`team_id.eq.${ledTeamId},supervisor_id.eq.${user?.id}`);
        } else if (user?.id) {
          query = query.eq('supervisor_id', user.id);
        }
        
        const { data: teamMembers } = await query;
        agentIds = teamMembers?.map(m => m.id) || [];
      }

      const [data1, data2] = await Promise.all([
        fetchPeriodData(period1.from, period1.to, agentIds),
        fetchPeriodData(period2.from, period2.to, agentIds),
      ]);

      const period1Data: PeriodPerformance = {
        ...data1,
        label: 'Period 1',
        dateRange: `${format(period1.from, 'MMM d')} - ${format(period1.to, 'MMM d, yyyy')}`,
      };

      const period2Data: PeriodPerformance = {
        ...data2,
        label: 'Period 2',
        dateRange: `${format(period2.from, 'MMM d')} - ${format(period2.to, 'MMM d, yyyy')}`,
      };

      // Calculate comparison metrics
      const metrics: ComparisonMetric[] = [
        {
          metric: 'Total Calls',
          period1Value: data1.totalCalls,
          period2Value: data2.totalCalls,
          difference: data2.totalCalls - data1.totalCalls,
          percentChange: data1.totalCalls > 0 ? Math.round(((data2.totalCalls - data1.totalCalls) / data1.totalCalls) * 100) : 0,
          isPositive: data2.totalCalls >= data1.totalCalls,
        },
        {
          metric: 'Interested Leads',
          period1Value: data1.interested,
          period2Value: data2.interested,
          difference: data2.interested - data1.interested,
          percentChange: data1.interested > 0 ? Math.round(((data2.interested - data1.interested) / data1.interested) * 100) : 0,
          isPositive: data2.interested >= data1.interested,
        },
        {
          metric: 'Leads Generated',
          period1Value: data1.leadsGenerated,
          period2Value: data2.leadsGenerated,
          difference: data2.leadsGenerated - data1.leadsGenerated,
          percentChange: data1.leadsGenerated > 0 ? Math.round(((data2.leadsGenerated - data1.leadsGenerated) / data1.leadsGenerated) * 100) : 0,
          isPositive: data2.leadsGenerated >= data1.leadsGenerated,
        },
        {
          metric: 'Conversion Rate',
          period1Value: data1.conversionRate,
          period2Value: data2.conversionRate,
          difference: data2.conversionRate - data1.conversionRate,
          percentChange: data1.conversionRate > 0 ? Math.round(((data2.conversionRate - data1.conversionRate) / data1.conversionRate) * 100) : 0,
          isPositive: data2.conversionRate >= data1.conversionRate,
        },
        {
          metric: 'Avg Calls/Day',
          period1Value: data1.avgCallsPerDay,
          period2Value: data2.avgCallsPerDay,
          difference: data2.avgCallsPerDay - data1.avgCallsPerDay,
          percentChange: data1.avgCallsPerDay > 0 ? Math.round(((data2.avgCallsPerDay - data1.avgCallsPerDay) / data1.avgCallsPerDay) * 100) : 0,
          isPositive: data2.avgCallsPerDay >= data1.avgCallsPerDay,
        },
        {
          metric: 'Active Agents',
          period1Value: data1.activeAgents,
          period2Value: data2.activeAgents,
          difference: data2.activeAgents - data1.activeAgents,
          percentChange: data1.activeAgents > 0 ? Math.round(((data2.activeAgents - data1.activeAgents) / data1.activeAgents) * 100) : 0,
          isPositive: data2.activeAgents >= data1.activeAgents,
        },
      ];

      return {
        period1: period1Data,
        period2: period2Data,
        metrics,
      };
    },
    enabled: !!user && isSupervisor && !!period1 && !!period2,
  });

  return {
    period1Data: data?.period1 || null,
    period2Data: data?.period2 || null,
    metrics: data?.metrics || [],
    isLoading,
    refetch,
  };
};
