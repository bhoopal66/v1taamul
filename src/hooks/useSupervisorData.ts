import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  email: string;
  isActive: boolean;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  conversionRate: number;
  leadsGenerated: number;
}

export interface PendingUpload {
  id: string;
  agentId: string;
  agentName: string;
  fileName: string;
  uploadDate: string;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  duplicateEntries: number;
  status: string;
}

export interface TeamStats {
  totalAgents: number;
  activeAgents: number;
  totalCallsToday: number;
  totalLeadsToday: number;
  avgConversionRate: number;
  pendingUploads: number;
}

export const useSupervisorData = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date();

  const isSupervisor = userRole === 'supervisor' || userRole === 'operations_head' || userRole === 'admin' || userRole === 'super_admin';

  // Fetch team agents with their performance
  const { data: teamPerformance, isLoading: teamLoading, refetch: refetchTeam } = useQuery({
    queryKey: ['team-performance'],
    queryFn: async (): Promise<AgentPerformance[]> => {
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Get all agent profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, username, is_active');

      if (profilesError) throw profilesError;

      // Get today's feedback for all agents
      const { data: feedback } = await supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .gte('call_timestamp', todayStart)
        .lte('call_timestamp', todayEnd);

      // Get today's leads
      const { data: leads } = await supabase
        .from('leads')
        .select('agent_id')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Aggregate by agent
      return (profiles || []).map(profile => {
        const agentFeedback = feedback?.filter(f => f.agent_id === profile.id) || [];
        const agentLeads = leads?.filter(l => l.agent_id === profile.id) || [];
        
        const totalCalls = agentFeedback.length;
        const interested = agentFeedback.filter(f => f.feedback_status === 'interested').length;
        const notInterested = agentFeedback.filter(f => f.feedback_status === 'not_interested').length;
        const notAnswered = agentFeedback.filter(f => f.feedback_status === 'not_answered').length;

        return {
          agentId: profile.id,
          agentName: profile.full_name || profile.username || 'Unknown',
          email: profile.email,
          isActive: profile.is_active ?? true,
          totalCalls,
          interested,
          notInterested,
          notAnswered,
          conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
          leadsGenerated: agentLeads.length,
        };
      });
    },
    enabled: isSupervisor,
    refetchInterval: 30000,
  });

  // Fetch pending uploads
  const { data: pendingUploads, isLoading: uploadsLoading, refetch: refetchUploads } = useQuery({
    queryKey: ['pending-uploads'],
    queryFn: async (): Promise<PendingUpload[]> => {
      const { data: uploads, error } = await supabase
        .from('call_sheet_uploads')
        .select('*')
        .eq('status', 'pending')
        .order('upload_timestamp', { ascending: false });

      if (error) throw error;

      // Get agent names
      const agentIds = [...new Set(uploads?.map(u => u.agent_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', agentIds);

      return (uploads || []).map(upload => {
        const profile = profiles?.find(p => p.id === upload.agent_id);
        return {
          id: upload.id,
          agentId: upload.agent_id,
          agentName: profile?.full_name || profile?.username || 'Unknown',
          fileName: upload.file_name || 'Unknown file',
          uploadDate: upload.upload_timestamp || upload.created_at || '',
          totalEntries: upload.total_entries_submitted || 0,
          validEntries: upload.valid_entries || 0,
          invalidEntries: upload.invalid_entries || 0,
          duplicateEntries: upload.duplicate_entries || 0,
          status: upload.status || 'pending',
        };
      });
    },
    enabled: isSupervisor,
    refetchInterval: 30000,
  });

  // Calculate team stats
  const teamStats: TeamStats = {
    totalAgents: teamPerformance?.length || 0,
    activeAgents: teamPerformance?.filter(a => a.isActive).length || 0,
    totalCallsToday: teamPerformance?.reduce((sum, a) => sum + a.totalCalls, 0) || 0,
    totalLeadsToday: teamPerformance?.reduce((sum, a) => sum + a.leadsGenerated, 0) || 0,
    avgConversionRate: teamPerformance && teamPerformance.length > 0
      ? Math.round(teamPerformance.reduce((sum, a) => sum + a.conversionRate, 0) / teamPerformance.length)
      : 0,
    pendingUploads: pendingUploads?.length || 0,
  };

  // Approve upload mutation
  const approveUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from('call_sheet_uploads')
        .update({ 
          status: 'approved',
          approval_timestamp: new Date().toISOString(),
        })
        .eq('id', uploadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Upload approved successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-uploads'] });
    },
    onError: (error) => {
      toast.error('Failed to approve upload: ' + error.message);
    },
  });

  // Reject upload mutation
  const rejectUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from('call_sheet_uploads')
        .update({ 
          status: 'rejected',
          approval_timestamp: new Date().toISOString(),
        })
        .eq('id', uploadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Upload rejected');
      queryClient.invalidateQueries({ queryKey: ['pending-uploads'] });
    },
    onError: (error) => {
      toast.error('Failed to reject upload: ' + error.message);
    },
  });

  const refetchAll = () => {
    refetchTeam();
    refetchUploads();
  };

  return {
    teamPerformance: teamPerformance || [],
    pendingUploads: pendingUploads || [],
    teamStats,
    isLoading: teamLoading || uploadsLoading,
    isSupervisor,
    approveUpload: approveUpload.mutate,
    rejectUpload: rejectUpload.mutate,
    refetch: refetchAll,
  };
};
