import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'approved' | 'lost' | 'declined';
export type ProductType = 'account' | 'loan';
export type BankName = 'RAK' | 'NBF' | 'UBL' | 'RUYA' | 'MASHREQ' | 'WIO';
export type LeadSource = `${ProductType}_${BankName}`;

// Banks available for Account products (all banks)
export const ACCOUNT_BANKS: { value: BankName; label: string }[] = [
  { value: 'RAK', label: 'RAK Bank' },
  { value: 'NBF', label: 'NBF' },
  { value: 'UBL', label: 'UBL' },
  { value: 'RUYA', label: 'Ruya' },
  { value: 'MASHREQ', label: 'Mashreq' },
  { value: 'WIO', label: 'WIO' },
];

// Banks available for Loan products (limited selection)
export const LOAN_BANKS: { value: BankName; label: string }[] = [
  { value: 'WIO', label: 'WIO' },
  { value: 'NBF', label: 'NBF' },
  { value: 'RAK', label: 'RAK Bank' },
];

export const PRODUCT_TYPES: { value: ProductType; label: string; icon: string }[] = [
  { value: 'account', label: 'Account', icon: '🏦' },
  { value: 'loan', label: 'Loan', icon: '💰' },
];

// Generate all lead sources for analytics
export const LEAD_SOURCES: { value: LeadSource; label: string; icon: string; product: ProductType; bank: BankName }[] = [
  ...ACCOUNT_BANKS.map(bank => ({
    value: `account_${bank.value}` as LeadSource,
    label: `Account - ${bank.label}`,
    icon: '🏦',
    product: 'account' as ProductType,
    bank: bank.value,
  })),
  ...LOAN_BANKS.map(bank => ({
    value: `loan_${bank.value}` as LeadSource,
    label: `Loan - ${bank.label}`,
    icon: '💰',
    product: 'loan' as ProductType,
    bank: bank.value,
  })),
];

// Helper to parse lead source
export const parseLeadSource = (source: string | null): { product: ProductType; bank: BankName } | null => {
  if (!source) return null;
  const [product, bank] = source.split('_') as [ProductType, BankName];
  if (product && bank) {
    return { product, bank };
  }
  return null;
};

// Helper to create lead source string
export const createLeadSource = (product: ProductType, bank: BankName): LeadSource => {
  return `${product}_${bank}` as LeadSource;
};

export interface Lead {
  id: string;
  contactId: string;
  agentId: string;
  agentName?: string;
  teamId?: string | null;
  teamName?: string | null;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  tradeLicenseNumber: string | null;
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
  // Derived field: true if has trade license (Lead), false if no trade license (Opportunity)
  isLead: boolean;
}

export interface LeadStats {
  total: number;
  leads: number; // With trade license
  opportunities: number; // Without trade license
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  approved: number;
  declined: number;
  lost: number;
  totalDealValue: number;
}

export interface LeadFilters {
  agentId?: string | 'all';
  teamId?: string | 'all';
  bankName?: BankName | 'all';
  productType?: ProductType | 'all';
}

