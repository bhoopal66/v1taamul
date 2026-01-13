import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type FollowUpType = Database['public']['Enums']['follow_up_type'];

export interface CaseFollowUp {
  id: string;
  caseId: string;
  followUpType: FollowUpType;
  scheduledAt: string;
  completedAt: string | null;
  notes: string | null;
  outcome: string | null;
  createdBy: string;
  createdAt: string;
  creatorName?: string;
}

export const FOLLOW_UP_TYPES: { value: FollowUpType; label: string; icon: string }[] = [
  { value: 'call', label: 'Phone Call', icon: '📞' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'meeting', label: 'Meeting', icon: '🤝' },
  { value: 'bank_visit', label: 'Bank Visit', icon: '🏦' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export const useCaseFollowUps = (caseId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: followUps, isLoading, refetch } = useQuery({
    queryKey: ['case-follow-ups', caseId],
    queryFn: async (): Promise<CaseFollowUp[]> => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('follow_ups')
        .select(`
          *,
          creator:created_by(full_name)
        `)
        .eq('case_id', caseId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(fu => ({
        id: fu.id,
        caseId: fu.case_id,
        followUpType: fu.follow_up_type,
        scheduledAt: fu.scheduled_at,
        completedAt: fu.completed_at,
        notes: fu.notes,
        outcome: fu.outcome,
        createdBy: fu.created_by,
        createdAt: fu.created_at,
        creatorName: (fu.creator as any)?.full_name || 'Unknown',
      }));
    },
    enabled: !!caseId && !!user?.id,
  });

  const createFollowUp = useMutation({
    mutationFn: async ({
      followUpType,
      scheduledAt,
      notes,
    }: {
      followUpType: FollowUpType;
      scheduledAt: Date;
      notes?: string;
    }) => {
      if (!caseId || !user?.id) {
        throw new Error('Case ID and user required');
      }

      const { error } = await supabase
        .from('follow_ups')
        .insert({
          case_id: caseId,
          follow_up_type: followUpType,
          scheduled_at: scheduledAt.toISOString(),
          notes: notes || null,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Follow-up scheduled');
      queryClient.invalidateQueries({ queryKey: ['case-follow-ups', caseId] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-follow-ups'] });
    },
    onError: (error) => {
      toast.error(`Failed to schedule follow-up: ${error.message}`);
    },
  });

  const completeFollowUp = useMutation({
    mutationFn: async ({
      followUpId,
      outcome,
    }: {
      followUpId: string;
      outcome: string;
    }) => {
      const { error } = await supabase
        .from('follow_ups')
        .update({
          completed_at: new Date().toISOString(),
          outcome,
        })
        .eq('id', followUpId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Follow-up completed');
      queryClient.invalidateQueries({ queryKey: ['case-follow-ups', caseId] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-follow-ups'] });
    },
    onError: (error) => {
      toast.error(`Failed to complete follow-up: ${error.message}`);
    },
  });

  const deleteFollowUp = useMutation({
    mutationFn: async (followUpId: string) => {
      const { error } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', followUpId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Follow-up deleted');
      queryClient.invalidateQueries({ queryKey: ['case-follow-ups', caseId] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-follow-ups'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete follow-up: ${error.message}`);
    },
  });

  // Separate pending and completed follow-ups
  const pendingFollowUps = followUps?.filter(fu => !fu.completedAt) || [];
  const completedFollowUps = followUps?.filter(fu => fu.completedAt) || [];

  // Check for overdue follow-ups
  const overdueFollowUps = pendingFollowUps.filter(
    fu => new Date(fu.scheduledAt) < new Date()
  );

  // Get upcoming follow-ups (next 7 days)
  const upcomingFollowUps = pendingFollowUps.filter(fu => {
    const scheduled = new Date(fu.scheduledAt);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return scheduled >= now && scheduled <= weekFromNow;
  });

  return {
    followUps: followUps || [],
    pendingFollowUps,
    completedFollowUps,
    overdueFollowUps,
    upcomingFollowUps,
    isLoading,
    refetch,
    createFollowUp: createFollowUp.mutate,
    isCreating: createFollowUp.isPending,
    completeFollowUp: completeFollowUp.mutate,
    isCompleting: completeFollowUp.isPending,
    deleteFollowUp: deleteFollowUp.mutate,
    isDeleting: deleteFollowUp.isPending,
  };
};

// Hook to get all upcoming follow-ups across all cases
export const useUpcomingFollowUps = () => {
  const { user } = useAuth();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['upcoming-follow-ups'],
    queryFn: async (): Promise<(CaseFollowUp & { caseNumber: string; companyName: string })[]> => {
      const { data, error } = await supabase
        .from('follow_ups')
        .select(`
          *,
          creator:created_by(full_name),
          cases!inner(case_number, master_contacts!cases_contact_id_fkey(company_name))
        `)
        .is('completed_at', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (error) throw error;

      return (data || []).map(fu => ({
        id: fu.id,
        caseId: fu.case_id,
        followUpType: fu.follow_up_type,
        scheduledAt: fu.scheduled_at,
        completedAt: fu.completed_at,
        notes: fu.notes,
        outcome: fu.outcome,
        createdBy: fu.created_by,
        createdAt: fu.created_at,
        creatorName: (fu.creator as any)?.full_name || 'Unknown',
        caseNumber: (fu.cases as any)?.case_number || '',
        companyName: (fu.cases as any)?.master_contacts?.company_name || 'Unknown',
      }));
    },
    enabled: !!user?.id,
  });

  return {
    followUps: followUps || [],
    isLoading,
  };
};
