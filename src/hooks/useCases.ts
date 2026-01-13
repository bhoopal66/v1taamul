import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type CaseStatus = 
  | 'new'
  | 'document_collection'
  | 'under_review'
  | 'submitted_to_bank'
  | 'bank_processing'
  | 'approved'
  | 'declined'
  | 'on_hold'
  | 'cancelled';

export type CaseBank = 'RAK' | 'NBF' | 'UBL' | 'RUYA' | 'MASHREQ' | 'WIO';
export type ProductType = 'account' | 'loan';

export interface Case {
  id: string;
  caseNumber: string;
  leadId: string | null;
  contactId: string;
  coordinatorId: string;
  originalAgentId: string;
  bank: CaseBank;
  productType: ProductType;
  status: CaseStatus;
  priority: number;
  dealValue: number | null;
  notes: string | null;
  internalNotes: string | null;
  expectedCompletionDate: string | null;
  actualCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  companyName?: string;
  contactPersonName?: string;
  phoneNumber?: string;
  tradeLicenseNumber?: string | null;
  agentName?: string;
  coordinatorName?: string;
}

export interface CaseStats {
  total: number;
  new: number;
  documentCollection: number;
  underReview: number;
  submittedToBank: number;
  bankProcessing: number;
  approved: number;
  declined: number;
  onHold: number;
  cancelled: number;
}

export const CASE_STAGES: { status: CaseStatus; label: string; color: string; bgColor: string }[] = [
  { status: 'new', label: 'New Cases', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  { status: 'document_collection', label: 'Document Collection', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  { status: 'under_review', label: 'Under Review', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  { status: 'submitted_to_bank', label: 'Submitted to Bank', color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950/30' },
  { status: 'bank_processing', label: 'Bank Processing', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
  { status: 'approved', label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  { status: 'declined', label: 'Declined', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30' },
  { status: 'on_hold', label: 'On Hold', color: 'text-gray-600', bgColor: 'bg-gray-50 dark:bg-gray-950/30' },
];

export const BANK_OPTIONS: { value: CaseBank; label: string }[] = [
  { value: 'RAK', label: 'RAK Bank' },
  { value: 'NBF', label: 'NBF' },
  { value: 'UBL', label: 'UBL' },
  { value: 'RUYA', label: 'Ruya' },
  { value: 'MASHREQ', label: 'Mashreq' },
  { value: 'WIO', label: 'WIO' },
];

export const useCases = (statusFilter?: CaseStatus | 'all') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cases, isLoading, refetch } = useQuery({
    queryKey: ['cases', user?.id, statusFilter],
    queryFn: async (): Promise<Case[]> => {
      let query = supabase
        .from('cases')
        .select(`
          *,
          master_contacts!cases_contact_id_fkey (
            company_name,
            contact_person_name,
            phone_number,
            trade_license_number
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        caseNumber: item.case_number,
        leadId: item.lead_id,
        contactId: item.contact_id,
        coordinatorId: item.coordinator_id,
        originalAgentId: item.original_agent_id,
        bank: item.bank as CaseBank,
        productType: item.product_type as ProductType,
        status: item.status as CaseStatus,
        priority: item.priority || 2,
        dealValue: item.deal_value,
        notes: item.notes,
        internalNotes: item.internal_notes,
        expectedCompletionDate: item.expected_completion_date,
        actualCompletionDate: item.actual_completion_date,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        companyName: (item.master_contacts as any)?.company_name || 'Unknown',
        contactPersonName: (item.master_contacts as any)?.contact_person_name || 'Unknown',
        phoneNumber: (item.master_contacts as any)?.phone_number || '',
        tradeLicenseNumber: (item.master_contacts as any)?.trade_license_number || null,
      }));
    },
    enabled: !!user?.id,
  });

  const stats: CaseStats = {
    total: cases?.length || 0,
    new: cases?.filter(c => c.status === 'new').length || 0,
    documentCollection: cases?.filter(c => c.status === 'document_collection').length || 0,
    underReview: cases?.filter(c => c.status === 'under_review').length || 0,
    submittedToBank: cases?.filter(c => c.status === 'submitted_to_bank').length || 0,
    bankProcessing: cases?.filter(c => c.status === 'bank_processing').length || 0,
    approved: cases?.filter(c => c.status === 'approved').length || 0,
    declined: cases?.filter(c => c.status === 'declined').length || 0,
    onHold: cases?.filter(c => c.status === 'on_hold').length || 0,
    cancelled: cases?.filter(c => c.status === 'cancelled').length || 0,
  };

  const updateCase = useMutation({
    mutationFn: async ({
      caseId,
      updates,
    }: {
      caseId: string;
      updates: {
        status?: CaseStatus;
        priority?: number;
        notes?: string | null;
        internal_notes?: string | null;
        expected_completion_date?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from('cases')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.updates.status) {
        const statusLabels: Record<CaseStatus, string> = {
          new: 'Moved to New',
          document_collection: 'Collecting Documents',
          under_review: 'Under Review',
          submitted_to_bank: '📤 Submitted to Bank',
          bank_processing: '🏦 Bank Processing',
          approved: '🎉 Case Approved!',
          declined: '❌ Case Declined',
          on_hold: '⏸️ Put On Hold',
          cancelled: 'Case Cancelled',
        };
        toast.success(statusLabels[variables.updates.status]);
      } else {
        toast.success('Case updated');
      }
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (error) => {
      toast.error(`Failed to update case: ${error.message}`);
    },
  });

  const updateCaseStatus = (caseId: string, status: CaseStatus) => {
    updateCase.mutate({ caseId, updates: { status } });
  };

  return {
    cases: cases || [],
    stats,
    isLoading,
    refetch,
    updateCaseStatus,
    updateCase: updateCase.mutate,
    isUpdating: updateCase.isPending,
  };
};
