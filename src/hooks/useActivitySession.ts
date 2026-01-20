import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Activity types for the new simplified selector
export type SimpleActivityType = 
  | 'data_collection'
  | 'calling'
  | 'followup'
  | 'meeting_in_office'
  | 'market_visit'
  | 'others';

// Map simple types to database activity types
export const SIMPLE_TO_DB_ACTIVITY: Record<SimpleActivityType, string> = {
  data_collection: 'data_collection',
  calling: 'calling_telecalling', // Default calling type
  followup: 'customer_followup',
  meeting_in_office: 'client_meeting',
  market_visit: 'market_visit',
  others: 'others',
};

export const SIMPLE_ACTIVITY_LABELS: Record<SimpleActivityType, string> = {
  data_collection: 'Data Collection',
  calling: 'Calling',
  followup: 'Follow-up',
  meeting_in_office: 'Meeting In Office',
  market_visit: 'Market Visit',
  others: 'Others',
};

export interface ActivitySession {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  end_reason: string | null;
  is_active: boolean;
  current_activity: string | null;
  current_activity_started_at: string | null;
  last_confirmation_at: string | null;
  missed_confirmations: number;
  total_others_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityConfirmation {
  id: string;
  session_id: string;
  user_id: string;
  prompted_at: string;
  responded_at: string | null;
  response_type: string | null;
  activity_before: string | null;
  activity_after: string | null;
  auto_switch_reason: string | null;
  created_at: string;
}

// Configuration
export const CONFIRMATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes grace
export const MAX_MISSED_CONFIRMATIONS = 2;
export const OTHERS_FLAG_THRESHOLD_MINUTES = 30;

// Break schedule (Asia/Dubai)
export const BREAK_SCHEDULE = {
  tea_morning: { start: '11:15', end: '11:30', label: 'Tea Break' },
  lunch: { start: '13:15', end: '14:15', label: 'Lunch Break' },
  tea_afternoon: { start: '16:30', end: '16:45', label: 'Tea Break' },
};

export const WORK_HOURS = {
  start: '10:00',
  end: '19:00',
};

// Helper to get Dubai time
export function getDubaiTime(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
}

// Helper to format time string from date
export function getTimeString(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Check if on scheduled break
export function isOnScheduledBreak(now: Date): { onBreak: boolean; breakLabel: string; breakEnd: string | null } {
  const dubaiTime = getDubaiTime(now);
  const currentTime = getTimeString(dubaiTime);
  
  for (const [, breakInfo] of Object.entries(BREAK_SCHEDULE)) {
    if (currentTime >= breakInfo.start && currentTime < breakInfo.end) {
      return { onBreak: true, breakLabel: breakInfo.label, breakEnd: breakInfo.end };
    }
  }
  
  return { onBreak: false, breakLabel: '', breakEnd: null };
}

// Check if within work hours
export function isWithinWorkHours(now: Date): boolean {
  const dubaiTime = getDubaiTime(now);
  const currentTime = getTimeString(dubaiTime);
  return currentTime >= WORK_HOURS.start && currentTime < WORK_HOURS.end;
}

export function useActivitySession() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfirmationPrompt, setShowConfirmationPrompt] = useState(false);
  const [confirmationPendingSince, setConfirmationPendingSince] = useState<Date | null>(null);
  const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update current time every second for the clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate break status and work hours
  const breakStatus = useMemo(() => isOnScheduledBreak(currentTime), [currentTime]);
  const withinWorkHours = useMemo(() => isWithinWorkHours(currentTime), [currentTime]);
  const dubaiTime = useMemo(() => getDubaiTime(currentTime), [currentTime]);

