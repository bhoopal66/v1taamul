import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { 
  ActivityLog, 
  AttendanceRecord, 
  IdleAlert,
  CALLING_ACTIVITIES,
} from './useActivityMonitor';

export interface TeamMemberActivity {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  currentActivity: ActivityLog | null;
  todayLogs: ActivityLog[];
  attendance: AttendanceRecord | null;
  idleAlerts: IdleAlert[];
  callingStats: {
    totalCallingMinutes: number;
    callListMovementMinutes: number;
    callListMovementPercentage: number;
    isCallListMovementOverCap: boolean;
  };
  disciplineFlags: number;
}

export interface UseTeamActivityOptions {
  teamId?: string;
  refreshInterval?: number;
}

export function useTeamActivityMonitor({ teamId, refreshInterval = 30000 }: UseTeamActivityOptions = {}) {
  const { user, userRole, ledTeamId } = useAuth();
  
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || (!canSeeAllTeams ? ledTeamId : undefined);

  // Fetch team members
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members-activity', effectiveTeamId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, team_id, supervisor_id')
        .eq('is_active', true);
      
      if (effectiveTeamId) {
        query = query.eq('team_id', effectiveTeamId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchInterval: refreshInterval,
  });

  const memberIds = useMemo(() => teamMembers.map(m => m.id), [teamMembers]);

  // Fetch all activity logs for team members
  const { data: allActivityLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['team-activity-logs', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .in('user_id', memberIds)
        .gte('started_at', `${today}T00:00:00`)
        .order('started_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ActivityLog[];
    },
    enabled: memberIds.length > 0,
    refetchInterval: refreshInterval,
  });

  // Fetch all attendance records for team members
  const { data: allAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['team-attendance', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .in('user_id', memberIds)
        .eq('date', today);
      
      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    enabled: memberIds.length > 0,
    refetchInterval: refreshInterval,
  });

  // Fetch all idle alerts for team members
  const { data: allIdleAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['team-idle-alerts', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('idle_alerts')
        .select('*')
        .in('user_id', memberIds)
        .gte('alert_time', `${today}T00:00:00`)
        .order('alert_time', { ascending: false });
      
      if (error) throw error;
      return (data || []) as IdleAlert[];
    },
    enabled: memberIds.length > 0,
    refetchInterval: refreshInterval,
  });

  // Process data into team member activity
  const teamActivity: TeamMemberActivity[] = useMemo(() => {
    return teamMembers.map(member => {
      const memberLogs = allActivityLogs.filter(log => log.user_id === member.id);
      const currentActivity = memberLogs.find(log => !log.ended_at) || null;
      const attendance = allAttendance.find(a => a.user_id === member.id) || null;
      const idleAlerts = allIdleAlerts.filter(a => a.user_id === member.id);
      
      // Calculate calling stats
      const callingLogs = memberLogs.filter(log => CALLING_ACTIVITIES.includes(log.activity_type));
      const callListMovementLogs = memberLogs.filter(log => log.activity_type === 'calling_calllist_movement');
      
      const totalCallingMinutes = callingLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
      const callListMovementMinutes = callListMovementLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
      
      const callListMovementPercentage = totalCallingMinutes > 0 
        ? (callListMovementMinutes / totalCallingMinutes) * 100 
        : 0;
      
      // Count discipline flags
      const disciplineFlags = idleAlerts.filter(a => a.severity === 'discipline_flag').length;
      
      return {
        userId: member.id,
        fullName: member.full_name || 'Unknown',
        username: member.username || member.id.slice(0, 8),
        avatarUrl: member.avatar_url,
        currentActivity,
        todayLogs: memberLogs,
        attendance,
        idleAlerts,
        callingStats: {
          totalCallingMinutes,
          callListMovementMinutes,
          callListMovementPercentage,
          isCallListMovementOverCap: callListMovementPercentage > 15,
        },
        disciplineFlags,
      };
    });
  }, [teamMembers, allActivityLogs, allAttendance, allIdleAlerts]);

  // Summary statistics
  const teamStats = useMemo(() => {
    const presentCount = teamActivity.filter(m => m.attendance?.status === 'present').length;
    const lateCount = teamActivity.filter(m => m.attendance?.is_late).length;
    const absentCount = teamActivity.filter(m => !m.attendance || m.attendance.status === 'absent').length;
    const activeCount = teamActivity.filter(m => m.currentActivity && m.currentActivity.activity_type !== 'idle' && m.currentActivity.activity_type !== 'break').length;
    const onBreakCount = teamActivity.filter(m => m.currentActivity?.activity_type === 'break').length;
    const idleCount = teamActivity.filter(m => !m.currentActivity || m.currentActivity.activity_type === 'idle').length;
    const callingCount = teamActivity.filter(m => m.currentActivity && CALLING_ACTIVITIES.includes(m.currentActivity.activity_type)).length;
    const totalIdleAlerts = allIdleAlerts.filter(a => a.severity === 'escalation').length;
    const lowDisciplineCount = teamActivity.filter(m => m.disciplineFlags > 0).length;
    
    return {
      total: teamActivity.length,
      presentCount,
      lateCount,
      absentCount,
      activeCount,
      onBreakCount,
      idleCount,
      callingCount,
      totalIdleAlerts,
      lowDisciplineCount,
    };
  }, [teamActivity, allIdleAlerts]);

  return {
    teamActivity,
    teamStats,
    isLoading: membersLoading || logsLoading || attendanceLoading || alertsLoading,
  };
}
