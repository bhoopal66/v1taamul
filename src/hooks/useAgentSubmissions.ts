import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { format, getDay } from 'date-fns';
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
      return api.get<AgentSubmission[]>('/submissions', { period });
    },
    enabled: !!user?.id,
  });

  const createSubmission = useMutation({
    mutationFn: async (submission: {
      submission_group: SubmissionGroup;
      bank_name: string;
      notes?: string;
    }) => {
      return api.post('/submissions', submission);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-submissions'] });
      toast.success('Submission recorded successfully!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('You have already submitted for this bank today');
      } else {
        toast.error('Failed to record submission');
      }
    },
  });

  const deleteSubmission = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/submissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-submissions'] });
      toast.success('Submission deleted');
    },
    onError: () => {
      toast.error('Failed to delete submission');
    },
  });

  const checkMissingSubmission = (): boolean => {
    const today = new Date();
    const dayOfWeek = getDay(today);
    
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
