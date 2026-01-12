import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';
import { CalendarIcon, GitCompare, TrendingUp, TrendingDown, Minus, RefreshCw, Building2, Users, MapPin, Package } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { parseLeadSource } from '@/hooks/useLeads';

interface PeriodData {
  totalLeads: number;
  totalDealValue: number;
  bankBreakdown: { name: string; count: number; dealValue: number }[];
  teamBreakdown: { name: string; count: number; dealValue: number }[];
  cityBreakdown: { name: string; count: number; dealValue: number }[];
  productBreakdown: { name: string; count: number; dealValue: number }[];
  dateRange: string;
}

interface ComparisonMetric {
  name: string;
  period1Value: number;
  period2Value: number;
  difference: number;
  percentChange: number;
  isPositive: boolean;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PERIOD_COLORS = { period1: '#6366f1', period2: '#22c55e' };

const presetRanges = [
  {
    label: 'This Week vs Last Week',
    getPeriods: () => {
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      return {
        period1: { from: lastWeekStart, to: lastWeekEnd },
        period2: { from: thisWeekStart, to: now },
      };
    },
  },
  {
    label: 'This Month vs Last Month',
    getPeriods: () => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      return {
        period1: { from: lastMonthStart, to: lastMonthEnd },
        period2: { from: thisMonthStart, to: now },
      };
    },
  },
  {
    label: 'Last 30 Days vs Prior 30 Days',
    getPeriods: () => {
      const now = new Date();
      return {
        period1: { from: subDays(now, 60), to: subDays(now, 31) },
        period2: { from: subDays(now, 30), to: now },
      };
    },
  },
];

