import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DailyTeamTrend } from '@/hooks/useTeamPerformanceTrends';
import { PieChart } from 'lucide-react';

interface TeamConversionAreaChartProps {
  data: DailyTeamTrend[];
  isLoading: boolean;
}

const chartConfig = {
  conversionRate: {
    label: 'Conversion Rate',
    color: 'hsl(var(--primary))',
  },
  activeAgents: {
    label: 'Active Agents',
    color: 'hsl(var(--muted-foreground))',
  },
};

export const TeamConversionAreaChart: React.FC<TeamConversionAreaChartProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Conversion Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some(d => d.totalCalls > 0);

  // Calculate average conversion rate
  const avgConversion = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.conversionRate, 0) / data.filter(d => d.totalCalls > 0).length) || 0
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary" />
              Conversion Rate Trend
            </CardTitle>
            <CardDescription className="mt-1">
              Daily conversion rate percentage
            </CardDescription>
          </div>
          {hasData && (
            <div className="text-2xl font-bold text-primary">
              {avgConversion}%
              <span className="text-sm font-normal text-muted-foreground ml-1">avg</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasData ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No conversion data yet</p>
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
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
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                className="fill-muted-foreground"
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
              />
              <Area
                type="monotone"
                dataKey="conversionRate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#conversionGradient)"
                name="Conversion Rate"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
