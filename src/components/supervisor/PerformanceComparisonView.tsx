import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';
import { useTeamPerformanceComparison, ComparisonMetric } from '@/hooks/useTeamPerformanceComparison';
import { CalendarIcon, GitCompare, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface PerformanceComparisonViewProps {
  className?: string;
}

const chartConfig = {
  period1: {
    label: 'Period 1',
    color: 'hsl(var(--primary))',
  },
  period2: {
    label: 'Period 2',
    color: 'hsl(var(--success))',
  },
};

const presetRanges = [
  {
    label: 'This Week vs Last Week',
    getPeriods: () => {
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
      const thisWeekEnd = now;
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      return {
        period1: { from: lastWeekStart, to: lastWeekEnd },
        period2: { from: thisWeekStart, to: thisWeekEnd },
      };
    },
  },
  {
    label: 'Last 7 Days vs Prior 7 Days',
    getPeriods: () => {
      const now = new Date();
      return {
        period1: { from: subDays(now, 14), to: subDays(now, 8) },
        period2: { from: subDays(now, 7), to: now },
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

export const PerformanceComparisonView: React.FC<PerformanceComparisonViewProps> = ({ className }) => {
  const [period1, setPeriod1] = useState<DateRange | undefined>();
  const [period2, setPeriod2] = useState<DateRange | undefined>();

  const {
    period1Data,
    period2Data,
    metrics,
    isLoading,
    refetch,
  } = useTeamPerformanceComparison({
    period1: period1?.from && period1?.to ? { from: period1.from, to: period1.to } : null,
    period2: period2?.from && period2?.to ? { from: period2.from, to: period2.to } : null,
  });

  const handlePresetSelect = (preset: typeof presetRanges[0]) => {
    const { period1: p1, period2: p2 } = preset.getPeriods();
    setPeriod1({ from: p1.from, to: p1.to });
    setPeriod2({ from: p2.from, to: p2.to });
  };

  const hasValidPeriods = period1?.from && period1?.to && period2?.from && period2?.to;

  // Prepare chart data
  const chartData = metrics.map(m => ({
    metric: m.metric.replace(' ', '\n'),
    shortMetric: m.metric.split(' ')[0],
    period1: m.period1Value,
    period2: m.period2Value,
  }));

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header and Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                Performance Comparison
              </CardTitle>
              <CardDescription className="mt-1">
                Compare team performance between two time periods
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
              <label className="text-sm font-medium text-muted-foreground">Period 1 (Baseline)</label>
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
              <label className="text-sm font-medium text-muted-foreground">Period 2 (Comparison)</label>
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
          ) : (
            <>
              {/* Comparison Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Side-by-Side Comparison</CardTitle>
                  <div className="flex gap-4 text-xs mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-primary" />
                      <span className="text-muted-foreground">{period1Data?.dateRange}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-success" />
                      <span className="text-muted-foreground">{period2Data?.dateRange}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="shortMetric"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="fill-muted-foreground"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="period1" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Period 1" />
                      <Bar dataKey="period2" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Period 2" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {metrics.map((metric, idx) => (
                  <MetricComparisonCard key={idx} metric={metric} />
                ))}
              </div>
            </>
          )}
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

const MetricComparisonCard: React.FC<{ metric: ComparisonMetric }> = ({ metric }) => {
  const TrendIcon = metric.isPositive ? TrendingUp : metric.difference === 0 ? Minus : TrendingDown;
  const trendColor = metric.isPositive ? 'text-success' : metric.difference === 0 ? 'text-muted-foreground' : 'text-destructive';
  const isPercentage = metric.metric === 'Conversion Rate';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-2 truncate">{metric.metric}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {metric.period2Value}{isPercentage ? '%' : ''}
          </span>
          <span className="text-xs text-muted-foreground">
            vs {metric.period1Value}{isPercentage ? '%' : ''}
          </span>
        </div>
        <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}>
          <TrendIcon className="w-4 h-4" />
          <span>
            {metric.difference >= 0 ? '+' : ''}{metric.difference}{isPercentage ? 'pp' : ''}
          </span>
          {metric.period1Value > 0 && (
            <span className="text-xs">
              ({metric.percentChange >= 0 ? '+' : ''}{metric.percentChange}%)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
