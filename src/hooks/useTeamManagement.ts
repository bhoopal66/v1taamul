import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  team_type: 'remote' | 'office';
  leader_id: string | null;
  leader_name?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string | null;
  username: string;
  email: string;
  team_id: string | null;
  is_active: boolean;
  role?: string;
}

export const useTeamManagement = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // Fetch all teams with leader info and member count
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-management'],
    queryFn: async (): Promise<Team[]> => {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) throw teamsError;

      // Get leader names
      const leaderIds = teamsData?.filter(t => t.leader_id).map(t => t.leader_id) || [];
      let leaderProfiles: { id: string; full_name: string | null; username: string }[] = [];
      
      if (leaderIds.length > 0) {
        const { data } = await supabase
          .from('profiles_public')
          .select('id, full_name, username')
          .in('id', leaderIds);
        leaderProfiles = data || [];
      }

      // Get member counts - only count active members
      const { data: memberCounts } = await supabase
        .from('profiles_public')
        .select('team_id')
        .eq('is_active', true)
        .not('team_id', 'is', null);

      const countMap = new Map<string, number>();
      memberCounts?.forEach(m => {
        if (m.team_id) {
          countMap.set(m.team_id, (countMap.get(m.team_id) || 0) + 1);
        }
      });

      return (teamsData || []).map(team => {
        const leader = leaderProfiles.find(p => p.id === team.leader_id);
        return {
          ...team,
          team_type: team.team_type as 'remote' | 'office',
          leader_name: leader ? (leader.full_name || leader.username) : undefined,
          member_count: countMap.get(team.id) || 0,
        };
      });
    },
    enabled: !!user?.id && isAdmin,
  });

  // Fetch only active agents (for assignment) with their roles
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-for-team-assignment'],
    queryFn: async (): Promise<TeamMember[]> => {
      // Admins can access full profiles including email - only show active members
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, team_id, is_active')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      // Fetch roles for all agents
      const agentIds = data?.map(a => a.id) || [];
      let rolesMap = new Map<string, string>();
      
      if (agentIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', agentIds);
        
        rolesData?.forEach(r => {
          rolesMap.set(r.user_id, r.role);
        });
      }

      return (data || []).map(agent => ({
        ...agent,
        role: rolesMap.get(agent.id) || 'agent',
      }));
    },
    enabled: !!user?.id && isAdmin,
  });

  // Create team mutation
  const createTeam = useMutation({
    mutationFn: async (team: { name: string; team_type: 'remote' | 'office'; leader_id?: string }) => {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: team.name,
          team_type: team.team_type,
          leader_id: team.leader_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      toast.success('Team created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create team: ${error.message}`);
    },
  });

  // Update team mutation
  const updateTeam = useMutation({
    mutationFn: async (team: { id: string; name?: string; team_type?: 'remote' | 'office'; leader_id?: string | null }) => {
      const { id, ...updates } = team;
      const { data, error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      toast.success('Team updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update team: ${error.message}`);
    },
  });

  // Delete team mutation
  const deleteTeam = useMutation({
    mutationFn: async (teamId: string) => {
      // First, unassign all members from this team
      await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId);

      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Team deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete team: ${error.message}`);
    },
  });

  // Assign agent to team mutation
  const assignAgentToTeam = useMutation({
    mutationFn: async ({ agentId, teamId }: { agentId: string; teamId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Agent assignment updated');
    },
    onError: (error) => {
      toast.error(`Failed to assign agent: ${error.message}`);
    },
  });

  // Bulk assign agents to team
  const bulkAssignAgents = useMutation({
    mutationFn: async ({ agentIds, teamId }: { agentIds: string[]; teamId: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .in('id', agentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Agents assigned to team');
    },
    onError: (error) => {
      toast.error(`Failed to assign agents: ${error.message}`);
    },
  });

  return {
    teams: teams || [],
    agents: agents || [],
    isLoading: teamsLoading || agentsLoading,
    isAdmin,
    createTeam,
    updateTeam,
    deleteTeam,
    assignAgentToTeam,
    bulkAssignAgents,
  };
};
