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

      // Build a map of first activity start and last activity end per user per date
      const activityTimesMap = new Map<string, { firstStart: string; lastEnd: string | null }>();
      
      (allActivityLogs || []).forEach(log => {
        const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
        const key = `${log.user_id}|${dubaiDateKey}`;
        
        const existing = activityTimesMap.get(key);
        if (!existing) {
          activityTimesMap.set(key, {
            firstStart: log.started_at,
            lastEnd: log.ended_at,
          });
        } else {
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

      const dubaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

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

      (activityLogs || []).forEach(log => {
        const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
        const window = getWorkWindow(dubaiDateKey);
        if (!window) return;

        const rawStart = new Date(log.started_at).getTime();
        const rawEnd = log.ended_at ? new Date(log.ended_at).getTime() : Date.now();

        // Clamp spans to the day’s Dubai work-hours window to prevent multi-day inflation
        const start = Math.max(rawStart, window.start);
        const end = Math.min(rawEnd, window.end);

        if (end <= start) return;

        const key = `${log.user_id}|${dubaiDateKey}`;
        const existing = logsByUserDate.get(key) || [];
        existing.push({ start, end });
        logsByUserDate.set(key, existing);
      });

      // Calculate non-overlapping work minutes for each user/date
      const workMinutesByUserDate = new Map<string, number>();
      
      logsByUserDate.forEach((spans, key) => {
        // Sort spans by start time
        spans.sort((a, b) => a.start - b.start);
        
        // Merge overlapping spans
        const mergedSpans: Array<{ start: number; end: number }> = [];
        for (const span of spans) {
          if (mergedSpans.length === 0) {
            mergedSpans.push({ ...span });
          } else {
            const last = mergedSpans[mergedSpans.length - 1];
            if (span.start <= last.end) {
              // Overlapping - extend the end time if needed
              last.end = Math.max(last.end, span.end);
            } else {
              // Non-overlapping - add new span
              mergedSpans.push({ ...span });
            }
          }
        }
        
        // Sum up non-overlapping durations
        const totalMinutes = mergedSpans.reduce((sum, span) => {
          return sum + Math.round((span.end - span.start) / 60000);
        }, 0);
        
        workMinutesByUserDate.set(key, totalMinutes);
      });

      // Create a map for easy lookup
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Transform data - group by agent and date
      const records: AgentAttendanceRecord[] = (attendanceData || []).map(record => {
        const agent = profileMap.get(record.user_id);
        const workKey = `${record.user_id}|${record.date}`;
        
        // Use calculated work minutes from activity logs if available,
        // otherwise fall back to stored total_work_minutes
        const calculatedWorkMinutes = workMinutesByUserDate.get(workKey);

        // Prefer calculated minutes from activity logs.
        // If we fall back to stored minutes, clamp to a sane single-day maximum to avoid inflated values.
        const fallbackStored = typeof record.total_work_minutes === 'number' ? record.total_work_minutes : null;
        const safeFallback = fallbackStored !== null && fallbackStored > 0 && fallbackStored <= 24 * 60 ? fallbackStored : null;
        const totalWorkMinutes = calculatedWorkMinutes ?? safeFallback;
        
        // Get accurate first/last times from activity logs (more reliable than stored attendance times)
        const activityTimes = activityTimesMap.get(workKey);
        const accurateFirstLogin = activityTimes?.firstStart || record.first_login;
        const accurateLastLogout = activityTimes?.lastEnd || record.last_logout;
        
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
