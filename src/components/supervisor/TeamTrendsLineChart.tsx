import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DailyTeamTrend } from '@/hooks/useTeamPerformanceTrends';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TeamTrendsLineChartProps {
  data: DailyTeamTrend[];
  isLoading: boolean;
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
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
  leadsGenerated: {
    label: 'Leads',
    color: 'hsl(var(--warning))',
  },
};

export const TeamTrendsLineChart: React.FC<TeamTrendsLineChartProps> = ({
  data,
  isLoading,
  trend = 'stable',
  trendPercentage = 0,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Team Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading trends...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some(d => d.totalCalls > 0);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Team Performance Trends
            </CardTitle>
            <CardDescription className="mt-1">
              Daily call volume and conversions over time
            </CardDescription>
          </div>
          {hasData && (
            <div className={`flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span>{trendPercentage}% vs prior period</span>
            </div>
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
            <div className="w-3 h-3 rounded bg-warning" />
            <span className="text-muted-foreground">Leads Generated</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No historical data available</p>
              <p className="text-sm">Trends will appear as your team makes calls</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="displayDate"
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
              <Line
                type="monotone"
                dataKey="totalCalls"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
                name="Total Calls"
              />
              <Line
                type="monotone"
                dataKey="interested"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
                name="Interested"
              />
              <Line
                type="monotone"
                dataKey="leadsGenerated"
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--warning))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
                name="Leads Generated"
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
