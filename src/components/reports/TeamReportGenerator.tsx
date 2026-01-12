import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Phone,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  FileDown,
  Loader2,
  AlertTriangle,
  Crown,
  CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DateRange } from 'react-day-picker';

type TimePeriod = 'today' | 'week' | 'month' | 'custom';

interface TeamMemberReport {
  agentId: string;
  agentName: string;
  username: string;
  totalCalls: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  leadsGenerated: number;
  conversionRate: number;
  talkTimeMinutes: number;
}

// Helper component for comparison cards
const ComparisonCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  previousValue?: number;
  showComparison: boolean;
  valueClassName?: string;
  suffix?: string;
}> = ({ icon, label, value, previousValue, showComparison, valueClassName, suffix = '' }) => {
  const getChange = () => {
    if (!showComparison || previousValue === undefined) return null;
    if (previousValue === 0) return value > 0 ? 100 : 0;
    return Math.round(((value - previousValue) / previousValue) * 100);
  };

  const change = getChange();
  const isPositive = change !== null && change > 0;
  const isNegative = change !== null && change < 0;

  return (
    <div className="p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <p className={cn("text-2xl font-bold", valueClassName)}>
          {value}{suffix}
        </p>
        {showComparison && change !== null && (
          <div className={cn(
            "flex items-center text-xs font-medium pb-1",
            isPositive && "text-green-500",
            isNegative && "text-red-500",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive && <ArrowUpRight className="h-3 w-3" />}
            {isNegative && <ArrowDownRight className="h-3 w-3" />}
            {!isPositive && !isNegative && <Minus className="h-3 w-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      {showComparison && previousValue !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          Previous: {previousValue}{suffix}
        </p>
      )}
    </div>
  );
};

export const TeamReportGenerator: React.FC = () => {
  const { ledTeamId } = useAuth();
  const { teamInfo, isTeamLeader } = useTeamLeaderData();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const getDateRange = (period: TimePeriod) => {
    const today = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'custom':
        return { 
          start: startOfDay(customDateRange?.from || subDays(today, 7)), 
          end: endOfDay(customDateRange?.to || today) 
        };
    }
  };

  const getPreviousDateRange = (period: TimePeriod) => {
    const { start, end } = getDateRange(period);
    const daysDiff = differenceInDays(end, start) + 1;
    
    switch (period) {
      case 'today':
        return { start: subDays(start, 1), end: subDays(end, 1) };
      case 'week':
        return { start: subWeeks(start, 1), end: subWeeks(end, 1) };
      case 'month':
        return { start: subMonths(start, 1), end: subMonths(end, 1) };
      case 'custom':
        return { start: subDays(start, daysDiff), end: subDays(end, daysDiff) };
    }
  };

  const fetchPeriodData = async (start: Date, end: Date, memberIds: string[]) => {
    const { data: feedback } = await supabase
      .from('call_feedback')
      .select('agent_id, feedback_status')
      .in('agent_id', memberIds)
      .gte('call_timestamp', start.toISOString())
      .lte('call_timestamp', end.toISOString());

    const { data: leads } = await supabase
      .from('leads')
      .select('agent_id')
      .in('agent_id', memberIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { data: talkTime } = await supabase
      .from('agent_talk_time')
      .select('agent_id, talk_time_minutes')
      .in('agent_id', memberIds)
      .gte('date', format(start, 'yyyy-MM-dd'))
      .lte('date', format(end, 'yyyy-MM-dd'));

    return { feedback, leads, talkTime };
  };

  const aggregateData = (
    profiles: { id: string; full_name: string | null; username: string | null }[],
    feedback: { agent_id: string; feedback_status: string }[] | null,
    leads: { agent_id: string }[] | null,
    talkTime: { agent_id: string; talk_time_minutes: number | null }[] | null
  ): { members: TeamMemberReport[]; totals: TeamMemberReport } => {
    const members: TeamMemberReport[] = profiles.map(profile => {
      const agentFeedback = feedback?.filter(f => f.agent_id === profile.id) || [];
      const agentLeads = leads?.filter(l => l.agent_id === profile.id) || [];
      const agentTalkTime = talkTime?.filter(t => t.agent_id === profile.id) || [];
      
      const totalCalls = agentFeedback.length;
      const interested = agentFeedback.filter(f => f.feedback_status === 'interested').length;
      const notInterested = agentFeedback.filter(f => f.feedback_status === 'not_interested').length;
      const notAnswered = agentFeedback.filter(f => f.feedback_status === 'not_answered').length;

      return {
        agentId: profile.id,
        agentName: profile.full_name || profile.username || 'Unknown',
        username: profile.username || '',
        totalCalls,
        interested,
        notInterested,
        notAnswered,
        leadsGenerated: agentLeads.length,
        conversionRate: totalCalls > 0 ? Math.round((interested / totalCalls) * 100) : 0,
        talkTimeMinutes: agentTalkTime.reduce((sum, t) => sum + (t.talk_time_minutes || 0), 0),
      };
    });

    const totals: TeamMemberReport = {
      agentId: 'total',
      agentName: 'Team Total',
      username: '',
      totalCalls: members.reduce((sum, m) => sum + m.totalCalls, 0),
      interested: members.reduce((sum, m) => sum + m.interested, 0),
      notInterested: members.reduce((sum, m) => sum + m.notInterested, 0),
      notAnswered: members.reduce((sum, m) => sum + m.notAnswered, 0),
      leadsGenerated: members.reduce((sum, m) => sum + m.leadsGenerated, 0),
      conversionRate: 0,
      talkTimeMinutes: members.reduce((sum, m) => sum + m.talkTimeMinutes, 0),
    };
    totals.conversionRate = totals.totalCalls > 0 
      ? Math.round((totals.interested / totals.totalCalls) * 100) 
      : 0;

    members.sort((a, b) => b.totalCalls - a.totalCalls);
    return { members, totals };
  };

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['team-report', ledTeamId, timePeriod, customDateRange?.from?.toISOString(), customDateRange?.to?.toISOString(), showComparison],
    queryFn: async (): Promise<{ 
      members: TeamMemberReport[]; 
      totals: TeamMemberReport;
      previousMembers?: TeamMemberReport[];
      previousTotals?: TeamMemberReport;
    }> => {
      if (!ledTeamId) return { members: [], totals: getEmptyTotals() };

      const { start, end } = getDateRange(timePeriod);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('team_id', ledTeamId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return { members: [], totals: getEmptyTotals() };

      const memberIds = profiles.map(p => p.id);

      // Fetch current period data
      const currentData = await fetchPeriodData(start, end, memberIds);
      const { members, totals } = aggregateData(profiles, currentData.feedback, currentData.leads, currentData.talkTime);

      // Fetch previous period data if comparison is enabled
      if (showComparison) {
        const { start: prevStart, end: prevEnd } = getPreviousDateRange(timePeriod);
        const prevData = await fetchPeriodData(prevStart, prevEnd, memberIds);
        const { members: previousMembers, totals: previousTotals } = aggregateData(profiles, prevData.feedback, prevData.leads, prevData.talkTime);
        return { members, totals, previousMembers, previousTotals };
      }

      return { members, totals };
    },
    enabled: !!ledTeamId,
  });

  const getEmptyTotals = (): TeamMemberReport => ({
    agentId: 'total',
    agentName: 'Team Total',
    username: '',
    totalCalls: 0,
    interested: 0,
    notInterested: 0,
    notAnswered: 0,
    leadsGenerated: 0,
    conversionRate: 0,
    talkTimeMinutes: 0,
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(timePeriod);
    if (timePeriod === 'today') {
      return format(start, 'MMMM d, yyyy');
    }
    if (timePeriod === 'custom' && customDateRange?.from && customDateRange?.to) {
      return `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d, yyyy')}`;
    }
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const downloadPDF = () => {
    if (!reportData) return;
    setIsDownloading(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 98, 255);
      doc.text(`${teamInfo?.name || 'Team'} Performance Report`, margin, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(getPeriodLabel(), margin, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 15;

      // Summary Cards
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Team Summary', margin, yPos);
      yPos += 10;

      const summaryData = [
        ['Total Calls', reportData.totals.totalCalls.toString()],
        ['Interested', reportData.totals.interested.toString()],
        ['Leads Generated', reportData.totals.leadsGenerated.toString()],
        ['Conversion Rate', `${reportData.totals.conversionRate}%`],
        ['Total Talk Time', `${reportData.totals.talkTimeMinutes} min`],
      ];

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      summaryData.forEach(([label, value]) => {
        doc.setTextColor(100, 100, 100);
        doc.text(label + ':', margin, yPos);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(value, margin + 50, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 6;
      });
      yPos += 10;

      // Team Members Table
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Individual Performance', margin, yPos);
      yPos += 10;

      // Table header
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPos - 3, pageWidth - margin * 2, 8, 'F');
      
      const colWidths = [45, 22, 22, 22, 22, 22, 25];
      const headers = ['Agent', 'Calls', 'Interested', 'Not Int.', 'N/A', 'Leads', 'Conv %'];
      let xPos = margin + 2;
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos + 3);
        xPos += colWidths[i];
      });
      yPos += 10;

      // Table rows
      doc.setFont('helvetica', 'normal');
      reportData.members.forEach((member, index) => {
        if (yPos > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          yPos = 20;
        }

        if (index === 0) {
          doc.setFillColor(255, 251, 235);
          doc.rect(margin, yPos - 3, pageWidth - margin * 2, 7, 'F');
        }

        xPos = margin + 2;
        const values = [
          member.agentName.length > 18 ? member.agentName.slice(0, 15) + '...' : member.agentName,
          member.totalCalls.toString(),
          member.interested.toString(),
          member.notInterested.toString(),
          member.notAnswered.toString(),
          member.leadsGenerated.toString(),
          `${member.conversionRate}%`,
        ];
        
        values.forEach((value, i) => {
          doc.text(value, xPos, yPos + 2);
          xPos += colWidths[i];
        });
        yPos += 7;
      });

      // Footer
      yPos += 10;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('This report was generated by the Sales Performance System.', margin, yPos);

      // Save
      const fileName = `Team_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error('Failed to generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isTeamLeader) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Team Leader Access Required</AlertTitle>
        <AlertDescription>
          This report is only available to team leaders. Contact your administrator if you believe this is an error.
        </AlertDescription>
      </Alert>
    );
  }

  const chartData = reportData?.members.slice(0, 10).map(m => ({
    name: m.agentName.split(' ')[0],
    calls: m.totalCalls,
    interested: m.interested,
    leads: m.leadsGenerated,
  })) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {teamInfo?.name || 'My Team'} Report
              </CardTitle>
              <CardDescription>
                Performance report for your team members
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              
              {timePeriod === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !customDateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange?.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "MMM d")} - {format(customDateRange.to, "MMM d, yyyy")}
                          </>
                        ) : (
                          format(customDateRange.from, "PPP")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange?.from}
                      selected={customDateRange}
                      onSelect={setCustomDateRange}
                      numberOfMonths={2}
                      disabled={(date) => date > new Date()}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              )}
              
              <div className="flex items-center gap-2 border-l pl-2">
                <Switch
                  id="comparison-mode"
                  checked={showComparison}
                  onCheckedChange={setShowComparison}
                />
                <Label htmlFor="comparison-mode" className="text-sm cursor-pointer">
                  Compare
                </Label>
              </div>
              
              <Button onClick={downloadPDF} disabled={isLoading || isDownloading || !reportData}>
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Download PDF</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Period indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{getPeriodLabel()}</span>
                </div>
                {showComparison && (
                  <Badge variant="outline" className="text-xs">
                    Comparing with previous {timePeriod === 'custom' ? 'period' : timePeriod}
                  </Badge>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ComparisonCard
                  icon={<Phone className="h-4 w-4" />}
                  label="Total Calls"
                  value={reportData?.totals.totalCalls || 0}
                  previousValue={reportData?.previousTotals?.totalCalls}
                  showComparison={showComparison}
                />
                <ComparisonCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Interested"
                  value={reportData?.totals.interested || 0}
                  previousValue={reportData?.previousTotals?.interested}
                  showComparison={showComparison}
                  valueClassName="text-green-500"
                />
                <ComparisonCard
                  icon={<Target className="h-4 w-4" />}
                  label="Leads"
                  value={reportData?.totals.leadsGenerated || 0}
                  previousValue={reportData?.previousTotals?.leadsGenerated}
                  showComparison={showComparison}
                  valueClassName="text-amber-500"
                />
                <ComparisonCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Conversion"
                  value={reportData?.totals.conversionRate || 0}
                  previousValue={reportData?.previousTotals?.conversionRate}
                  showComparison={showComparison}
                  valueClassName="text-purple-500"
                  suffix="%"
                />
                <ComparisonCard
                  icon={<Clock className="h-4 w-4" />}
                  label="Talk Time"
                  value={reportData?.totals.talkTimeMinutes || 0}
                  previousValue={reportData?.previousTotals?.talkTimeMinutes}
                  showComparison={showComparison}
                  valueClassName="text-cyan-500"
                  suffix="m"
                />
              </div>

              {/* Comparison Chart - Current vs Previous Period */}
              {showComparison && reportData?.previousTotals && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      Current vs Previous Period
                    </CardTitle>
                    <CardDescription>
                      Side-by-side comparison of key metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={[
                          {
                            metric: 'Total Calls',
                            current: reportData.totals.totalCalls,
                            previous: reportData.previousTotals.totalCalls,
                          },
                          {
                            metric: 'Interested',
                            current: reportData.totals.interested,
                            previous: reportData.previousTotals.interested,
                          },
                          {
                            metric: 'Leads',
                            current: reportData.totals.leadsGenerated,
                            previous: reportData.previousTotals.leadsGenerated,
                          },
                          {
                            metric: 'Talk Time (min)',
                            current: reportData.totals.talkTimeMinutes,
                            previous: reportData.previousTotals.talkTimeMinutes,
                          },
                        ]}
                        layout="vertical"
                        margin={{ left: 20, right: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                        <XAxis type="number" className="text-xs" />
                        <YAxis type="category" dataKey="metric" className="text-xs" width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string) => [value, name === 'current' ? 'Current Period' : 'Previous Period']}
                        />
                        <Legend 
                          formatter={(value) => value === 'current' ? 'Current Period' : 'Previous Period'}
                        />
                        <Bar dataKey="current" name="current" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                        <Bar dataKey="previous" name="previous" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} barSize={20} opacity={0.5} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Performance Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Performance by Agent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="calls" name="Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="interested" name="Interested" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="leads" name="Leads" fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Agent-Level Comparison Chart */}
              {showComparison && reportData?.previousMembers && reportData.members.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Agent Performance Comparison</CardTitle>
                    <CardDescription>
                      Each agent's current vs previous period calls
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(280, reportData.members.length * 50)}>
                      <BarChart
                        data={reportData.members.slice(0, 10).map(member => {
                          const prevMember = reportData.previousMembers?.find(p => p.agentId === member.agentId);
                          return {
                            name: member.agentName.split(' ')[0],
                            currentCalls: member.totalCalls,
                            previousCalls: prevMember?.totalCalls || 0,
                            currentInterested: member.interested,
                            previousInterested: prevMember?.interested || 0,
                          };
                        })}
                        layout="vertical"
                        margin={{ left: 10, right: 30 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                        <XAxis type="number" className="text-xs" />
                        <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                              currentCalls: 'Current Calls',
                              previousCalls: 'Previous Calls',
                              currentInterested: 'Current Interested',
                              previousInterested: 'Previous Interested',
                            };
                            return [value, labels[name] || name];
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            const labels: Record<string, string> = {
                              currentCalls: 'Current Calls',
                              previousCalls: 'Previous Calls',
                              currentInterested: 'Current Interested',
                              previousInterested: 'Previous Interested',
                            };
                            return labels[value] || value;
                          }}
                        />
                        <Bar dataKey="currentCalls" name="currentCalls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
                        <Bar dataKey="previousCalls" name="previousCalls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} opacity={0.3} />
                        <Bar dataKey="currentInterested" name="currentInterested" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} barSize={12} />
                        <Bar dataKey="previousInterested" name="previousInterested" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} barSize={12} opacity={0.3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Members Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Individual Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportData?.members.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No team members found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead className="text-center">Calls</TableHead>
                            <TableHead className="text-center">Interested</TableHead>
                            <TableHead className="text-center hidden sm:table-cell">Not Int.</TableHead>
                            <TableHead className="text-center hidden md:table-cell">N/A</TableHead>
                            <TableHead className="text-center">Leads</TableHead>
                            <TableHead className="text-center">Conv %</TableHead>
                            <TableHead className="text-center hidden lg:table-cell">Talk Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData?.members.map((member, index) => (
                            <TableRow 
                              key={member.agentId}
                              className={index === 0 ? 'bg-amber-500/5' : ''}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {getInitials(member.agentName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium text-sm">{member.agentName}</span>
                                      {index === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                                    </div>
                                    <span className="text-xs text-muted-foreground">@{member.username}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium">{member.totalCalls}</TableCell>
                              <TableCell className="text-center text-green-500 font-medium">{member.interested}</TableCell>
                              <TableCell className="text-center hidden sm:table-cell">{member.notInterested}</TableCell>
                              <TableCell className="text-center hidden md:table-cell">{member.notAnswered}</TableCell>
                              <TableCell className="text-center text-amber-500 font-medium">{member.leadsGenerated}</TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  variant={member.conversionRate >= 20 ? 'default' : 'secondary'}
                                  className={member.conversionRate >= 20 ? 'bg-green-500 hover:bg-green-600' : ''}
                                >
                                  {member.conversionRate}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center hidden lg:table-cell">{member.talkTimeMinutes}m</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
