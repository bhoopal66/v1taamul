import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Activity,
  Phone,
  Clock,
  AlertTriangle,
  Coffee,
  UserCheck,
  UserX,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { TeamMemberActivity } from '@/hooks/useTeamActivityMonitor';
import { CALLING_ACTIVITIES } from '@/hooks/useActivityMonitor';
import { cn } from '@/lib/utils';

interface TeamActivityMonitorProps {
  teamActivity: TeamMemberActivity[];
  teamStats: {
    total: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    activeCount: number;
    onBreakCount: number;
    idleCount: number;
    callingCount: number;
    totalIdleAlerts: number;
    lowDisciplineCount: number;
  };
  isLoading: boolean;
}

const ACTIVITY_LABELS: Record<string, string> = {
  data_collection: 'Data Collection',
  customer_followup: 'Customer Follow-up',
  calling_telecalling: 'Tele Calling',
  calling_coldcalling: 'Cold Calling',
  calling_calllist_movement: 'Call List Movement',
  client_meeting: 'Client Meeting',
  admin_documentation: 'Admin / Documentation',
  training: 'Training',
  system_bank_portal: 'System / Bank Portal',
  break: 'On Break',
  idle: 'Idle',
};

const getStatusColor = (activity: string | null | undefined): string => {
  if (!activity) return 'bg-muted text-muted-foreground';
  if (activity === 'idle') return 'bg-warning/10 text-warning border-warning/20';
  if (activity === 'break') return 'bg-info/10 text-info border-info/20';
  if (activity.startsWith('calling_')) return 'bg-success/10 text-success border-success/20';
  return 'bg-primary/10 text-primary border-primary/20';
};

const getStatusIcon = (activity: string | null | undefined) => {
  if (!activity || activity === 'idle') return <Clock className="w-4 h-4" />;
  if (activity === 'break') return <Coffee className="w-4 h-4" />;
  if (activity.startsWith('calling_')) return <Phone className="w-4 h-4" />;
  return <Activity className="w-4 h-4" />;
};

export const TeamActivityMonitor: React.FC<TeamActivityMonitorProps> = ({
  teamActivity,
  teamStats,
  isLoading,
}) => {
  // Sort by status: idle first, then by name
  const sortedActivity = useMemo(() => {
    return [...teamActivity].sort((a, b) => {
      const aIsIdle = !a.currentActivity || a.currentActivity.activity_type === 'idle';
      const bIsIdle = !b.currentActivity || b.currentActivity.activity_type === 'idle';
      if (aIsIdle && !bIsIdle) return -1;
      if (!aIsIdle && bIsIdle) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [teamActivity]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{teamStats.presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{teamStats.lateCount}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{teamStats.absentCount}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{teamStats.callingCount}</p>
                <p className="text-xs text-muted-foreground">Calling</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-info/20 bg-info/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-info" />
              <div>
                <p className="text-2xl font-bold text-info">{teamStats.onBreakCount}</p>
                <p className="text-xs text-muted-foreground">On Break</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{teamStats.idleCount}</p>
                <p className="text-xs text-muted-foreground">Idle</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discipline Warnings */}
      {teamStats.lowDisciplineCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-destructive">
              <Flame className="w-5 h-5" />
              <span className="font-medium">
                {teamStats.lowDisciplineCount} agent{teamStats.lowDisciplineCount > 1 ? 's' : ''} flagged for low discipline today
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Team Live Status
            <Badge variant="outline" className="ml-2">
              {teamActivity.length} members
            </Badge>
          </CardTitle>
          <CardDescription>
            Real-time activity tracking with timeline • Click on an agent to expand details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {sortedActivity.map((member) => (
                <AgentActivityCard key={member.userId} member={member} />
              ))}
              {sortedActivity.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
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

interface AgentActivityCardProps {
  member: TeamMemberActivity;
}

const AgentActivityCard: React.FC<AgentActivityCardProps> = ({ member }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const currentActivityType = member.currentActivity?.activity_type;
  const statusColor = getStatusColor(currentActivityType);
  const statusIcon = getStatusIcon(currentActivityType);
  const activityLabel = currentActivityType ? ACTIVITY_LABELS[currentActivityType] || currentActivityType : 'Offline';
  
  // Calculate duration of current activity
  const activityDuration = member.currentActivity?.started_at
    ? differenceInMinutes(new Date(), new Date(member.currentActivity.started_at))
    : 0;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'rounded-lg border p-4 transition-all',
          !member.currentActivity || member.currentActivity.activity_type === 'idle'
            ? 'border-warning/30 bg-warning/5'
            : 'border-border'
        )}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback>{getInitials(member.fullName)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{member.fullName}</span>
                {member.disciplineFlags > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <Flame className="w-3 h-3 mr-1" />
                    {member.disciplineFlags} flags
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{member.username}</span>
                {member.attendance?.is_late && (
                  <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                    Late by {member.attendance.late_by_minutes}m
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Calling Stats */}
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">
                  {Math.round(member.callingStats.totalCallingMinutes)}m calling
                </p>
                <div className="flex items-center gap-1">
                  <Progress
                    value={Math.min(member.callingStats.callListMovementPercentage, 100)}
                    className={cn(
                      'h-1.5 w-16',
                      member.callingStats.isCallListMovementOverCap && '[&>div]:bg-destructive'
                    )}
                  />
                  <span className={cn(
                    'text-xs',
                    member.callingStats.isCallListMovementOverCap ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {member.callingStats.callListMovementPercentage.toFixed(0)}% CLM
                  </span>
                </div>
              </div>

              {/* Current Status Badge */}
              <Badge variant="outline" className={cn('gap-1', statusColor)}>
                {statusIcon}
                {activityLabel}
                {activityDuration > 0 && (
                  <span className="ml-1 opacity-70">({activityDuration}m)</span>
                )}
              </Badge>

              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Today's Timeline
              </h4>
              {member.todayLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities logged today</p>
              ) : (
                <div className="space-y-2">
                  {member.todayLogs.slice(-5).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-16">
                        {format(new Date(log.started_at), 'HH:mm')}
                      </span>
                      <Badge variant="outline" className={getStatusColor(log.activity_type)}>
                        {ACTIVITY_LABELS[log.activity_type] || log.activity_type}
                      </Badge>
                      {log.duration_minutes && (
                        <span className="text-muted-foreground">
                          ({log.duration_minutes}m)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Idle Alerts */}
            {member.idleAlerts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  Idle Alerts Today
                </h4>
                <div className="space-y-1">
                  {member.idleAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center gap-2 text-sm text-warning">
                      <span>{format(new Date(alert.alert_time), 'HH:mm')}</span>
                      <span>Idle for {alert.idle_duration_minutes}m</span>
                      <Badge variant={alert.severity === 'discipline_flag' ? 'destructive' : 'outline'} className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance Summary */}
            {member.attendance && (
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div>
                  <span className="text-muted-foreground">First Login:</span>{' '}
                  <span className="font-medium">
                    {member.attendance.first_login
                      ? format(new Date(member.attendance.first_login), 'HH:mm')
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Work Time:</span>{' '}
                  <span className="font-medium">
                    {member.attendance.total_work_minutes || 0}m
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Daily Score:</span>{' '}
                  <Badge variant={
                    (member.attendance.daily_score || 0) >= 80 ? 'default' :
                    (member.attendance.daily_score || 0) >= 60 ? 'secondary' : 'destructive'
                  }>
                    {member.attendance.daily_score || 0}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
