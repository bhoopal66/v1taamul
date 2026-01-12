import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LeadStatus } from './useLeads';

export interface LeadTransition {
  id: string;
  leadId: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  changedAt: string;
  changedBy: string | null;
  notes: string | null;
  changedByName?: string;
}

export const useLeadTransitions = (leadId: string | null) => {
  return useQuery({
    queryKey: ['lead-transitions', leadId],
    queryFn: async (): Promise<LeadTransition[]> => {
      if (!leadId) return [];

      const { data, error } = await supabase
        .from('lead_stage_transitions')
        .select(`
          id,
          lead_id,
          from_status,
          to_status,
          changed_at,
          changed_by,
          notes
        `)
        .eq('lead_id', leadId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Fetch user names for changed_by
      const userIds = [...new Set(data?.filter(t => t.changed_by).map(t => t.changed_by) || [])];
      let userMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, full_name, username')
          .in('id', userIds);
        
        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.username || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map(t => ({
        id: t.id,
        leadId: t.lead_id,
        fromStatus: t.from_status as LeadStatus | null,
        toStatus: t.to_status as LeadStatus,
        changedAt: t.changed_at,
        changedBy: t.changed_by,
        notes: t.notes,
        changedByName: t.changed_by ? userMap[t.changed_by] : undefined,
      }));
    },
    enabled: !!leadId,
  });
};

export const useAllLeadTransitions = (agentId: string | null) => {
  return useQuery({
    queryKey: ['all-lead-transitions', agentId],
    queryFn: async (): Promise<(LeadTransition & { companyName?: string })[]> => {
      if (!agentId) return [];

      // First get all leads for this agent
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, master_contacts(company_name)')
        .eq('agent_id', agentId);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map(l => l.id);
      const leadCompanyMap: Record<string, string> = {};
      leads.forEach(l => {
        leadCompanyMap[l.id] = (l.master_contacts as any)?.company_name || 'Unknown';
      });

      // Get all transitions for these leads
      const { data, error } = await supabase
        .from('lead_stage_transitions')
        .select('*')
        .in('lead_id', leadIds)
        .order('changed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map(t => ({
        id: t.id,
        leadId: t.lead_id,
        fromStatus: t.from_status as LeadStatus | null,
        toStatus: t.to_status as LeadStatus,
        changedAt: t.changed_at,
        changedBy: t.changed_by,
        notes: t.notes,
        companyName: leadCompanyMap[t.lead_id],
      }));
    },
    enabled: !!agentId,
  });
};
