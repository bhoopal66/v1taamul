import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserCheck,
  UserX,
  MapPin,
  LogOut,
  AlertTriangle,
  Coffee,
  Clock,
  Play,
  XCircle,
  Phone,
  Users,
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { AgentWorkingStatus, TeamWorkingStats } from '@/hooks/useTeamWorkingStatus';
import { cn } from '@/lib/utils';

interface TeamWorkingStatusPanelProps {
  teamStatus: AgentWorkingStatus[];
  stats: TeamWorkingStats;
  isLoading: boolean;
}

const ACTIVITY_LABELS: Record<string, string> = {
  data_collection: 'Data Collection',
  calling: 'Calling',
  followup: 'Follow-up',
  meeting_in_office: 'Meeting In Office',
  market_visit: 'Market Visit',
  others: 'Others',
  break: 'Break',
};

const getReasonBadge = (status: AgentWorkingStatus) => {
  if (status.isWorking) {
    if (status.currentActivity === 'break') {
      return { label: 'On Break', icon: Coffee, variant: 'info' as const };
    }
    return { label: 'Working', icon: UserCheck, variant: 'success' as const };
  }

  // Not working - determine reason
  const endReason = status.endReason || '';
  
  // Check for 5-minute auto-logout first
  if (endReason.startsWith('auto_logout_5min_')) {
    const activityType = endReason.replace('auto_logout_5min_', '');
    const label = activityType === 'calling_telecalling' 
      ? 'Auto Logout – Cold Calling (5 min rule)'
      : 'Auto Logout – Client Meeting (5 min rule)';
    return { label, icon: Phone, variant: 'destructive' as const };
  }

  switch (endReason) {
    case 'auto_logout_missed_confirmations':
      return { label: 'Auto Logout – Missed Confirmations', icon: AlertTriangle, variant: 'destructive' as const };
    case 'market_visit':
      return { label: 'Market Visit Logout', icon: MapPin, variant: 'warning' as const };
    case 'manual_logout':
      return { label: 'Manual Logout', icon: LogOut, variant: 'secondary' as const };
    case 'end_of_day':
      return { label: 'End of Day', icon: Clock, variant: 'secondary' as const };
    default:
      if (!status.sessionStartTime) {
        return { label: 'Logged in – Not Started', icon: Users, variant: 'muted' as const };
      }
      return { label: 'Not Working', icon: UserX, variant: 'destructive' as const };
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const TeamWorkingStatusPanel: React.FC<TeamWorkingStatusPanelProps> = ({
  teamStatus,
  stats,
  isLoading,
}) => {
  // Sort: working first, then by name
  const sortedStatus = [...teamStatus].sort((a, b) => {
    if (a.isWorking && !b.isWorking) return -1;
    if (!a.isWorking && b.isWorking) return 1;
    return a.fullName.localeCompare(b.fullName);
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{stats.working}</p>
                <p className="text-xs text-muted-foreground">Working</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.notWorking}</p>
                <p className="text-xs text-muted-foreground">Not Working</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-info/20 bg-info/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-info" />
              <div>
                <p className="text-2xl font-bold text-info">{stats.onBreak}</p>
                <p className="text-xs text-muted-foreground">On Break</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted bg-muted/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{stats.loggedInNotStarted}</p>
                <p className="text-xs text-muted-foreground">Logged In – Not Started</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.fiveMinAutoLogout}</p>
                <p className="text-xs text-muted-foreground">5-Min Auto Logout</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.autoLogout}</p>
                <p className="text-xs text-muted-foreground">Auto Logout</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{stats.marketVisit}</p>
                <p className="text-xs text-muted-foreground">Market Visit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 bg-secondary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-secondary-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.manualLogout}</p>
                <p className="text-xs text-muted-foreground">Manual Logout</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Working Status
            <Badge variant="outline" className="ml-2">
              {teamStatus.length} agents
            </Badge>
          </CardTitle>
          <CardDescription>
            Real-time working/not-working status with reason flags • Updates every 15 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-2">
              {sortedStatus.map((agent) => (
                <AgentStatusRow key={agent.userId} agent={agent} />
              ))}
              {sortedStatus.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No team members found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

interface AgentStatusRowProps {
  agent: AgentWorkingStatus;
}

const AgentStatusRow: React.FC<AgentStatusRowProps> = ({ agent }) => {
  const reasonInfo = getReasonBadge(agent);
  const ReasonIcon = reasonInfo.icon;

  // Calculate activity duration if working
  const activityDuration = agent.currentActivityStartedAt
    ? differenceInMinutes(new Date(), new Date(agent.currentActivityStartedAt))
    : 0;

  const sessionDuration = agent.sessionStartTime
    ? differenceInMinutes(new Date(), new Date(agent.sessionStartTime))
    : 0;

  const getBadgeClasses = (variant: string) => {
    switch (variant) {
      case 'success':
        return 'bg-success/10 text-success border-success/20';
      case 'destructive':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'info':
        return 'bg-info/10 text-info border-info/20';
      case 'muted':
        return 'bg-muted text-muted-foreground border-muted';
      default:
        return 'bg-secondary text-secondary-foreground border-secondary/20';
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border transition-all',
        agent.isWorking
          ? 'border-success/20 bg-success/5'
          : agent.endReason === 'auto_logout_missed_confirmations'
          ? 'border-destructive/30 bg-destructive/5'
          : agent.endReason === 'market_visit'
          ? 'border-warning/30 bg-warning/5'
          : 'border-border'
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={agent.avatarUrl || undefined} />
        <AvatarFallback>{getInitials(agent.fullName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{agent.fullName}</span>
          {agent.missedConfirmations > 0 && agent.isWorking && (
            <Badge variant="destructive" className="text-xs">
              {agent.missedConfirmations} missed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>@{agent.username}</span>
          {agent.isWorking && agent.currentActivity && (
            <>
              <span>•</span>
              <span className="text-primary">
                {ACTIVITY_LABELS[agent.currentActivity] || agent.currentActivity}
                {activityDuration > 0 && ` (${activityDuration}m)`}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Session duration if started */}
        {agent.sessionStartTime && (
          <div className="text-right hidden md:block">
            <p className="text-xs text-muted-foreground">Started</p>
            <p className="text-sm font-medium">
              {format(new Date(agent.sessionStartTime), 'HH:mm')}
            </p>
          </div>
        )}

        {/* Status Badge */}
        <Badge variant="outline" className={cn('gap-1 min-w-[140px] justify-center', getBadgeClasses(reasonInfo.variant))}>
          <ReasonIcon className="w-3.5 h-3.5" />
          <span className="truncate">{reasonInfo.label}</span>
        </Badge>
      </div>
    </div>
  );
};
