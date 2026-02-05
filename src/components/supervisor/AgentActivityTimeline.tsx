 import React, { useState, useMemo } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Skeleton } from '@/components/ui/skeleton';
 import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
 import { Calendar } from '@/components/ui/calendar';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
 import { useAgentActivityTimeline, TimelinePeriod, getActivityLabel } from '@/hooks/useAgentActivityTimeline';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { CalendarDays, ChevronLeft, ChevronRight, Clock, Activity, Download, User, ChevronDown, ChevronUp, LogIn, LogOut, Users } from 'lucide-react';
 import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 import { useAuth } from '@/contexts/AuthContext';
 
 interface AgentActivityTimelineProps {
   teamId?: string;
 }
 
 const DATA_START_DATE = new Date('2025-02-04');
 
 // Activity type colors for visual distinction
 const ACTIVITY_COLORS: Record<string, string> = {
   data_collection: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
   customer_followup: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
   calling_telecalling: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
   calling_coldcalling: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
   calling_calllist_movement: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
   client_meeting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
   admin_documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
   training: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
   system_bank_portal: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
   break_lunch: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
   break_short: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
   break_prayer: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
   idle: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
   others: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
 };
 
 export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({ teamId }) => {
   const { userRole } = useAuth();
   const [period, setPeriod] = useState<TimelinePeriod>('day');
   const [selectedDate, setSelectedDate] = useState<Date>(new Date());
   const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
   const [selectedTeamId, setSelectedTeamId] = useState<string>(teamId || 'all');
   const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
 
   // Check if user has global access (can see all teams)
   const hasGlobalAccess = ['super_admin', 'admin', 'operations_head'].includes(userRole || '');
 
   // Effective team filter - use selected team for global users, otherwise use prop
   const effectiveTeamId = hasGlobalAccess
     ? (selectedTeamId === 'all' ? undefined : selectedTeamId)
     : teamId;
 
   // Fetch all teams for the team selector (only for global access users)
   const { data: teams } = useQuery({
     queryKey: ['timeline-teams'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('teams')
         .select('id, name, team_type')
         .order('name');
       if (error) throw error;
       return data;
     },
     enabled: hasGlobalAccess,
   });
 
   // Fetch team members for agent selector
   const { data: agents } = useQuery({
     queryKey: ['timeline-agents', effectiveTeamId],
     queryFn: async () => {
       let query = supabase
         .from('profiles_public')
         .select('id, full_name, username, team_id')
         .eq('is_active', true)
         .order('full_name');
 
       if (effectiveTeamId) {
         query = query.eq('team_id', effectiveTeamId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data;
     },
   });
 
   const { data: timelineData, isLoading } = useAgentActivityTimeline({
     teamId: effectiveTeamId,
     period,
     selectedDate,
     selectedAgentId,
   });
 
   // Reset agent selection when team changes
   const handleTeamChange = (newTeamId: string) => {
     setSelectedTeamId(newTeamId);
     setSelectedAgentId('all'); // Reset agent filter when team changes
   };
 
   const formatTime = (isoString: string | null) => {
     if (!isoString) return '—';
     try {
       return new Date(isoString).toLocaleTimeString('en-US', {
         timeZone: 'Asia/Dubai',
         hour: '2-digit',
         minute: '2-digit',
         hour12: true,
       });
     } catch {
       return '—';
     }
   };
 
   const formatDuration = (minutes: number | null) => {
     if (!minutes || minutes <= 0) return '—';
     const hours = Math.floor(minutes / 60);
     const mins = Math.round(minutes % 60);
     return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
   };
 
   const getDateRangeLabel = () => {
     switch (period) {
       case 'day':
         return format(selectedDate, 'EEEE, MMM d, yyyy');
       case 'week':
         const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
         const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
         return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
       case 'month':
         return format(selectedDate, 'MMMM yyyy');
     }
   };
 
   const navigatePrevious = () => {
     switch (period) {
       case 'day':
         setSelectedDate(prev => subDays(prev, 1));
         break;
       case 'week':
         setSelectedDate(prev => subWeeks(prev, 1));
         break;
       case 'month':
         setSelectedDate(prev => subMonths(prev, 1));
         break;
     }
   };
 
   const navigateNext = () => {
     const today = new Date();
     switch (period) {
       case 'day':
         if (addDays(selectedDate, 1) <= today) setSelectedDate(addDays(selectedDate, 1));
         break;
       case 'week':
         if (startOfWeek(addWeeks(selectedDate, 1)) <= today) setSelectedDate(addWeeks(selectedDate, 1));
         break;
       case 'month':
         if (startOfMonth(addMonths(selectedDate, 1)) <= today) setSelectedDate(addMonths(selectedDate, 1));
         break;
     }
   };
 
   const canNavigateNext = () => {
     const today = new Date();
     switch (period) {
       case 'day': return addDays(selectedDate, 1) <= today;
       case 'week': return startOfWeek(addWeeks(selectedDate, 1)) <= today;
       case 'month': return startOfMonth(addMonths(selectedDate, 1)) <= today;
     }
   };
 
   const canNavigatePrevious = () => {
     switch (period) {
       case 'day': return subDays(selectedDate, 1) >= DATA_START_DATE;
       case 'week': return endOfWeek(subWeeks(selectedDate, 1)) >= DATA_START_DATE;
       case 'month': return endOfMonth(subMonths(selectedDate, 1)) >= DATA_START_DATE;
     }
   };
 
   const toggleRowExpansion = (key: string) => {
     setExpandedRows(prev => {
       const newSet = new Set(prev);
       if (newSet.has(key)) {
         newSet.delete(key);
       } else {
         newSet.add(key);
       }
       return newSet;
     });
   };
 
   // Group data by agent for week/month summary
   const groupedByAgent = useMemo(() => {
     if (!timelineData || period === 'day') return null;
 
     const grouped = new Map<string, typeof timelineData>();
     timelineData.forEach(record => {
       const existing = grouped.get(record.agentId) || [];
       existing.push(record);
       grouped.set(record.agentId, existing);
     });
 
     return Array.from(grouped.entries()).map(([agentId, records]) => {
       // Aggregate activity summary across all days
       const totalActivitySummary: Record<string, number> = {};
       records.forEach(r => {
         Object.entries(r.activitySummary).forEach(([type, mins]) => {
           totalActivitySummary[type] = (totalActivitySummary[type] || 0) + mins;
         });
       });
 
       return {
         agentId,
         agentName: records[0]?.agentName || 'Unknown',
         records,
         totalDays: records.length,
         lateDays: records.filter(r => r.isLate).length,
         totalWorkMinutes: records.reduce((sum, r) => sum + r.totalWorkMinutes, 0),
         activitySummary: totalActivitySummary,
       };
     });
   }, [timelineData, period]);
 
   // Export to CSV
   const exportToCSV = () => {
     if (!timelineData || timelineData.length === 0) {
       toast.error('No data to export');
       return;
     }
 
     // Activity types for columns
     const activityTypes = [
       'calling_telecalling', 'calling_coldcalling', 'calling_calllist_movement',
       'data_collection', 'customer_followup', 'client_meeting',
       'admin_documentation', 'training', 'system_bank_portal',
       'break_lunch', 'break_short', 'break_prayer', 'idle', 'others'
     ];
 
       // Include Team column for global access users viewing all teams
       const includeTeam = hasGlobalAccess && selectedTeamId === 'all';
       const headers = includeTeam
         ? ['Team', 'Agent Name', 'Date', 'Day', 'First Login', 'Last Logout', 'Total Work Time', 'Is Late', ...activityTypes.map(t => getActivityLabel(t))]
         : ['Agent Name', 'Date', 'Day', 'First Login', 'Last Logout', 'Total Work Time', 'Is Late', ...activityTypes.map(t => getActivityLabel(t))];
 
     const rows = timelineData.map(record => {
       const date = new Date(record.date);
         const baseRow = [
         `"${record.agentName}"`,
         format(date, 'yyyy-MM-dd'),
         format(date, 'EEEE'),
         record.firstLogin ? format(new Date(record.firstLogin), 'hh:mm a') : 'No Login',
         record.lastLogout ? format(new Date(record.lastLogout), 'hh:mm a') : 'No Logout',
         `${Math.floor(record.totalWorkMinutes / 60)}h ${Math.round(record.totalWorkMinutes % 60)}m`,
         record.isLate ? 'Yes' : 'No',
         ...activityTypes.map(t => {
           const mins = record.activitySummary[t] || 0;
           return mins > 0 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : '0';
         }),
       ];
         return includeTeam ? [`"${record.teamName || 'Unknown'}"`, ...baseRow] : baseRow;
     });
 
     // Add summary section for monthly export
     if (period === 'month' && groupedByAgent) {
       rows.push([]);
       rows.push(['--- AGENT SUMMARY ---']);
         rows.push(includeTeam
           ? ['Team', 'Agent', 'Days Present', 'Late Days', 'Total Work Time', ...activityTypes.map(t => getActivityLabel(t))]
           : ['Agent', 'Days Present', 'Late Days', 'Total Work Time', ...activityTypes.map(t => getActivityLabel(t))]);
       
       groupedByAgent.forEach(agent => {
           const summaryRow = [
           `"${agent.agentName}"`,
           agent.totalDays.toString(),
           agent.lateDays.toString(),
           `${Math.floor(agent.totalWorkMinutes / 60)}h ${Math.round(agent.totalWorkMinutes % 60)}m`,
           ...activityTypes.map(t => {
             const mins = agent.activitySummary[t] || 0;
             return mins > 0 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : '0';
           }),
           ];
           // Get team name from first record
           const teamName = agent.records[0]?.teamName || 'Unknown';
           rows.push(includeTeam ? [`"${teamName}"`, ...summaryRow] : summaryRow);
       });
     }
 
     const csvContent = [headers.join(','), ...rows.map(row => Array.isArray(row) ? row.join(',') : row)].join('\n');
     const filename = `agent-activity-timeline-${period}-${getDateRangeLabel().replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
 
     const blob = new Blob([csvContent], { type: 'text/csv' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);
 
     toast.success('Activity timeline exported to CSV');
   };
 
   return (
     <Card>
       <CardHeader className="pb-4">
         <div className="flex flex-col gap-4">
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <CardTitle className="flex items-center gap-2 text-lg">
               <Activity className="w-5 h-5 text-primary" />
               Agent Activity Timeline
             </CardTitle>
 
             <div className="flex items-center gap-3 flex-wrap">
               {/* Export Button */}
               <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
                 <Download className="w-4 h-4" />
                 Export CSV
               </Button>
 
               {/* Period Toggle */}
               <ToggleGroup
                 type="single"
                 value={period}
                 onValueChange={(v) => v && setPeriod(v as TimelinePeriod)}
                 className="border rounded-md"
               >
                 <ToggleGroupItem value="day" size="sm">Day</ToggleGroupItem>
                 <ToggleGroupItem value="week" size="sm">Week</ToggleGroupItem>
                 <ToggleGroupItem value="month" size="sm">Month</ToggleGroupItem>
               </ToggleGroup>
             </div>
           </div>
 
           <div className="flex flex-col sm:flex-row sm:items-center gap-3">
             {/* Team Selector (only for global access users) */}
             {hasGlobalAccess && (
               <div className="flex items-center gap-2">
                 <Users className="w-4 h-4 text-muted-foreground" />
                 <Select value={selectedTeamId} onValueChange={handleTeamChange}>
                   <SelectTrigger className="w-[180px]">
                     <SelectValue placeholder="Select team" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Teams</SelectItem>
                     {teams?.map(team => (
                       <SelectItem key={team.id} value={team.id}>
                         {team.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             )}
 
             {/* Agent Selector */}
             <div className="flex items-center gap-2">
               <User className="w-4 h-4 text-muted-foreground" />
               <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                 <SelectTrigger className="w-[200px]">
                   <SelectValue placeholder="Select agent" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Agents</SelectItem>
                   {agents?.map(agent => (
                     <SelectItem key={agent.id} value={agent.id}>
                       {agent.full_name || agent.username}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Date Navigation */}
             <div className="flex items-center gap-1 ml-auto">
               <Button
                 variant="outline"
                 size="icon"
                 className="h-8 w-8"
                 onClick={navigatePrevious}
                 disabled={!canNavigatePrevious()}
               >
                 <ChevronLeft className="w-4 h-4" />
               </Button>
 
               <Popover>
                 <PopoverTrigger asChild>
                   <Button variant="outline" size="sm" className="gap-2 min-w-[180px]">
                     <CalendarDays className="w-4 h-4" />
                     {getDateRangeLabel()}
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent className="w-auto p-0" align="end">
                   <Calendar
                     mode="single"
                     selected={selectedDate}
                     onSelect={(date) => date && setSelectedDate(date)}
                     disabled={(date) => date > new Date() || date < DATA_START_DATE}
                     initialFocus
                     className="pointer-events-auto"
                   />
                 </PopoverContent>
               </Popover>
 
               <Button
                 variant="outline"
                 size="icon"
                 className="h-8 w-8"
                 onClick={navigateNext}
                 disabled={!canNavigateNext()}
               >
                 <ChevronRight className="w-4 h-4" />
               </Button>
             </div>
           </div>
         </div>
       </CardHeader>
 
       <CardContent>
         {isLoading ? (
           <div className="space-y-3">
             {[1, 2, 3, 4, 5].map(i => (
               <Skeleton key={i} className="h-16 w-full" />
             ))}
           </div>
         ) : timelineData && timelineData.length > 0 ? (
           period === 'day' ? (
             // Daily View - Detailed with expandable activity list
             <div className="space-y-3">
               {timelineData.map((record, idx) => {
                 const rowKey = `${record.agentId}-${record.date}-${idx}`;
                 const isExpanded = expandedRows.has(rowKey);
 
                 return (
                   <Collapsible key={rowKey} open={isExpanded} onOpenChange={() => toggleRowExpansion(rowKey)}>
                     <div className="border rounded-lg overflow-hidden">
                       <CollapsibleTrigger asChild>
                         <div className="flex items-center justify-between p-4 bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                           <div className="flex items-center gap-4">
                             <div>
                                 <div className="flex items-center gap-2">
                                   <p className="font-medium">{record.agentName}</p>
                                   {hasGlobalAccess && selectedTeamId === 'all' && record.teamName && (
                                     <Badge variant="outline" className="text-xs">{record.teamName}</Badge>
                                   )}
                                 </div>
                               <p className="text-sm text-muted-foreground">
                                 {format(new Date(record.date), 'EEEE, MMM d')}
                               </p>
                             </div>
                             {record.isLate && (
                               <Badge variant="destructive" className="text-xs">Late</Badge>
                             )}
                           </div>
                           <div className="flex items-center gap-6">
                             <div className="text-right">
                               <div className="flex items-center gap-2 text-sm">
                                 <LogIn className="w-3.5 h-3.5 text-muted-foreground" />
                                 <span className="font-mono">{formatTime(record.firstLogin)}</span>
                               </div>
                               <div className="flex items-center gap-2 text-sm">
                                 <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
                                 <span className="font-mono">{formatTime(record.lastLogout)}</span>
                               </div>
                             </div>
                             <div className="text-right min-w-[80px]">
                               <p className="text-sm text-muted-foreground">Work Time</p>
                               <p className="font-mono font-medium">{formatDuration(record.totalWorkMinutes)}</p>
                             </div>
                             <div className="flex items-center gap-1 text-muted-foreground">
                               <span className="text-xs">{record.activities.length} activities</span>
                               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                             </div>
                           </div>
                         </div>
                       </CollapsibleTrigger>
                       <CollapsibleContent>
                         <div className="border-t bg-muted/30 p-4">
                           {/* Activity Summary Pills */}
                           <div className="flex flex-wrap gap-2 mb-4">
                             {Object.entries(record.activitySummary)
                               .filter(([, mins]) => mins > 0)
                               .sort(([, a], [, b]) => b - a)
                               .map(([type, mins]) => (
                                 <Badge key={type} className={cn('text-xs', ACTIVITY_COLORS[type] || ACTIVITY_COLORS.others)}>
                                   {getActivityLabel(type)}: {formatDuration(mins)}
                                 </Badge>
                               ))}
                           </div>
                           {/* Activity Timeline */}
                           <div className="space-y-2 max-h-[300px] overflow-y-auto">
                             {record.activities.map(act => (
                               <div key={act.id} className="flex items-center justify-between py-2 px-3 bg-background rounded border">
                                 <div className="flex items-center gap-3">
                                   <Badge className={cn('text-xs', ACTIVITY_COLORS[act.activityType] || ACTIVITY_COLORS.others)}>
                                     {act.activityLabel}
                                   </Badge>
                                   <span className="text-sm text-muted-foreground">
                                     {formatTime(act.startedAt)} - {act.endedAt ? formatTime(act.endedAt) : 'Ongoing'}
                                   </span>
                                 </div>
                                 <span className="font-mono text-sm">{formatDuration(act.durationMinutes)}</span>
                               </div>
                             ))}
                             {record.activities.length === 0 && (
                               <p className="text-sm text-muted-foreground text-center py-4">No activities logged</p>
                             )}
                           </div>
                         </div>
                       </CollapsibleContent>
                     </div>
                   </Collapsible>
                 );
               })}
             </div>
           ) : (
             // Week/Month View - Summary table with expandable daily breakdown
             <div className="space-y-4">
               {groupedByAgent?.map(agent => {
                 const agentKey = `agent-${agent.agentId}`;
                 const isExpanded = expandedRows.has(agentKey);
 
                 return (
                   <Collapsible key={agentKey} open={isExpanded} onOpenChange={() => toggleRowExpansion(agentKey)}>
                     <div className="border rounded-lg overflow-hidden">
                       <CollapsibleTrigger asChild>
                         <div className="flex items-center justify-between p-4 bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                           <div className="flex items-center gap-4">
                             <div>
                                 <div className="flex items-center gap-2">
                                   <p className="font-medium">{agent.agentName}</p>
                                   {hasGlobalAccess && selectedTeamId === 'all' && agent.records[0]?.teamName && (
                                     <Badge variant="outline" className="text-xs">{agent.records[0].teamName}</Badge>
                                   )}
                                 </div>
                               <p className="text-sm text-muted-foreground">
                                 {agent.totalDays} days present
                                 {agent.lateDays > 0 && <span className="text-destructive ml-2">({agent.lateDays} late)</span>}
                               </p>
                             </div>
                           </div>
                           <div className="flex items-center gap-6">
                             <div className="text-right min-w-[100px]">
                               <p className="text-sm text-muted-foreground">Total Work</p>
                               <p className="font-mono font-medium">{formatDuration(agent.totalWorkMinutes)}</p>
                             </div>
                             <div className="flex items-center gap-1 text-muted-foreground">
                               <span className="text-xs">View days</span>
                               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                             </div>
                           </div>
                         </div>
                       </CollapsibleTrigger>
                       <CollapsibleContent>
                         <div className="border-t">
                           {/* Activity Summary for Period */}
                           <div className="p-4 bg-muted/30 border-b">
                             <p className="text-sm font-medium mb-2">Activity Breakdown</p>
                             <div className="flex flex-wrap gap-2">
                               {Object.entries(agent.activitySummary)
                                 .filter(([, mins]) => mins > 0)
                                 .sort(([, a], [, b]) => b - a)
                                 .map(([type, mins]) => (
                                   <Badge key={type} className={cn('text-xs', ACTIVITY_COLORS[type] || ACTIVITY_COLORS.others)}>
                                     {getActivityLabel(type)}: {formatDuration(mins)}
                                   </Badge>
                                 ))}
                             </div>
                           </div>
                           {/* Daily Records */}
                           <Table>
                             <TableHeader>
                               <TableRow className="bg-muted/50">
                                 <TableHead>Date</TableHead>
                                 <TableHead className="text-center">Login</TableHead>
                                 <TableHead className="text-center">Logout</TableHead>
                                 <TableHead className="text-center">Work Time</TableHead>
                                 <TableHead className="text-center">Status</TableHead>
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {agent.records.map((record, idx) => (
                                 <TableRow key={`${record.date}-${idx}`}>
                                   <TableCell>
                                     <span className="font-medium">{format(new Date(record.date), 'EEE, MMM d')}</span>
                                   </TableCell>
                                   <TableCell className="text-center font-mono">{formatTime(record.firstLogin)}</TableCell>
                                   <TableCell className="text-center font-mono">{formatTime(record.lastLogout)}</TableCell>
                                   <TableCell className="text-center font-mono">{formatDuration(record.totalWorkMinutes)}</TableCell>
                                   <TableCell className="text-center">
                                     {record.isLate ? (
                                       <Badge variant="destructive" className="text-xs">Late</Badge>
                                     ) : (
                                       <Badge className="bg-emerald-600 text-white text-xs">Present</Badge>
                                     )}
                                   </TableCell>
                                 </TableRow>
                               ))}
                             </TableBody>
                           </Table>
                         </div>
                       </CollapsibleContent>
                     </div>
                   </Collapsible>
                 );
               })}
             </div>
           )
         ) : (
           <div className="text-center py-12 text-muted-foreground">
             <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
             <p>No activity data found for this period</p>
             <p className="text-sm mt-1">Data available from Feb 4, 2025</p>
           </div>
         )}
       </CardContent>
     </Card>
   );
 };