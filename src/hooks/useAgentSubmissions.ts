import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, startOfMonth, format, isAfter, isBefore, getDay } from 'date-fns';
import { toast } from 'sonner';

export type SubmissionGroup = 'group1' | 'group2';
export type SubmissionPeriod = 'weekly' | 'monthly';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface AgentSubmission {
  id: string;
  agent_id: string;
  submission_date: string;
  submission_group: SubmissionGroup;
  bank_name: string;
  notes: string | null;
  status: SubmissionStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const BANK_GROUPS = {
  group1: ['NBF', 'UBL'],
  group2: ['RAK', 'Mashreq', 'Wioriya'],
} as const;

export const useAgentSubmissions = (period: SubmissionPeriod = 'weekly') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ['agent-submissions', user?.id, period],
    queryFn: async (): Promise<AgentSubmission[]> => {
      let startDate: Date;
      
      if (period === 'weekly') {
        startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(new Date());
      }

      const { data, error } = await supabase
        .from('agent_submissions')
        .select('*')
        .eq('agent_id', user?.id)
        .gte('submission_date', format(startDate, 'yyyy-MM-dd'))
        .order('submission_date', { ascending: false });

      if (error) throw error;
      return (data || []) as AgentSubmission[];
    },
    enabled: !!user?.id,
  });

  const createSubmission = useMutation({
    mutationFn: async (submission: {
      submission_group: SubmissionGroup;
      bank_name: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('agent_submissions')
        .insert({
          agent_id: user?.id,
          submission_group: submission.submission_group,
          bank_name: submission.bank_name,
          notes: submission.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-submissions'] });
      toast.success('Submission recorded successfully!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('You have already submitted for this bank today');
      } else {
        toast.error('Failed to record submission');
      }
    },
  });

  const deleteSubmission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agent_submissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-submissions'] });
      toast.success('Submission deleted');
    },
    onError: () => {
      toast.error('Failed to delete submission');
    },
  });

  // Check if today's submission is missing (except Sunday)
  const checkMissingSubmission = (): boolean => {
    const today = new Date();
    const dayOfWeek = getDay(today);
    
    // Skip Sunday (0)
    if (dayOfWeek === 0) return false;

    const todayStr = format(today, 'yyyy-MM-dd');
    const todaySubmissions = submissions?.filter(s => s.submission_date === todayStr) || [];
    
    return todaySubmissions.length === 0;
  };

  return {
    submissions: submissions || [],
    isLoading,
    refetch,
    createSubmission,
    deleteSubmission,
    isMissingToday: checkMissingSubmission(),
  };
};
