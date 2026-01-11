import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Trophy,
  Medal,
  Award,
  Crown,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useTalkTimeLeaderboard, TimePeriod, TalkTimeAgent, TeamTalkTimeStats } from '@/hooks/useTalkTimeLeaderboard';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { cn } from '@/lib/utils';

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg">
        <Crown className="w-4 h-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow">
        <Medal className="w-4 h-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow">
        <Award className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-sm">
      {rank}
    </div>
  );
};

const TrendIndicator: React.FC<{ trend: TalkTimeAgent['trend'] }> = ({ trend }) => {
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
        <ArrowUp className="w-3 h-3" />
      </Badge>
    );
  }
  if (trend === 'down') {
    return (
      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
        <ArrowDown className="w-3 h-3" />
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      <Minus className="w-3 h-3" />
    </Badge>
  );
};

const TopThreeCards: React.FC<{ agents: TalkTimeAgent[] }> = ({ agents }) => {
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
          <div className={cn('absolute inset-0 bg-gradient-to-b opacity-50', getGradient(index + 1))} />
          <CardContent className="relative pt-6 text-center">
            <div className="mb-3 flex justify-center">
              <RankBadge rank={index + 1} />
            </div>
            <Avatar className="w-14 h-14 mx-auto mb-2 ring-4 ring-background shadow-xl">
              <AvatarImage src={agent.avatarUrl || ''} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {agent.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-bold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">@{agent.username}</p>

            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xl font-bold">{formatDuration(agent.talkTimeMinutes)}</span>
            </div>
            {agent.teamName && (
              <Badge variant="outline" className="mt-2 text-xs">
                {agent.teamName}
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const TeamComparisonCard: React.FC<{ teams: TeamTalkTimeStats[] }> = ({ teams }) => {
  if (teams.length === 0) return null;

  const maxTalkTime = Math.max(...teams.map(t => t.totalTalkTime), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-primary" />
          Team Talk Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {teams.map((team, index) => (
          <div key={team.teamId} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium w-5">#{index + 1}</span>
                <span className="font-medium">{team.teamName}</span>
                <Badge variant="outline" className="text-xs">
                  {team.agentCount} agents
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="font-medium text-foreground">{formatDuration(team.totalTalkTime)}</span>
                <span className="text-xs">avg: {formatDuration(team.avgTalkTime)}</span>
              </div>
            </div>
            <Progress value={(team.totalTalkTime / maxTalkTime) * 100} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const TalkTimeLeaderboard: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_week');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const { teams } = useTeamManagement();
  const { agents, teamStats, isLoading } = useTalkTimeLeaderboard({
    timePeriod,
    teamFilter: teamFilter === 'all' ? null : teamFilter,
  });

  const getTimePeriodLabel = (period: TimePeriod) => {
    const labels: Record<TimePeriod, string> = {
      today: 'Today',
      this_week: 'This Week',
      last_week: 'Last Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      all_time: 'All Time',
    };
    return labels[period];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const agentsWithTime = agents.filter(a => a.talkTimeMinutes > 0);
  const maxTalkTime = Math.max(...agentsWithTime.map(a => a.talkTimeMinutes), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Talk Time Leaderboard
            </CardTitle>
            <CardDescription>Top performers by talk time</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="agents">
          <TabsList className="mb-4">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          <TabsContent value="agents">
            {agentsWithTime.length > 0 && <TopThreeCards agents={agentsWithTime} />}

            {agentsWithTime.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No talk time recorded</p>
                <p className="text-sm mt-1">
                  Talk time data for {getTimePeriodLabel(timePeriod).toLowerCase()} will appear here
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Talk Time</TableHead>
                    <TableHead className="w-32">Progress</TableHead>
                    <TableHead className="w-16">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.slice(0, 20).map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <RankBadge rank={agent.rank} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={agent.avatarUrl || ''} />
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {agent.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">@{agent.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {agent.teamName ? (
                          <Badge variant="outline" className="text-xs">
                            {agent.teamName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatDuration(agent.talkTimeMinutes)}
                      </TableCell>
                      <TableCell>
                        <Progress
                          value={(agent.talkTimeMinutes / maxTalkTime) * 100}
                          className="h-2"
                        />
                      </TableCell>
                      <TableCell>
                        <TrendIndicator trend={agent.trend} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="teams">
            {teamStats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No team data available</p>
              </div>
            ) : (
              <TeamComparisonCard teams={teamStats} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