export const LeadsComparisonView: React.FC = () => {
  const [period1, setPeriod1] = useState<DateRange | undefined>();
  const [period2, setPeriod2] = useState<DateRange | undefined>();

  const fetchPeriodData = async (from: Date, to: Date): Promise<PeriodData> => {
    const { data: leadsData, error } = await supabase
      .from('leads')
      .select(`
        id,
        lead_source,
        deal_value,
        agent_id,
        master_contacts (
          city
        )
      `)
      .eq('lead_status', 'approved')
      .gte('updated_at', from.toISOString())
      .lte('updated_at', to.toISOString());

    if (error) throw error;

    // Fetch agent profiles
    const agentIds = [...new Set((leadsData || []).map(l => l.agent_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, username, team_id')
      .in('id', agentIds);

    const teamIds = [...new Set((profilesData || []).map(p => p.team_id).filter(Boolean))];
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds);

    const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
    const teamsMap = new Map((teamsData || []).map(t => [t.id, t.name]));

    // Calculate breakdowns
    const bankMap = new Map<string, { count: number; dealValue: number }>();
    const teamMap = new Map<string, { count: number; dealValue: number }>();
    const cityMap = new Map<string, { count: number; dealValue: number }>();
    const productMap = new Map<string, { count: number; dealValue: number }>();

    let totalDealValue = 0;

    (leadsData || []).forEach(lead => {
      const parsed = parseLeadSource(lead.lead_source);
      const bank = parsed?.bank || 'Unknown';
      const product = parsed?.product || 'account';
      const profile = profilesMap.get(lead.agent_id);
      const team = profile?.team_id ? teamsMap.get(profile.team_id) || 'Unassigned' : 'Unassigned';
      const city = lead.master_contacts?.city || 'Unknown';
      const dealValue = lead.deal_value || 0;

      totalDealValue += dealValue;

      // Bank
      const bankEntry = bankMap.get(bank) || { count: 0, dealValue: 0 };
      bankMap.set(bank, { count: bankEntry.count + 1, dealValue: bankEntry.dealValue + dealValue });

      // Team
      const teamEntry = teamMap.get(team) || { count: 0, dealValue: 0 };
      teamMap.set(team, { count: teamEntry.count + 1, dealValue: teamEntry.dealValue + dealValue });

      // City
      const cityEntry = cityMap.get(city) || { count: 0, dealValue: 0 };
      cityMap.set(city, { count: cityEntry.count + 1, dealValue: cityEntry.dealValue + dealValue });

      // Product
      const productEntry = productMap.get(product) || { count: 0, dealValue: 0 };
      productMap.set(product, { count: productEntry.count + 1, dealValue: productEntry.dealValue + dealValue });
    });

    return {
      totalLeads: leadsData?.length || 0,
      totalDealValue,
      bankBreakdown: Array.from(bankMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      teamBreakdown: Array.from(teamMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count),
      cityBreakdown: Array.from(cityMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      productBreakdown: Array.from(productMap.entries())
        .map(([name, data]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...data }))
        .sort((a, b) => b.count - a.count),
      dateRange: `${format(from, 'MMM d')} - ${format(to, 'MMM d, yyyy')}`,
    };
  };

  const { data: period1Data, isLoading: loading1 } = useQuery({
    queryKey: ['leads-comparison-p1', period1?.from, period1?.to],
    queryFn: () => period1?.from && period1?.to ? fetchPeriodData(period1.from, period1.to) : null,
    enabled: !!period1?.from && !!period1?.to,
  });

  const { data: period2Data, isLoading: loading2, refetch } = useQuery({
    queryKey: ['leads-comparison-p2', period2?.from, period2?.to],
    queryFn: () => period2?.from && period2?.to ? fetchPeriodData(period2.from, period2.to) : null,
    enabled: !!period2?.from && !!period2?.to,
  });

  const isLoading = loading1 || loading2;
  const hasValidPeriods = period1?.from && period1?.to && period2?.from && period2?.to;

  const handlePresetSelect = (preset: typeof presetRanges[0]) => {
    const { period1: p1, period2: p2 } = preset.getPeriods();
    setPeriod1({ from: p1.from, to: p1.to });
    setPeriod2({ from: p2.from, to: p2.to });
  };

  // Calculate comparison metrics
  const comparisonMetrics: ComparisonMetric[] = period1Data && period2Data ? [
    {
      name: 'Total Leads',
      period1Value: period1Data.totalLeads,
      period2Value: period2Data.totalLeads,
      difference: period2Data.totalLeads - period1Data.totalLeads,
      percentChange: period1Data.totalLeads > 0 
        ? Math.round(((period2Data.totalLeads - period1Data.totalLeads) / period1Data.totalLeads) * 100)
        : 0,
      isPositive: period2Data.totalLeads >= period1Data.totalLeads,
    },
    {
      name: 'Deal Value',
      period1Value: period1Data.totalDealValue,
      period2Value: period2Data.totalDealValue,
      difference: period2Data.totalDealValue - period1Data.totalDealValue,
      percentChange: period1Data.totalDealValue > 0 
        ? Math.round(((period2Data.totalDealValue - period1Data.totalDealValue) / period1Data.totalDealValue) * 100)
        : 0,
      isPositive: period2Data.totalDealValue >= period1Data.totalDealValue,
    },
    {
      name: 'Avg Deal Value',
      period1Value: period1Data.totalLeads > 0 ? Math.round(period1Data.totalDealValue / period1Data.totalLeads) : 0,
      period2Value: period2Data.totalLeads > 0 ? Math.round(period2Data.totalDealValue / period2Data.totalLeads) : 0,
      difference: 0,
      percentChange: 0,
      isPositive: true,
    },
  ] : [];

  // Update avg deal value metrics
  if (comparisonMetrics.length > 0) {
    const avg1 = comparisonMetrics[2].period1Value;
    const avg2 = comparisonMetrics[2].period2Value;
    comparisonMetrics[2].difference = avg2 - avg1;
    comparisonMetrics[2].percentChange = avg1 > 0 ? Math.round(((avg2 - avg1) / avg1) * 100) : 0;
    comparisonMetrics[2].isPositive = avg2 >= avg1;
  }

  // Prepare comparison chart data
  const prepareComparisonData = (p1Data: { name: string; count: number }[], p2Data: { name: string; count: number }[]) => {
    const allNames = new Set([...p1Data.map(d => d.name), ...p2Data.map(d => d.name)]);
    return Array.from(allNames).map(name => ({
      name,
      period1: p1Data.find(d => d.name === name)?.count || 0,
      period2: p2Data.find(d => d.name === name)?.count || 0,
    })).sort((a, b) => (b.period1 + b.period2) - (a.period1 + a.period2)).slice(0, 8);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                Leads Comparison
              </CardTitle>
              <CardDescription className="mt-1">
                Compare approved leads between two time periods
              </CardDescription>
            </div>
            {hasValidPeriods && (
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {presetRanges.map((preset, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Range Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: PERIOD_COLORS.period1 }} />
                Period 1 (Baseline)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !period1 && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {period1?.from ? (
                      period1.to ? (
                        <>
                          {format(period1.from, 'LLL dd, y')} - {format(period1.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(period1.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={period1?.from}
                    selected={period1}
                    onSelect={setPeriod1}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: PERIOD_COLORS.period2 }} />
                Period 2 (Comparison)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !period2 && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {period2?.from ? (
                      period2.to ? (
                        <>
                          {format(period2.from, 'LLL dd, y')} - {format(period2.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(period2.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={period2?.from}
                    selected={period2}
                    onSelect={setPeriod2}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {hasValidPeriods && (
        <>
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                  Loading comparison data...
                </div>
              </CardContent>
            </Card>
          ) : period1Data && period2Data ? (
            <>
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {comparisonMetrics.map((metric, idx) => (
                  <MetricComparisonCard key={idx} metric={metric} period1Data={period1Data} period2Data={period2Data} />
                ))}
              </div>

              {/* Comparison Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bank Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Bank Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={prepareComparisonData(period1Data.bankBreakdown, period2Data.bankBreakdown)}
                          layout="vertical"
                          margin={{ left: 60, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold">{label}</p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period1 }}>
                                      Period 1: {payload[0]?.value}
                                    </p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period2 }}>
                                      Period 2: {payload[1]?.value}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="period1" name="Period 1" fill={PERIOD_COLORS.period1} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="period2" name="Period 2" fill={PERIOD_COLORS.period2} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Team Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={prepareComparisonData(period1Data.teamBreakdown, period2Data.teamBreakdown)}
                          layout="vertical"
                          margin={{ left: 80, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold">{label}</p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period1 }}>
                                      Period 1: {payload[0]?.value}
                                    </p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period2 }}>
                                      Period 2: {payload[1]?.value}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="period1" name="Period 1" fill={PERIOD_COLORS.period1} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="period2" name="Period 2" fill={PERIOD_COLORS.period2} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* City Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      City Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={prepareComparisonData(period1Data.cityBreakdown, period2Data.cityBreakdown)}
                          layout="vertical"
                          margin={{ left: 60, right: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold">{label}</p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period1 }}>
                                      Period 1: {payload[0]?.value}
                                    </p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period2 }}>
                                      Period 2: {payload[1]?.value}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="period1" name="Period 1" fill={PERIOD_COLORS.period1} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="period2" name="Period 2" fill={PERIOD_COLORS.period2} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Product Comparison */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Product Type Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={prepareComparisonData(period1Data.productBreakdown, period2Data.productBreakdown)}
                          margin={{ left: 20, right: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold">{label}</p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period1 }}>
                                      Period 1: {payload[0]?.value}
                                    </p>
                                    <p className="text-sm" style={{ color: PERIOD_COLORS.period2 }}>
                                      Period 2: {payload[1]?.value}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
                          <Bar dataKey="period1" name="Period 1" fill={PERIOD_COLORS.period1} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="period2" name="Period 2" fill={PERIOD_COLORS.period2} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </>
      )}

      {!hasValidPeriods && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Select two date ranges to compare</p>
              <p className="text-sm mt-1">Use the preset buttons or custom date pickers above</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const MetricComparisonCard: React.FC<{
  metric: ComparisonMetric;
  period1Data: PeriodData;
  period2Data: PeriodData;
}> = ({ metric, period1Data, period2Data }) => {
  const TrendIcon = metric.isPositive ? TrendingUp : metric.difference === 0 ? Minus : TrendingDown;
  const trendColor = metric.isPositive ? 'text-green-600' : metric.difference === 0 ? 'text-muted-foreground' : 'text-red-600';
  const isValue = metric.name.includes('Value');
  
  const formatValue = (val: number) => {
    if (isValue) {
      return val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toLocaleString();
    }
    return val.toLocaleString();
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground mb-3">{metric.name}</div>
        
        {/* Period comparison */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: PERIOD_COLORS.period1 }} />
              <span className="text-xs text-muted-foreground">Period 1</span>
            </div>
            <span className="font-semibold">{formatValue(metric.period1Value)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: PERIOD_COLORS.period2 }} />
              <span className="text-xs text-muted-foreground">Period 2</span>
            </div>
            <span className="font-semibold">{formatValue(metric.period2Value)}</span>
          </div>
        </div>

        {/* Change indicator */}
        <div className={cn('flex items-center gap-1 mt-4 pt-3 border-t text-sm', trendColor)}>
          <TrendIcon className="w-4 h-4" />
          <span>
            {metric.difference >= 0 ? '+' : ''}{formatValue(metric.difference)}
          </span>
          {metric.period1Value > 0 && (
            <Badge variant={metric.isPositive ? 'default' : 'destructive'} className="ml-auto text-xs">
              {metric.percentChange >= 0 ? '+' : ''}{metric.percentChange}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
