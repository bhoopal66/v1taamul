import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  Target,
  Users,
  Crown,
  Sparkles,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useLeaderboard, TimePeriod, LeaderboardAgent, TeamStats } from '@/hooks/useLeaderboard';
import { cn } from '@/lib/utils';

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg">
        <Crown className="w-5 h-5" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow">
        <Medal className="w-5 h-5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow">
        <Award className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold">
      {rank}
    </div>
  );
};

const TrendIndicator: React.FC<{ trend: LeaderboardAgent['trend']; previousRank: number | null }> = ({ 
  trend, 
  previousRank 
}) => {
  if (trend === 'new') {
    return (
      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
        <Sparkles className="w-3 h-3 mr-1" />
        New
      </Badge>
    );
  }
  if (trend === 'up') {
    return (
      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
        <ArrowUp className="w-3 h-3 mr-1" />
        Up
      </Badge>
    );
  }
  if (trend === 'down') {
    return (
      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
        <ArrowDown className="w-3 h-3 mr-1" />
        Down
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      <Minus className="w-3 h-3 mr-1" />
      Same
    </Badge>
  );
};

const TopThreeCards: React.FC<{ agents: LeaderboardAgent[] }> = ({ agents }) => {
  const top3 = agents.slice(0, 3);
  
  if (top3.length === 0) return null;

  const getGradient = (rank: number) => {
    if (rank === 1) return 'from-yellow-400/20 via-amber-400/10 to-transparent border-yellow-400/50';
    if (rank === 2) return 'from-slate-300/20 via-slate-300/10 to-transparent border-slate-400/50';
    if (rank === 3) return 'from-amber-600/20 via-amber-600/10 to-transparent border-amber-600/50';
    return '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {top3.map((agent, index) => (
        <Card 
          key={agent.id} 
          className={cn(
            'relative overflow-hidden border-2',
            getGradient(index + 1),
            index === 0 && 'md:order-2 md:scale-105 md:z-10',
            index === 1 && 'md:order-1',
            index === 2 && 'md:order-3'
          )}
        >
          <div className={cn(
            'absolute inset-0 bg-gradient-to-b opacity-50',
            getGradient(index + 1)
          )} />
          <CardContent className="relative pt-6 text-center">
            <div className="mb-4">
              <RankBadge rank={index + 1} />
            </div>
            <Avatar className="w-16 h-16 mx-auto mb-3 ring-4 ring-background shadow-xl">
              <AvatarImage src={agent.avatarUrl || ''} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {agent.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-bold text-lg">{agent.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">@{agent.username}</p>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Calls</p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.interestedCalls}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conv.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const TeamComparisonCard: React.FC<{ teams: TeamStats[] }> = ({ teams }) => {
  if (teams.length === 0) return null;

  const maxCalls = Math.max(...teams.map(t => t.totalCalls), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team Comparison
        </CardTitle>
        <CardDescription>Compare performance across teams</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teams.map((team, index) => (
          <div key={team.supervisorId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm w-6">#{index + 1}</span>
                <span className="font-medium">{team.teamName}'s Team</span>
                <Badge variant="outline" className="text-xs">
                  {team.totalAgents} agents
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {team.totalCalls}
                </span>
                <span className="text-muted-foreground">
                  <Target className="w-3 h-3 inline mr-1" />
                  {team.totalLeads}
                </span>
                <Badge variant="secondary">{team.avgConversionRate}%</Badge>
              </div>
            </div>
            <Progress 
              value={(team.totalCalls / maxCalls) * 100} 
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const Leaderboard: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_week');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  
  const { agents, teamStats, totalAgents, periodLabel, isLoading } = useLeaderboard({
    timePeriod,
    teamFilter: teamFilter === 'all' ? null : teamFilter,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalAgents} agents ranked · {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="six_months">6 Months</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          {teamStats.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[160px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamStats.map(team => (
                  <SelectItem key={team.supervisorId} value={team.supervisorId}>
                    {team.teamName}'s Team
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Top 3 Showcase */}
      <TopThreeCards agents={agents} />

      {/* Tabs for Rankings and Teams */}
      <Tabs defaultValue="rankings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rankings" className="gap-2">
            <Medal className="w-4 h-4" />
            Full Rankings
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            Team Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>Full Rankings</CardTitle>
              <CardDescription>All agents ranked by call volume</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Interested</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => (
                      <TableRow 
                        key={agent.id}
                        className={cn(
                          agent.rank <= 3 && 'bg-muted/30'
                        )}
                      >
                        <TableCell>
                          <RankBadge rank={agent.rank} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={agent.avatarUrl || ''} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {agent.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                @{agent.username}
                                {agent.supervisorName && ` · ${agent.supervisorName}'s team`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <TrendIndicator trend={agent.trend} previousRank={agent.previousRank} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {agent.totalCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-success">{agent.interestedCalls}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-info">{agent.leadsGenerated}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={agent.conversionRate >= 25 ? 'default' : 'secondary'}
                            className={agent.conversionRate >= 25 ? 'bg-success' : ''}
                          >
                            {agent.conversionRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <TeamComparisonCard teams={teamStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
