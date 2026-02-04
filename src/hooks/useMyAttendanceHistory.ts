import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

export type AttendancePeriod = 'day' | 'week' | 'month';

export interface MyAttendanceRecord {
  date: string;
  firstLogin: string | null;
  lastLogout: string | null;
  status: string | null;
  isLate: boolean;
  totalWorkMinutes: number | null;
}

interface UseMyAttendanceHistoryOptions {
  period: AttendancePeriod;
  selectedDate: Date;
}

// Data starts from Feb 4, 2025
const DATA_START_DATE = new Date('2025-02-04');

export const useMyAttendanceHistory = ({
  period,
  selectedDate,
}: UseMyAttendanceHistoryOptions) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-attendance-history', user?.id, period, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!user?.id) return [];

      // Calculate date range based on period
      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'day':
          startDate = startOfDay(selectedDate);
          endDate = endOfDay(selectedDate);
          break;
        case 'week':
          startDate = startOfWeek(selectedDate, { weekStartsOn: 0 });
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

      // Fetch attendance records
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) throw error;

      // Fetch activity logs to get accurate first/last times
      const { data: activityLogs, error: activityError } = await supabase
        .from('activity_logs')
        .select('started_at, ended_at')
        .eq('user_id', user.id)
        .gte('started_at', `${startDateStr}T00:00:00+04:00`)
        .lte('started_at', `${endDateStr}T23:59:59+04:00`)
        .order('started_at', { ascending: true });

      if (activityError) throw activityError;

      // Build a map of first activity start and last activity end per date
      const dubaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const activityTimesMap = new Map<string, { firstStart: string; lastEnd: string | null }>();
      
      (activityLogs || []).forEach(log => {
        const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
        
        const existing = activityTimesMap.get(dubaiDateKey);
        if (!existing) {
          activityTimesMap.set(dubaiDateKey, {
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

      return (data || []).map(record => {
        // Get accurate first/last times from activity logs
        const activityTimes = activityTimesMap.get(record.date);
        const accurateFirstLogin = activityTimes?.firstStart || record.first_login;
        const accurateLastLogout = activityTimes?.lastEnd || record.last_logout;

        return {
          date: record.date,
          firstLogin: accurateFirstLogin,
          lastLogout: accurateLastLogout,
          status: record.status,
          isLate: record.is_late || false,
          totalWorkMinutes: record.total_work_minutes,
        };
      }) as MyAttendanceRecord[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
};
