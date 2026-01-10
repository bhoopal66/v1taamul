import { useLeadActivity, ActivityType } from '@/hooks/useLeadActivity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Phone, 
  PhoneOff, 
  PhoneMissed,
  Calendar,
  MessageSquare,
  Plus,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Clock,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface LeadActivityTimelineProps {
  contactId: string;
  compact?: boolean;
}

const getActivityConfig = (type: ActivityType) => {
  const configs: Record<ActivityType, { 
    icon: React.ElementType; 
    color: string; 
    bgColor: string;
    label: string;
  }> = {
    call_interested: {
      icon: ThumbsUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: 'Interested',
    },
    call_not_interested: {
      icon: ThumbsDown,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      label: 'Not Interested',
    },
    call_not_answered: {
      icon: PhoneMissed,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'No Answer',
    },
    call_callback: {
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      label: 'Callback',
    },
    call_wrong_number: {
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      label: 'Wrong Number',
    },
    lead_created: {
      icon: Plus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      label: 'Lead Created',
    },
    status_change: {
      icon: ArrowRight,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      label: 'Status Change',
    },
    note_added: {
      icon: MessageSquare,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
      label: 'Note',
    },
    whatsapp_sent: {
      icon: MessageSquare,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      label: 'WhatsApp',
    },
  };
  return configs[type];
};

export const LeadActivityTimeline = ({ contactId, compact = false }: LeadActivityTimelineProps) => {
  const { activities, isLoading } = useLeadActivity(contactId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  const TimelineContent = () => (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const config = getActivityConfig(activity.type);
          const Icon = config.icon;
          const isFirst = index === 0;

          return (
            <div key={activity.id} className="relative flex gap-3">
              {/* Icon */}
              <div 
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor} ${
                  isFirst ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                }`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${config.color}`}>
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
                
                <p className="text-sm mt-1">{activity.description}</p>
                
                {activity.notes && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground italic">
                      "{activity.notes}"
                    </p>
                  </div>
                )}

                {!compact && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(activity.timestamp), 'MMM d, yyyy • h:mm a')}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (compact) {
    return <TimelineContent />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Activity Timeline
          <Badge variant="secondary" className="ml-auto">
            {activities.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <TimelineContent />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LeadActivityTimeline;
