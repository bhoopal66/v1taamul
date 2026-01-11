import React from 'react';
import { usePerformanceAlerts } from '@/hooks/usePerformanceAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Phone, Target } from 'lucide-react';
import { format } from 'date-fns';

const METRIC_LABELS: Record<string, string> = {
  calls: 'Calls',
  leads: 'Leads',
  conversion_rate: 'Conversion Rate',
};

const METRIC_ICONS: Record<string, React.ElementType> = {
  calls: Phone,
  leads: Target,
  conversion_rate: TrendingDown,
};

export const MyPerformanceAlerts: React.FC = () => {
  const { alerts, acknowledgeAlert, isLoading } = usePerformanceAlerts();
  
  // Filter to only show active alerts for the current user
  const myActiveAlerts = alerts.filter(a => a.alert_status === 'active');

  if (isLoading || myActiveAlerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Performance Alerts
          <Badge variant="destructive">{myActiveAlerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {myActiveAlerts.slice(0, 3).map(alert => {
          const MetricIcon = METRIC_ICONS[alert.metric] || Target;
          const metricLabel = METRIC_LABELS[alert.metric] || alert.metric;
          const isPercentage = alert.metric === 'conversion_rate';

          return (
            <div 
              key={alert.id} 
              className="flex items-start justify-between gap-4 p-3 bg-background rounded-lg border"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <MetricIcon className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {metricLabel} below target
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.actual_value}{isPercentage ? '%' : ''} / {alert.target_value}{isPercentage ? '%' : ''} 
                    ({alert.percentage_achieved.toFixed(0)}% achieved)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => acknowledgeAlert.mutate(alert.id)}
                disabled={acknowledgeAlert.isPending}
              >
                Acknowledge
              </Button>
            </div>
          );
        })}
        {myActiveAlerts.length > 3 && (
          <p className="text-xs text-center text-muted-foreground">
            +{myActiveAlerts.length - 3} more alerts
          </p>
        )}
      </CardContent>
    </Card>
  );
};
