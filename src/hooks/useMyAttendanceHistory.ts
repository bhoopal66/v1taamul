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

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      if (error) throw error;

      return (data || []).map(record => ({
        date: record.date,
        firstLogin: record.first_login,
        lastLogout: record.last_logout,
        status: record.status,
        isLate: record.is_late || false,
        totalWorkMinutes: record.total_work_minutes,
      })) as MyAttendanceRecord[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
};