  // Fetch today's session
  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useQuery({
    queryKey: ['activity-session', user?.id],
    queryFn: async (): Promise<ActivitySession | null> => {
      if (!user?.id) return null;
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('activity_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as ActivitySession | null;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const hasStarted = !!session?.start_time;
  const isSessionActive = session?.is_active && hasStarted;

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      // First try to update existing session, or insert new one
      const { data: existingSession, error: selectError } = await supabase
        .from('activity_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') throw selectError;

      if (existingSession) {
        // Update existing session
        const { error } = await supabase
          .from('activity_sessions')
          .update({
            start_time: now,
            is_active: true,
            last_confirmation_at: now,
            missed_confirmations: 0,
            end_time: null,
            end_reason: null,
            updated_at: now,
          })
          .eq('id', existingSession.id);
        
        if (error) throw error;
      } else {
        // Insert new session
        const { error } = await supabase
          .from('activity_sessions')
          .insert({
            user_id: user.id,
            date: today,
            start_time: now,
            is_active: true,
            last_confirmation_at: now,
          });
        
        if (error) throw error;
      }

      // Also update attendance record
      await supabase
        .from('attendance_records')
        .upsert({
          user_id: user.id,
          date: today,
          first_login: now,
          start_button_pressed_at: now,
          is_working: true,
          status: 'present',
        }, { onConflict: 'user_id,date' });

      return true;
    },
    onSuccess: () => {
      toast.success('Session started! Select your activity.');
      queryClient.invalidateQueries({ queryKey: ['activity-session'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      toast.error(`Failed to start session: ${error.message}`);
    },
  });

  // Switch activity mutation
  const switchActivityMutation = useMutation({
    mutationFn: async ({ 
      activity, 
      details 
    }: { 
      activity: SimpleActivityType; 
      details?: string;
    }) => {
      if (!user?.id || !session?.id) throw new Error('No active session');
      
      const now = new Date().toISOString();
      const dbActivity = SIMPLE_TO_DB_ACTIVITY[activity];

      // Update session with new activity
      const { error: sessionError } = await supabase
        .from('activity_sessions')
        .update({
          current_activity: dbActivity,
          current_activity_started_at: now,
          last_confirmation_at: now,
          updated_at: now,
        })
        .eq('id', session.id);

      if (sessionError) throw sessionError;

      // Log the activity change
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          activity_type: dbActivity as any,
          started_at: now,
          metadata: details ? { details } : {},
          activity_details: details || null,
        });

      // Handle Market Visit - immediate logout
      if (activity === 'market_visit') {
        await handleMarketVisitLogout(details || '');
      }

      return { activity, isMarketVisit: activity === 'market_visit' };
    },
    onSuccess: (result) => {
      if (result.isMarketVisit) {
        toast.info('You have been logged out due to Market Visit.');
      } else {
        toast.success(`Activity changed to ${SIMPLE_ACTIVITY_LABELS[result.activity]}`);
      }
      queryClient.invalidateQueries({ queryKey: ['activity-session'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
    },
    onError: (error) => {
      toast.error(`Failed to switch activity: ${error.message}`);
    },
  });

  // Handle market visit logout
  const handleMarketVisitLogout = async (details: string) => {
    if (!user?.id || !session?.id) return;

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // End the session
    await supabase
      .from('activity_sessions')
      .update({
        end_time: now,
        end_reason: 'market_visit',
        is_active: false,
        updated_at: now,
      })
      .eq('id', session.id);

    // Update attendance
    await supabase
      .from('attendance_records')
      .update({
        is_working: false,
        end_reason: 'Market Visit',
        last_logout: now,
      })
      .eq('user_id', user.id)
      .eq('date', today);

    // Alert supervisor
    await alertSupervisor('market_visit', 
      `${profile?.full_name || 'Agent'} switched to Market Visit and has been logged out.`,
      { details }
    );
  };

  // Alert supervisor helper
  const alertSupervisor = async (alertType: string, description: string, details: Record<string, string | number | boolean> = {}) => {
    if (!user?.id || !profile) return;

    // Get supervisor ID from profile
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('supervisor_id, team_id')
      .eq('id', user.id)
      .single();

    let supervisorId = agentProfile?.supervisor_id;

    // If no direct supervisor, get team leader
    if (!supervisorId && agentProfile?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('leader_id')
        .eq('id', agentProfile.team_id)
        .single();
      supervisorId = team?.leader_id;
    }

    if (!supervisorId) {
      console.warn('No supervisor found for agent');
      return;
    }

    await supabase
      .from('supervisor_alerts')
      .insert([{
        supervisor_id: supervisorId,
        agent_id: user.id,
        agent_name: profile.full_name || profile.username || 'Unknown Agent',
        alert_type: alertType,
        title: getAlertTitle(alertType),
        description,
        details,
      }]);
  };

  const getAlertTitle = (alertType: string): string => {
    switch (alertType) {
      case 'market_visit':
        return 'Agent Market Visit Logout';
      case 'auto_switch':
        return 'Agent Auto-switched to Calling';
      case 'auto_logout':
        return 'Agent Auto-logged Out (Missed Confirmations)';
      case 'excessive_others':
        return 'Excessive "Others" Activity';
      case 'break_overrun':
        return 'Break Time Overrun';
      default:
        return 'Agent Activity Alert';
    }
  };

  // Confirm activity (accept same or change)
  const confirmActivityMutation = useMutation({
    mutationFn: async ({ 
      responseType, 
      newActivity,
      details,
    }: { 
      responseType: 'accepted' | 'changed';
      newActivity?: SimpleActivityType;
      details?: string;
    }) => {
      if (!user?.id || !session?.id) throw new Error('No active session');
      
      const now = new Date().toISOString();

      // Log the confirmation
      await supabase
        .from('activity_confirmations')
        .insert({
          session_id: session.id,
          user_id: user.id,
          prompted_at: confirmationPendingSince?.toISOString() || now,
          responded_at: now,
          response_type: responseType,
          activity_before: session.current_activity,
          activity_after: responseType === 'changed' && newActivity ? SIMPLE_TO_DB_ACTIVITY[newActivity] : session.current_activity,
        });

      // Update session
      const updateData: Record<string, unknown> = {
        last_confirmation_at: now,
        missed_confirmations: 0,
        updated_at: now,
      };

      if (responseType === 'changed' && newActivity) {
        updateData.current_activity = SIMPLE_TO_DB_ACTIVITY[newActivity];
        updateData.current_activity_started_at = now;

        // If changing to Others, track it
        if (newActivity === 'others') {
          // Log activity with details
          await supabase
            .from('activity_logs')
            .insert({
              user_id: user.id,
              activity_type: 'others' as any,
              started_at: now,
              activity_details: details || null,
              metadata: { details },
            });
        }

        // Handle Market Visit during confirmation
        if (newActivity === 'market_visit') {
          await handleMarketVisitLogout(details || '');
        }
      }

      await supabase
        .from('activity_sessions')
        .update(updateData)
        .eq('id', session.id);

      return { responseType, newActivity };
    },
    onSuccess: (result) => {
      setShowConfirmationPrompt(false);
      setConfirmationPendingSince(null);
      
      if (result.responseType === 'accepted') {
        toast.success('Activity confirmed!');
      } else if (result.newActivity === 'market_visit') {
        toast.info('You have been logged out due to Market Visit.');
      } else {
        toast.success(`Activity changed to ${SIMPLE_ACTIVITY_LABELS[result.newActivity!]}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['activity-session'] });
    },
    onError: (error) => {
      toast.error(`Failed to confirm activity: ${error.message}`);
    },
  });

  // Auto-switch to calling
  const autoSwitchToCalling = useCallback(async () => {
    if (!user?.id || !session?.id) return;

    const now = new Date().toISOString();

    // Log auto-switch
    await supabase
      .from('activity_confirmations')
      .insert({
        session_id: session.id,
        user_id: user.id,
        prompted_at: confirmationPendingSince?.toISOString() || now,
        responded_at: now,
        response_type: 'auto_switched',
        activity_before: session.current_activity,
        activity_after: 'calling_telecalling',
        auto_switch_reason: 'No 15-min confirmation response',
      });

    // Update session
    await supabase
      .from('activity_sessions')
      .update({
        current_activity: 'calling_telecalling',
        current_activity_started_at: now,
        last_confirmation_at: now,
        missed_confirmations: (session.missed_confirmations || 0) + 1,
        updated_at: now,
      })
      .eq('id', session.id);

    // Alert supervisor
    await alertSupervisor('auto_switch',
      `${profile?.full_name || 'Agent'} was auto-switched to Calling due to no confirmation response.`,
      { missed_confirmations: (session.missed_confirmations || 0) + 1 }
    );

    toast.warning('Auto-switched to Calling due to no confirmation.');
    setShowConfirmationPrompt(false);
    setConfirmationPendingSince(null);
    queryClient.invalidateQueries({ queryKey: ['activity-session'] });
  }, [user?.id, session, profile?.full_name, confirmationPendingSince, queryClient]);

  // Auto-logout due to missed confirmations
  const autoLogout = useCallback(async () => {
    if (!user?.id || !session?.id) return;

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // End session
    await supabase
      .from('activity_sessions')
      .update({
        end_time: now,
        end_reason: 'auto_logout_missed_confirmations',
        is_active: false,
        updated_at: now,
      })
      .eq('id', session.id);

    // Update attendance
    await supabase
      .from('attendance_records')
      .update({
        is_working: false,
        end_reason: 'Auto logout – missed confirmations',
        last_logout: now,
      })
      .eq('user_id', user.id)
      .eq('date', today);

    // Alert supervisor
    await alertSupervisor('auto_logout',
      `${profile?.full_name || 'Agent'} was auto-logged out due to missed activity confirmations.`,
      { missed_confirmations: MAX_MISSED_CONFIRMATIONS }
    );

    toast.error('You have been logged out due to missed activity confirmations.');
    setShowConfirmationPrompt(false);
    setConfirmationPendingSince(null);
    queryClient.invalidateQueries({ queryKey: ['activity-session'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  }, [user?.id, session, profile?.full_name, queryClient]);

  // Manual end session
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !session?.id) throw new Error('No active session');
      
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      await supabase
        .from('activity_sessions')
        .update({
          end_time: now,
          end_reason: 'manual_logout',
          is_active: false,
          updated_at: now,
        })
        .eq('id', session.id);

      await supabase
        .from('attendance_records')
        .update({
          is_working: false,
          end_reason: 'Manual logout',
          last_logout: now,
        })
        .eq('user_id', user.id)
        .eq('date', today);

      return true;
    },
    onSuccess: () => {
      toast.success('Session ended.');
      queryClient.invalidateQueries({ queryKey: ['activity-session'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      toast.error(`Failed to end session: ${error.message}`);
    },
  });

  // 15-minute confirmation timer logic
  useEffect(() => {
    if (!isSessionActive || breakStatus.onBreak || !withinWorkHours) {
      // Clear timers if not in active working state
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
      if (gracePeriodTimerRef.current) {
        clearTimeout(gracePeriodTimerRef.current);
        gracePeriodTimerRef.current = null;
      }
      return;
    }

    // Check if it's time for confirmation
    if (session?.last_confirmation_at) {
      const lastConfirmation = new Date(session.last_confirmation_at);
      const timeSinceConfirmation = currentTime.getTime() - lastConfirmation.getTime();

      if (timeSinceConfirmation >= CONFIRMATION_INTERVAL_MS && !showConfirmationPrompt) {
        // Time to show confirmation prompt
        setShowConfirmationPrompt(true);
        setConfirmationPendingSince(new Date());

        // Set grace period timer
        gracePeriodTimerRef.current = setTimeout(async () => {
          // Grace period expired - check if should auto-switch or auto-logout
          if ((session.missed_confirmations || 0) >= MAX_MISSED_CONFIRMATIONS - 1) {
            await autoLogout();
          } else {
            await autoSwitchToCalling();
          }
        }, GRACE_PERIOD_MS);
      }
    }

    return () => {
      if (gracePeriodTimerRef.current) {
        clearTimeout(gracePeriodTimerRef.current);
      }
    };
  }, [isSessionActive, breakStatus.onBreak, withinWorkHours, session?.last_confirmation_at, currentTime, showConfirmationPrompt, session?.missed_confirmations, autoSwitchToCalling, autoLogout]);

  // Clear grace period timer when confirmation is shown
  useEffect(() => {
    if (!showConfirmationPrompt && gracePeriodTimerRef.current) {
      clearTimeout(gracePeriodTimerRef.current);
      gracePeriodTimerRef.current = null;
    }
  }, [showConfirmationPrompt]);

  // End of day auto-close (7:00 PM)
  useEffect(() => {
    if (!isSessionActive) return;

    const dubaiNow = getDubaiTime(currentTime);
    const currentTimeStr = getTimeString(dubaiNow);

    if (currentTimeStr >= WORK_HOURS.end) {
      // Auto-close session at end of day
      endSessionMutation.mutate();
    }
  }, [currentTime, isSessionActive, endSessionMutation]);

  // Set up realtime subscription for session updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('activity-session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchSession]);

  return {
    // State
    session,
    hasStarted,
    isSessionActive,
    currentTime,
    dubaiTime,
    breakStatus,
    withinWorkHours,
    showConfirmationPrompt,
    confirmationPendingSince,
    graceTimeRemaining: confirmationPendingSince 
      ? Math.max(0, GRACE_PERIOD_MS - (currentTime.getTime() - confirmationPendingSince.getTime()))
      : GRACE_PERIOD_MS,

    // Loading states
    isLoading: sessionLoading,
    isStarting: startSessionMutation.isPending,
    isSwitching: switchActivityMutation.isPending,
    isConfirming: confirmActivityMutation.isPending,
    isEnding: endSessionMutation.isPending,

    // Actions
    startSession: () => startSessionMutation.mutate(),
    switchActivity: (activity: SimpleActivityType, details?: string) => 
      switchActivityMutation.mutate({ activity, details }),
    confirmActivity: (responseType: 'accepted' | 'changed', newActivity?: SimpleActivityType, details?: string) =>
      confirmActivityMutation.mutate({ responseType, newActivity, details }),
    endSession: () => endSessionMutation.mutate(),
    refetch: refetchSession,
  };
}