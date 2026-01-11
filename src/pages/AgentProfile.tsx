import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentProfile } from '@/hooks/useAgentProfile';
import { useAgentGoals } from '@/hooks/useAgentGoals';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  BarChart, 
  Bar,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { 
  User, 
  Phone, 
  Target, 
  TrendingUp, 
  Award, 
  Calendar,
  Flame,
  Trophy,
  Medal,
  Star,
  Zap,
  Crown,
  BarChart3,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { PerformanceCertificate } from '@/components/profile/PerformanceCertificate';
import { AchievementGrid } from '@/components/profile/AchievementGrid';
import { WeeklyReport } from '@/components/profile/WeeklyReport';
import { GoalTracker } from '@/components/profile/GoalTracker';
import { StreakMilestones } from '@/components/profile/StreakMilestones';
import { LoginStreakReminderBanner } from '@/components/profile/LoginStreakReminderBanner';
import { LoginStreakMilestones } from '@/components/profile/LoginStreakMilestones';
import { MyPerformanceAlerts } from '@/components/profile/MyPerformanceAlerts';

const chartConfig = {
  calls: { label: 'Calls', color: 'hsl(var(--primary))' },
  interested: { label: 'Interested', color: 'hsl(var(--success))' },
  leads: { label: 'Leads', color: 'hsl(var(--info))' },
  conversionRate: { label: 'Conversion %', color: 'hsl(var(--warning))' },
};

export const AgentProfile: React.FC = () => {
  const { profile: authProfile } = useAuth();
  const { 
    profile, 
    profileStats, 
    monthlyPerformance, 
    dailyPerformance,
    earnedAchievements,
    inProgressAchievements,
    isLoading 
  } = useAgentProfile();
  const { streaks } = useAgentGoals();
  const { streakData } = useLoginStreak();
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-48 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const initials = authProfile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'AG';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Login Streak Reminder Banner */}
      {streakData && (
        <LoginStreakReminderBanner
          currentStreak={streakData.currentStreak}
          lastLoginDate={streakData.lastLoginDate}
          isNewDay={streakData.isNewDay}
        />
      )}

      {/* Profile Header */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="h-32 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
        <CardContent className="relative pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
            <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
              <AvatarImage src={authProfile?.avatar_url || ''} />
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">{authProfile?.full_name || 'Agent'}</h1>
                  <p className="text-muted-foreground">@{authProfile?.username}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    <Trophy className="w-4 h-4 mr-2" />
                    Rank #{profileStats.rank}
                  </Badge>
                  {profileStats.currentStreak > 0 && (
                    <Badge className="text-lg px-4 py-1 bg-warning text-warning-foreground">
                      <Flame className="w-4 h-4 mr-2" />
                      {profileStats.currentStreak} Day Streak
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Member since {authProfile?.created_at ? format(new Date(authProfile.created_at), 'MMMM yyyy') : 'N/A'}
                {' · '}{profileStats.daysActive} days active
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-3xl font-bold">{profileStats.totalCallsAllTime.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Phone className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Interested</p>
                <p className="text-3xl font-bold">{profileStats.totalInterestedAllTime.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-full bg-success/10">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads Generated</p>
                <p className="text-3xl font-bold">{profileStats.totalLeadsAllTime.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-full bg-info/10">
                <Target className="w-6 h-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Conversion</p>
                <p className="text-3xl font-bold">{profileStats.averageConversionRate}%</p>
              </div>
              <div className="p-3 rounded-full bg-warning/10">
                <Zap className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      <MyPerformanceAlerts />

      {/* Performance Charts */}
      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="monthly" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Monthly Trend
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-2">
            <Activity className="w-4 h-4" />
            Daily Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>6-Month Performance</CardTitle>
              <CardDescription>Your performance trend over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <ComposedChart data={monthlyPerformance} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monthlyCallsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#monthlyCallsGradient)"
                    name="Calls"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="interested"
                    fill="hsl(var(--success))"
                    radius={[4, 4, 0, 0]}
                    name="Interested"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="leads"
                    fill="hsl(var(--info))"
                    radius={[4, 4, 0, 0]}
                    name="Leads"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="conversionRate"
                    stroke="hsl(var(--warning))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: 'hsl(var(--warning))' }}
                    name="Conversion %"
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>30-Day Activity</CardTitle>
              <CardDescription>Your daily call activity over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <AreaChart data={dailyPerformance} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dailyCallsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="dailyInterestedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
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
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#dailyCallsGradient)"
                    name="Total Calls"
                  />
                  <Area
                    type="monotone"
                    dataKey="interested"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    fill="url(#dailyInterestedGradient)"
                    name="Interested"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Goal Tracker */}
      <GoalTracker />

      {/* Login Streak Milestones */}
      {streakData && (
        <LoginStreakMilestones 
          currentStreak={streakData.currentStreak}
          longestStreak={streakData.longestStreak}
        />
      )}

      {/* Goal Streak Milestones */}
      <StreakMilestones streaks={streaks} />

      {/* Weekly Performance Report */}
      <WeeklyReport />

      {/* Achievements Section with Sharing */}
      <AchievementGrid
        earnedAchievements={earnedAchievements}
        inProgressAchievements={inProgressAchievements}
        agentName={authProfile?.full_name || 'Agent'}
      />

      {/* Performance Certificate */}
      <PerformanceCertificate
        data={{
          agentName: authProfile?.full_name || 'Agent',
          totalCalls: profileStats.totalCallsAllTime,
          totalInterested: profileStats.totalInterestedAllTime,
          totalLeads: profileStats.totalLeadsAllTime,
          conversionRate: profileStats.averageConversionRate,
          rank: profileStats.rank,
          totalAgents: profileStats.totalAgents,
          daysActive: profileStats.daysActive,
          earnedAchievements: earnedAchievements.length,
          bestDay: profileStats.bestDay,
          longestStreak: profileStats.longestStreak,
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Flame className="w-8 h-8 mx-auto mb-2 text-warning" />
            <p className="text-2xl font-bold">{profileStats.longestStreak}</p>
            <p className="text-sm text-muted-foreground">Longest Streak</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-info" />
            <p className="text-2xl font-bold">{profileStats.daysActive}</p>
            <p className="text-sm text-muted-foreground">Days Active</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{profileStats.bestDay?.calls || 0}</p>
            <p className="text-sm text-muted-foreground">Best Day</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Crown className="w-8 h-8 mx-auto mb-2 text-warning" />
            <p className="text-2xl font-bold">#{profileStats.rank}</p>
            <p className="text-sm text-muted-foreground">of {profileStats.totalAgents} agents</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};