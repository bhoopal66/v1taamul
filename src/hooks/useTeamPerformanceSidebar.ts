import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, format } from 'date-fns';

export interface TeamPerformanceStats {
  totalCalls: number;
  interestedCount: number;
  leadsGenerated: number;
  teamMemberCount: number;
}

export const useTeamPerformanceSidebar = () => {
  const { user, profile, userRole, ledTeamId } = useAuth();

  // Roles with global access (can see all teams)
  const globalAccessRoles = ['super_admin', 'admin', 'operations_head'];
  const hasGlobalAccess = globalAccessRoles.includes(userRole || '');
  
  // Show for management roles OR team leaders who lead a team
  const managementRoles = ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'];
  const isManagementRole = managementRoles.includes(userRole || '');
  const isTeamLeaderWithTeam = !!ledTeamId;
  const isTeamViewer = isManagementRole || isTeamLeaderWithTeam;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['team-performance-sidebar', user?.id, profile?.team_id, ledTeamId, userRole, hasGlobalAccess],
    queryFn: async (): Promise<TeamPerformanceStats> => {
      if (!user) throw new Error('No user');

      const todayStart = startOfDay(new Date()).toISOString();
      let memberIds: string[] = [];
      let teamMemberCount = 0;

      if (hasGlobalAccess) {
        // Global access: fetch ALL active agents
        const { data: allAgents, error: agentsError } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_active', true);

        if (agentsError) throw agentsError;
        memberIds = allAgents?.map(m => m.id) || [];
        teamMemberCount = memberIds.length;
      } else {
        // Team-specific access
        const teamId = ledTeamId || profile?.team_id;
        
        if (!teamId) {
          return { totalCalls: 0, interestedCount: 0, leadsGenerated: 0, teamMemberCount: 0 };
        }

        const { data: teamMembers, error: teamError } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', teamId)
          .eq('is_active', true);

        if (teamError) throw teamError;
        memberIds = teamMembers?.map(m => m.id) || [];
        teamMemberCount = memberIds.length;
      }

      if (memberIds.length === 0) {
        return { totalCalls: 0, interestedCount: 0, leadsGenerated: 0, teamMemberCount: 0 };
      }

      // Get today's call feedback for all team members
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('feedback_status')
        .in('agent_id', memberIds)
        .gte('call_timestamp', todayStart);

      if (feedbackError) throw feedbackError;

      const totalCalls = feedbackData?.length || 0;
      const interestedCount = feedbackData?.filter(f => f.feedback_status === 'interested').length || 0;

      // Get today's leads for all team members
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .in('agent_id', memberIds)
        .gte('created_at', todayStart);

      if (leadsError) throw leadsError;

      const leadsGenerated = leadsData?.length || 0;

      return {
        totalCalls,
        interestedCount,
        leadsGenerated,
        teamMemberCount,
      };
    },
    enabled: !!user && isTeamViewer,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return {
    stats: stats || { totalCalls: 0, interestedCount: 0, leadsGenerated: 0, teamMemberCount: 0 },
    isLoading,
    isTeamViewer,
    hasGlobalAccess,
  };
};
