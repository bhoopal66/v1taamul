import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Download, FileSpreadsheet, FileText, CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

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

interface AllAgentsSummary {
  totalAgents: number;
  totalCalls: number;
  totalInterested: number;
  totalNotInterested: number;
  totalNotAnswered: number;
  totalLeads: number;
  avgConversionRate: number;
}

export const AgentPerformanceList: React.FC = () => {
  const { user, userRole, ledTeamId, profile } = useAuth();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const canSeeAllAgents = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = ledTeamId || (userRole === 'supervisor' ? profile?.team_id : null);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance-list', user?.id, effectiveTeamId, canSeeAllAgents, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const startDate = dateRange?.from ? startOfDay(dateRange.from) : startOfMonth(new Date());
      const endDate = dateRange?.to ? endOfDay(dateRange.to) : endOfMonth(new Date());
      const start = startDate.toISOString();
      const end = endDate.toISOString();

      // Get list of agent IDs we can view (for team filtering)
      let agentIds: string[] | null = null;
      if (!canSeeAllAgents && effectiveTeamId) {
        const { data: teamProfiles } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        agentIds = teamProfiles?.map(p => p.id) || [];
      } else if (!canSeeAllAgents && !effectiveTeamId && user?.id) {
        const { data: supervisedProfiles } = await supabase
          .from('profiles_public')
          .select('id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        agentIds = supervisedProfiles?.map(p => p.id) || [];
      }

      // Build the query for call feedback
      let feedbackQuery = supabase
        .from('call_feedback')
        .select('agent_id, feedback_status')
        .gte('call_timestamp', start)
        .lte('call_timestamp', end);

      if (agentIds && agentIds.length > 0) {
        feedbackQuery = feedbackQuery.in('agent_id', agentIds);
      } else if (agentIds && agentIds.length === 0) {
        return { agentStats: [], summary: null };
      }

      const { data: feedback, error: feedbackError } = await feedbackQuery;
      if (feedbackError) throw feedbackError;

      // Build the query for leads
      let leadsQuery = supabase
        .from('leads')
        .select('agent_id')
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
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const agents = data?.agentStats || [];
  const summary = data?.summary;

  const getDateRangeText = () => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    if (dateRange?.from) {
      return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  const dateRangeLabel = getDateRangeText();

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Agent Performance
            </CardTitle>
            <CardDescription>No activity recorded</CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No activity recorded for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance ({agents.length} agents)
          </CardTitle>
          <CardDescription>Performance metrics by agent</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
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
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};
