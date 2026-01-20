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

// 5-MINUTE AUTO-LOGOUT ACTIVITIES (Cold Calling, Client Meeting)
export const FIVE_MIN_AUTO_LOGOUT_ACTIVITIES: SimpleActivityType[] = ['calling', 'meeting_in_office'];
export const FIVE_MIN_AUTO_LOGOUT_MS = 5 * 60 * 1000; // 5 minutes

// Activity labels for auto-logout reasons
export const FIVE_MIN_ACTIVITY_LABELS: Record<string, string> = {
  calling: 'Cold Calling',
  calling_telecalling: 'Cold Calling',
  meeting_in_office: 'Client Meeting',
  client_meeting: 'Client Meeting',
};

// Break schedule (Asia/Dubai)
export const BREAK_SCHEDULE = {
  tea_morning: { start: '11:15', end: '11:30', label: 'Tea Break', durationMinutes: 15 },
  lunch: { start: '13:15', end: '14:15', label: 'Lunch Break', durationMinutes: 60 },
  tea_afternoon: { start: '16:30', end: '16:45', label: 'Tea Break', durationMinutes: 15 },
};

// Break overrun threshold - alert after X minutes past scheduled break end
export const BREAK_OVERRUN_THRESHOLD_MINUTES = 5;
// Auto-switch to Calling after X minutes past scheduled break end
export const BREAK_OVERRUN_AUTO_SWITCH_MINUTES = 10;

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

// Helper to check if current time exceeds break end by threshold
export function getBreakOverrunMinutes(now: Date): { overrunMinutes: number; breakLabel: string } | null {
  const dubaiTime = getDubaiTime(now);
  const currentMinutes = dubaiTime.getHours() * 60 + dubaiTime.getMinutes();
  
  for (const [, breakInfo] of Object.entries(BREAK_SCHEDULE)) {
    const [endHour, endMin] = breakInfo.end.split(':').map(Number);
    const breakEndMinutes = endHour * 60 + endMin;
    const [startHour, startMin] = breakInfo.start.split(':').map(Number);
    const breakStartMinutes = startHour * 60 + startMin;
    
    // Check if we're past break end but within a reasonable window (within 30 min of break end)
    if (currentMinutes >= breakEndMinutes && currentMinutes < breakEndMinutes + 30) {
      // Also verify we were within the break window recently (started after break start)
      if (currentMinutes >= breakStartMinutes) {
        const overrunMinutes = currentMinutes - breakEndMinutes;
        return { overrunMinutes, breakLabel: breakInfo.label };
      }
    }
  }
  
  return null;
}

