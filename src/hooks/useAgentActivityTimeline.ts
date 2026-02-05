 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays, eachDayOfInterval } from 'date-fns';
 
 export type TimelinePeriod = 'day' | 'week' | 'month';
 
 // Activity type display labels
 const ACTIVITY_LABELS: Record<string, string> = {
   data_collection: 'Data Collection',
   customer_followup: 'Customer Followup',
   calling_telecalling: 'Telecalling',
   calling_coldcalling: 'Cold Calling',
   calling_calllist_movement: 'Call List Movement',
   client_meeting: 'Client Meeting',
   admin_documentation: 'Admin/Documentation',
   training: 'Training',
   system_bank_portal: 'Bank Portal',
   break_lunch: 'Lunch Break',
   break_short: 'Short Break',
   break_prayer: 'Prayer Break',
   idle: 'Idle',
   others: 'Others',
 };
 
 export interface ActivityLogEntry {
   id: string;
   activityType: string;
   activityLabel: string;
   startedAt: string;
   endedAt: string | null;
   durationMinutes: number | null;
 }
 
 export interface AgentDailyTimeline {
   agentId: string;
   agentName: string;
   date: string;
   firstLogin: string | null;
   lastLogout: string | null;
   isLate: boolean;
   totalWorkMinutes: number;
   activities: ActivityLogEntry[];
   activitySummary: Record<string, number>; // activity type -> total minutes
 }
 
 interface UseAgentActivityTimelineOptions {
   teamId?: string;
   period: TimelinePeriod;
   selectedDate: Date;
   selectedAgentId?: string; // 'all' or specific agent ID
 }
 
 const DATA_START_DATE = new Date('2025-02-04');
 
 export const useAgentActivityTimeline = ({
   teamId,
   period,
   selectedDate,
   selectedAgentId = 'all',
 }: UseAgentActivityTimelineOptions) => {
   return useQuery({
     queryKey: ['agent-activity-timeline', teamId, period, format(selectedDate, 'yyyy-MM-dd'), selectedAgentId],
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
 
       // Don't query future dates
       const today = new Date();
       if (endDate > today) {
         endDate = today;
       }
 
       const startDateStr = format(startDate, 'yyyy-MM-dd');
       const endDateStr = format(endDate, 'yyyy-MM-dd');
 
       // Get team members
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
 
       // Filter to specific agent if selected
       const memberIds = selectedAgentId === 'all'
         ? profiles.map(p => p.id)
         : profiles.filter(p => p.id === selectedAgentId).map(p => p.id);
 
       if (memberIds.length === 0) {
         return [];
       }
 
       // Fetch attendance records
       const { data: attendanceData, error: attendanceError } = await supabase
         .from('attendance_records')
         .select('*')
         .in('user_id', memberIds)
         .gte('date', startDateStr)
         .lte('date', endDateStr)
         .order('date', { ascending: true });
 
       if (attendanceError) throw attendanceError;
 
       // Fetch activity logs
       const { data: activityLogs, error: activityError } = await supabase
         .from('activity_logs')
         .select('id, user_id, activity_type, started_at, ended_at, duration_minutes')
         .in('user_id', memberIds)
         .gte('started_at', `${startDateStr}T00:00:00+04:00`)
         .lte('started_at', `${endDateStr}T23:59:59+04:00`)
         .order('started_at', { ascending: true });
 
       if (activityError) throw activityError;
 
       // Dubai date formatter
       const dubaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
         timeZone: 'Asia/Dubai',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
       });
 
       // Group activity logs by user and date
       const logsByUserDate = new Map<string, ActivityLogEntry[]>();
       const firstLastByUserDate = new Map<string, { first: string; last: string | null }>();
 
       (activityLogs || []).forEach(log => {
         const dubaiDateKey = dubaiDateFormatter.format(new Date(log.started_at));
         const key = `${log.user_id}|${dubaiDateKey}`;
 
         // Track first/last activity times
         const existing = firstLastByUserDate.get(key);
         if (!existing) {
           firstLastByUserDate.set(key, { first: log.started_at, last: log.ended_at });
         } else {
           if (log.ended_at) {
             if (!existing.last || new Date(log.ended_at) > new Date(existing.last)) {
               existing.last = log.ended_at;
             }
           }
         }
 
         // Calculate duration for unclosed logs
         let duration = log.duration_minutes;
         if (!duration && log.ended_at) {
           duration = Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000);
         }
 
         const entry: ActivityLogEntry = {
           id: log.id,
           activityType: log.activity_type,
           activityLabel: ACTIVITY_LABELS[log.activity_type] || log.activity_type,
           startedAt: log.started_at,
           endedAt: log.ended_at,
           durationMinutes: duration,
         };
 
         const existingLogs = logsByUserDate.get(key) || [];
         existingLogs.push(entry);
         logsByUserDate.set(key, existingLogs);
       });
 
       // Build timeline records
       const profileMap = new Map(profiles.map(p => [p.id, p]));
       const records: AgentDailyTimeline[] = [];
 
       // Create records from attendance data
       (attendanceData || []).forEach(record => {
         const agent = profileMap.get(record.user_id);
         const workKey = `${record.user_id}|${record.date}`;
         const activities = logsByUserDate.get(workKey) || [];
         const times = firstLastByUserDate.get(workKey);
 
         // Calculate activity summary
         const activitySummary: Record<string, number> = {};
         activities.forEach(act => {
           if (act.durationMinutes && act.durationMinutes > 0) {
             activitySummary[act.activityType] = (activitySummary[act.activityType] || 0) + act.durationMinutes;
           }
         });
 
         // Calculate total work time (excluding breaks and idle)
         const workTypes = ['data_collection', 'customer_followup', 'calling_telecalling', 'calling_coldcalling', 
           'calling_calllist_movement', 'client_meeting', 'admin_documentation', 'training', 'system_bank_portal'];
         const totalWorkMinutes = workTypes.reduce((sum, type) => sum + (activitySummary[type] || 0), 0);
 
         records.push({
           agentId: record.user_id,
           agentName: agent?.full_name || agent?.username || 'Unknown',
           date: record.date,
           firstLogin: times?.first || record.first_login,
           lastLogout: times?.last || record.last_logout,
           isLate: record.is_late || false,
           totalWorkMinutes,
           activities,
           activitySummary,
         });
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
 
 export const getActivityLabel = (type: string) => ACTIVITY_LABELS[type] || type;