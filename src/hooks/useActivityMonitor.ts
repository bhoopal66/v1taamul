import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Activity types matching the database enum
export type ActivityType = 
  | 'data_collection'
  | 'customer_followup'
  | 'calling_telecalling'
  | 'calling_coldcalling'
  | 'calling_calllist_movement'
  | 'client_meeting'
  | 'admin_documentation'
  | 'training'
  | 'system_bank_portal'
  | 'break'
  | 'idle';

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_system_enforced: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  first_login: string | null;
  last_logout: string | null;
  total_work_minutes: number;
  total_break_minutes: number;
  status: 'present' | 'late' | 'absent' | 'half_day' | null;
  is_late: boolean;
  late_by_minutes: number;
  daily_score: number | null;
}

export interface IdleAlert {
  id: string;
  user_id: string;
  alert_time: string;
  severity: 'warning' | 'escalation' | 'discipline_flag';
  idle_duration_minutes: number;
  was_acknowledged: boolean;
  acknowledged_at: string | null;
  escalated_to: string | null;
  notes: string | null;
}

// Break schedule configuration (Asia/Dubai timezone)
export const BREAK_SCHEDULE = {
  tea_morning: { start: '11:15', end: '11:30', label: 'Tea Break' },
  lunch: { start: '13:15', end: '14:15', label: 'Lunch Break' },
  tea_afternoon: { start: '16:30', end: '16:45', label: 'Tea Break' },
};

export const WORK_HOURS = {
  start: '10:00',
  end: '19:00',
};

// Activity type labels for display
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  data_collection: 'Data Collection',
  customer_followup: 'Customer Follow-up',
  calling_telecalling: 'Calling (Tele Calling)',
  calling_coldcalling: 'Calling (Cold Calling)',
  calling_calllist_movement: 'Calling (Call List Movement)',
  client_meeting: 'Client Meeting',
  admin_documentation: 'Admin / Documentation',
  training: 'Training',
  system_bank_portal: 'System / Bank Portal Work',
  break: 'Break',
  idle: 'Idle',
};

// Calling activities (all count as "Calling" for KPIs)
export const CALLING_ACTIVITIES: ActivityType[] = [
  'calling_telecalling',
  'calling_coldcalling',
  'calling_calllist_movement',
];

// Helper to check if currently on break
export function isOnScheduledBreak(now: Date): { onBreak: boolean; breakLabel: string; breakEnd: string | null } {
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const currentTime = `${dubaiTime.getHours().toString().padStart(2, '0')}:${dubaiTime.getMinutes().toString().padStart(2, '0')}`;
  
  for (const [, breakInfo] of Object.entries(BREAK_SCHEDULE)) {
    if (currentTime >= breakInfo.start && currentTime < breakInfo.end) {
      return { onBreak: true, breakLabel: breakInfo.label, breakEnd: breakInfo.end };
    }
  }
  
  return { onBreak: false, breakLabel: '', breakEnd: null };
}

// Helper to check if within work hours
export function isWithinWorkHours(now: Date): boolean {
  const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const currentTime = `${dubaiTime.getHours().toString().padStart(2, '0')}:${dubaiTime.getMinutes().toString().padStart(2, '0')}`;
  return currentTime >= WORK_HOURS.start && currentTime < WORK_HOURS.end;
}

export function useActivityMonitor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate break status
  const breakStatus = useMemo(() => isOnScheduledBreak(currentTime), [currentTime]);
  const withinWorkHours = useMemo(() => isWithinWorkHours(currentTime), [currentTime]);

  // Fetch today's activity logs
  const { data: todayLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['activity-logs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', `${today}T00:00:00`)
        .order('started_at', { ascending: true });
      
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch today's attendance
  const { data: attendance, isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as AttendanceRecord | null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Fetch today's idle alerts
  const { data: idleAlerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['idle-alerts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('idle_alerts')
        .select('*')
        .eq('user_id', user.id)
        .gte('alert_time', `${today}T00:00:00`)
        .order('alert_time', { ascending: false });
      
      if (error) throw error;
      return data as IdleAlert[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Get current (active) activity
  const currentActivity = useMemo(() => {
    return todayLogs.find(log => !log.ended_at) || null;
  }, [todayLogs]);

  // Switch activity mutation
  const switchActivityMutation = useMutation({
    mutationFn: async ({ activityType, metadata = {} }: { activityType: ActivityType; metadata?: Record<string, string | boolean | number> }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Use the database function to switch activity
      const { data, error } = await supabase.rpc('switch_activity', {
        p_user_id: user.id,
        p_activity_type: activityType,
        p_metadata: metadata,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to switch activity: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Acknowledge idle alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('idle_alerts')
        .update({
          was_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['idle-alerts'] });
    },
  });

  // Calculate calling time stats
  const callingStats = useMemo(() => {
    const callingLogs = todayLogs.filter(log => CALLING_ACTIVITIES.includes(log.activity_type));
    const callListMovementLogs = todayLogs.filter(log => log.activity_type === 'calling_calllist_movement');
    
    const totalCallingMinutes = callingLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
    const callListMovementMinutes = callListMovementLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
    
    const callListMovementPercentage = totalCallingMinutes > 0 
      ? (callListMovementMinutes / totalCallingMinutes) * 100 
      : 0;
    
    return {
      totalCallingMinutes,
      callListMovementMinutes,
      callListMovementPercentage,
      isCallListMovementOverCap: callListMovementPercentage > 15,
    };
  }, [todayLogs]);

  // Switch activity handler
  const switchActivity = useCallback((activityType: ActivityType, metadata?: Record<string, string | boolean | number>) => {
    // If on break, force break activity
    if (breakStatus.onBreak && activityType !== 'break') {
      toast({
        title: 'Break Time',
        description: `You are currently on ${breakStatus.breakLabel}. Please wait until ${breakStatus.breakEnd}.`,
        variant: 'destructive',
      });
      return;
    }
    
    switchActivityMutation.mutate({ activityType, metadata });
  }, [breakStatus, switchActivityMutation, toast]);

  // Auto-switch to break when on scheduled break
  useEffect(() => {
    if (breakStatus.onBreak && currentActivity?.activity_type !== 'break') {
      switchActivityMutation.mutate({ 
        activityType: 'break', 
        metadata: { 
          break_label: breakStatus.breakLabel,
          is_system_enforced: true 
        } as Record<string, string | boolean>
      });
    }
  }, [breakStatus.onBreak, currentActivity?.activity_type, breakStatus.breakLabel, switchActivityMutation]);

  // Set up realtime subscription for activity logs
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetchLogs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'idle_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchLogs, refetchAlerts]);

  return {
    // State
    currentActivity,
    todayLogs,
    attendance,
    idleAlerts,
    callingStats,
    breakStatus,
    withinWorkHours,
    currentTime,
    
    // Loading states
    isLoading: logsLoading || attendanceLoading,
    isSwitching: switchActivityMutation.isPending,
    
    // Actions
    switchActivity,
    acknowledgeAlert: acknowledgeAlertMutation.mutate,
    refetch: () => {
      refetchLogs();
      refetchAttendance();
      refetchAlerts();
    },
  };
}