export function useActivitySession() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showConfirmationPrompt, setShowConfirmationPrompt] = useState(false);
  const [confirmationPendingSince, setConfirmationPendingSince] = useState<Date | null>(null);
  const [breakOverrunAlerted, setBreakOverrunAlerted] = useState<string | null>(null); // Track which break was alerted
  const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fiveMinAutoLogoutTimerRef = useRef<NodeJS.Timeout | null>(null); // 5-min auto-logout timer

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

      // Calculate time spent on previous "others" activity if applicable
      let newTotalOthersMinutes = session.total_others_minutes || 0;
      if (session.current_activity === 'others' && session.current_activity_started_at) {
        const othersMinutes = Math.round(
          (Date.now() - new Date(session.current_activity_started_at).getTime()) / 60000
        );
        newTotalOthersMinutes += othersMinutes;
      }

      // Check if we need to flag excessive others (only when switching away from others)
      const wasOnOthers = session.current_activity === 'others';
      const shouldFlagExcessiveOthers = wasOnOthers && 
        newTotalOthersMinutes >= OTHERS_FLAG_THRESHOLD_MINUTES &&
        (session.total_others_minutes || 0) < OTHERS_FLAG_THRESHOLD_MINUTES;

      // Update session with new activity
      const { error: sessionError } = await supabase
        .from('activity_sessions')
        .update({
          current_activity: dbActivity,
          current_activity_started_at: now,
          last_confirmation_at: now,
          total_others_minutes: newTotalOthersMinutes,
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

      // Alert supervisor for excessive others
      if (shouldFlagExcessiveOthers) {
        await alertSupervisor('excessive_others',
          `${profile?.full_name || 'Agent'} has used "Others" activity for more than ${OTHERS_FLAG_THRESHOLD_MINUTES} minutes today.`,
          { total_others_minutes: newTotalOthersMinutes }
        );
      }

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
      case 'five_min_auto_logout':
        return 'Auto Logout – 5 Minute Rule';
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

      // Calculate time spent on "others" activity if applicable
      let newTotalOthersMinutes = session.total_others_minutes || 0;
      const isCurrentlyOnOthers = session.current_activity === 'others';
      const isChangingAwayFromOthers = responseType === 'changed' && isCurrentlyOnOthers && newActivity !== 'others';
      const isAcceptingOthers = responseType === 'accepted' && isCurrentlyOnOthers;

      // If changing away from others or confirming others continues, track time
      if ((isChangingAwayFromOthers || isAcceptingOthers) && session.current_activity_started_at) {
        const othersMinutes = Math.round(
          (Date.now() - new Date(session.current_activity_started_at).getTime()) / 60000
        );
        newTotalOthersMinutes += othersMinutes;
      }

      // Check if we need to flag excessive others
      const shouldFlagExcessiveOthers = newTotalOthersMinutes >= OTHERS_FLAG_THRESHOLD_MINUTES &&
        (session.total_others_minutes || 0) < OTHERS_FLAG_THRESHOLD_MINUTES;

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
        total_others_minutes: newTotalOthersMinutes,
        updated_at: now,
      };

      // If accepting and still on others, reset the start time for next interval tracking
      if (isAcceptingOthers) {
        updateData.current_activity_started_at = now;
      }

      if (responseType === 'changed' && newActivity) {
        updateData.current_activity = SIMPLE_TO_DB_ACTIVITY[newActivity];
        updateData.current_activity_started_at = now;

        // If changing to Others, log activity with details
        if (newActivity === 'others') {
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

      // Alert supervisor for excessive others
      if (shouldFlagExcessiveOthers) {
        await alertSupervisor('excessive_others',
          `${profile?.full_name || 'Agent'} has used "Others" activity for more than ${OTHERS_FLAG_THRESHOLD_MINUTES} minutes today.`,
          { total_others_minutes: newTotalOthersMinutes }
        );
      }

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

  // Break overrun detection, alerting, and auto-switch
  useEffect(() => {
    if (!isSessionActive || !session?.current_activity || !user?.id) return;
    
    // Only check if agent is currently on break activity
    const isOnBreakActivity = session.current_activity === 'break';
    if (!isOnBreakActivity) {
      // Reset alert tracking when not on break
      if (breakOverrunAlerted) {
        setBreakOverrunAlerted(null);
      }
      return;
    }

    const overrunInfo = getBreakOverrunMinutes(currentTime);
    
    if (overrunInfo && overrunInfo.overrunMinutes >= BREAK_OVERRUN_THRESHOLD_MINUTES) {
      const breakKey = `${new Date().toISOString().split('T')[0]}-${overrunInfo.breakLabel}`;
      const autoSwitchKey = `${breakKey}-autoswitch`;
      
      // Check if we need to auto-switch (10+ minutes overrun)
      if (overrunInfo.overrunMinutes >= BREAK_OVERRUN_AUTO_SWITCH_MINUTES && breakOverrunAlerted !== autoSwitchKey) {
        setBreakOverrunAlerted(autoSwitchKey);
        
        // Auto-switch to Calling
        const performAutoSwitch = async () => {
          const now = new Date().toISOString();
          
          // Update session to Calling
          await supabase
            .from('activity_sessions')
            .update({
              current_activity: 'calling_telecalling',
              current_activity_started_at: now,
              last_confirmation_at: now,
              updated_at: now,
            })
            .eq('id', session.id);
          
          // Log the activity change
          await supabase
            .from('activity_logs')
            .insert({
              user_id: user.id,
              activity_type: 'calling_telecalling' as any,
              started_at: now,
              metadata: { auto_switched: true, reason: 'break_overrun' },
            });
          
          // Alert supervisor about auto-switch
          await alertSupervisor('break_overrun',
            `${profile?.full_name || 'Agent'} was auto-switched to Calling after exceeding ${overrunInfo.breakLabel} by ${overrunInfo.overrunMinutes} minutes.`,
            { 
              break_label: overrunInfo.breakLabel, 
              overrun_minutes: overrunInfo.overrunMinutes,
              auto_switched: true
            }
          );
          
          toast.warning(`You've been auto-switched to Calling after exceeding your ${overrunInfo.breakLabel} by ${overrunInfo.overrunMinutes} minutes.`);
          queryClient.invalidateQueries({ queryKey: ['activity-session'] });
        };
        
        performAutoSwitch();
      }
      // First warning at 5 minutes
      else if (breakOverrunAlerted !== breakKey && breakOverrunAlerted !== autoSwitchKey) {
        setBreakOverrunAlerted(breakKey);
        
        alertSupervisor('break_overrun',
          `${profile?.full_name || 'Agent'} has exceeded their ${overrunInfo.breakLabel} by ${overrunInfo.overrunMinutes} minutes.`,
          { 
            break_label: overrunInfo.breakLabel, 
            overrun_minutes: overrunInfo.overrunMinutes 
          }
        );
        
        const remainingMinutes = BREAK_OVERRUN_AUTO_SWITCH_MINUTES - overrunInfo.overrunMinutes;
        toast.warning(`Your ${overrunInfo.breakLabel} has ended. You will be auto-switched to Calling in ${remainingMinutes} minutes.`);
      }
    }
  }, [isSessionActive, session?.current_activity, session?.id, currentTime, breakOverrunAlerted, profile?.full_name, user?.id, queryClient]);

  // 5-MINUTE AUTO-LOGOUT for Cold Calling / Client Meeting
  useEffect(() => {
    // Clear existing timer when activity changes or session becomes inactive
    if (fiveMinAutoLogoutTimerRef.current) {
      clearTimeout(fiveMinAutoLogoutTimerRef.current);
      fiveMinAutoLogoutTimerRef.current = null;
    }

    if (!isSessionActive || !session?.id || !user?.id || !session?.current_activity) return;

    // Check if current activity is one that requires 5-min auto-logout
    const isFiveMinActivity = session.current_activity === 'calling_telecalling' || 
                              session.current_activity === 'client_meeting';
    
    if (!isFiveMinActivity || !session.current_activity_started_at) return;

    // Calculate time remaining until auto-logout
    const activityStartedAt = new Date(session.current_activity_started_at).getTime();
    const now = Date.now();
    const elapsed = now - activityStartedAt;
    const remaining = FIVE_MIN_AUTO_LOGOUT_MS - elapsed;

    if (remaining <= 0) {
      // Already exceeded 5 minutes - perform auto-logout immediately
      performFiveMinAutoLogout();
    } else {
      // Set timer for remaining time
      fiveMinAutoLogoutTimerRef.current = setTimeout(() => {
        performFiveMinAutoLogout();
      }, remaining);
    }

    async function performFiveMinAutoLogout() {
      const nowIso = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];
      const activityLabel = FIVE_MIN_ACTIVITY_LABELS[session!.current_activity || ''] || 'Activity';

      // End the session
      await supabase
        .from('activity_sessions')
        .update({
          end_time: nowIso,
          end_reason: `auto_logout_5min_${session!.current_activity}`,
          is_active: false,
          updated_at: nowIso,
        })
        .eq('id', session!.id);

      // Update attendance record
      await supabase
        .from('attendance_records')
        .update({
          is_working: false,
          end_reason: `Auto logout – ${activityLabel} (5 min rule)`,
          last_logout: nowIso,
        })
        .eq('user_id', user!.id)
        .eq('date', today);

      // Log the auto-logout event
      await supabase
        .from('activity_logs')
        .insert({
          user_id: user!.id,
          activity_type: session!.current_activity as any,
          started_at: session!.current_activity_started_at,
          ended_at: nowIso,
          metadata: { 
            auto_logout: true, 
            auto_logout_reason: `5_min_rule_${activityLabel.toLowerCase().replace(' ', '_')}`,
            supervisor_notified: true
          },
        });

      // Alert supervisor
      await alertSupervisor('five_min_auto_logout',
        `Agent ${profile?.full_name || 'Unknown'} selected ${activityLabel} and was auto-logged out after 5 minutes.`,
        { 
          activity_type: session!.current_activity || '',
          activity_label: activityLabel,
          auto_logout_reason: `5 min rule – ${activityLabel}`,
          supervisor_notified: true
        }
      );

      toast.error(`You have been auto-logged out after 5 minutes on ${activityLabel}. To resume work, please log in again and press START.`);
      
      queryClient.invalidateQueries({ queryKey: ['activity-session'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }

    return () => {
      if (fiveMinAutoLogoutTimerRef.current) {
        clearTimeout(fiveMinAutoLogoutTimerRef.current);
        fiveMinAutoLogoutTimerRef.current = null;
      }
    };
  }, [isSessionActive, session?.id, session?.current_activity, session?.current_activity_started_at, user?.id, profile?.full_name, queryClient]);

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