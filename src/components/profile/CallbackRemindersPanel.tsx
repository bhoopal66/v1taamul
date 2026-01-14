import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PhoneForwarded, 
  Clock, 
  AlertTriangle, 
  Phone,
  Building2,
  User,
  Bell,
  BellRing,
  ExternalLink
} from 'lucide-react';
import { useCallbackReminders, CallbackReminder } from '@/hooks/useCallbackReminders';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const CallbackCard = ({ reminder }: { reminder: CallbackReminder }) => {
  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-colors",
        reminder.isOverdue 
          ? "bg-destructive/10 border-destructive/30" 
          : reminder.isUpcoming 
            ? "bg-yellow-500/10 border-yellow-500/30 animate-pulse" 
            : "bg-muted/50 border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {reminder.isOverdue ? (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Overdue
              </Badge>
            ) : reminder.isUpcoming ? (
              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
                <BellRing className="w-3 h-3 mr-1" />
                Soon
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Scheduled
              </Badge>
            )}
          </div>
          
          <p className="font-medium text-sm truncate flex items-center gap-1">
            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
            {reminder.companyName}
          </p>
          
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3 shrink-0" />
            {reminder.contactPersonName}
          </p>
          
          <p className="text-xs font-medium text-primary">
            {reminder.isOverdue 
              ? `${formatDistanceToNow(reminder.callbackDatetime)} ago`
              : `in ${formatDistanceToNow(reminder.callbackDatetime)}`
            }
            <span className="text-muted-foreground ml-1">
              ({format(reminder.callbackDatetime, 'h:mm a')})
            </span>
          </p>
        </div>
        
        <a 
          href={`tel:${reminder.phoneNumber}`}
          className="shrink-0"
        >
          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
            <Phone className="w-4 h-4" />
          </Button>
        </a>
      </div>
      
      {reminder.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic border-t pt-2">
          {reminder.notes}
        </p>
      )}
    </div>
  );
};

export const CallbackRemindersPanel: React.FC = () => {
  const { reminders, upcomingCount, overdueCount, isLoading } = useCallbackReminders();
  const navigate = useNavigate();

  const hasReminders = reminders.length > 0;
  const hasUrgent = upcomingCount > 0 || overdueCount > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneForwarded className="w-5 h-5 text-primary" />
            Callback Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(hasUrgent && "ring-2 ring-yellow-500/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {hasUrgent ? (
              <BellRing className="w-5 h-5 text-yellow-500 animate-bounce" />
            ) : (
              <Bell className="w-5 h-5 text-primary" />
            )}
            Callback Reminders
            {hasReminders && (
              <Badge variant="secondary" className="ml-1">
                {reminders.length}
              </Badge>
            )}
          </CardTitle>
          
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasReminders ? (
          <div className="text-center py-6 text-muted-foreground">
            <PhoneForwarded className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No scheduled callbacks</p>
            <p className="text-xs mt-1">Callbacks you schedule will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <CallbackCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          </ScrollArea>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-3"
          onClick={() => navigate('/call-list')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Go to Call List
        </Button>
      </CardContent>
    </Card>
  );
};
