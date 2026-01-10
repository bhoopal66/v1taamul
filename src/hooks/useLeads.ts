import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'cold_call' | 'referral' | 'website' | 'social_media' | 'event' | 'inbound_call' | 'email_campaign' | 'partner';

export const LEAD_SOURCES: { value: LeadSource; label: string; icon: string }[] = [
  { value: 'cold_call', label: 'Cold Call', icon: '📞' },
  { value: 'referral', label: 'Referral', icon: '🤝' },
  { value: 'website', label: 'Website', icon: '🌐' },
  { value: 'social_media', label: 'Social Media', icon: '📱' },
  { value: 'event', label: 'Event', icon: '🎪' },
  { value: 'inbound_call', label: 'Inbound Call', icon: '📲' },
  { value: 'email_campaign', label: 'Email Campaign', icon: '📧' },
  { value: 'partner', label: 'Partner', icon: '🏢' },
];

export interface Lead {
  id: string;
  contactId: string;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  city: string | null;
  industry: string | null;
  leadStatus: LeadStatus;
  leadScore: number;
  leadSource: LeadSource;
  dealValue: number | null;
  expectedCloseDate: string | null;
  qualifiedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
  totalDealValue: number;
}

export const useLeads = (statusFilter?: LeadStatus | 'all') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', user?.id, statusFilter],
    queryFn: async (): Promise<Lead[]> => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          master_contacts (
            company_name,
            contact_person_name,
            phone_number,
            city,
            industry
          )
        `)
        .eq('agent_id', user?.id)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        contactId: item.contact_id,
        companyName: item.master_contacts?.company_name || 'Unknown',
        contactPersonName: item.master_contacts?.contact_person_name || 'Unknown',
        phoneNumber: item.master_contacts?.phone_number || '',
        city: item.master_contacts?.city || null,
        industry: item.master_contacts?.industry || null,
        leadStatus: (item.lead_status || 'new') as LeadStatus,
        leadScore: item.lead_score || 0,
        leadSource: ((item as any).lead_source || 'cold_call') as LeadSource,
        dealValue: item.deal_value,
        expectedCloseDate: item.expected_close_date,
        qualifiedDate: item.qualified_date,
        notes: item.notes,
        createdAt: item.created_at || '',
        updatedAt: item.updated_at || '',
      }));
    },
    enabled: !!user?.id,
  });

  const stats: LeadStats = {
    total: leads?.length || 0,
    new: leads?.filter(l => l.leadStatus === 'new').length || 0,
    contacted: leads?.filter(l => l.leadStatus === 'contacted').length || 0,
    qualified: leads?.filter(l => l.leadStatus === 'qualified').length || 0,
    converted: leads?.filter(l => l.leadStatus === 'converted').length || 0,
    lost: leads?.filter(l => l.leadStatus === 'lost').length || 0,
    totalDealValue: leads?.reduce((sum, l) => sum + (l.dealValue || 0), 0) || 0,
  };

  const updateLead = useMutation({
    mutationFn: async ({
      leadId,
      updates,
    }: {
      leadId: string;
      updates: {
        lead_status?: LeadStatus;
        lead_score?: number;
        lead_source?: LeadSource;
        deal_value?: number | null;
        expected_close_date?: string | null;
        notes?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.updates.lead_status) {
        const statusLabels: Record<LeadStatus, string> = {
          new: 'Moved to New',
          contacted: 'Moved to Contacted',
          qualified: '✅ Lead Qualified!',
          converted: '🎉 Lead Converted!',
          lost: 'Marked as Lost',
        };
        toast.success(statusLabels[variables.updates.lead_status]);
      } else {
        toast.success('Lead updated');
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast.error(`Failed to update lead: ${error.message}`);
    },
  });

  const updateLeadStatus = (leadId: string, status: LeadStatus) => {
    updateLead.mutate({ leadId, updates: { lead_status: status } });
  };

  const updateLeadDetails = (
    leadId: string,
    details: {
      lead_score?: number;
      lead_source?: LeadSource;
      deal_value?: number | null;
      expected_close_date?: string | null;
      notes?: string | null;
    }
  ) => {
    updateLead.mutate({ leadId, updates: details });
  };

  return {
    leads: leads || [],
    stats,
    isLoading,
    refetch,
    updateLeadStatus,
    updateLeadDetails,
    isUpdating: updateLead.isPending,
  };
};
