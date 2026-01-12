import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useAgentPerformanceTrends, AgentDailyTrend, AgentTrendSummary } from '@/hooks/useAgentPerformanceTrends';
import { useAuth } from '@/contexts/AuthContext';
import { User, TrendingUp, TrendingDown, Minus, Phone, ThumbsUp, Target, Calendar, Activity, RefreshCw, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { generateAgentPerformancePDF } from '@/utils/agentReportPDF';
import { toast } from 'sonner';

interface AgentDrillDownChartProps {
  className?: string;
}

const chartConfig = {
  totalCalls: {
    label: 'Total Calls',
    color: 'hsl(var(--primary))',
  },
  interested: {
    label: 'Interested',
    color: 'hsl(var(--success))',
  },
  conversionRate: {
    label: 'Conversion %',
    color: 'hsl(var(--warning))',
  },
};

export const AgentDrillDownChart: React.FC<AgentDrillDownChartProps> = ({ className }) => {
  const { profile } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [days, setDays] = useState<number>(14);
  const [isExporting, setIsExporting] = useState(false);

  const {
    agents,
    agentsLoading,
    dailyTrends,
    summary,
    isLoading,
    refetch,
  } = useAgentPerformanceTrends({ agentId: selectedAgentId, days });

  const hasData = dailyTrends.some(d => d.totalCalls > 0);

  const handleExportPDF = async () => {
    if (!summary) return;
    
    setIsExporting(true);
    try {
      await generateAgentPerformancePDF({
        summary,
        dailyTrends,
        days,
        generatedAt: new Date(),
        generatedBy: profile?.full_name || profile?.username || undefined,
      });
      toast.success('PDF report downloaded successfully');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header and Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Agent Performance Drill-Down
              </CardTitle>
              <CardDescription className="mt-1">
                Analyze individual agent performance trends over time
              </CardDescription>
            </div>
            {selectedAgentId && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportPDF} 
                  disabled={isLoading || isExporting || !summary}
                >
                  <FileDown className={cn('w-4 h-4 mr-2', isExporting && 'animate-pulse')} />
                  {isExporting ? 'Generating...' : 'Export PDF'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Agent</label>
              <Select
                value={selectedAgentId || ''}
                onValueChange={(v) => setSelectedAgentId(v || null)}
                disabled={agentsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={agentsLoading ? 'Loading agents...' : 'Choose an agent'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span>{agent.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Time Period</label>
              <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {!selectedAgentId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Select an agent to view their performance</p>
              <p className="text-sm mt-1">Choose from the dropdown above</p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <AgentTrendsSkeleton />
      ) : (
        <>
          {/* Summary Cards */}
          {summary && <AgentSummaryCards summary={summary} days={days} />}

          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {summary?.agentName}'s Performance Trend
                  </CardTitle>
                  <CardDescription>Daily activity over the last {days} days</CardDescription>
                </div>
                {summary && (
                  <TrendBadge trend={summary.trend} percentage={summary.trendPercentage} />
                )}
              </div>
              <div className="flex gap-4 text-xs mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-muted-foreground">Total Calls</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-success" />
                  <span className="text-muted-foreground">Interested</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded bg-warning" />
                  <span className="text-muted-foreground">Conversion %</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {!hasData ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No activity recorded for this period</p>
                  </div>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ComposedChart data={dailyTrends} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="agentCallsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      className="fill-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalCalls"
                      stroke="hsl(var(--primary))"
                      fill="url(#agentCallsGradient)"
                      strokeWidth={2}
                      name="Total Calls"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="interested"
                      fill="hsl(var(--success))"
                      radius={[4, 4, 0, 0]}
                      name="Interested"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversionRate"
                      stroke="hsl(var(--warning))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--warning))', strokeWidth: 0, r: 3 }}
                      name="Conversion %"
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Calls</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Interested</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Not Interested</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">No Answer</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Leads</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailyTrends].reverse().map((day) => (
                      <tr key={day.date} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{day.displayDate}</td>
                        <td className="text-right py-2 px-3">{day.totalCalls}</td>
                        <td className="text-right py-2 px-3 text-success">{day.interested}</td>
                        <td className="text-right py-2 px-3 text-destructive">{day.notInterested}</td>
                        <td className="text-right py-2 px-3 text-muted-foreground">{day.notAnswered}</td>
                        <td className="text-right py-2 px-3 text-warning">{day.leadsGenerated}</td>
                        <td className="text-right py-2 px-3 font-medium">{day.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

const AgentSummaryCards: React.FC<{ summary: AgentTrendSummary; days: number }> = ({ summary, days }) => {
  const stats = [
    { label: `Total Calls (${days}d)`, value: summary.totalCalls.toLocaleString(), icon: Phone, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Interested', value: summary.totalInterested.toLocaleString(), icon: ThumbsUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Leads Generated', value: summary.totalLeads.toLocaleString(), icon: Target, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Avg Conversion', value: `${summary.avgConversionRate}%`, icon: TrendingUp, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Avg Calls/Day', value: summary.avgCallsPerDay.toLocaleString(), icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Best Day', value: `${summary.bestDay} (${summary.bestDayCalls})`, icon: Calendar, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card key={idx}>
            <CardContent className="p-4">
              <div className={cn('p-2 rounded-lg w-fit mb-2', stat.bg)}>
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const TrendBadge: React.FC<{ trend: 'up' | 'down' | 'stable'; percentage: number }> = ({ trend, percentage }) => {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const color = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className={cn('flex items-center gap-1.5 text-sm font-medium', color)}>
      <Icon className="w-4 h-4" />
      <span>{percentage}% vs prior period</span>
    </div>
  );
};

const AgentTrendsSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  </div>
);
