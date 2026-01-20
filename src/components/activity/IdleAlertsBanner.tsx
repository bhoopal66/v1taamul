import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle2, X } from 'lucide-react';
import { IdleAlert } from '@/hooks/useActivityMonitor';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface IdleAlertsBannerProps {
  alerts: IdleAlert[];
  onAcknowledge: (alertId: string) => void;
  compact?: boolean;
}

const SEVERITY_CONFIG = {
  warning: {
    label: 'Warning',
    variant: 'default' as const,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    icon: Clock,
  },
  escalation: {
    label: 'Escalation',
    variant: 'destructive' as const,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/20',
    icon: AlertTriangle,
  },
  discipline_flag: {
    label: 'Low Discipline',
    variant: 'destructive' as const,
    color: 'text-red-600',
    bgColor: 'bg-red-600/10 border-red-600/20',
    icon: AlertTriangle,
  },
};

export const IdleAlertsBanner: React.FC<IdleAlertsBannerProps> = ({
  alerts,
  onAcknowledge,
  compact = false,
}) => {
  const unacknowledgedAlerts = alerts.filter(a => !a.was_acknowledged);
  
  if (unacknowledgedAlerts.length === 0) {
    return null;
  }

  // Show most recent alert prominently
  const latestAlert = unacknowledgedAlerts[0];
  const config = SEVERITY_CONFIG[latestAlert.severity];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg border",
        config.bgColor
      )}>
        <Icon className={cn("w-4 h-4", config.color)} />
        <span className="text-sm font-medium flex-1">
          Idle for {latestAlert.idle_duration_minutes}m
        </span>
        <Badge variant={config.variant} className="text-xs">
          {config.label}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => onAcknowledge(latestAlert.id)}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {unacknowledgedAlerts.slice(0, 3).map((alert) => {
        const alertConfig = SEVERITY_CONFIG[alert.severity];
        const AlertIcon = alertConfig.icon;
        
        return (
          <Alert
            key={alert.id}
            variant={alert.severity === 'warning' ? 'default' : 'destructive'}
            className={cn("relative", alertConfig.bgColor)}
          >
            <AlertIcon className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span>Idle Alert - {alertConfig.label}</span>
              <Badge variant="outline" className="text-xs">
                {format(new Date(alert.alert_time), 'HH:mm')}
              </Badge>
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                You've been idle for {alert.idle_duration_minutes} minutes. 
                Please select an activity to continue.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAcknowledge(alert.id)}
                className="ml-4 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Acknowledge
              </Button>
            </AlertDescription>
          </Alert>
        );
      })}
      
      {unacknowledgedAlerts.length > 3 && (
        <p className="text-sm text-muted-foreground text-center">
          +{unacknowledgedAlerts.length - 3} more alerts
        </p>
      )}
    </div>
  );
};
