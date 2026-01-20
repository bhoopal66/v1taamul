import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, startOfMonth, format } from 'date-fns';
import { toast } from 'sonner';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type SubmissionPeriod = 'weekly' | 'monthly';

export interface TeamSubmission {
  id: string;
  agent_id: string;
  submission_date: string;
  submission_group: 'group1' | 'group2';
  bank_name: string;
  notes: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  agent: {
    full_name: string | null;
    username: string;
  } | null;
}

export const useTeamSubmissions = (period: SubmissionPeriod = 'weekly') => {
  const { user, userRole, ledTeamId } = useAuth();
  const queryClient = useQueryClient();
  
  // Check if user can see all teams (admin, super_admin, operations_head)
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');

  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ['team-submissions', user?.id, period, ledTeamId, canSeeAllTeams],
    queryFn: async (): Promise<TeamSubmission[]> => {
      let startDate: Date;
      
      if (period === 'weekly') {
        startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(new Date());
      }

      // First, get agent IDs for team scoping if needed
      let agentIds: string[] | null = null;
      if (!canSeeAllTeams) {
        let query = supabase
          .from('profiles_public')
          .select('id')
          .eq('is_active', true);
        
        if (ledTeamId) {
          query = query.or(`team_id.eq.${ledTeamId},supervisor_id.eq.${user?.id}`);
        } else if (user?.id) {
          query = query.eq('supervisor_id', user.id);
        }
        
        const { data: teamMembers } = await query;
        agentIds = teamMembers?.map(m => m.id) || [];
      }

      // Build submissions query
      let submissionsQuery = supabase
        .from('agent_submissions')
        .select(`
          *,
          agent:profiles!agent_submissions_agent_id_fkey(full_name, username)
        `)
        .gte('submission_date', format(startDate, 'yyyy-MM-dd'))
        .order('submission_date', { ascending: false });

      // Filter by team member IDs if not admin/ops_head
      if (agentIds !== null && agentIds.length > 0) {
        submissionsQuery = submissionsQuery.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        // No team members, return empty
        return [];
      }

      const { data, error } = await submissionsQuery;

      if (error) throw error;
      return (data || []) as unknown as TeamSubmission[];
    },
    enabled: !!user?.id,
  });

  const updateSubmissionStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      review_notes 
    }: { 
      id: string; 
      status: SubmissionStatus; 
      review_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('agent_submissions')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-submissions'] });
      toast.success(`Submission ${variables.status === 'approved' ? 'approved' : 'rejected'} successfully`);
    },
    onError: () => {
      toast.error('Failed to update submission status');
    },
  });

  const pendingCount = submissions?.filter(s => s.status === 'pending').length || 0;
  const approvedCount = submissions?.filter(s => s.status === 'approved').length || 0;
  const rejectedCount = submissions?.filter(s => s.status === 'rejected').length || 0;

  return {
    submissions: submissions || [],
    isLoading,
    refetch,
    updateSubmissionStatus,
    stats: {
      total: submissions?.length || 0,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
};
