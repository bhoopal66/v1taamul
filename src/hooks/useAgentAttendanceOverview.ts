import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

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

      // Fetch activity logs to calculate actual work time
      // Use a wider time range to account for timezone differences (Dubai is UTC+4)
      const { data: activityLogs, error: activityError } = await supabase
        .from('activity_logs')
        .select('user_id, activity_type, started_at, ended_at, duration_minutes')
        .in('user_id', memberIds)
        .gte('started_at', `${startDateStr}T00:00:00+04:00`)
        .lte('started_at', `${endDateStr}T23:59:59+04:00`)
        .in('activity_type', WORK_ACTIVITY_TYPES);

      if (activityError) throw activityError;

      // Group activity logs by user and date (in Dubai timezone), sum up work minutes
      const workMinutesByUserDate = new Map<string, number>();
      
      (activityLogs || []).forEach(log => {
        // Convert to Dubai timezone for date grouping
        const dubaiDate = new Date(log.started_at).toLocaleString('en-CA', { 
          timeZone: 'Asia/Dubai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split(',')[0]; // Gets YYYY-MM-DD format
        
        const key = `${log.user_id}|${dubaiDate}`;
        
        // Calculate duration: use stored duration_minutes if available,
        // otherwise calculate from started_at and ended_at
        let durationMinutes = log.duration_minutes;
        
        if (durationMinutes === null && log.ended_at) {
          const start = new Date(log.started_at).getTime();
          const end = new Date(log.ended_at).getTime();
          durationMinutes = Math.round((end - start) / 60000);
        }
        
        // For ongoing activities (no end time), calculate from start to now
        if (durationMinutes === null && !log.ended_at) {
          const start = new Date(log.started_at).getTime();
          const now = Date.now();
          durationMinutes = Math.round((now - start) / 60000);
        }
        
        if (durationMinutes && durationMinutes > 0) {
          const existing = workMinutesByUserDate.get(key) || 0;
          workMinutesByUserDate.set(key, existing + durationMinutes);
        }
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
        const totalWorkMinutes = calculatedWorkMinutes !== undefined 
          ? calculatedWorkMinutes 
          : record.total_work_minutes;
        
        return {
          agentId: record.user_id,
          agentName: agent?.full_name || agent?.username || 'Unknown',
          date: record.date,
          firstLogin: record.first_login,
          lastLogout: record.last_logout,
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
