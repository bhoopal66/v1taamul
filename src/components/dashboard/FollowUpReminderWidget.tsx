import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useFollowUpsDashboard, FOLLOW_UP_TYPES } from '@/hooks/useCaseFollowUps';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { 
  CalendarClock, 
  AlertTriangle, 
  Clock, 
  Calendar,
  CheckCircle2,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Building2,
  ChevronRight,
  RefreshCw,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FollowUpItem {
  id: string;
  caseId: string;
  followUpType: string;
  scheduledAt: string;
  notes: string | null;
  caseNumber: string;
  companyName: string;
  contactName: string;
  bank: string;
}

const getFollowUpIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'whatsapp': return <MessageSquare className="w-4 h-4" />;
    case 'meeting': return <Users className="w-4 h-4" />;
    case 'bank_visit': return <Building2 className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

const getFollowUpLabel = (type: string) => {
  const found = FOLLOW_UP_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

const formatScheduledTime = (scheduledAt: string) => {
  const date = new Date(scheduledAt);
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, h:mm a');
};

const FollowUpCard: React.FC<{
  item: FollowUpItem;
  variant: 'overdue' | 'today' | 'upcoming';
  onComplete: (id: string, outcome: string) => void;
  isCompleting: boolean;
}> = ({ item, variant, onComplete, isCompleting }) => {
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [outcome, setOutcome] = useState('');

  const handleComplete = () => {
    if (!outcome.trim()) return;
    onComplete(item.id, outcome);
    setShowCompleteDialog(false);
    setOutcome('');
  };

  const variantStyles = {
    overdue: 'border-l-4 border-l-destructive bg-destructive/5',
    today: 'border-l-4 border-l-warning bg-warning/5',
    upcoming: 'border-l-4 border-l-primary/50',
  };

  return (
    <>
      <div className={`p-3 rounded-lg border ${variantStyles[variant]} hover:bg-accent/50 transition-colors`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="gap-1 text-xs">
                {getFollowUpIcon(item.followUpType)}
                {getFollowUpLabel(item.followUpType)}
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                {item.caseNumber}
              </Badge>
            </div>
            <p className="font-medium text-sm truncate">{item.companyName}</p>
            <p className="text-xs text-muted-foreground truncate">{item.contactName}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {variant === 'overdue' ? (
                <span className="text-destructive font-medium">
                  Overdue by {formatDistanceToNow(new Date(item.scheduledAt))}
                </span>
              ) : (
                <span>{formatScheduledTime(item.scheduledAt)}</span>
              )}
            </div>
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                📝 {item.notes}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 px-2"
              onClick={() => setShowCompleteDialog(true)}
              disabled={isCompleting}
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
            <Link to={`/cases?caseId=${item.caseId}`}>
              <Button size="sm" variant="ghost" className="h-7 px-2">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Follow-up</DialogTitle>
            <DialogDescription>
              Record the outcome of this {getFollowUpLabel(item.followUpType).toLowerCase()} with {item.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Outcome</label>
              <Textarea
                placeholder="Describe what happened during this follow-up..."
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={!outcome.trim() || isCompleting}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const EmptyState: React.FC<{ type: string }> = ({ type }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
      <CalendarClock className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">
      {type === 'overdue' && 'No overdue follow-ups! 🎉'}
      {type === 'today' && 'No follow-ups scheduled for today'}
      {type === 'upcoming' && 'No upcoming follow-ups this week'}
    </p>
  </div>
);

export const FollowUpReminderWidget: React.FC = () => {
  const { userRole } = useAuth();
  const { 
    overdue, 
    dueToday, 
    upcoming, 
    total, 
    isLoading, 
    refetch,
    completeFollowUp,
    isCompleting 
  } = useFollowUpsDashboard();

  // Only show for coordinators, supervisors, admins
  const canViewFollowUps = ['coordinator', 'supervisor', 'admin', 'super_admin', 'operations_head'].includes(userRole || '');
  
  if (!canViewFollowUps) return null;

  const handleComplete = (followUpId: string, outcome: string) => {
    completeFollowUp({ followUpId, outcome });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Follow-up Reminders</CardTitle>
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total} pending
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={overdue.length > 0 ? 'overdue' : 'today'} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overdue" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              Overdue
              {overdue.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {overdue.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="today" className="gap-1 text-xs">
              <Clock className="w-3 h-3" />
              Today
              {dueToday.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-warning text-warning-foreground">
                  {dueToday.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              Upcoming
              {upcoming.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {upcoming.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overdue" className="mt-0">
            <ScrollArea className="h-[320px] pr-3">
              {overdue.length === 0 ? (
                <EmptyState type="overdue" />
              ) : (
                <div className="space-y-2">
                  {overdue.map((item) => (
                    <FollowUpCard
                      key={item.id}
                      item={item}
                      variant="overdue"
                      onComplete={handleComplete}
                      isCompleting={isCompleting}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="today" className="mt-0">
            <ScrollArea className="h-[320px] pr-3">
              {dueToday.length === 0 ? (
                <EmptyState type="today" />
              ) : (
                <div className="space-y-2">
                  {dueToday.map((item) => (
                    <FollowUpCard
                      key={item.id}
                      item={item}
                      variant="today"
                      onComplete={handleComplete}
                      isCompleting={isCompleting}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            <ScrollArea className="h-[320px] pr-3">
              {upcoming.length === 0 ? (
                <EmptyState type="upcoming" />
              ) : (
                <div className="space-y-2">
                  {upcoming.map((item) => (
                    <FollowUpCard
                      key={item.id}
                      item={item}
                      variant="upcoming"
                      onComplete={handleComplete}
                      isCompleting={isCompleting}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {total > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Link to="/cases">
              <Button variant="outline" className="w-full gap-2">
                <CalendarClock className="w-4 h-4" />
                View All Cases
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};