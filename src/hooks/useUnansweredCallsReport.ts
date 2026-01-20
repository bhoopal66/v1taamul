import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, startOfWeek, startOfMonth, format } from 'date-fns';

export type UnansweredPeriod = 'today' | 'weekly' | 'monthly';
export type CallFeedbackType = 'not_answered' | 'not_interested';

export interface UnansweredCallRecord {
  id: string;
  agentName: string;
  agentId: string;
  companyName: string;
  contactPerson: string | null;
  phoneNumber: string;
  callTimestamp: string;
  notes: string | null;
  feedbackType: CallFeedbackType;
}

export interface UnansweredCallsData {
  records: UnansweredCallRecord[];
  totalCount: number;
  periodLabel: string;
}

export const useUnansweredCallsReport = (
  period: UnansweredPeriod = 'today',
  teamId?: string,
  feedbackType: CallFeedbackType = 'not_answered'
) => {
  const { user, ledTeamId, userRole } = useAuth();
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['unanswered-calls-report', period, teamId, ledTeamId, user?.id, feedbackType],
    queryFn: async (): Promise<UnansweredCallsData> => {
      // Calculate start date based on period
      const now = new Date();
      let startDate: Date;
      let periodLabel: string;

      switch (period) {
        case 'today':
          startDate = startOfDay(now);
          periodLabel = format(now, 'EEEE, MMMM d, yyyy');
          break;
        case 'weekly':
          startDate = startOfWeek(now, { weekStartsOn: 0 });
          periodLabel = `Week of ${format(startDate, 'MMM d')} - ${format(now, 'MMM d, yyyy')}`;
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          periodLabel = format(now, 'MMMM yyyy');
          break;
        default:
          startDate = startOfDay(now);
          periodLabel = 'Today';
      }

      // Get agent IDs based on team scope
      const effectiveTeamId = teamId || (!canSeeAllTeams ? ledTeamId : undefined);
      
      let agentIds: string[] = [];
      
      if (effectiveTeamId) {
        // Get agents from specific team
        const { data: teamAgents } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        
        agentIds = teamAgents?.map(a => a.id) || [];
      } else if (!canSeeAllTeams && user?.id) {
        // Supervisor without led team - get directly supervised agents
        const { data: supervisedAgents } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        
        agentIds = supervisedAgents?.map(a => a.id) || [];
      }

      // Build the query for calls with specified feedback type
      let query = supabase
        .from('call_feedback')
        .select(`
          id,
          agent_id,
          call_timestamp,
          notes,
          contact_id,
          feedback_status,
          master_contacts!inner (
            company_name,
            contact_person_name,
            phone_number
          )
        `)
        .eq('feedback_status', feedbackType)
        .gte('call_timestamp', startDate.toISOString())
        .order('call_timestamp', { ascending: false });

      // Apply agent filter if we have specific agents to filter
      if (agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (!canSeeAllTeams) {
        // No agents found for this supervisor, return empty
        return {
          records: [],
          totalCount: 0,
          periodLabel,
        };
      }

      const { data: calls, error } = await query;

      if (error) throw error;

      // Get agent names
      const uniqueAgentIds = [...new Set(calls?.map(c => c.agent_id) || [])];
      const { data: agents } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .in('id', uniqueAgentIds.length > 0 ? uniqueAgentIds : ['no-match']);

      const agentMap = new Map(
        agents?.map(a => [a.id, a.full_name || a.username || 'Unknown']) || []
      );

      const records: UnansweredCallRecord[] = (calls || []).map(call => ({
        id: call.id,
        agentId: call.agent_id,
        agentName: agentMap.get(call.agent_id) || 'Unknown',
        companyName: (call.master_contacts as any)?.company_name || 'Unknown',
        contactPerson: (call.master_contacts as any)?.contact_person_name || null,
        phoneNumber: (call.master_contacts as any)?.phone_number || '',
        callTimestamp: call.call_timestamp || '',
        notes: call.notes,
        feedbackType: call.feedback_status as CallFeedbackType,
      }));

      return {
        records,
        totalCount: records.length,
        periodLabel,
      };
    },
    enabled: !!user?.id,
  });

  return {
    data: data || { records: [], totalCount: 0, periodLabel: '' },
    isLoading,
    refetch,
  };
};
