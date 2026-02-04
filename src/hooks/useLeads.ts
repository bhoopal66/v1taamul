import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay } from 'date-fns';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'approved' | 'lost';
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

// Valid product types and bank names for validation
const VALID_PRODUCTS: ProductType[] = ['account', 'loan'];
const VALID_BANKS: BankName[] = ['RAK', 'NBF', 'UBL', 'RUYA', 'MASHREQ', 'WIO'];

// Helper to parse lead source
export const parseLeadSource = (source: string | null): { product: ProductType; bank: BankName } | null => {
  if (!source) return null;
  const parts = source.split('_');
  if (parts.length < 2) return null;
  
  const product = parts[0] as ProductType;
  const bank = parts[1] as BankName;
  
  // Validate that the parsed values are actually valid
  if (!VALID_PRODUCTS.includes(product) || !VALID_BANKS.includes(bank)) {
    return null;
  }
  
  return { product, bank };
};

// Helper to create lead source string
export const createLeadSource = (product: ProductType, bank: BankName): LeadSource => {
  return `${product}_${bank}` as LeadSource;
};

export interface Lead {
  id: string;
  contactId: string;
  agentId?: string;
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
  lost: number;
  totalDealValue: number;
}

export const useLeads = (statusFilter?: LeadStatus | 'all', dateRange?: DateRange, agentId?: string) => {
  const { user, userRole, profile, ledTeamId } = useAuth();
  const queryClient = useQueryClient();

  // Check if user has global access (admin, super_admin, operations_head)
  const hasGlobalAccess = userRole === 'admin' || userRole === 'super_admin' || userRole === 'operations_head';
  
  // Check if user is a team viewer (supervisor, team leader, etc.)
  const isTeamViewer = userRole === 'supervisor' || userRole === 'sales_controller' || !!ledTeamId;

  // Date range for filtering
  const fromDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
  const toDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : null;

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['leads', user?.id, userRole, profile?.team_id, ledTeamId, statusFilter, fromDate, toDate, agentId],
    queryFn: async (): Promise<Lead[]> => {
      // For admins/super_admins/operations_head, show all leads (global access)
      if (hasGlobalAccess) {
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
            )
          `)
          .order('created_at', { ascending: false });

        // Apply agent filter if specified
        if (agentId && agentId !== 'all') {
          query = query.eq('agent_id', agentId);
        }

        // Apply date filter
        if (fromDate) {
          query = query.gte('created_at', fromDate);
        }
        if (toDate) {
          query = query.lte('created_at', toDate);
        }

        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('lead_status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(item => {
          const tradeLicenseNumber = item.master_contacts?.trade_license_number || null;
          return {
            id: item.id,
            contactId: item.contact_id,
            agentId: item.agent_id,
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
      }

      // For team viewers (supervisors, team leaders), get team member leads
      let teamMemberIds: string[] = [user?.id || ''];

      if (isTeamViewer) {
        const teamIdToFetch = ledTeamId || profile?.team_id;

        if (teamIdToFetch) {
          const { data: teamMembers } = await supabase
            .from('profiles')
            .select('id')
            .eq('team_id', teamIdToFetch)
            .eq('is_active', true);

          if (teamMembers && teamMembers.length > 0) {
            teamMemberIds = teamMembers.map(m => m.id);
            if (!teamMemberIds.includes(user?.id || '')) {
              teamMemberIds.push(user?.id || '');
            }
          }
        }
      }

      // If a specific agent is selected, filter to just that agent
      const agentIdsToQuery = (agentId && agentId !== 'all') ? [agentId] : teamMemberIds;

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
          )
        `)
        .in('agent_id', agentIdsToQuery)
        .order('created_at', { ascending: false });

      // Apply date filter
      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(item => {
        const tradeLicenseNumber = item.master_contacts?.trade_license_number || null;
        return {
          id: item.id,
          contactId: item.contact_id,
          agentId: item.agent_id,
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
          isLead: !!tradeLicenseNumber, // Has TL = Lead, No TL = Opportunity
        };
      });
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
    contactId: string,
    details: {
      lead_score?: number;
      lead_source?: LeadSource;
      deal_value?: number | null;
      expected_close_date?: string | null;
      notes?: string | null;
      trade_license_number?: string | null;
      contact_person_name?: string | null;
    }
  ) => {
    // Separate contact fields from lead fields
    const { trade_license_number, contact_person_name, ...leadDetails } = details;
    
    // Update lead
    updateLead.mutate({ leadId, updates: leadDetails });
    
    // Update contact if contact fields are provided
    if (trade_license_number !== undefined || contact_person_name !== undefined) {
      const contactUpdates: { trade_license_number?: string | null; contact_person_name?: string | null } = {};
      if (trade_license_number !== undefined) contactUpdates.trade_license_number = trade_license_number;
      if (contact_person_name !== undefined) contactUpdates.contact_person_name = contact_person_name;
      
      supabase
        .from('master_contacts')
        .update({
          ...contactUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
        .then(({ error }) => {
          if (error) {
            toast.error(`Failed to update contact: ${error.message}`);
          }
        });
    }
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
