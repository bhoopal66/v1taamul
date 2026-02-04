import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays } from 'date-fns';

export type AttendancePeriod = 'day' | 'week' | 'month';

// Activity types that count as "work" (exclude break and idle)
const WORK_ACTIVITY_TYPES = [
  'data_collection',
  'customer_followup',
  'calling_telecalling',
  'calling_coldcalling',
  'calling_calllist_movement',
  'client_meeting',
  'admin_documentation',
  'training',
  'system_bank_portal',
] as const;

interface AgentAttendanceRecord {
  agentId: string;
  agentName: string;
  date: string;
  firstLogin: string | null;
  lastLogout: string | null;
  status: string | null;
  isLate: boolean;
  totalWorkMinutes: number | null;
}

interface UseAgentAttendanceOverviewOptions {
  teamId?: string;
  period: AttendancePeriod;
  selectedDate: Date;
}

// Data starts from Feb 4, 2025
const DATA_START_DATE = new Date('2025-02-04');

export const useAgentAttendanceOverview = ({
  teamId,
  period,
  selectedDate,
}: UseAgentAttendanceOverviewOptions) => {
  return useQuery({
    queryKey: ['agent-attendance-overview', teamId, period, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Calculate date range based on period
      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'day':
          startDate = startOfDay(selectedDate);
          endDate = endOfDay(selectedDate);
          break;
        case 'week':
          startDate = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Sunday
          endDate = endOfWeek(selectedDate, { weekStartsOn: 0 });
          break;
        case 'month':
          startDate = startOfMonth(selectedDate);
          endDate = endOfMonth(selectedDate);
          break;
      }

      // Ensure we don't query before data start date
      if (startDate < DATA_START_DATE) {
        startDate = DATA_START_DATE;
      }

      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      // First get team members - using profiles_public view to avoid RLS issues
      let profilesQuery = supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('is_active', true);

      if (teamId) {
        profilesQuery = profilesQuery.eq('team_id', teamId);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        return [];
      }

      const memberIds = profiles.map(p => p.id);

      // Fetch attendance records for the date range
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .in('user_id', memberIds)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (attendanceError) throw attendanceError;

      // Fetch ALL activity logs for the date range to calculate accurate first/last times
      // This is more reliable than stored attendance times which can be overwritten by multiple sessions
      const { data: allActivityLogs, error: allActivityError } = await supabase
        .from('activity_logs')
        .select('user_id, started_at, ended_at')
        .in('user_id', memberIds)
        .gte('started_at', `${startDateStr}T00:00:00+04:00`)
        .lte('started_at', `${endDateStr}T23:59:59+04:00`)
        .order('started_at', { ascending: true });

      if (allActivityError) throw allActivityError;

      // Dubai date formatter for consistent date keys
      const dubaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const todayDubaiKey = dubaiDateFormatter.format(new Date());

      // Build a map of first activity start and last activity end per user per date
      // Also track the latest started_at for ongoing activities to show as "last activity time"
      const activityTimesMap = new Map<string, { 
        firstStart: string; 
        lastEnd: string | null;
        lastStarted: string; // Track latest started_at for ongoing sessions
        hasOngoing: boolean;
      }>();
      
      (allActivityLogs || []).forEach(log => {
        const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
        const key = `${log.user_id}|${dubaiDateKey}`;
        
        const existing = activityTimesMap.get(key);
        const logStartTime = new Date(log.started_at).getTime();
        const isOngoing = !log.ended_at;
        
        if (!existing) {
          activityTimesMap.set(key, {
            firstStart: log.started_at,
            lastEnd: log.ended_at,
            lastStarted: log.started_at,
            hasOngoing: isOngoing,
          });
        } else {
          // Track the latest started_at
          if (logStartTime > new Date(existing.lastStarted).getTime()) {
            existing.lastStarted = log.started_at;
          }
          
          // Track if any activity is ongoing
          if (isOngoing) {
            existing.hasOngoing = true;
          }
          
          // Update lastEnd if this log has a later end time
          if (log.ended_at) {
            if (!existing.lastEnd || new Date(log.ended_at) > new Date(existing.lastEnd)) {
              existing.lastEnd = log.ended_at;
            }
          }
        }
      });

      // Fetch activity logs to calculate actual work time
      // Query a slightly wider range to safely catch spans that start near boundaries,
      // then clamp spans to Dubai work-hours windows per day.
      const activityQueryStartStr = format(addDays(startDate, -1), 'yyyy-MM-dd');
      const activityQueryEndStr = format(addDays(endDate, 1), 'yyyy-MM-dd');

      const { data: activityLogs, error: activityError } = await supabase
        .from('activity_logs')
        .select('user_id, activity_type, started_at, ended_at, duration_minutes')
        .in('user_id', memberIds)
        .gte('started_at', `${activityQueryStartStr}T00:00:00+04:00`)
        .lte('started_at', `${activityQueryEndStr}T23:59:59+04:00`)
        .in('activity_type', WORK_ACTIVITY_TYPES)
        .order('started_at', { ascending: true });

      if (activityError) throw activityError;

      // Group activity logs by user and Dubai-date, then calculate non-overlapping work time
      type Span = { start: number; end: number };
      const logsByUserDate = new Map<string, Span[]>();

      const workWindowCache = new Map<string, { start: number; end: number } | null>();
      const getWorkWindow = (dubaiDateKey: string) => {
        const cached = workWindowCache.get(dubaiDateKey);
        if (cached !== undefined) return cached;

        // Determine weekday in Dubai (Dubai is fixed UTC+4; using a Dubai timestamp keeps this stable)
        const noonDubai = new Date(`${dubaiDateKey}T12:00:00+04:00`);
        const day = noonDubai.getUTCDay();

        // Sunday (0) is off
        if (day === 0) {
          workWindowCache.set(dubaiDateKey, null);
          return null;
        }

        const startMs = new Date(`${dubaiDateKey}T10:00:00+04:00`).getTime();
        const endTime = day === 6 ? '14:00:00' : '19:00:00';
        const endMs = new Date(`${dubaiDateKey}T${endTime}+04:00`).getTime();

        const window = { start: startMs, end: endMs };
        workWindowCache.set(dubaiDateKey, window);
        return window;
      };

      // Build spans only from CLOSED work-activity logs.
      // Unclosed logs (ended_at is null) can be duplicated / stale; we only consider the most recent
      // unclosed log for TODAY, and only if the agent is actively working (handled later per-record).
      const latestOngoingStartByUserDate = new Map<string, number>();

      (activityLogs || []).forEach(log => {
        const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
        const window = getWorkWindow(dubaiDateKey);
        if (!window) return;

        const rawStart = new Date(log.started_at).getTime();
        const key = `${log.user_id}|${dubaiDateKey}`;

        if (!log.ended_at) {
          // Track only the latest unclosed work log per user/date (we'll optionally include it for today)
          const existing = latestOngoingStartByUserDate.get(key);
          if (!existing || rawStart > existing) {
            latestOngoingStartByUserDate.set(key, rawStart);
          }
          return;
        }

        const rawEnd = new Date(log.ended_at).getTime();

        // Skip if the activity ended before the work window started (entirely outside work hours)
        if (rawEnd <= window.start) return;
        // Skip if the activity started after the work window ended
        if (rawStart >= window.end) return;

        // Clamp spans to the day's Dubai work-hours window to prevent multi-day inflation
        const start = Math.max(rawStart, window.start);
        const end = Math.min(rawEnd, window.end);

        if (end <= start) return;

        const existing = logsByUserDate.get(key) || [];
        existing.push({ start, end });
        logsByUserDate.set(key, existing);
      });

      const mergeAndSumMinutes = (spans: Span[]) => {
        if (spans.length === 0) return 0;

        const sorted = [...spans].sort((a, b) => a.start - b.start);
        const merged: Span[] = [];
        for (const span of sorted) {
          if (merged.length === 0) {
            merged.push({ ...span });
            continue;
          }
          const last = merged[merged.length - 1];
          if (span.start <= last.end) {
            last.end = Math.max(last.end, span.end);
          } else {
            merged.push({ ...span });
          }
        }

        return merged.reduce((sum, span) => sum + Math.round((span.end - span.start) / 60000), 0);
      };

      // Calculate non-overlapping work minutes for each user/date (closed logs only)
      const workMinutesByUserDateClosed = new Map<string, number>();
      // For today's date key only, we also compute an optional total including the latest ongoing log
      const workMinutesByUserDateWithOngoingToday = new Map<string, number>();

      logsByUserDate.forEach((spans, key) => {
        const closedMinutes = mergeAndSumMinutes(spans);
        workMinutesByUserDateClosed.set(key, closedMinutes);

        // If there's an ongoing log today for this key, compute a total including a capped ongoing span.
        const dateKey = key.split('|')[1];
        if (dateKey === todayDubaiKey) {
          const ongoingStart = latestOngoingStartByUserDate.get(key);
          if (ongoingStart) {
            const window = getWorkWindow(dateKey);
            if (window) {
              const rawEnd = Math.min(ongoingStart + 15 * 60 * 1000, Date.now());
              const start = Math.max(ongoingStart, window.start);
              const end = Math.min(rawEnd, window.end);
              const totalWithOngoing = end > start
                ? mergeAndSumMinutes([...spans, { start, end }])
                : closedMinutes;
              workMinutesByUserDateWithOngoingToday.set(key, totalWithOngoing);
            }
          }
        }
      });

      // If we have an ongoing log today but no closed spans at all, still prepare the with-ongoing total.
      latestOngoingStartByUserDate.forEach((ongoingStart, key) => {
        const dateKey = key.split('|')[1];
        if (dateKey !== todayDubaiKey) return;
        if (workMinutesByUserDateWithOngoingToday.has(key)) return;

        const window = getWorkWindow(dateKey);
        if (!window) return;

        const rawEnd = Math.min(ongoingStart + 15 * 60 * 1000, Date.now());
        const start = Math.max(ongoingStart, window.start);
        const end = Math.min(rawEnd, window.end);
        if (end <= start) return;

        workMinutesByUserDateWithOngoingToday.set(key, mergeAndSumMinutes([{ start, end }]));
      });

      // Create a map for easy lookup
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Transform data - group by agent and date
      const records: AgentAttendanceRecord[] = (attendanceData || []).map(record => {
        const agent = profileMap.get(record.user_id);
        // The attendance record date is stored in YYYY-MM-DD (Dubai calendar day).
        // The activityTimesMap and workMinutesByUserDate use dubaiDateFormatter output which is also YYYY-MM-DD.
        // They should match directly.
        const workKey = `${record.user_id}|${record.date}`;

        // Only treat ongoing logs as relevant if:
        // 1. This is TODAY
        // 2. The agent is currently working (is_working = true)
        // 3. The time is still within the shift window
        // 4. The latest ongoing log is recent (started within the last 30 minutes) to avoid stale sessions
        const todayWindow = getWorkWindow(todayDubaiKey);
        const isWithinTodayWindow = !!todayWindow && Date.now() >= todayWindow.start && Date.now() <= todayWindow.end;
        const latestOngoingStart = latestOngoingStartByUserDate.get(workKey);
        const isOngoingRecent = latestOngoingStart && (Date.now() - latestOngoingStart < 30 * 60 * 1000);
        const includeOngoingForToday = record.date === todayDubaiKey && isWithinTodayWindow && !!record.is_working && isOngoingRecent;

        const closedMinutes = workMinutesByUserDateClosed.get(workKey);
        const withOngoingTodayMinutes = workMinutesByUserDateWithOngoingToday.get(workKey);
        const calculatedWorkMinutes = includeOngoingForToday
          ? (withOngoingTodayMinutes ?? closedMinutes)
          : closedMinutes;

        // If we have no calculated minutes (no activity logs matched), fall back to stored total_work_minutes.
        // Clamp stored minutes to a sane single-day maximum to avoid inflated values.
        const fallbackStored = typeof record.total_work_minutes === 'number' ? record.total_work_minutes : null;
        const safeFallback = fallbackStored !== null && fallbackStored >= 0 && fallbackStored <= 24 * 60 ? fallbackStored : null;
        const totalWorkMinutes = calculatedWorkMinutes ?? safeFallback;
        
        // Get accurate first/last times from activity logs (more reliable than stored attendance times)
        const activityTimes = activityTimesMap.get(workKey);
        const accurateFirstLogin = activityTimes?.firstStart || record.first_login;
        
        let accurateLastLogout: string | null;
        // Prefer the latest ended_at as the true "logout" time.
        // Only show latest started_at when the agent is currently working today (to indicate "last active").
        if (activityTimes?.lastEnd) {
          accurateLastLogout = activityTimes.lastEnd;
        } else if (includeOngoingForToday && activityTimes?.hasOngoing) {
          accurateLastLogout = activityTimes.lastStarted;
        } else {
          accurateLastLogout = record.last_logout;
        }
        
        return {
          agentId: record.user_id,
          agentName: agent?.full_name || agent?.username || 'Unknown',
          date: record.date,
          firstLogin: accurateFirstLogin,
          lastLogout: accurateLastLogout,
          status: record.status,
          isLate: record.is_late || false,
          totalWorkMinutes: totalWorkMinutes,
        };
      });

      // Sort by agent name, then date
      records.sort((a, b) => {
        const nameCompare = a.agentName.localeCompare(b.agentName);
        if (nameCompare !== 0) return nameCompare;
        return a.date.localeCompare(b.date);
      });

      return records;
    },
    staleTime: 30000,
  });
};
