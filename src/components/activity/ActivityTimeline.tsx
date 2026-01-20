import React from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Phone, 
  Users, 
  FileText, 
  GraduationCap, 
  Monitor, 
  Coffee,
  Database,
  UserCheck,
  PhoneOutgoing,
  List,
  Play
} from 'lucide-react';
import { 
  ActivityLog, 
  ActivityType, 
  ACTIVITY_LABELS, 
  CALLING_ACTIVITIES 
} from '@/hooks/useActivityMonitor';
import { cn } from '@/lib/utils';

interface ActivityTimelineProps {
  logs: ActivityLog[];
  isLoading?: boolean;
  compact?: boolean;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  data_collection: <Database className="w-4 h-4" />,
  customer_followup: <UserCheck className="w-4 h-4" />,
  calling_telecalling: <Phone className="w-4 h-4" />,
  calling_coldcalling: <PhoneOutgoing className="w-4 h-4" />,
  calling_calllist_movement: <List className="w-4 h-4" />,
  client_meeting: <Users className="w-4 h-4" />,
  admin_documentation: <FileText className="w-4 h-4" />,
  training: <GraduationCap className="w-4 h-4" />,
  system_bank_portal: <Monitor className="w-4 h-4" />,
  break: <Coffee className="w-4 h-4" />,
  idle: <Clock className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  data_collection: 'bg-blue-500',
  customer_followup: 'bg-purple-500',
  calling_telecalling: 'bg-green-500',
  calling_coldcalling: 'bg-emerald-500',
  calling_calllist_movement: 'bg-teal-500',
  client_meeting: 'bg-indigo-500',
  admin_documentation: 'bg-gray-500',
  training: 'bg-yellow-500',
  system_bank_portal: 'bg-cyan-500',
  break: 'bg-amber-500',
  idle: 'bg-red-500',
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  logs,
  isLoading = false,
  compact = false,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-3 h-3 rounded-full bg-muted" />
                <div className="flex-1 h-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activity logged today</p>
            <p className="text-sm">Select an activity to start tracking</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Today's Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={compact ? "h-[200px]" : "h-[350px]"}>
          <div className="relative pl-6">
            {/* Timeline line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {logs.map((log, index) => {
                const isActive = !log.ended_at;
                const duration = log.duration_minutes || (isActive 
                  ? differenceInMinutes(new Date(), new Date(log.started_at))
                  : 0);
                
                return (
                  <div key={log.id} className="relative">
                    {/* Timeline dot */}
                    <div 
                      className={cn(
                        "absolute -left-6 w-3 h-3 rounded-full border-2 border-background",
                        ACTIVITY_COLORS[log.activity_type],
                        isActive && "ring-2 ring-primary ring-offset-2"
                      )}
                    />
                    
                    <div className={cn(
                      "p-3 rounded-lg border transition-colors",
                      isActive ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                    )}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded",
                            isActive ? "bg-primary/10" : "bg-muted"
                          )}>
                            {ACTIVITY_ICONS[log.activity_type]}
                          </div>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {ACTIVITY_LABELS[log.activity_type]}
                              {isActive && (
                                <Badge variant="default" className="text-xs animate-pulse">
                                  <Play className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                              {CALLING_ACTIVITIES.includes(log.activity_type) && (
                                <Badge variant="outline" className="text-xs">
                                  Calling
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(log.started_at), 'HH:mm')}
                              {log.ended_at && ` - ${format(new Date(log.ended_at), 'HH:mm')}`}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className={cn(
                            "text-sm font-medium",
                            isActive && "text-primary"
                          )}>
                            {formatDuration(duration)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
