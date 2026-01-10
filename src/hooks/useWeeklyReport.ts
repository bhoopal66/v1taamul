import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, subWeeks, format, differenceInDays } from 'date-fns';

export interface WeeklyMetrics {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  totalCalls: number;
  interestedCalls: number;
  notInterestedCalls: number;
  notAnsweredCalls: number;
  leadsGenerated: number;
  conversionRate: number;
  avgCallsPerDay: number;
  activeDays: number;
}

export interface WeeklyInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'tip';
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface WeeklyReportData {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics;
  weeklyHistory: WeeklyMetrics[];
  insights: WeeklyInsight[];
  weekOverWeekChange: {
    calls: number;
    interested: number;
    leads: number;
    conversion: number;
  };
}

const calculateInsights = (
  currentWeek: WeeklyMetrics,
  previousWeek: WeeklyMetrics,
  weeklyHistory: WeeklyMetrics[]
): WeeklyInsight[] => {
  const insights: WeeklyInsight[] = [];

  // Calculate week-over-week changes
  const callsChange = previousWeek.totalCalls > 0 
    ? ((currentWeek.totalCalls - previousWeek.totalCalls) / previousWeek.totalCalls) * 100 
    : currentWeek.totalCalls > 0 ? 100 : 0;

  const conversionChange = previousWeek.conversionRate > 0 
    ? currentWeek.conversionRate - previousWeek.conversionRate 
    : currentWeek.conversionRate;

  const leadsChange = currentWeek.leadsGenerated - previousWeek.leadsGenerated;

  // Call volume insights
  if (callsChange > 20) {
    insights.push({
      id: 'calls-surge',
      type: 'positive',
      title: 'Call Volume Surge',
      description: `You made ${Math.abs(Math.round(callsChange))}% more calls this week compared to last week. Great momentum!`,
      metric: `+${Math.round(callsChange)}%`,
      trend: 'up',
    });
  } else if (callsChange < -20) {
    insights.push({
      id: 'calls-decline',
      type: 'negative',
      title: 'Call Volume Dropped',
      description: `Your call volume decreased by ${Math.abs(Math.round(callsChange))}%. Consider setting daily targets to maintain consistency.`,
      metric: `${Math.round(callsChange)}%`,
      trend: 'down',
    });
  } else if (currentWeek.totalCalls > 0) {
    insights.push({
      id: 'calls-stable',
      type: 'neutral',
      title: 'Consistent Calling',
      description: 'Your call volume is stable. Consistency is key to long-term success!',
      metric: `${currentWeek.totalCalls} calls`,
      trend: 'stable',
    });
  }

  // Conversion rate insights
  if (conversionChange > 5) {
    insights.push({
      id: 'conversion-up',
      type: 'positive',
      title: 'Conversion Boost',
      description: `Your conversion rate improved by ${conversionChange.toFixed(1)} percentage points. Your pitch is resonating well!`,
      metric: `+${conversionChange.toFixed(1)}%`,
      trend: 'up',
    });
  } else if (conversionChange < -5) {
    insights.push({
      id: 'conversion-down',
      type: 'negative',
      title: 'Conversion Dip',
      description: `Conversion dropped by ${Math.abs(conversionChange).toFixed(1)} points. Review your call scripts and follow-up timing.`,
      metric: `${conversionChange.toFixed(1)}%`,
      trend: 'down',
    });
  }

  // Lead generation insights
  if (leadsChange > 0) {
    insights.push({
      id: 'leads-growth',
      type: 'positive',
      title: 'Lead Growth',
      description: `You generated ${leadsChange} more leads than last week. Excellent prospecting work!`,
      metric: `+${leadsChange} leads`,
      trend: 'up',
    });
  } else if (leadsChange < 0) {
    insights.push({
      id: 'leads-drop',
      type: 'negative',
      title: 'Lead Slowdown',
      description: `Lead generation is down by ${Math.abs(leadsChange)}. Focus on qualifying interested contacts.`,
      metric: `${leadsChange} leads`,
      trend: 'down',
    });
  }

  // Activity pattern insights
  if (currentWeek.activeDays >= 5) {
    insights.push({
      id: 'high-activity',
      type: 'positive',
      title: 'High Activity',
      description: `You were active ${currentWeek.activeDays} days this week. Maintaining a strong presence!`,
      metric: `${currentWeek.activeDays}/7 days`,
      trend: 'up',
    });
  } else if (currentWeek.activeDays <= 2 && currentWeek.totalCalls > 0) {
    insights.push({
      id: 'low-activity',
      type: 'tip',
      title: 'Spread Your Calls',
      description: 'Try distributing calls across more days for better contact rates and work-life balance.',
      metric: `${currentWeek.activeDays}/7 days`,
    });
  }

  // Best day analysis from history
  const avgCallsAcrossWeeks = weeklyHistory.reduce((sum, w) => sum + w.totalCalls, 0) / weeklyHistory.length;
  if (currentWeek.totalCalls > avgCallsAcrossWeeks * 1.3) {
    insights.push({
      id: 'above-average',
      type: 'positive',
      title: 'Above Average Week',
      description: `This week's performance is 30%+ above your 4-week average. Outstanding effort!`,
      metric: `${Math.round((currentWeek.totalCalls / avgCallsAcrossWeeks - 1) * 100)}% above avg`,
      trend: 'up',
    });
  }

  // Conversion rate tips
  if (currentWeek.conversionRate < 15 && currentWeek.totalCalls >= 20) {
    insights.push({
      id: 'conversion-tip',
      type: 'tip',
      title: 'Conversion Opportunity',
      description: 'Your conversion is below 15%. Try calling at different times or refining your opening pitch.',
    });
  }

  // No activity tip
  if (currentWeek.totalCalls === 0) {
    insights.push({
      id: 'no-activity',
      type: 'tip',
      title: 'Get Started',
      description: 'No calls recorded this week. Set a small goal of 10 calls to build momentum!',
    });
  }

  return insights.slice(0, 6); // Max 6 insights
};

