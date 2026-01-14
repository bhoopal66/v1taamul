import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  PhoneForwarded, 
  Clock, 
  AlertTriangle, 
  Phone,
  Building2,
  User,
  Bell,
  BellRing,
  ExternalLink,
  CheckCircle2,
  CalendarIcon,
  ThumbsUp,
  ThumbsDown,
  PhoneMissed,
  X,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { useCallbackReminders, CallbackReminder, CallbackOutcome } from '@/hooks/useCallbackReminders';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const outcomeOptions: { value: CallbackOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'interested', label: 'Interested', icon: <ThumbsUp className="w-4 h-4" />, color: 'bg-green-500 hover:bg-green-600' },
  { value: 'not_interested', label: 'Not Interested', icon: <ThumbsDown className="w-4 h-4" />, color: 'bg-orange-500 hover:bg-orange-600' },
  { value: 'not_answered', label: 'Not Answered', icon: <PhoneMissed className="w-4 h-4" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
  { value: 'wrong_number', label: 'Wrong Number', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-500 hover:bg-red-600' },
];

interface CallbackCardProps {
  reminder: CallbackReminder;
  onComplete: (reminder: CallbackReminder) => void;
  onReschedule: (reminder: CallbackReminder) => void;
  onDismiss: (feedbackId: string) => void;
  isDismissing: boolean;
}

const CallbackCard = ({ reminder, onComplete, onReschedule, onDismiss, isDismissing }: CallbackCardProps) => {
  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-colors",
        reminder.isOverdue 
          ? "bg-destructive/10 border-destructive/30" 
          : reminder.isUpcoming 
            ? "bg-yellow-500/10 border-yellow-500/30" 
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

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t">
        <Button 
          size="sm" 
          variant="default"
          className="flex-1 h-8 text-xs"
          onClick={() => onComplete(reminder)}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Complete
        </Button>
        <Button 
          size="sm" 
          variant="secondary"
          className="flex-1 h-8 text-xs"
          onClick={() => onReschedule(reminder)}
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reschedule
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDismiss(reminder.id)}
          disabled={isDismissing}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export const CallbackRemindersPanel: React.FC = () => {
  const { 
    reminders, 
    upcomingCount, 
    overdueCount, 
    isLoading,
    completeCallback,
    isCompleting,
    rescheduleCallback,
    isRescheduling,
    dismissCallback,
    isDismissing
  } = useCallbackReminders();
  const navigate = useNavigate();

  // Complete dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<CallbackReminder | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<CallbackOutcome | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');

  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState<string>('10:00');

  const hasReminders = reminders.length > 0;
  const hasUrgent = upcomingCount > 0 || overdueCount > 0;

  const handleOpenComplete = (reminder: CallbackReminder) => {
    setSelectedReminder(reminder);
    setSelectedOutcome(null);
    setOutcomeNotes('');
    setCompleteDialogOpen(true);
  };

  const handleOpenReschedule = (reminder: CallbackReminder) => {
    setSelectedReminder(reminder);
    setRescheduleDate(undefined);
    setRescheduleTime('10:00');
    setRescheduleDialogOpen(true);
  };

  const handleSubmitComplete = () => {
    if (!selectedReminder || !selectedOutcome) return;
    
    completeCallback({
      feedbackId: selectedReminder.id,
      contactId: selectedReminder.contactId,
      outcome: selectedOutcome,
      notes: outcomeNotes || undefined,
    });
    
    setCompleteDialogOpen(false);
    setSelectedReminder(null);
    setSelectedOutcome(null);
    setOutcomeNotes('');
  };

  const handleSubmitReschedule = () => {
    if (!selectedReminder || !rescheduleDate) return;
    
    const [hours, minutes] = rescheduleTime.split(':').map(Number);
    const newDatetime = new Date(rescheduleDate);
    newDatetime.setHours(hours, minutes, 0, 0);
    
    rescheduleCallback({
      feedbackId: selectedReminder.id,
      newDatetime,
    });
    
    setRescheduleDialogOpen(false);
    setSelectedReminder(null);
    setRescheduleDate(undefined);
    setRescheduleTime('10:00');
  };

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
    <>
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
                  <CallbackCard 
                    key={reminder.id} 
                    reminder={reminder}
                    onComplete={handleOpenComplete}
                    onReschedule={handleOpenReschedule}
                    onDismiss={dismissCallback}
                    isDismissing={isDismissing}
                  />
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

      {/* Complete Callback Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Complete Callback
            </DialogTitle>
            <DialogDescription>
              {selectedReminder && (
                <span className="font-medium">{selectedReminder.companyName}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {outcomeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedOutcome === option.value ? 'default' : 'outline'}
                  className={cn(
                    "justify-start gap-2 h-auto py-3",
                    selectedOutcome === option.value && option.color.replace('hover:', '')
                  )}
                  onClick={() => setSelectedOutcome(option.value)}
                >
                  {option.icon}
                  {option.label}
                </Button>
              ))}
            </div>

            {selectedOutcome === 'interested' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Add details about the interest (required)..."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={3}
                  className={!outcomeNotes.trim() ? "border-destructive" : ""}
                />
              </div>
            )}

            {selectedOutcome && selectedOutcome !== 'interested' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes..."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitComplete}
              disabled={
                !selectedOutcome || 
                isCompleting ||
                (selectedOutcome === 'interested' && !outcomeNotes.trim())
              }
            >
              {isCompleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Reschedule Callback
            </DialogTitle>
            <DialogDescription>
              {selectedReminder && (
                <span className="font-medium">{selectedReminder.companyName}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  New Date <span className="text-destructive">*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !rescheduleDate && "text-muted-foreground",
                        !rescheduleDate && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rescheduleDate ? format(rescheduleDate, 'PPP') : <span>Pick date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={setRescheduleDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  New Time <span className="text-destructive">*</span>
                </label>
                <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                  <SelectTrigger className="w-full">
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => (
                      <React.Fragment key={hour}>
                        <SelectItem value={`${hour.toString().padStart(2, '0')}:00`}>
                          {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`}
                        </SelectItem>
                        <SelectItem value={`${hour.toString().padStart(2, '0')}:30`}>
                          {hour > 12 ? `${hour - 12}:30 PM` : hour === 12 ? '12:30 PM' : `${hour}:30 AM`}
                        </SelectItem>
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitReschedule}
              disabled={!rescheduleDate || isRescheduling}
            >
              {isRescheduling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CalendarIcon className="w-4 h-4 mr-2" />
              )}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
