import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  ThumbsUp, 
  ThumbsDown, 
  PhoneOff, 
  MessageSquare, 
  Clock,
  Activity
} from 'lucide-react';
import { RecentActivity } from '@/hooks/usePerformanceData';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivityFeedProps {
  activities: RecentActivity[];
  isLoading: boolean;
}

const getActivityIcon = (status: string) => {
  switch (status) {
    case 'interested':
      return <ThumbsUp className="w-4 h-4 text-success" />;
    case 'not_interested':
      return <ThumbsDown className="w-4 h-4 text-destructive" />;
    case 'not_answered':
      return <PhoneOff className="w-4 h-4 text-warning" />;
    case 'callback':
      return <Clock className="w-4 h-4 text-info" />;
    case 'whatsapp':
      return <MessageSquare className="w-4 h-4 text-success" />;
    default:
      return <Phone className="w-4 h-4 text-primary" />;
  }
};

const getActivityColor = (status: string) => {
  switch (status) {
    case 'interested':
      return 'bg-success/10 border-success/20';
    case 'not_interested':
      return 'bg-destructive/10 border-destructive/20';
    case 'not_answered':
      return 'bg-warning/10 border-warning/20';
    case 'callback':
      return 'bg-info/10 border-info/20';
    case 'whatsapp':
      return 'bg-success/10 border-success/20';
    default:
      return 'bg-primary/10 border-primary/20';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'interested':
      return 'Interested';
    case 'not_interested':
      return 'Not Interested';
    case 'not_answered':
      return 'No Answer';
    case 'callback':
      return 'Callback';
    case 'whatsapp':
      return 'WhatsApp Sent';
    default:
      return 'Called';
  }
};

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({ activities, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Your latest call activity
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {activities.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No activity yet today</p>
              <p className="text-sm">Your call history will appear here</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div 
                  key={activity.id || index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityColor(activity.status)} transition-all hover:scale-[1.01]`}
                >
                  <div className={`p-2 rounded-full ${getActivityColor(activity.status)}`}>
                    {getActivityIcon(activity.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {activity.companyName || 'Unknown Company'}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getStatusLabel(activity.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.contactName || 'Unknown Contact'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.timestamp 
                        ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                        : 'Just now'
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
