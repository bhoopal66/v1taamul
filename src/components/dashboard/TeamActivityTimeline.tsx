import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Phone, UserCheck, Star } from 'lucide-react';
import { TimelineActivity } from '@/hooks/useDashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface TeamActivityTimelineProps {
  data: TimelineActivity[];
  isLoading: boolean;
}

export const TeamActivityTimeline = ({ data, isLoading }: TeamActivityTimelineProps) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'interested':
        return <Star className="w-3 h-3 text-yellow-500" />;
      case 'lead':
        return <UserCheck className="w-3 h-3 text-green-500" />;
      default:
        return <Phone className="w-3 h-3 text-primary" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'interested':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'lead':
        return 'bg-green-500/10 border-green-500/30';
      default:
        return 'bg-primary/10 border-primary/30';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 w-36 flex-shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Team Activity</CardTitle>
            <CardDescription>Recent calls and leads</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {data.length === 0 ? (
              <div className="flex items-center justify-center w-full h-20 text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              data.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex-shrink-0 w-40 p-3 rounded-lg border ${getTypeColor(activity.type)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getIcon(activity.type)}
                    <span className="text-xs font-medium capitalize">{activity.type}</span>
                  </div>
                  <p className="text-sm font-medium truncate" title={activity.agentName}>
                    {activity.agentName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={activity.companyName}>
                    {activity.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
