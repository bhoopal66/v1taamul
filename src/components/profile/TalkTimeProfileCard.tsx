import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Clock, TrendingUp, Target, Calendar, Award, Flame } from 'lucide-react';
import { useTalkTime } from '@/hooks/useTalkTime';
import { useAgentGoals } from '@/hooks/useAgentGoals';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const chartConfig = {
  talkTime: { label: 'Talk Time', color: 'hsl(var(--primary))' },
};

interface DailyTalkTime {
  date: string;
  minutes: number;
}

interface MonthlyTalkTime {
  month: string;
  minutes: number;
  avgPerDay: number;
}

export const TalkTimeProfileCard: React.FC = () => {
  const { user } = useAuth();
  const { todayTalkTime, recentEntries, monthlyTotal, isLoading } = useTalkTime();
  const { goals } = useAgentGoals();

  // Get talk time goals
  const talkTimeGoals = goals.filter(g => g.metric === 'talk_time');
  const activeGoal = talkTimeGoals.find(g => !g.isCompleted);

  // Fetch extended historical data (30 days)
  const { data: dailyTalkTime } = useQuery({
    queryKey: ['talk-time-daily-30', user?.id],
    queryFn: async (): Promise<DailyTalkTime[]> => {
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('agent_talk_time')
        .select('date, talk_time_minutes')
        .eq('agent_id', user!.id)
        .gte('date', startDate)
        .order('date', { ascending: true });

      if (error) throw error;

      // Create a map of all 30 days
      const dailyMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dateStr = format(day, 'yyyy-MM-dd');
        dailyMap.set(dateStr, 0);
      }

      // Fill in actual data
      data?.forEach(entry => {
        dailyMap.set(entry.date, entry.talk_time_minutes);
      });

      return Array.from(dailyMap.entries()).map(([date, minutes]) => ({
        date: format(new Date(date), 'MMM d'),
        minutes,
      }));
    },
    enabled: !!user,
  });

  // Fetch monthly talk time (last 6 months)
  const { data: monthlyTalkTime } = useQuery({
    queryKey: ['talk-time-monthly-6', user?.id],
    queryFn: async (): Promise<MonthlyTalkTime[]> => {
      const months: MonthlyTalkTime[] = [];
      const today = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(today, i);
        const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('agent_talk_time')
          .select('talk_time_minutes')
          .eq('agent_id', user!.id)
          .gte('date', start)
          .lte('date', end);

        if (error) throw error;

        const totalMinutes = data?.reduce((sum, entry) => sum + entry.talk_time_minutes, 0) || 0;
        const daysInMonth = data?.length || 1;

        months.push({
          month: format(monthDate, 'MMM'),
          minutes: totalMinutes,
          avgPerDay: Math.round(totalMinutes / daysInMonth),
        });
      }

      return months;
    },
    enabled: !!user,
  });

  // Calculate stats
  const totalAllTime = monthlyTalkTime?.reduce((sum, m) => sum + m.minutes, 0) || 0;
  const avgDaily = dailyTalkTime && dailyTalkTime.length > 0
    ? Math.round(dailyTalkTime.reduce((sum, d) => sum + d.minutes, 0) / dailyTalkTime.filter(d => d.minutes > 0).length) || 0
    : 0;
  const bestDay = dailyTalkTime?.reduce((best, current) => 
    current.minutes > (best?.minutes || 0) ? current : best, 
    dailyTalkTime[0]
  );
  const activeDays = dailyTalkTime?.filter(d => d.minutes > 0).length || 0;

  // Calculate streak
  const calculateStreak = () => {
    if (!dailyTalkTime) return 0;
    const reversed = [...dailyTalkTime].reverse();
    let streak = 0;
    for (const day of reversed) {
      if (day.minutes > 0) streak++;
      else break;
    }
    return streak;
  };
  const currentStreak = calculateStreak();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Talk Time Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{todayTalkTime?.talk_time_minutes || 0} min</p>
              </div>
              <Clock className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{monthlyTotal} min</p>
              </div>
              <Calendar className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily Avg</p>
                <p className="text-2xl font-bold">{avgDaily} min</p>
              </div>
              <TrendingUp className="w-6 h-6 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Best Day</p>
                <p className="text-2xl font-bold">{bestDay?.minutes || 0} min</p>
              </div>
              <Award className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{currentStreak} days</p>
              </div>
              <Flame className="w-6 h-6 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Goal Progress */}
      {activeGoal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Active Talk Time Goal
                </CardTitle>
                <CardDescription>
                  {activeGoal.goal_type === 'weekly' ? 'Weekly' : 'Monthly'} Target: {activeGoal.target_value} minutes
                </CardDescription>
              </div>
              <Badge variant={activeGoal.progressPercentage >= 100 ? 'default' : 'secondary'}>
                {Math.round(activeGoal.progressPercentage)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{activeGoal.currentValue} / {activeGoal.target_value} minutes</span>
                <span>{activeGoal.daysRemaining} days left</span>
              </div>
              <Progress value={Math.min(activeGoal.progressPercentage, 100)} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Talk Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>30-Day Talk Time History</CardTitle>
          <CardDescription>Your daily talk time over the last 30 days ({activeDays} active days)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={dailyTalkTime || []} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="talkTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                tickLine={false} 
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent formatter={(value) => `${value} minutes`} />} 
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#talkTimeGradient)"
                name="Talk Time"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Talk Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>6-Month Talk Time Trend</CardTitle>
          <CardDescription>Your monthly talk time performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={monthlyTalkTime || []} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value, name, props) => {
                      const avgPerDay = props.payload?.avgPerDay || 0;
                      return (
                        <div className="space-y-1">
                          <p>{value} total minutes</p>
                          <p className="text-xs text-muted-foreground">~{avgPerDay} min/day avg</p>
                        </div>
                      );
                    }} 
                  />
                } 
              />
              <Bar
                dataKey="minutes"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                name="Talk Time"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Talk Time Entries</CardTitle>
            <CardDescription>Your last 7 days of recorded talk time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{format(new Date(entry.date), 'EEEE, MMM d')}</p>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg">
                    {entry.talk_time_minutes} min
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Talk Time Goals */}
      {talkTimeGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Talk Time Goals
            </CardTitle>
            <CardDescription>Track your talk time targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {talkTimeGoals.map((goal) => (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{goal.goal_type} Goal</span>
                      {goal.isCompleted && (
                        <Badge variant="default" className="bg-success">Completed</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {goal.currentValue} / {goal.target_value} min
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(goal.progressPercentage, 100)} 
                    className={`h-2 ${goal.isCompleted ? '[&>div]:bg-success' : ''}`} 
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
