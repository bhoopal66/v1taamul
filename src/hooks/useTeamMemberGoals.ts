import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { toast } from 'sonner';
import { GoalType, GoalMetric, Goal } from './useAgentGoals';

export interface CreateTeamMemberGoalInput {
  agent_id: string;
  goal_type: GoalType;
  metric: GoalMetric;
  target_value: number;
}

const getDateRange = (goalType: GoalType): { start: Date; end: Date } => {
  const today = new Date();
  if (goalType === 'weekly') {
    return {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    };
  }
  return {
    start: startOfMonth(today),
    end: endOfMonth(today),
  };
};

export const useTeamMemberGoals = () => {
  const { ledTeamId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all goals for team members
  const { data: teamGoals, isLoading } = useQuery({
    queryKey: ['team-member-goals', ledTeamId],
    queryFn: async () => {
      if (!ledTeamId) return [];

      // Get team member IDs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [];

      const memberIds = profiles.map(p => p.id);

      // Fetch active goals for all team members
      const { data: goals, error: goalsError } = await supabase
        .from('agent_goals')
        .select('*')
        .in('agent_id', memberIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      // Map goals with agent info
      return (goals || []).map(goal => ({
        ...goal,
        agentName: profiles.find(p => p.id === goal.agent_id)?.full_name || 'Unknown',
        username: profiles.find(p => p.id === goal.agent_id)?.username || '',
      }));
    },
    enabled: !!ledTeamId,
  });

  // Create goal for team member
  const createGoalMutation = useMutation({
    mutationFn: async (input: CreateTeamMemberGoalInput) => {
      const { start, end } = getDateRange(input.goal_type);

      // Deactivate existing goals of same type/metric for this agent
      await supabase
        .from('agent_goals')
        .update({ is_active: false })
        .eq('agent_id', input.agent_id)
        .eq('goal_type', input.goal_type)
        .eq('metric', input.metric)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('agent_goals')
        .insert({
          agent_id: input.agent_id,
          goal_type: input.goal_type,
          metric: input.metric,
          target_value: input.target_value,
          start_date: format(start, 'yyyy-MM-dd'),
          end_date: format(end, 'yyyy-MM-dd'),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-goals', ledTeamId] });
      toast.success('Goal set for team member!');
    },
    onError: (error) => {
      toast.error('Failed to set goal: ' + error.message);
    },
  });

  // Update goal
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, target_value }: { id: string; target_value: number }) => {
      const { data, error } = await supabase
        .from('agent_goals')
        .update({ target_value })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-goals', ledTeamId] });
      toast.success('Goal updated!');
    },
    onError: (error) => {
      toast.error('Failed to update goal: ' + error.message);
    },
  });

  // Delete/deactivate goal
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agent_goals')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-goals', ledTeamId] });
      toast.success('Goal removed');
    },
    onError: (error) => {
      toast.error('Failed to remove goal: ' + error.message);
    },
  });

  return {
    teamGoals: teamGoals || [],
    isLoading,
    createGoal: createGoalMutation.mutate,
    updateGoal: updateGoalMutation.mutate,
    deleteGoal: deleteGoalMutation.mutate,
    isCreating: createGoalMutation.isPending,
  };
};
