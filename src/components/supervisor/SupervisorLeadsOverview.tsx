import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface SupervisorLeadsOverviewProps {
  teamId?: string;
}

type PeriodFilter = 'today' | 'weekly' | 'monthly' | 'custom';

interface LeadWithDetails {
  id: string;
  company_name: string;
  agent_name: string;
  agent_id: string;
  created_at: string;
  lead_status: string;
  lead_source: string | null;
  deal_value: number | null;
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  proposal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  negotiation: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export const SupervisorLeadsOverview: React.FC<SupervisorLeadsOverviewProps> = ({ teamId }) => {
  const [period, setPeriod] = useState<PeriodFilter>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  // Calculate date range based on period
  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'weekly':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'monthly':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'custom':
        return dateRange?.from && dateRange?.to 
          ? { from: startOfDay(dateRange.from), to: endOfDay(dateRange.to) }
          : { from: startOfDay(now), to: endOfDay(now) };
      default:
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  };

  const effectiveDateRange = getDateRange();

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['supervisor-leads', teamId, effectiveDateRange.from?.toISOString(), effectiveDateRange.to?.toISOString()],
    queryFn: async (): Promise<LeadWithDetails[]> => {
      // Get leads within date range
      let query = supabase
        .from('leads')
        .select(`
          id,
          created_at,
          lead_status,
          lead_source,
          deal_value,
          agent_id,
          contact_id
        `)
        .gte('created_at', effectiveDateRange.from?.toISOString())
        .lte('created_at', effectiveDateRange.to?.toISOString())
        .order('created_at', { ascending: false });

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      if (!leadsData || leadsData.length === 0) return [];

      // Get unique agent IDs
      const agentIds = [...new Set(leadsData.map(l => l.agent_id))];
      
      // Get agent profiles - filter by team if specified
      let profilesQuery = supabase
        .from('profiles_public')
        .select('id, full_name, username, team_id')
        .in('id', agentIds);
      
      if (teamId) {
        profilesQuery = profilesQuery.eq('team_id', teamId);
      }

      const { data: profiles } = await profilesQuery;

      // Get contact details for company names
      const contactIds = [...new Set(leadsData.map(l => l.contact_id))];
      const { data: contacts } = await supabase
        .from('master_contacts')
        .select('id, company_name')
        .in('id', contactIds);

      // Filter leads by team if teamId is specified
      const teamAgentIds = new Set(profiles?.map(p => p.id) || []);
      
      return leadsData
        .filter(lead => !teamId || teamAgentIds.has(lead.agent_id))
        .map(lead => {
          const profile = profiles?.find(p => p.id === lead.agent_id);
          const contact = contacts?.find(c => c.id === lead.contact_id);
          return {
            id: lead.id,
            company_name: contact?.company_name || 'Unknown Company',
            agent_name: profile?.full_name || profile?.username || 'Unknown Agent',
            agent_id: lead.agent_id,
            created_at: lead.created_at,
            lead_status: lead.lead_status || 'new',
            lead_source: lead.lead_source,
            deal_value: lead.deal_value,
          };
        });
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      // Reset custom date range when switching to preset
      setDateRange(undefined);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setPeriod('custom');
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>New Leads</CardTitle>
              <CardDescription>
                {period === 'today' && "Today's new leads"}
                {period === 'weekly' && "This week's new leads"}
                {period === 'monthly' && "This month's new leads"}
                {period === 'custom' && dateRange?.from && dateRange?.to && 
                  `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`
                }
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period Tabs */}
            <Tabs value={period} onValueChange={(v) => handlePeriodChange(v as PeriodFilter)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={period === 'custom' ? 'default' : 'outline'}
                  className={cn(
                    'justify-start text-left font-normal',
                    period === 'custom' && 'bg-primary text-primary-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {period === 'custom' && dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM')}`
                    : 'Custom Range'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            ))}
          </div>
        ) : !leads || leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">No new leads found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {period === 'today' && 'No leads generated today yet'}
              {period === 'weekly' && 'No leads generated this week yet'}
              {period === 'monthly' && 'No leads generated this month yet'}
              {period === 'custom' && 'No leads found in the selected date range'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.company_name}</TableCell>
                    <TableCell>{lead.agent_name}</TableCell>
                    <TableCell>{formatDate(lead.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatTime(lead.created_at)}</TableCell>
                    <TableCell>
                      <Badge className={cn('capitalize', statusColors[lead.lead_status] || 'bg-gray-100 text-gray-800')}>
                        {lead.lead_status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {lead.deal_value 
                        ? new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(lead.deal_value)
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Summary Stats */}
        {leads && leads.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: <strong className="text-foreground">{leads.length}</strong> leads</span>
            <span>
              Total Value: <strong className="text-foreground">
                {new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 })
                  .format(leads.reduce((sum, l) => sum + (l.deal_value || 0), 0))}
              </strong>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
