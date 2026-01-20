import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  PhoneOff, 
  Coffee, 
  Utensils, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { format, differenceInMinutes, parseISO, isToday } from 'date-fns';

// Break schedule configuration
const BREAK_SCHEDULE = {
  break1: { start: '11:30', end: '11:45', label: 'Break' },
  lunch: { start: '13:15', end: '14:15', label: 'Lunch' },
  break2: { start: '16:15', end: '16:30', label: 'Break' },
  workEnd: '19:00',
  workStart: '09:00',
};

// Convert time string to minutes from midnight
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if current time is within a break
const isOnBreak = (now: Date): { onBreak: boolean; breakLabel: string } => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const break1Start = timeToMinutes(BREAK_SCHEDULE.break1.start);
  const break1End = timeToMinutes(BREAK_SCHEDULE.break1.end);
  if (currentMinutes >= break1Start && currentMinutes < break1End) {
    return { onBreak: true, breakLabel: BREAK_SCHEDULE.break1.label };
  }
  
  const lunchStart = timeToMinutes(BREAK_SCHEDULE.lunch.start);
  const lunchEnd = timeToMinutes(BREAK_SCHEDULE.lunch.end);
  if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) {
    return { onBreak: true, breakLabel: BREAK_SCHEDULE.lunch.label };
  }
  
  const break2Start = timeToMinutes(BREAK_SCHEDULE.break2.start);
  const break2End = timeToMinutes(BREAK_SCHEDULE.break2.end);
  if (currentMinutes >= break2Start && currentMinutes < break2End) {
    return { onBreak: true, breakLabel: BREAK_SCHEDULE.break2.label };
  }
  
  return { onBreak: false, breakLabel: '' };
};

// Check if within working hours
const isWithinWorkHours = (now: Date): boolean => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const workStart = timeToMinutes(BREAK_SCHEDULE.workStart);
  const workEnd = timeToMinutes(BREAK_SCHEDULE.workEnd);
  return currentMinutes >= workStart && currentMinutes < workEnd;
};

// Calculate total working minutes (excluding breaks)
const getTotalWorkMinutes = (): number => {
  const workStart = timeToMinutes(BREAK_SCHEDULE.workStart);
  const workEnd = timeToMinutes(BREAK_SCHEDULE.workEnd);
  const totalMinutes = workEnd - workStart;
  
  // Subtract breaks (15 + 60 + 15 = 90 minutes)
  const breakMinutes = 90;
  return totalMinutes - breakMinutes;
};

// Calculate elapsed working minutes (excluding breaks)
const getElapsedWorkMinutes = (now: Date): number => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const workStart = timeToMinutes(BREAK_SCHEDULE.workStart);
  const workEnd = timeToMinutes(BREAK_SCHEDULE.workEnd);
  
  if (currentMinutes < workStart) return 0;
  if (currentMinutes >= workEnd) return getTotalWorkMinutes();
  
  let elapsed = currentMinutes - workStart;
  
  // Subtract completed breaks
  const break1Start = timeToMinutes(BREAK_SCHEDULE.break1.start);
  const break1End = timeToMinutes(BREAK_SCHEDULE.break1.end);
  if (currentMinutes >= break1End) elapsed -= 15;
  else if (currentMinutes > break1Start) elapsed -= (currentMinutes - break1Start);
  
  const lunchStart = timeToMinutes(BREAK_SCHEDULE.lunch.start);
  const lunchEnd = timeToMinutes(BREAK_SCHEDULE.lunch.end);
  if (currentMinutes >= lunchEnd) elapsed -= 60;
  else if (currentMinutes > lunchStart) elapsed -= (currentMinutes - lunchStart);
  
  const break2Start = timeToMinutes(BREAK_SCHEDULE.break2.start);
  const break2End = timeToMinutes(BREAK_SCHEDULE.break2.end);
  if (currentMinutes >= break2End) elapsed -= 15;
  else if (currentMinutes > break2Start) elapsed -= (currentMinutes - break2Start);
  
  return Math.max(0, elapsed);
};

export interface AgentActivity {
  agentId: string;
  agentName: string;
  username: string;
  lastCallTime: string | null;
  todayCalls: number;
  todayInterested: number;
  isActive: boolean;
}

interface AgentActivityMonitorProps {
  agents: AgentActivity[];
  isLoading: boolean;
}

type ActivityStatus = 'calling' | 'idle' | 'on_break' | 'inactive' | 'off_hours';

const getAgentStatus = (agent: AgentActivity, now: Date): ActivityStatus => {
  const { onBreak } = isOnBreak(now);
  
  if (!isWithinWorkHours(now)) {
    return 'off_hours';
  }
  
  if (onBreak) {
    return 'on_break';
  }
  
  if (!agent.lastCallTime) {
    return 'inactive';
  }
  
  const lastCall = parseISO(agent.lastCallTime);
  if (!isToday(lastCall)) {
    return 'inactive';
  }
  
  const minutesSinceLastCall = differenceInMinutes(now, lastCall);
  
  if (minutesSinceLastCall <= 10) {
    return 'calling';
  } else if (minutesSinceLastCall <= 30) {
    return 'idle';
  } else {
    return 'inactive';
  }
};

