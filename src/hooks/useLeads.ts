import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
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
  isLead: boolean;
}

export interface LeadStats {
  total: number;
  leads: number;
  opportunities: number;
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
      const params: Record<string, string> = {};
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      return api.get<Lead[]>('/leads', params);
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
      return api.put(`/leads/${leadId}`, updates);
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
    onError: (error: any) => {
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

  const updateTradeLicense = useMutation({
    mutationFn: async ({
      contactId,
      tradeLicenseNumber,
    }: {
      contactId: string;
      tradeLicenseNumber: string;
    }) => {
      return api.put(`/leads/contact/${contactId}/trade-license`, { tradeLicenseNumber });
    },
    onSuccess: () => {
      toast.success('🎉 Opportunity converted to Lead!', {
        description: 'Trade license number has been added.',
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
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
