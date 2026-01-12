import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  Users,
  Phone,
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
  Crown,
  Flame,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

export const TeamLeaderDashboard: React.FC = () => {
  const { profile, ledTeamId } = useAuth();
  const {
    teamInfo,
    teamMembers,
    teamStats,
    weeklyTrends,
    isLoading,
    isTeamLeader,
    refetch,
  } = useTeamLeaderData();

  if (!isTeamLeader) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This dashboard is only available to team leaders. You are not currently leading any team.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Sort members by performance
  const sortedMembers = [...teamMembers].sort((a, b) => b.totalCalls - a.totalCalls);
  const topPerformer = sortedMembers[0];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {teamStats.teamName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Team Leader Dashboard • {profile?.full_name}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.activeMembers}</p>
                <p className="text-xs text-muted-foreground">Active Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Phone className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalCallsToday}</p>
                <p className="text-xs text-muted-foreground">Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Target className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalLeadsToday}</p>
                <p className="text-xs text-muted-foreground">Leads Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.avgConversionRate}%</p>
                <p className="text-xs text-muted-foreground">Avg Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teamStats.totalTalkTimeToday}m</p>
                <p className="text-xs text-muted-foreground">Talk Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Top Performer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trends Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Performance Trends</CardTitle>
            <CardDescription>Team calls and leads over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalCalls"
                    name="Total Calls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="interested"
                    name="Interested"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(142, 76%, 36%)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke="hsl(45, 93%, 47%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(45, 93%, 47%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Performer Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Top Performer Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topPerformer ? (
              <div className="text-center space-y-4">
                <Avatar className="h-20 w-20 mx-auto">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(topPerformer.agentName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{topPerformer.agentName}</h3>
                  <p className="text-sm text-muted-foreground">@{topPerformer.username}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{topPerformer.totalCalls}</p>
                    <p className="text-xs text-muted-foreground">Calls</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{topPerformer.interested}</p>
                    <p className="text-xs text-muted-foreground">Interested</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{topPerformer.leadsGenerated}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan-500">{topPerformer.conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Conversion</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No activity yet today
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members Performance</CardTitle>
          <CardDescription>Today's performance for all team members</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No team members found
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMembers.map((member, index) => (
                <div
                  key={member.agentId}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                    index === 0 && "bg-amber-500/5 border-amber-500/20"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(member.agentName)}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <Crown className="absolute -top-1 -right-1 w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{member.agentName}</p>
                        {member.loginStreak > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="w-3 h-3" />
                            <span className="text-xs font-medium">{member.loginStreak}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">@{member.username}</p>
                    </div>
                  </div>

                  <div className="hidden sm:grid grid-cols-5 gap-6 text-center">
                    <div>
                      <p className="text-sm font-semibold">{member.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Calls</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-500">{member.interested}</p>
                      <p className="text-xs text-muted-foreground">Interested</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-500">{member.leadsGenerated}</p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cyan-500">{member.talkTimeMinutes}m</p>
                      <p className="text-xs text-muted-foreground">Talk Time</p>
                    </div>
                    <div>
                      <Badge
                        variant={member.conversionRate >= 20 ? 'default' : 'secondary'}
                        className={cn(
                          member.conversionRate >= 20 && 'bg-green-500 hover:bg-green-600'
                        )}
                      >
                        {member.conversionRate}%
                      </Badge>
                    </div>
                  </div>

                  {/* Mobile view */}
                  <div className="sm:hidden flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-sm font-semibold">{member.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Calls</p>
                    </div>
                    <Badge
                      variant={member.conversionRate >= 20 ? 'default' : 'secondary'}
                      className={cn(
                        member.conversionRate >= 20 && 'bg-green-500 hover:bg-green-600'
                      )}
                    >
                      {member.conversionRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Calls Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="totalCalls" name="Total Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interested" name="Interested" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Calls</span>
              <span className="font-semibold text-lg">{teamStats.weeklyCallsTotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Leads</span>
              <span className="font-semibold text-lg">{teamStats.weeklyLeadsTotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Daily Calls</span>
              <span className="font-semibold text-lg">
                {Math.round(teamStats.weeklyCallsTotal / 7)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Daily Leads</span>
              <span className="font-semibold text-lg">
                {(teamStats.weeklyLeadsTotal / 7).toFixed(1)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
