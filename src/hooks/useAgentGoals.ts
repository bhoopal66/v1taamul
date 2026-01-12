import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type GoalType = 'weekly' | 'monthly';
export type GoalMetric = 'calls' | 'interested' | 'leads' | 'conversion' | 'talk_time';

export interface Goal {
  id: string;
  agent_id: string;
  goal_type: GoalType;
  metric: GoalMetric;
  target_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalWithProgress extends Goal {
  currentValue: number;
  progressPercentage: number;
  isCompleted: boolean;
  daysRemaining: number;
}

export interface GoalStreak {
  metric: GoalMetric;
  goalType: GoalType;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

export interface CreateGoalInput {
  goal_type: GoalType;
  metric: GoalMetric;
  target_value: number;
}

export const useAgentGoals = (agentId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = agentId || user?.id;

  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['agent-goals', targetUserId],
    queryFn: async () => {
      const params = agentId ? { agentId } : {};
      return api.get<{
        goals: GoalWithProgress[];
        streaks: GoalStreak[];
        completedCount: number;
      }>('/goals', params);
    },
    enabled: !!targetUserId,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      return api.post('/goals', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal created successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to create goal: ' + error.message);
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, target_value }: { id: string; target_value: number }) => {
      return api.put(`/goals/${id}`, { target_value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update goal: ' + error.message);
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal removed');
    },
    onError: (error: any) => {
      toast.error('Failed to remove goal: ' + error.message);
    },
  });

  return {
    goals: goalsData?.goals || [],
    streaks: goalsData?.streaks || [],
    completedCount: goalsData?.completedCount || 0,
    isLoading,
    createGoal: createGoalMutation.mutate,
    updateGoal: updateGoalMutation.mutate,
    deleteGoal: deleteGoalMutation.mutate,
    isCreating: createGoalMutation.isPending,
  };
};
