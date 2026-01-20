import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface SupervisorAlert {
  id: string;
  created_at: string;
  supervisor_id: string;
  agent_id: string;
  agent_name: string;
  alert_type: string;
  title: string;
  description: string | null;
  details: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
}

export function useSupervisorAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['supervisor-alerts', user?.id, today],
    queryFn: async (): Promise<SupervisorAlert[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('supervisor_alerts')
        .select('*')
        .eq('supervisor_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SupervisorAlert[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('supervisor-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'supervisor_alerts',
          filter: `supervisor_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['supervisor-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Mark alert as read
  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('supervisor_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-alerts'] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      const { error } = await supabase
        .from('supervisor_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('supervisor_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-alerts'] });
    },
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const alertsByType = {
    missedConfirmation: alerts.filter(a => a.alert_type === 'missed_confirmation'),
    autoLogout: alerts.filter(a => a.alert_type === 'auto_logout'),
    marketVisit: alerts.filter(a => a.alert_type === 'market_visit'),
    excessiveOthers: alerts.filter(a => a.alert_type === 'excessive_others'),
    breakOverrun: alerts.filter(a => a.alert_type === 'break_overrun'),
    fiveMinAutoLogout: alerts.filter(a => a.alert_type === 'five_min_auto_logout'),
  };

  return {
    alerts,
    unreadCount,
    alertsByType,
    isLoading,
    refetch,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