export const useWeeklyReport = (agentId?: string) => {
  const { user } = useAuth();
  const targetUserId = agentId || user?.id;
  const today = new Date();

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['weekly-report', targetUserId],
    queryFn: async (): Promise<WeeklyReportData> => {
      if (!targetUserId) throw new Error('No user');

      const weeklyHistory: WeeklyMetrics[] = [];

      // Fetch last 4 weeks of data
      for (let i = 0; i < 4; i++) {
        const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });

        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('feedback_status, call_timestamp')
          .eq('agent_id', targetUserId)
          .gte('call_timestamp', weekStart.toISOString())
          .lte('call_timestamp', weekEnd.toISOString());

        const { data: leads } = await supabase
          .from('leads')
          .select('id')
          .eq('agent_id', targetUserId)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());

        const totalCalls = feedback?.length || 0;
        const interestedCalls = feedback?.filter(f => f.feedback_status === 'interested').length || 0;
        const notInterestedCalls = feedback?.filter(f => f.feedback_status === 'not_interested').length || 0;
        const notAnsweredCalls = feedback?.filter(f => f.feedback_status === 'not_answered').length || 0;

        // Calculate active days
        const uniqueDays = new Set(
          feedback?.map(f => f.call_timestamp ? format(new Date(f.call_timestamp), 'yyyy-MM-dd') : null).filter(Boolean)
        );

        const daysInWeek = differenceInDays(weekEnd, weekStart) + 1;

        weeklyHistory.push({
          weekStart: format(weekStart, 'MMM d'),
          weekEnd: format(weekEnd, 'MMM d'),
          weekLabel: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i} Weeks Ago`,
          totalCalls,
          interestedCalls,
          notInterestedCalls,
          notAnsweredCalls,
          leadsGenerated: leads?.length || 0,
          conversionRate: totalCalls > 0 ? Math.round((interestedCalls / totalCalls) * 100) : 0,
          avgCallsPerDay: Math.round(totalCalls / daysInWeek * 10) / 10,
          activeDays: uniqueDays.size,
        });
      }

      const currentWeek = weeklyHistory[0];
      const previousWeek = weeklyHistory[1];

      const insights = calculateInsights(currentWeek, previousWeek, weeklyHistory);

      const weekOverWeekChange = {
        calls: previousWeek.totalCalls > 0 
          ? Math.round(((currentWeek.totalCalls - previousWeek.totalCalls) / previousWeek.totalCalls) * 100) 
          : 0,
        interested: previousWeek.interestedCalls > 0 
          ? Math.round(((currentWeek.interestedCalls - previousWeek.interestedCalls) / previousWeek.interestedCalls) * 100) 
          : 0,
        leads: currentWeek.leadsGenerated - previousWeek.leadsGenerated,
        conversion: Math.round((currentWeek.conversionRate - previousWeek.conversionRate) * 10) / 10,
      };

      return {
        currentWeek,
        previousWeek,
        weeklyHistory: weeklyHistory.reverse(), // Oldest first for charts
        insights,
        weekOverWeekChange,
      };
    },
    enabled: !!targetUserId,
  });

  return {
    reportData,
    isLoading,
    error,
  };
};