export const useLeads = (statusFilter?: LeadStatus | 'all', filters?: LeadFilters) => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'operations_head';

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', user?.id, statusFilter, filters?.agentId, filters?.teamId, filters?.bankName, filters?.productType],
    queryFn: async (): Promise<Lead[]> => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          master_contacts (
            company_name,
            contact_person_name,
            phone_number,
            trade_license_number,
            city,
            industry
          ),
          profiles!leads_agent_id_fkey (
            full_name,
            team_id
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters based on role
      if (isAdminOrSuperAdmin) {
        // Admins can see all, but can filter by agent or team
        if (filters?.agentId && filters.agentId !== 'all') {
          query = query.eq('agent_id', filters.agentId);
        }
        // Team filter will be applied after fetching since it requires join
      } else {
        // Regular agents can only see their own leads
        query = query.eq('agent_id', user?.id);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let mappedLeads = (data || []).map(item => {
        const tradeLicenseNumber = item.master_contacts?.trade_license_number || null;
        return {
          id: item.id,
          contactId: item.contact_id,
          agentId: item.agent_id,
          agentName: (item.profiles as any)?.full_name || 'Unknown',
          teamId: (item.profiles as any)?.team_id || null,
          teamName: null, // Will be populated if needed
          companyName: item.master_contacts?.company_name || 'Unknown',
          contactPersonName: item.master_contacts?.contact_person_name || 'Unknown',
          phoneNumber: item.master_contacts?.phone_number || '',
          tradeLicenseNumber,
          city: item.master_contacts?.city || null,
          industry: item.master_contacts?.industry || null,
          leadStatus: (item.lead_status || 'new') as LeadStatus,
          leadScore: item.lead_score || 0,
          leadSource: ((item as any).lead_source || 'account_RAK') as LeadSource,
          dealValue: item.deal_value,
          expectedCloseDate: item.expected_close_date,
          qualifiedDate: item.qualified_date,
          notes: item.notes,
          createdAt: item.created_at || '',
          updatedAt: item.updated_at || '',
          isLead: !!tradeLicenseNumber,
        };
      });

      // Apply team filter if specified
      if (isAdminOrSuperAdmin && filters?.teamId && filters.teamId !== 'all') {
        mappedLeads = mappedLeads.filter(lead => lead.teamId === filters.teamId);
      }

      // Apply bank filter if specified
      if (filters?.bankName && filters.bankName !== 'all') {
        mappedLeads = mappedLeads.filter(lead => {
          const parsed = parseLeadSource(lead.leadSource);
          return parsed?.bank === filters.bankName;
        });
      }

      // Apply product type (group) filter if specified
      if (filters?.productType && filters.productType !== 'all') {
        mappedLeads = mappedLeads.filter(lead => {
          const parsed = parseLeadSource(lead.leadSource);
          return parsed?.product === filters.productType;
        });
      }

      return mappedLeads;
    },
    enabled: !!user?.id,
  });

  const stats: LeadStats = {
    total: leads?.length || 0,
    leads: leads?.filter(l => l.isLead).length || 0,
    opportunities: leads?.filter(l => !l.isLead).length || 0,
    new: leads?.filter(l => l.leadStatus === 'new').length || 0,
    contacted: leads?.filter(l => l.leadStatus === 'contacted').length || 0,
    qualified: leads?.filter(l => l.leadStatus === 'qualified').length || 0,
    converted: leads?.filter(l => l.leadStatus === 'converted').length || 0,
    approved: leads?.filter(l => l.leadStatus === 'approved').length || 0,
    declined: leads?.filter(l => l.leadStatus === 'declined').length || 0,
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
          contacted: 'Moved to In Progress',
          qualified: '✅ Lead Submitted!',
          converted: '📋 Lead Assessing!',
          approved: '🎉 Lead Approved!',
          declined: '❌ Lead Declined',
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

  const updateLeadStatus = (leadId: string, status: LeadStatus, notes?: string) => {
    const updates: { lead_status: LeadStatus; notes?: string } = { lead_status: status };
    if (notes) {
      updates.notes = notes;
    }
    updateLead.mutate({ leadId, updates });
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

  // Mutation to update trade license on master_contacts (convert Opportunity to Lead)
  const updateTradeLicense = useMutation({
    mutationFn: async ({
      contactId,
      tradeLicenseNumber,
    }: {
      contactId: string;
      tradeLicenseNumber: string;
    }) => {
      const { error } = await supabase
        .from('master_contacts')
        .update({
          trade_license_number: tradeLicenseNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('🎉 Opportunity converted to Lead!', {
        description: 'Trade license number has been added.',
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast.error(`Failed to update trade license: ${error.message}`);
    },
  });

  const convertToLead = (contactId: string, tradeLicenseNumber: string) => {
    if (!tradeLicenseNumber.trim()) {
      toast.error('Please enter a valid trade license number');
      return;
    }
    updateTradeLicense.mutate({ contactId, tradeLicenseNumber: tradeLicenseNumber.trim() });
  };

  return {
    leads: leads || [],
    stats,
    isLoading,
    refetch,
    updateLeadStatus,
    updateLeadDetails,
    convertToLead,
    isUpdating: updateLead.isPending,
    isConverting: updateTradeLicense.isPending,
  };
};
