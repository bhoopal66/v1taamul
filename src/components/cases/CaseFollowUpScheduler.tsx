import { useState } from 'react';
import { useCaseFollowUps, FOLLOW_UP_TYPES, CaseFollowUp } from '@/hooks/useCaseFollowUps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Building,
  FileText,
  Loader2,
  CalendarClock,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type FollowUpType = Database['public']['Enums']['follow_up_type'];

interface CaseFollowUpSchedulerProps {
  caseId: string;
  caseNumber: string;
}

const getFollowUpIcon = (type: FollowUpType) => {
  const icons: Record<FollowUpType, React.ElementType> = {
    call: Phone,
    email: Mail,
    whatsapp: MessageSquare,
    meeting: Users,
    bank_visit: Building,
    other: FileText,
  };
  return icons[type] || FileText;
};

const getFollowUpTypeInfo = (type: FollowUpType) => {
  return FOLLOW_UP_TYPES.find(ft => ft.value === type) || { label: type, icon: '📋' };
};

const getScheduleLabel = (date: Date) => {
  if (isPast(date) && !isToday(date)) return 'Overdue';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d, yyyy');
};

const getScheduleBadgeClass = (date: Date) => {
  if (isPast(date) && !isToday(date)) return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-300';
  if (isToday(date)) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-300';
  if (isTomorrow(date)) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-950/50 dark:text-gray-400 border-gray-300';
};

export const CaseFollowUpScheduler = ({ caseId, caseNumber }: CaseFollowUpSchedulerProps) => {
  const {
    pendingFollowUps,
    completedFollowUps,
    overdueFollowUps,
    isLoading,
    createFollowUp,
    isCreating,
    completeFollowUp,
    isCompleting,
    deleteFollowUp,
    isDeleting,
  } = useCaseFollowUps(caseId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<FollowUpType>('call');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [notes, setNotes] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] = useState<CaseFollowUp | null>(null);

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [followUpToComplete, setFollowUpToComplete] = useState<CaseFollowUp | null>(null);
  const [outcome, setOutcome] = useState('');

  const handleCreateFollowUp = () => {
    if (!selectedDate) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    createFollowUp({
      followUpType: selectedType,
      scheduledAt,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setShowAddForm(false);
        setSelectedDate(undefined);
        setNotes('');
        setSelectedTime('10:00');
      },
    });
  };

  const handleCompleteClick = (followUp: CaseFollowUp) => {
    setFollowUpToComplete(followUp);
    setOutcome('');
    setCompleteDialogOpen(true);
  };

  const handleConfirmComplete = () => {
    if (followUpToComplete && outcome.trim()) {
      completeFollowUp({
        followUpId: followUpToComplete.id,
        outcome,
      });
    }
    setCompleteDialogOpen(false);
    setFollowUpToComplete(null);
  };

  const handleDeleteClick = (followUp: CaseFollowUp) => {
    setFollowUpToDelete(followUp);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (followUpToDelete) {
      deleteFollowUp(followUpToDelete.id);
    }
    setDeleteDialogOpen(false);
    setFollowUpToDelete(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Follow-ups
            </CardTitle>
            <CardDescription>
              Schedule and track follow-ups for case #{caseNumber}
            </CardDescription>
          </div>
          {overdueFollowUps.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overdueFollowUps.length} Overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Follow-up Button/Form */}
        {!showAddForm ? (
          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule New Follow-up
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">New Follow-up</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="followUpType">Type</Label>
                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as FollowUpType)}>
                  <SelectTrigger id="followUpType" className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_TYPES.map(ft => (
                      <SelectItem key={ft.value} value={ft.value}>
                        <span className="flex items-center gap-2">
                          <span>{ft.icon}</span>
                          {ft.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date & Time</Label>
                <div className="flex gap-2 mt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'flex-1 justify-start text-left font-normal',
                          !selectedDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-28"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="followUpNotes">Notes (optional)</Label>
              <Textarea
                id="followUpNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes for this follow-up..."
                className="mt-1"
                rows={2}
              />
            </div>

            <Button
              onClick={handleCreateFollowUp}
              disabled={!selectedDate || isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Follow-up
                </>
              )}
            </Button>
          </div>
        )}

        {/* Pending Follow-ups */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : pendingFollowUps.length === 0 && completedFollowUps.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No follow-ups scheduled</p>
            <p className="text-sm">Schedule a follow-up to stay on track</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Upcoming</span>
                  <Badge variant="secondary" className="text-xs">
                    {pendingFollowUps.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {pendingFollowUps.map(followUp => {
                    const Icon = getFollowUpIcon(followUp.followUpType);
                    const typeInfo = getFollowUpTypeInfo(followUp.followUpType);
                    const scheduledDate = new Date(followUp.scheduledAt);
                    const isOverdue = isPast(scheduledDate) && !isToday(scheduledDate);

                    return (
                      <div
                        key={followUp.id}
                        className={cn(
                          'flex items-center justify-between p-3 border rounded-lg transition-colors group',
                          isOverdue ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-background hover:bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'p-2 rounded-lg',
                            isOverdue ? 'bg-red-100 dark:bg-red-950/50' : 'bg-muted'
                          )}>
                            <Icon className={cn(
                              'w-4 h-4',
                              isOverdue ? 'text-red-600' : 'text-muted-foreground'
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{typeInfo.label}</span>
                              <Badge
                                variant="outline"
                                className={cn('text-xs', getScheduleBadgeClass(scheduledDate))}
                              >
                                {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                                {getScheduleLabel(scheduledDate)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(scheduledDate, 'h:mm a')} • {formatDistanceToNow(scheduledDate, { addSuffix: true })}
                            </p>
                            {followUp.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {followUp.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/50"
                                  onClick={() => handleCompleteClick(followUp)}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark Complete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                  onClick={() => handleDeleteClick(followUp)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {completedFollowUps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">Completed</span>
                  <Badge variant="secondary" className="text-xs">
                    {completedFollowUps.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {completedFollowUps.slice(0, 5).map(followUp => {
                    const Icon = getFollowUpIcon(followUp.followUpType);
                    const typeInfo = getFollowUpTypeInfo(followUp.followUpType);

                    return (
                      <div
                        key={followUp.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50/30 dark:bg-green-950/10 opacity-75"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                            <Icon className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm line-through">{typeInfo.label}</span>
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-green-300">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completed
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {followUp.completedAt && format(new Date(followUp.completedAt), 'PPp')}
                            </p>
                            {followUp.outcome && (
                              <p className="text-xs text-muted-foreground mt-1">
                                <span className="font-medium">Outcome:</span> {followUp.outcome}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {completedFollowUps.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{completedFollowUps.length - 5} more completed follow-ups
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Complete Follow-up Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Complete Follow-up
            </DialogTitle>
            <DialogDescription>
              Record the outcome of this {followUpToComplete && getFollowUpTypeInfo(followUpToComplete.followUpType).label.toLowerCase()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="outcome">Outcome</Label>
            <Textarea
              id="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Describe the outcome of this follow-up..."
              className="mt-2"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmComplete}
              disabled={!outcome.trim() || isCompleting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Complete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Follow-up
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this follow-up? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
