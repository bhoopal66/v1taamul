import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Line, ComposedChart, Bar } from 'recharts';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { WeeklyTrendData } from '@/hooks/usePerformanceData';

interface WeeklyTrendChartProps {
  data: WeeklyTrendData[];
  isLoading: boolean;
}

const chartConfig = {
  calls: {
    label: 'Calls',
    color: 'hsl(var(--primary))',
  },
  interested: {
    label: 'Interested',
    color: 'hsl(var(--success))',
  },
  conversionRate: {
    label: 'Conversion %',
    color: 'hsl(var(--info))',
  },
};

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({ data, isLoading }) => {
  // Calculate trend
  const getTrend = () => {
    if (data.length < 2) return { direction: 'neutral', percentage: 0 };
    const recent = data.slice(-3).reduce((sum, d) => sum + d.calls, 0) / 3;
    const earlier = data.slice(0, 3).reduce((sum, d) => sum + d.calls, 0) / 3;
    if (earlier === 0) return { direction: 'up', percentage: 100 };
    const change = ((recent - earlier) / earlier) * 100;
    return {
      direction: change >= 0 ? 'up' : 'down',
      percentage: Math.abs(Math.round(change)),
    };
  };

  const trend = getTrend();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Weekly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading trend data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some(d => d.calls > 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Weekly Performance
            </CardTitle>
            <CardDescription className="mt-1">
              Your 7-day performance trend
            </CardDescription>
          </div>
          {hasData && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              trend.direction === 'up' 
                ? 'bg-success/10 text-success' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {trend.direction === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {trend.percentage}%
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No historical data yet</p>
              <p className="text-sm">Start making calls to build your trend!</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="interestedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="calls"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#callsGradient)"
                name="Total Calls"
              />
              <Bar
                yAxisId="left"
                dataKey="interested"
                fill="hsl(var(--success))"
                radius={[4, 4, 0, 0]}
                name="Interested"
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversionRate"
                stroke="hsl(var(--info))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: 'hsl(var(--info))' }}
                name="Conversion %"
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
