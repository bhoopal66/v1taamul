import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PerformanceTarget {
  id: string;
  target_type: 'team' | 'agent';
  team_id: string | null;
  agent_id: string | null;
  metric: string;
  target_value: number;
  threshold_percentage: number;
  period: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  team_name?: string;
  agent_name?: string;
}

export interface PerformanceAlert {
  id: string;
  target_id: string;
  alert_type: 'team' | 'agent';
  team_id: string | null;
  agent_id: string | null;
  metric: string;
  target_value: number;
  actual_value: number;
  percentage_achieved: number;
  alert_status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  team_name?: string;
  agent_name?: string;
}

interface CreateTargetInput {
  target_type: 'team' | 'agent';
  team_id?: string;
  agent_id?: string;
  metric: string;
  target_value: number;
  threshold_percentage: number;
  period: string;
}

export const usePerformanceAlerts = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // Fetch performance targets
  const { data: targets = [], isLoading: targetsLoading } = useQuery({
    queryKey: ['performance-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_targets')
        .select(`
          *,
          teams:team_id(name),
          profiles:agent_id(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((target: any) => ({
        ...target,
        team_name: target.teams?.name,
        agent_name: target.profiles?.full_name || target.profiles?.username,
      })) as PerformanceTarget[];
    },
    enabled: !!user?.id,
  });

  // Fetch performance alerts
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['performance-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_alerts')
        .select(`
          *,
          teams:team_id(name),
          profiles:agent_id(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((alert: any) => ({
        ...alert,
        team_name: alert.teams?.name,
        agent_name: alert.profiles?.full_name || alert.profiles?.username,
      })) as PerformanceAlert[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  // Create target mutation
  const createTarget = useMutation({
    mutationFn: async (input: CreateTargetInput) => {
      const { data, error } = await supabase
        .from('performance_targets')
        .insert({
          target_type: input.target_type,
          team_id: input.team_id || null,
          agent_id: input.agent_id || null,
          metric: input.metric,
          target_value: input.target_value,
          threshold_percentage: input.threshold_percentage,
          period: input.period,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Performance target created');
      queryClient.invalidateQueries({ queryKey: ['performance-targets'] });
    },
    onError: (error) => {
      toast.error('Failed to create target: ' + error.message);
    },
  });

  // Update target mutation
  const updateTarget = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PerformanceTarget> & { id: string }) => {
      const { data, error } = await supabase
        .from('performance_targets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Target updated');
      queryClient.invalidateQueries({ queryKey: ['performance-targets'] });
    },
    onError: (error) => {
      toast.error('Failed to update target: ' + error.message);
    },
  });

  // Delete target mutation
  const deleteTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('performance_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Target deleted');
      queryClient.invalidateQueries({ queryKey: ['performance-targets'] });
    },
    onError: (error) => {
      toast.error('Failed to delete target: ' + error.message);
    },
  });

  // Acknowledge alert mutation
  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase
        .from('performance_alerts')
        .update({
          alert_status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['performance-alerts'] });
    },
    onError: (error) => {
      toast.error('Failed to acknowledge alert: ' + error.message);
    },
  });

  // Resolve alert mutation
  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase
        .from('performance_alerts')
        .update({
          alert_status: 'resolved',
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Alert resolved');
      queryClient.invalidateQueries({ queryKey: ['performance-alerts'] });
    },
    onError: (error) => {
      toast.error('Failed to resolve alert: ' + error.message);
    },
  });

  // Get active alerts count
  const activeAlertsCount = alerts.filter(a => a.alert_status === 'active').length;

  return {
    targets,
    alerts,
    activeAlertsCount,
    isLoading: targetsLoading || alertsLoading,
    isAdmin,
    createTarget,
    updateTarget,
    deleteTarget,
    acknowledgeAlert,
    resolveAlert,
    refetchAlerts,
  };
};
