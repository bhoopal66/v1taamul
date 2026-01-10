import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, isWithinInterval, parseISO, subWeeks, subMonths } from 'date-fns';
import { toast } from 'sonner';

export type GoalType = 'weekly' | 'monthly';
export type GoalMetric = 'calls' | 'interested' | 'leads' | 'conversion';

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

// Calculate streaks from completed goals
const calculateStreaks = (completedGoals: Goal[]): GoalStreak[] => {
  const streakMap = new Map<string, { dates: Date[]; goalType: GoalType; metric: GoalMetric }>();

  // Group by goal type and metric
  completedGoals.forEach(goal => {
    if (!goal.completed_at) return;
    const key = `${goal.goal_type}-${goal.metric}`;
    const existing = streakMap.get(key) || { dates: [], goalType: goal.goal_type, metric: goal.metric };
    existing.dates.push(parseISO(goal.end_date));
    streakMap.set(key, existing);
  });

  const streaks: GoalStreak[] = [];

  streakMap.forEach(({ dates, goalType, metric }) => {
    // Sort dates descending
    dates.sort((a, b) => b.getTime() - a.getTime());

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();

    // Calculate current and longest streaks
    for (let i = 0; i < dates.length; i++) {
      const expectedDate = goalType === 'weekly'
        ? endOfWeek(subWeeks(today, i), { weekStartsOn: 1 })
        : endOfMonth(subMonths(today, i));

      const dateStr = format(dates[i], 'yyyy-MM-dd');
      const expectedStr = format(expectedDate, 'yyyy-MM-dd');

      if (i === 0) {
        // Check if most recent completion is current or previous period
        const currentPeriodEnd = goalType === 'weekly'
          ? endOfWeek(today, { weekStartsOn: 1 })
          : endOfMonth(today);
        const prevPeriodEnd = goalType === 'weekly'
          ? endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })
          : endOfMonth(subMonths(today, 1));

        const isCurrentOrPrev = 
          format(dates[i], 'yyyy-MM-dd') === format(currentPeriodEnd, 'yyyy-MM-dd') ||
          format(dates[i], 'yyyy-MM-dd') === format(prevPeriodEnd, 'yyyy-MM-dd');

        if (isCurrentOrPrev) {
          tempStreak = 1;
        }
      } else if (tempStreak > 0) {
        // Check consecutive periods
        const prevDate = dates[i - 1];
        const expectedPrev = goalType === 'weekly'
          ? endOfWeek(subWeeks(dates[i], -1), { weekStartsOn: 1 })
          : endOfMonth(subMonths(dates[i], -1));

        if (format(prevDate, 'yyyy-MM-dd') === format(expectedPrev, 'yyyy-MM-dd')) {
          tempStreak++;
        } else {
          currentStreak = Math.max(currentStreak, tempStreak);
          tempStreak = 0;
        }
      }

      longestStreak = Math.max(longestStreak, tempStreak);
    }

    currentStreak = tempStreak;
    longestStreak = Math.max(longestStreak, currentStreak);

    if (dates.length > 0) {
      streaks.push({
        metric,
        goalType,
        currentStreak,
        longestStreak,
        lastCompletedDate: format(dates[0], 'yyyy-MM-dd'),
      });
    }
  });

  return streaks;
};

export const useAgentGoals = (agentId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = agentId || user?.id;

  // Fetch goals with progress
  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['agent-goals', targetUserId],
    queryFn: async () => {
      if (!targetUserId) throw new Error('No user');

      // Fetch all goals (active and completed for streak calculation)
      const { data: allGoals, error } = await supabase
        .from('agent_goals')
        .select('*')
        .eq('agent_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const today = new Date();
      const goalsWithProgress: GoalWithProgress[] = [];
      const completedGoals: Goal[] = [];

      for (const goal of allGoals || []) {
        // Collect completed goals for streak calculation
        if (goal.completed_at) {
          completedGoals.push({
            ...goal,
            goal_type: goal.goal_type as GoalType,
            metric: goal.metric as GoalMetric,
          });
        }

        // Only process active goals for current progress
        if (!goal.is_active) continue;

        const startDate = parseISO(goal.start_date);
        const endDate = parseISO(goal.end_date);
        
        // Check if goal is within current period
        const isCurrentPeriod = isWithinInterval(today, { start: startDate, end: endDate });
        
        if (!isCurrentPeriod) continue;

        // Fetch current progress based on metric
        let currentValue = 0;

        if (goal.metric === 'calls' || goal.metric === 'interested') {
          const { data: feedback } = await supabase
            .from('call_feedback')
            .select('feedback_status')
            .eq('agent_id', targetUserId)
            .gte('call_timestamp', startDate.toISOString())
            .lte('call_timestamp', endDate.toISOString());

          if (goal.metric === 'calls') {
            currentValue = feedback?.length || 0;
          } else {
            currentValue = feedback?.filter(f => f.feedback_status === 'interested').length || 0;
          }
        } else if (goal.metric === 'leads') {
          const { data: leads } = await supabase
            .from('leads')
            .select('id')
            .eq('agent_id', targetUserId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          currentValue = leads?.length || 0;
        } else if (goal.metric === 'conversion') {
          const { data: feedback } = await supabase
            .from('call_feedback')
            .select('feedback_status')
            .eq('agent_id', targetUserId)
            .gte('call_timestamp', startDate.toISOString())
            .lte('call_timestamp', endDate.toISOString());

          const totalCalls = feedback?.length || 0;
          const interested = feedback?.filter(f => f.feedback_status === 'interested').length || 0;
          currentValue = totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0;
        }

        const isCompleted = currentValue >= goal.target_value;
        const progressPercentage = Math.min(Math.round((currentValue / goal.target_value) * 100), 100);
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        // Auto-mark as completed if target reached and not already marked
        if (isCompleted && !goal.completed_at) {
          await supabase
            .from('agent_goals')
            .update({ completed_at: new Date().toISOString() })
            .eq('id', goal.id);
          
          // Add to completed goals for streak
          completedGoals.push({
            ...goal,
            goal_type: goal.goal_type as GoalType,
            metric: goal.metric as GoalMetric,
            completed_at: new Date().toISOString(),
          });
        }

        goalsWithProgress.push({
          ...goal,
          goal_type: goal.goal_type as GoalType,
          metric: goal.metric as GoalMetric,
          currentValue,
          progressPercentage,
          isCompleted,
          daysRemaining,
        });
      }

      // Calculate streaks
      const streaks = calculateStreaks(completedGoals);

      return { goals: goalsWithProgress, streaks, completedCount: completedGoals.length };
    },
    enabled: !!targetUserId,
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      if (!targetUserId) throw new Error('No user');

      const { start, end } = getDateRange(input.goal_type);

      // Deactivate existing goals of same type/metric
      await supabase
        .from('agent_goals')
        .update({ is_active: false })
        .eq('agent_id', targetUserId)
        .eq('goal_type', input.goal_type)
        .eq('metric', input.metric)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('agent_goals')
        .insert({
          agent_id: targetUserId,
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
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create goal: ' + error.message);
    },
  });

  // Update goal mutation
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
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal updated successfully!');
    },
    onError: (error) => {
      toast.error('Failed to update goal: ' + error.message);
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agent_goals')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals', targetUserId] });
      toast.success('Goal removed');
    },
    onError: (error) => {
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
