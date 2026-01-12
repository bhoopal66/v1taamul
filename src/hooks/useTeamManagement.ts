import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
}

export const useTeamManagement = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams-management'],
    queryFn: async (): Promise<Team[]> => {
      return api.get<Team[]>('/teams');
    },
    enabled: !!user?.id && isAdmin,
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-for-team-assignment'],
    queryFn: async (): Promise<TeamMember[]> => {
      return api.get<TeamMember[]>('/teams/agents');
    },
    enabled: !!user?.id && isAdmin,
  });

  const createTeam = useMutation({
    mutationFn: async (team: { name: string; team_type: 'remote' | 'office'; leader_id?: string }) => {
      return api.post('/teams', team);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      toast.success('Team created successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to create team: ${error.message}`);
    },
  });

  const updateTeam = useMutation({
    mutationFn: async (team: { id: string; name?: string; team_type?: 'remote' | 'office'; leader_id?: string | null }) => {
      const { id, ...updates } = team;
      return api.put(`/teams/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      toast.success('Team updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update team: ${error.message}`);
    },
  });

  const deleteTeam = useMutation({
    mutationFn: async (teamId: string) => {
      return api.delete(`/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Team deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete team: ${error.message}`);
    },
  });

  const assignAgentToTeam = useMutation({
    mutationFn: async ({ agentId, teamId }: { agentId: string; teamId: string | null }) => {
      return api.post('/teams/assign-agent', { agentId, teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Agent assignment updated');
    },
    onError: (error: any) => {
      toast.error(`Failed to assign agent: ${error.message}`);
    },
  });

  const bulkAssignAgents = useMutation({
    mutationFn: async ({ agentIds, teamId }: { agentIds: string[]; teamId: string }) => {
      return api.post('/teams/bulk-assign', { agentIds, teamId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams-management'] });
      queryClient.invalidateQueries({ queryKey: ['agents-for-team-assignment'] });
      toast.success('Agents assigned to team');
    },
    onError: (error: any) => {
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
