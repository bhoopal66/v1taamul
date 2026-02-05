import React, { useState } from 'react';
import { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Download, FileSpreadsheet, FileText, CalendarDays, CalendarRange, ArrowLeft, Calendar, RotateCcw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AgentDailyStats {
  agentId: string;
  agentName: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
}

interface DailyBreakdown {
  date: string;
  displayDate: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
}

interface AllAgentsSummary {
  totalAgents: number;
  totalCalls: number;
  totalInterested: number;
  totalNotInterested: number;
  totalNotAnswered: number;
  totalLeads: number;
  avgConversionRate: number;
}

type FilterMode = 'single' | 'range' | 'week' | 'month' | null;

export const AgentPerformanceList: React.FC = () => {
  const { user, userRole, ledTeamId, profile } = useAuth();
  
  // Draft filter state (UI selection)
  const [filterMode, setFilterMode] = useState<FilterMode>(null);
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  
  // Applied filter state (triggers query)
  const [appliedMode, setAppliedMode] = useState<FilterMode>(null);
  const [appliedSingleDate, setAppliedSingleDate] = useState<Date | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState<Date | null>(null);
  const [appliedEndDate, setAppliedEndDate] = useState<Date | null>(null);
  const [appliedAgentId, setAppliedAgentId] = useState<string>('all');
  
  // Collapsible state for daily breakdown
  const [isDailyBreakdownOpen, setIsDailyBreakdownOpen] = useState(true);

  // Calculate week dates based on offset
  const getWeekDates = (offset: number) => {
    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, offset), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(subWeeks(now, offset), { weekStartsOn: 0 });
    return { weekStart, weekEnd };
  };

  // Calculate month dates based on offset
  const getMonthDates = (offset: number) => {
    const now = new Date();
    const monthStart = startOfMonth(subMonths(now, offset));
    const monthEnd = endOfMonth(subMonths(now, offset));
    return { monthStart, monthEnd };
  };

  // Check if filter has been applied
  const hasAppliedFilter = useMemo(() => {
    if (appliedMode === 'single') return appliedSingleDate !== null;
    if (appliedMode === 'range') return appliedStartDate !== null && appliedEndDate !== null;
    if (appliedMode === 'week') return appliedStartDate !== null && appliedEndDate !== null;
    if (appliedMode === 'month') return appliedStartDate !== null && appliedEndDate !== null;
    return false;
  }, [appliedMode, appliedSingleDate, appliedStartDate, appliedEndDate]);

  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = ledTeamId || profile?.team_id;
  
  // Check if we should show daily breakdown (for multi-day filters)
  const showDailyBreakdown = useMemo(() => {
    return appliedMode === 'week' || appliedMode === 'month' || 
      (appliedMode === 'range' && appliedStartDate && appliedEndDate && 
       startOfDay(appliedStartDate).getTime() !== startOfDay(appliedEndDate).getTime());
  }, [appliedMode, appliedStartDate, appliedEndDate]);

  // Fetch agents for dropdown
  const { data: agentOptions = [] } = useQuery({
    queryKey: ['agent-perf-agents', effectiveTeamId, canSeeAllData, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('is_active', true)
        .order('full_name');

      if (!canSeeAllData) {
        if (effectiveTeamId) {
          query = query.eq('team_id', effectiveTeamId);
        } else if (user?.id) {
          query = query.eq('supervisor_id', user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance-list', user?.id, effectiveTeamId, canSeeAllData, appliedMode, appliedSingleDate?.toISOString(), appliedStartDate?.toISOString(), appliedEndDate?.toISOString(), appliedAgentId],
    queryFn: async (): Promise<{ agentStats: AgentDailyStats[]; summary: AllAgentsSummary | null; dailyBreakdown: DailyBreakdown[] }> => {
      if (!hasAppliedFilter) return { agentStats: [], summary: null, dailyBreakdown: [] };

      let queryStart: Date;
      let queryEnd: Date;

      if (appliedMode === 'single' && appliedSingleDate) {
        queryStart = startOfDay(appliedSingleDate);
        queryEnd = endOfDay(appliedSingleDate);
      } else if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
        queryStart = startOfDay(appliedStartDate);
        queryEnd = endOfDay(appliedEndDate);
      } else if ((appliedMode === 'week' || appliedMode === 'month') && appliedStartDate && appliedEndDate) {
        queryStart = startOfDay(appliedStartDate);
        queryEnd = endOfDay(appliedEndDate);
      } else {
        return { agentStats: [], summary: null, dailyBreakdown: [] };
      }

      const start = queryStart.toISOString();
      const end = queryEnd.toISOString();

      // Get list of agent IDs in user's team
      let agentIds: string[] | null = null;

      if (!canSeeAllData) {
        if (appliedAgentId !== 'all') {
          agentIds = [appliedAgentId];
        } else if (effectiveTeamId) {
          const { data: teamProfiles } = await supabase
            .from('profiles_public')
            .select('id')
            .eq('team_id', effectiveTeamId)
            .eq('is_active', true);
          agentIds = teamProfiles?.map(p => p.id) || [];
        } else if (user?.id) {
          const { data: supervisedProfiles } = await supabase
            .from('profiles_public')
            .select('id')
            .eq('supervisor_id', user.id)
            .eq('is_active', true);
          agentIds = supervisedProfiles?.map(p => p.id) || [];
        } else {
          agentIds = [];
        }
      } else if (appliedAgentId !== 'all') {
        // Global access but specific agent selected
        agentIds = [appliedAgentId];
      }

      // Build the query for call feedback
      let feedbackQuery = supabase
        .from('call_feedback')
        .select('agent_id, feedback_status, call_timestamp')
        .gte('call_timestamp', start)
        .lte('call_timestamp', end);

      if (agentIds && agentIds.length > 0) {
        feedbackQuery = feedbackQuery.in('agent_id', agentIds);
      } else if (agentIds && agentIds.length === 0) {
        return { agentStats: [], summary: null, dailyBreakdown: [] };
      }

      const { data: feedback, error: feedbackError } = await feedbackQuery;
      if (feedbackError) throw feedbackError;

      // Build the query for leads
      let leadsQuery = supabase
        .from('leads')
        .select('agent_id, created_at')
        .gte('created_at', start)
        .lte('created_at', end);

      if (agentIds && agentIds.length > 0) {
        leadsQuery = leadsQuery.in('agent_id', agentIds);
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Get profiles for agent names
      let profilesQuery = supabase
        .from('profiles_public')
        .select('id, full_name, username');
      
      if (agentIds && agentIds.length > 0) {
        profilesQuery = profilesQuery.in('id', agentIds);
      }
      
      const { data: profiles } = await profilesQuery;

      // Aggregate data by agent
      const agentMap = new Map<string, AgentDailyStats>();

      feedback?.forEach(f => {
        if (!agentMap.has(f.agent_id)) {
          const agentProfile = profiles?.find(p => p.id === f.agent_id);
          agentMap.set(f.agent_id, {
            agentId: f.agent_id,
            agentName: agentProfile?.full_name || agentProfile?.username || 'Unknown Agent',
            totalCalls: 0,
            interested: 0,
            notInterested: 0,
            notAnswered: 0,
            leadsGenerated: 0,
            conversionRate: 0,
          });
        }
        
        const stats = agentMap.get(f.agent_id)!;
        stats.totalCalls++;
        
        if (f.feedback_status === 'interested') stats.interested++;
        else if (f.feedback_status === 'not_interested') stats.notInterested++;
        else if (f.feedback_status === 'not_answered') stats.notAnswered++;
      });

      // Add leads count
      leads?.forEach(l => {
        const stats = agentMap.get(l.agent_id);
        if (stats) {
          stats.leadsGenerated++;
        }
      });

      // Calculate conversion rates
      const agentStats: AgentDailyStats[] = Array.from(agentMap.values()).map(stats => ({
        ...stats,
        conversionRate: stats.totalCalls > 0 
          ? Math.round((stats.interested / stats.totalCalls) * 100) 
          : 0,
      }));

      // Calculate daily breakdown for multi-day filters
      const dailyBreakdown: DailyBreakdown[] = [];
      const isMultiDay = appliedMode === 'week' || appliedMode === 'month' || 
        (appliedMode === 'range' && queryStart.getTime() !== queryEnd.getTime() - 86400000 + 1);
      
      if (isMultiDay) {
        const allDays = eachDayOfInterval({ start: queryStart, end: queryEnd });
        
        allDays.forEach(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          
          const dayFeedback = feedback?.filter(f => {
            const ts = new Date(f.call_timestamp!);
            return ts >= dayStart && ts <= dayEnd;
          }) || [];
          
          const dayLeads = leads?.filter(l => {
            const ts = new Date(l.created_at!);
            return ts >= dayStart && ts <= dayEnd;
          }) || [];
          
          const totalCalls = dayFeedback.length;
          const interested = dayFeedback.filter(f => f.feedback_status === 'interested').length;
          const notInterested = dayFeedback.filter(f => f.feedback_status === 'not_interested').length;
          const notAnswered = dayFeedback.filter(f => f.feedback_status === 'not_answered').length;
          
          dailyBreakdown.push({
            date: format(day, 'yyyy-MM-dd'),
            displayDate: format(day, 'EEE, MMM d'),
            totalCalls,
            interested,
            notInterested,
            notAnswered,
            leadsGenerated: dayLeads.length,
            conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
          });
        });
      }

      // Calculate summary
      const summary: AllAgentsSummary = {
        totalAgents: agentStats.length,
        totalCalls: agentStats.reduce((sum, a) => sum + a.totalCalls, 0),
        totalInterested: agentStats.reduce((sum, a) => sum + a.interested, 0),
        totalNotInterested: agentStats.reduce((sum, a) => sum + a.notInterested, 0),
        totalNotAnswered: agentStats.reduce((sum, a) => sum + a.notAnswered, 0),
        totalLeads: agentStats.reduce((sum, a) => sum + a.leadsGenerated, 0),
        avgConversionRate: agentStats.length > 0
          ? Math.round(agentStats.reduce((sum, a) => sum + a.conversionRate, 0) / agentStats.length)
          : 0,
      };

      return {
        agentStats: agentStats.sort((a, b) => b.totalCalls - a.totalCalls),
        summary,
        dailyBreakdown,
      };
    },
    enabled: !!user?.id && hasAppliedFilter,
    refetchInterval: 30000,
  });

  const agents = data?.agentStats || [];
  const summary = data?.summary;
  const dailyBreakdown = data?.dailyBreakdown || [];

  // Validation for apply button
  const canApplyFilter = useCallback(() => {
    if (filterMode === 'single') return singleDate !== null;
    if (filterMode === 'range') return startDate !== null && endDate !== null;
    if (filterMode === 'week') return true;
    if (filterMode === 'month') return true;
    return false;
  }, [filterMode, singleDate, startDate, endDate]);

  // Apply filter handler
  const handleApplyFilter = useCallback(() => {
    if (!canApplyFilter() || !filterMode) return;

    setAppliedMode(filterMode);

    if (filterMode === 'single' && singleDate) {
      setAppliedSingleDate(singleDate);
      setAppliedStartDate(null);
      setAppliedEndDate(null);
    } else if (filterMode === 'range' && startDate && endDate) {
      setAppliedSingleDate(null);
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
    } else if (filterMode === 'week') {
      const { weekStart, weekEnd } = getWeekDates(selectedWeekOffset);
      setAppliedSingleDate(null);
      setAppliedStartDate(weekStart);
      setAppliedEndDate(weekEnd);
    } else if (filterMode === 'month') {
      const { monthStart, monthEnd } = getMonthDates(selectedMonthOffset);
      setAppliedSingleDate(null);
      setAppliedStartDate(monthStart);
      setAppliedEndDate(monthEnd);
    }
    setAppliedAgentId(selectedAgentId);
    toast.success('Filter applied successfully');
  }, [canApplyFilter, filterMode, singleDate, startDate, endDate, selectedWeekOffset, selectedMonthOffset, selectedAgentId]);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedWeekOffset(0);
    setSelectedMonthOffset(0);
    setSelectedAgentId('all');
    setAppliedMode(null);
    setAppliedSingleDate(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setAppliedAgentId('all');
  }, []);

  // Change filter type (go back)
  const handleChangeFilterType = useCallback(() => {
    setFilterMode(null);
    setSingleDate(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedWeekOffset(0);
    setSelectedMonthOffset(0);
  }, []);

  // Handle start date change
  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date);
    if (endDate && date && date > endDate) {
      setEndDate(null);
    }
  };

  const getAppliedDateRangeText = useCallback(() => {
    if (appliedMode === 'single' && appliedSingleDate) {
      return format(appliedSingleDate, 'MMM d, yyyy');
    }
    if (appliedMode === 'range' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    if (appliedMode === 'week' && appliedStartDate && appliedEndDate) {
      return `Week: ${format(appliedStartDate, 'MMM d')} - ${format(appliedEndDate, 'MMM d, yyyy')}`;
    }
    if (appliedMode === 'month' && appliedStartDate && appliedEndDate) {
      return `${format(appliedStartDate, 'MMMM yyyy')}`;
    }
    return 'No filter applied';
  }, [appliedMode, appliedSingleDate, appliedStartDate, appliedEndDate]);

  const dateRangeLabel = getAppliedDateRangeText();

  const exportToExcel = () => {
    if (agents.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = agents.map((agent, index) => ({
      'Rank': index + 1,
      'Agent Name': agent.agentName,
      'Total Calls': agent.totalCalls,
      'Interested': agent.interested,
      'Not Interested': agent.notInterested,
      'Not Answered': agent.notAnswered,
      'Leads Generated': agent.leadsGenerated,
      'Conversion Rate (%)': agent.conversionRate,
    }));

    if (summary) {
      exportData.push({
        'Rank': 0,
        'Agent Name': 'TOTAL',
        'Total Calls': summary.totalCalls,
        'Interested': summary.totalInterested,
        'Not Interested': summary.totalNotInterested,
        'Not Answered': summary.totalNotAnswered,
        'Leads Generated': summary.totalLeads,
        'Conversion Rate (%)': summary.avgConversionRate,
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Agent Performance');

    const filename = `agent_performance_${dateRangeLabel?.replace(/[,\s]+/g, '_') || new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    toast.success('Excel file downloaded successfully');
  };

  const exportToCSV = () => {
    if (agents.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Rank', 'Agent Name', 'Total Calls', 'Interested', 'Not Interested', 'Not Answered', 'Leads Generated', 'Conversion Rate (%)'];
    
    const rows = agents.map((agent, index) => [
      index + 1,
      agent.agentName,
      agent.totalCalls,
      agent.interested,
      agent.notInterested,
      agent.notAnswered,
      agent.leadsGenerated,
      agent.conversionRate,
    ]);

    if (summary) {
      rows.push([
        '',
        'TOTAL',
        summary.totalCalls,
        summary.totalInterested,
        summary.totalNotInterested,
        summary.totalNotAnswered,
        summary.totalLeads,
        summary.avgConversionRate,
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `agent_performance_${dateRangeLabel?.replace(/[,\s]+/g, '_') || new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV file downloaded successfully');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance {hasAppliedFilter && agents.length > 0 && `(${agents.length} agents)`}
          </CardTitle>
          <CardDescription>
            {hasAppliedFilter ? `Showing data for: ${dateRangeLabel}` : 'Select a date filter to view performance'}
          </CardDescription>
        </div>
        {hasAppliedFilter && agents.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent>
        {/* Step 1: Filter Mode Selection */}
        {filterMode === null && (
          <div className="space-y-4">
            {/* Agent Filter - Always visible */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-sm font-semibold">Select Date Filter Type</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-6">Choose how you want to filter the performance data</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <Button
                  variant="outline"
                  onClick={() => setFilterMode('single')}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <CalendarDays className="w-8 h-8 text-primary" />
                  <span className="font-medium">Single Day</span>
                  <span className="text-xs text-muted-foreground">Pick one specific date</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setFilterMode('range')}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <CalendarRange className="w-8 h-8 text-primary" />
                  <span className="font-medium">Date Range</span>
                  <span className="text-xs text-muted-foreground">From date to date</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setFilterMode('week')}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <CalendarIcon className="w-8 h-8 text-primary" />
                  <span className="font-medium">Weekly</span>
                  <span className="text-xs text-muted-foreground">Select a week</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setFilterMode('month')}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <Calendar className="w-8 h-8 text-primary" />
                  <span className="font-medium">Monthly</span>
                  <span className="text-xs text-muted-foreground">Select a month</span>
                </Button>
              </div>
            </div>
            
            {hasAppliedFilter && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Currently showing: <span className="font-medium text-foreground">{dateRangeLabel}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Single Date Selection */}
        {filterMode === 'single' && (
          <div className="space-y-4">
            {/* Agent Filter */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Change Filter Type
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="max-w-sm mx-auto">
              <label className="block text-sm font-medium mb-2">Select a Date:</label>
              <DatePicker
                selected={singleDate}
                onChange={(date) => setSingleDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Click to select a date"
                maxDate={new Date()}
                isClearable
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              />
              
              {singleDate && (
                <div className="mt-3 p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm font-medium">
                    Selected: {format(singleDate, 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 justify-center pt-4">
              <Button
                onClick={handleApplyFilter}
                disabled={!canApplyFilter()}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Date Range Selection */}
        {filterMode === 'range' && (
          <div className="space-y-4">
            {/* Agent Filter */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Change Filter Type
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              <div>
                <label className="block text-sm font-medium mb-2">From Date:</label>
                <DatePicker
                  selected={startDate}
                  onChange={handleStartDateChange}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  maxDate={endDate || new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select start date"
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">To Date:</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate || undefined}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select end date"
                  disabled={!startDate}
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  className={cn(
                    "w-full px-3 py-2 border border-input rounded-md bg-background text-foreground",
                    !startDate && "opacity-50 cursor-not-allowed"
                  )}
                />
                {!startDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Select "From Date" first
                  </p>
                )}
              </div>
            </div>
            
            {startDate && endDate && (
              <div className="max-w-lg mx-auto p-3 bg-primary/10 rounded-lg text-center">
                <p className="text-sm font-medium">
                  Selected Range: {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
                </p>
              </div>
            )}
            
            <div className="flex gap-2 justify-center pt-4">
              <Button
                onClick={handleApplyFilter}
                disabled={!canApplyFilter()}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Week Selection */}
        {filterMode === 'week' && (
          <div className="space-y-4">
            {/* Agent Filter */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Change Filter Type
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="max-w-sm mx-auto">
              <label className="block text-sm font-medium mb-2">Select Week:</label>
              <Select
                value={selectedWeekOffset.toString()}
                onValueChange={(v) => setSelectedWeekOffset(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a week" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const { weekStart, weekEnd } = getWeekDates(i);
                    const label = i === 0 
                      ? `This Week (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`
                      : i === 1
                        ? `Last Week (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')})`
                        : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
                    return (
                      <SelectItem key={i} value={i.toString()}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <div className="mt-3 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Selected: {format(getWeekDates(selectedWeekOffset).weekStart, 'MMM d')} - {format(getWeekDates(selectedWeekOffset).weekEnd, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-center pt-4">
              <Button
                onClick={handleApplyFilter}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Month Selection */}
        {filterMode === 'month' && (
          <div className="space-y-4">
            {/* Agent Filter */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeFilterType}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Change Filter Type
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agent:</span>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="max-w-sm mx-auto">
              <label className="block text-sm font-medium mb-2">Select Month:</label>
              <Select
                value={selectedMonthOffset.toString()}
                onValueChange={(v) => setSelectedMonthOffset(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const { monthStart } = getMonthDates(i);
                    const label = i === 0 
                      ? `This Month (${format(monthStart, 'MMMM yyyy')})`
                      : i === 1
                        ? `Last Month (${format(monthStart, 'MMMM yyyy')})`
                        : format(monthStart, 'MMMM yyyy');
                    return (
                      <SelectItem key={i} value={i.toString()}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <div className="mt-3 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium">
                  Selected: {format(getMonthDates(selectedMonthOffset).monthStart, 'MMMM yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-center pt-4">
              <Button
                onClick={handleApplyFilter}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Apply Filter
              </Button>
              <Button
                variant="outline"
                onClick={handleClearAll}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && hasAppliedFilter && (
          <div className="space-y-3 mt-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        )}

        {/* Results Table */}
        {hasAppliedFilter && !isLoading && agents.length > 0 && (
          <div className="mt-6">
            {/* Daily Breakdown Section - for week/month/range */}
            {showDailyBreakdown && dailyBreakdown.length > 0 && (
              <Collapsible open={isDailyBreakdownOpen} onOpenChange={setIsDailyBreakdownOpen} className="mb-6">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted">
                    <span className="font-medium flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Daily Breakdown ({dailyBreakdown.length} days)
                    </span>
                    {isDailyBreakdownOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border rounded-lg mt-2 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Interested</TableHead>
                          <TableHead className="text-right">Not Interested</TableHead>
                          <TableHead className="text-right">Not Answered</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="w-32">Conversion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyBreakdown.map((day) => (
                          <TableRow key={day.date} className={day.totalCalls === 0 ? 'opacity-50' : ''}>
                            <TableCell className="font-medium">{day.displayDate}</TableCell>
                            <TableCell className="text-right font-medium">{day.totalCalls}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="bg-success/10 text-success">
                                {day.interested}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                                {day.notInterested}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="bg-warning/10 text-warning">
                                {day.notAnswered}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="default">{day.leadsGenerated}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={day.conversionRate} className="h-2 flex-1" />
                                <span className="text-xs font-medium w-8">{day.conversionRate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow className="bg-primary/5 font-semibold border-t-2">
                          <TableCell className="font-bold">TOTAL</TableCell>
                          <TableCell className="text-right font-bold">
                            {dailyBreakdown.reduce((sum, d) => sum + d.totalCalls, 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-success/10 text-success font-bold">
                              {dailyBreakdown.reduce((sum, d) => sum + d.interested, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-destructive/10 text-destructive font-bold">
                              {dailyBreakdown.reduce((sum, d) => sum + d.notInterested, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="bg-warning/10 text-warning font-bold">
                              {dailyBreakdown.reduce((sum, d) => sum + d.notAnswered, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="default" className="font-bold">
                              {dailyBreakdown.reduce((sum, d) => sum + d.leadsGenerated, 0)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={
                                  dailyBreakdown.reduce((sum, d) => sum + d.totalCalls, 0) > 0
                                    ? Math.round(
                                        (dailyBreakdown.reduce((sum, d) => sum + d.interested, 0) / 
                                        dailyBreakdown.reduce((sum, d) => sum + d.totalCalls, 0)) * 100
                                      )
                                    : 0
                                } 
                                className="h-2 flex-1" 
                              />
                              <span className="text-xs font-bold w-8">
                                {dailyBreakdown.reduce((sum, d) => sum + d.totalCalls, 0) > 0
                                  ? Math.round(
                                      (dailyBreakdown.reduce((sum, d) => sum + d.interested, 0) / 
                                      dailyBreakdown.reduce((sum, d) => sum + d.totalCalls, 0)) * 100
                                    )
                                  : 0}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Agent Summary Table */}
            <div className="mb-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Agent Summary
              </h4>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Interested</TableHead>
                  <TableHead className="text-right">Not Interested</TableHead>
                  <TableHead className="text-right">Not Answered</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="w-32">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent, index) => (
                  <TableRow key={agent.agentId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                          {index + 1}
                        </Badge>
                        <span className="font-medium">{agent.agentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{agent.totalCalls}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        {agent.interested}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                        {agent.notInterested}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-warning/10 text-warning">
                        {agent.notAnswered}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">{agent.leadsGenerated}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={agent.conversionRate} className="h-2 flex-1" />
                        <span className="text-xs font-medium w-8">{agent.conversionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* No Results State */}
        {hasAppliedFilter && !isLoading && agents.length === 0 && (
          <div className="mt-6 text-center py-8">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No activity recorded for the selected period</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="mt-4 gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Different Dates
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
