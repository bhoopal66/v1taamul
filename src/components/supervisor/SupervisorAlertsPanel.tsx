import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  AlertTriangle,
  MapPin,
  LogOut,
  Clock,
  CheckCheck,
  Coffee,
  FileQuestion,
  Phone,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { SupervisorAlert } from '@/hooks/useSupervisorAlerts';
import { cn } from '@/lib/utils';

interface SupervisorAlertsPanelProps {
  alerts: SupervisorAlert[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (alertId: string) => void;
  onMarkAllAsRead: () => void;
}

const getAlertConfig = (alertType: string) => {
  switch (alertType) {
    case 'missed_confirmation':
      return {
        icon: Clock,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/20',
        label: 'Missed Confirmation',
      };
    case 'auto_logout':
      return {
        icon: LogOut,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/20',
        label: 'Auto Logout',
      };
    case 'market_visit':
      return {
        icon: MapPin,
        color: 'text-info',
        bgColor: 'bg-info/10',
        borderColor: 'border-info/20',
        label: 'Market Visit',
      };
    case 'excessive_others':
      return {
        icon: FileQuestion,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/20',
        label: 'Excessive Others',
      };
    case 'break_overrun':
      return {
        icon: Coffee,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/20',
        label: 'Break Overrun',
      };
    case 'five_min_auto_logout':
      return {
        icon: Phone,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/20',
        label: '10-Min Auto Logout',
      };
    default:
      return {
        icon: AlertTriangle,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/10',
        borderColor: 'border-muted/20',
        label: 'Alert',
      };
  }
};

export const SupervisorAlertsPanel: React.FC<SupervisorAlertsPanelProps> = ({
  alerts,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
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
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Activity Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead} className="gap-1">
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </Button>
          )}
        </div>
        <CardDescription>
          Real-time alerts for agent activity issues • Today only
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No alerts today</p>
            <p className="text-sm">All agents are on track!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onMarkAsRead={onMarkAsRead}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

interface AlertItemProps {
  alert: SupervisorAlert;
  onMarkAsRead: (alertId: string) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onMarkAsRead }) => {
  const config = getAlertConfig(alert.alert_type);
  const AlertIcon = config.icon;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        config.bgColor,
        config.borderColor,
        !alert.is_read && 'ring-2 ring-primary/20'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-full', config.bgColor)}>
          <AlertIcon className={cn('w-4 h-4', config.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-xs', config.color)}>
              {config.label}
            </Badge>
            {!alert.is_read && (
              <Badge variant="default" className="text-xs">
                New
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <h4 className="font-medium text-sm">{alert.title}</h4>
          
          <p className="text-sm text-muted-foreground mt-1">
            {alert.description}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              Agent: <span className="font-medium">{alert.agent_name}</span>
              {' • '}
              {format(new Date(alert.created_at), 'HH:mm')}
            </span>
            
            {!alert.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(alert.id)}
                className="text-xs h-7"
              >
                Mark as read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
