import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Phone, 
  Target, 
  Lightbulb,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useWeeklyReport, WeeklyInsight } from '@/hooks/useWeeklyReport';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
  totalCalls: { label: 'Total Calls', color: 'hsl(var(--primary))' },
  interestedCalls: { label: 'Interested', color: 'hsl(var(--success))' },
  conversionRate: { label: 'Conversion %', color: 'hsl(var(--warning))' },
};

interface TrendBadgeProps {
  value: number;
  suffix?: string;
  isPercentage?: boolean;
}

const TrendBadge: React.FC<TrendBadgeProps> = ({ value, suffix = '', isPercentage = true }) => {
  if (value === 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Minus className="w-3 h-3" />
        No change
      </Badge>
    );
  }

  const isPositive = value > 0;
  return (
    <Badge 
      variant={isPositive ? 'default' : 'destructive'} 
      className={`gap-1 ${isPositive ? 'bg-success hover:bg-success/90' : ''}`}
    >
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPositive ? '+' : ''}{value}{isPercentage ? '%' : ''}{suffix}
    </Badge>
  );
};

interface InsightCardProps {
  insight: WeeklyInsight;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const iconMap = {
    positive: <CheckCircle2 className="w-5 h-5 text-success" />,
    negative: <AlertCircle className="w-5 h-5 text-destructive" />,
    neutral: <Info className="w-5 h-5 text-info" />,
    tip: <Lightbulb className="w-5 h-5 text-warning" />,
  };

  const bgMap = {
    positive: 'bg-success/5 border-success/20',
    negative: 'bg-destructive/5 border-destructive/20',
    neutral: 'bg-info/5 border-info/20',
    tip: 'bg-warning/5 border-warning/20',
  };

  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${bgMap[insight.type]}`}>
      <div className="flex-shrink-0 mt-0.5">
        {iconMap[insight.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-sm">{insight.title}</h4>
          {insight.metric && (
            <Badge variant="outline" className="text-xs">
              {insight.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
              {insight.trend === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
              {insight.metric}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
      </div>
    </div>
  );
};

export const WeeklyReport: React.FC = () => {
  const { reportData, isLoading } = useWeeklyReport();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!reportData) return null;

  const { currentWeek, previousWeek, weeklyHistory, insights, weekOverWeekChange } = reportData;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Weekly Performance Report
              </CardTitle>
              <CardDescription className="mt-1">
                {currentWeek.weekStart} - {currentWeek.weekEnd}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              {currentWeek.weekLabel}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{currentWeek.totalCalls}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {previousWeek.totalCalls} last week
                </p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <TrendBadge value={weekOverWeekChange.calls} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interested</p>
                <p className="text-2xl font-bold">{currentWeek.interestedCalls}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {previousWeek.interestedCalls} last week
                </p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
            </div>
            <div className="mt-3">
              <TrendBadge value={weekOverWeekChange.interested} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads</p>
                <p className="text-2xl font-bold">{currentWeek.leadsGenerated}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {previousWeek.leadsGenerated} last week
                </p>
              </div>
              <div className="p-2 rounded-lg bg-info/10">
                <Target className="w-4 h-4 text-info" />
              </div>
            </div>
            <div className="mt-3">
              <TrendBadge 
                value={weekOverWeekChange.leads} 
                isPercentage={false} 
                suffix=" leads"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion</p>
                <p className="text-2xl font-bold">{currentWeek.conversionRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {previousWeek.conversionRate}% last week
                </p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10">
                <Sparkles className="w-4 h-4 text-warning" />
              </div>
            </div>
            <div className="mt-3">
              <TrendBadge 
                value={weekOverWeekChange.conversion} 
                suffix=" pts"
                isPercentage={false}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call Volume Trend</CardTitle>
            <CardDescription>Weekly calls over the last 4 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={weeklyHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis 
                  dataKey="weekStart" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="totalCalls"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="Total Calls"
                />
                <Bar
                  dataKey="interestedCalls"
                  fill="hsl(var(--success))"
                  radius={[4, 4, 0, 0]}
                  name="Interested"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Rate Trend</CardTitle>
            <CardDescription>Weekly conversion % over the last 4 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <LineChart data={weeklyHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis 
                  dataKey="weekStart" 
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="conversionRate"
                  stroke="hsl(var(--warning))"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(var(--warning))' }}
                  name="Conversion %"
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This Week's Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Interested</span>
                <span className="font-medium">{currentWeek.interestedCalls} calls</span>
              </div>
              <Progress 
                value={currentWeek.totalCalls > 0 ? (currentWeek.interestedCalls / currentWeek.totalCalls) * 100 : 0} 
                className="h-2 [&>div]:bg-success"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Not Interested</span>
                <span className="font-medium">{currentWeek.notInterestedCalls} calls</span>
              </div>
              <Progress 
                value={currentWeek.totalCalls > 0 ? (currentWeek.notInterestedCalls / currentWeek.totalCalls) * 100 : 0} 
                className="h-2 [&>div]:bg-destructive"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Not Answered</span>
                <span className="font-medium">{currentWeek.notAnsweredCalls} calls</span>
              </div>
              <Progress 
                value={currentWeek.totalCalls > 0 ? (currentWeek.notAnsweredCalls / currentWeek.totalCalls) * 100 : 0} 
                className="h-2 [&>div]:bg-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">{currentWeek.activeDays}</span>
                <span className="text-muted-foreground"> active days</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">{currentWeek.avgCallsPerDay}</span>
                <span className="text-muted-foreground"> avg calls/day</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights Section */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="w-5 h-5 text-warning" />
              Insights & Recommendations
            </CardTitle>
            <CardDescription>Personalized insights based on your performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