const getStatusConfig = (status: ActivityStatus) => {
  switch (status) {
    case 'calling':
      return {
        label: 'Calling',
        icon: Phone,
        color: 'bg-success/10 text-success border-success/20',
        bgColor: 'bg-success/5',
        dotColor: 'bg-success animate-pulse',
      };
    case 'idle':
      return {
        label: 'Idle',
        icon: Clock,
        color: 'bg-warning/10 text-warning border-warning/20',
        bgColor: 'bg-warning/5',
        dotColor: 'bg-warning',
      };
    case 'on_break':
      return {
        label: 'On Break',
        icon: Coffee,
        color: 'bg-info/10 text-info border-info/20',
        bgColor: 'bg-info/5',
        dotColor: 'bg-info',
      };
    case 'inactive':
      return {
        label: 'Inactive',
        icon: AlertTriangle,
        color: 'bg-destructive/10 text-destructive border-destructive/20',
        bgColor: 'bg-destructive/5',
        dotColor: 'bg-destructive',
      };
    case 'off_hours':
      return {
        label: 'Off Hours',
        icon: PhoneOff,
        color: 'bg-muted text-muted-foreground',
        bgColor: 'bg-muted/50',
        dotColor: 'bg-muted-foreground',
      };
  }
};

export const AgentActivityMonitor: React.FC<AgentActivityMonitorProps> = ({ agents, isLoading }) => {
  const [now, setNow] = React.useState(new Date());
  
  // Update current time every minute
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const { onBreak, breakLabel } = isOnBreak(now);
  const withinWorkHours = isWithinWorkHours(now);
  const elapsedMinutes = getElapsedWorkMinutes(now);
  const totalMinutes = getTotalWorkMinutes();
  const progressPercent = (elapsedMinutes / totalMinutes) * 100;
  
  // Calculate status counts
  const statusCounts = agents.reduce((acc, agent) => {
    const status = getAgentStatus(agent, now);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<ActivityStatus, number>);
  
  // Sort agents by status priority: inactive first (need attention), then idle, then calling
  const sortedAgents = [...agents].sort((a, b) => {
    const statusOrder: Record<ActivityStatus, number> = {
      inactive: 0,
      idle: 1,
      calling: 2,
      on_break: 3,
      off_hours: 4,
    };
    const statusA = getAgentStatus(a, now);
    const statusB = getAgentStatus(b, now);
    return statusOrder[statusA] - statusOrder[statusB];
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Activity Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Live Activity Monitor
            </CardTitle>
            <CardDescription className="mt-1">
              Real-time agent calling activity • Updated {format(now, 'HH:mm')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onBreak && (
              <Badge className="bg-info/10 text-info border-info/20 gap-1">
                <Utensils className="w-3 h-3" />
                {breakLabel} Time
              </Badge>
            )}
            {!withinWorkHours && (
              <Badge variant="secondary">
                <PhoneOff className="w-3 h-3 mr-1" />
                Off Hours
              </Badge>
            )}
          </div>
        </div>
        
        {/* Work day progress */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Work Day Progress</span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>9:00 AM</span>
            <div className="flex gap-4">
              <span>Break 11:30</span>
              <span>Lunch 1:15</span>
              <span>Break 4:15</span>
            </div>
            <span>7:00 PM</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <Phone className="w-4 h-4 text-success" />
            <div>
              <p className="text-2xl font-bold text-success">{statusCounts.calling || 0}</p>
              <p className="text-xs text-success/80">Calling</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="w-4 h-4 text-warning" />
            <div>
              <p className="text-2xl font-bold text-warning">{statusCounts.idle || 0}</p>
              <p className="text-xs text-warning/80">Idle</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{statusCounts.inactive || 0}</p>
              <p className="text-xs text-destructive/80">Inactive</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
            <Coffee className="w-4 h-4 text-info" />
            <div>
              <p className="text-2xl font-bold text-info">{statusCounts.on_break || 0}</p>
              <p className="text-xs text-info/80">On Break</p>
            </div>
          </div>
        </div>
        
        {/* Agent list */}
        <div className="space-y-2">
          {sortedAgents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No agents found</p>
            </div>
          ) : (
            sortedAgents.map((agent) => {
              const status = getAgentStatus(agent, now);
              const config = getStatusConfig(status);
              const StatusIcon = config.icon;
              
              const lastCallFormatted = agent.lastCallTime && isToday(parseISO(agent.lastCallTime))
                ? format(parseISO(agent.lastCallTime), 'HH:mm')
                : agent.lastCallTime
                ? format(parseISO(agent.lastCallTime), 'MMM d, HH:mm')
                : 'No calls';
              
              const minutesSinceCall = agent.lastCallTime
                ? differenceInMinutes(now, parseISO(agent.lastCallTime))
                : null;
              
              return (
                <div
                  key={agent.agentId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${config.bgColor}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {agent.agentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${config.dotColor}`} />
                    </div>
                    <div>
                      <div className="font-medium">{agent.agentName}</div>
                      <div className="text-xs text-muted-foreground">@{agent.username}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <div className="text-sm font-medium">{agent.todayCalls} calls</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.todayInterested} interested
                      </div>
                    </div>
                    
                    <div className="text-right min-w-[80px]">
                      <div className="text-xs text-muted-foreground">Last call</div>
                      <div className="text-sm font-medium">{lastCallFormatted}</div>
                      {minutesSinceCall !== null && minutesSinceCall > 0 && isToday(parseISO(agent.lastCallTime!)) && (
                        <div className="text-xs text-muted-foreground">
                          {minutesSinceCall}m ago
                        </div>
                      )}
                    </div>
                    
                    <Badge className={`${config.color} gap-1 min-w-[90px] justify-center`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
