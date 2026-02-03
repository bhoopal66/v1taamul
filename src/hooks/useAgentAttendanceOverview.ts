import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export type AttendancePeriod = 'day' | 'week' | 'month';

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

      // First get team members
      let profilesQuery = supabase
        .from('profiles')
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

      // Create a map for easy lookup
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Transform data - group by agent and date
      const records: AgentAttendanceRecord[] = (attendanceData || []).map(record => {
        const agent = profileMap.get(record.user_id);
        return {
          agentId: record.user_id,
          agentName: agent?.full_name || agent?.username || 'Unknown',
          date: record.date,
          firstLogin: record.first_login,
          lastLogout: record.last_logout,
          status: record.status,
          isLate: record.is_late || false,
          totalWorkMinutes: record.total_work_minutes,
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
