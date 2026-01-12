import { useLeadTransitions, LeadTransition } from '@/hooks/useLeadTransitions';
import { LeadStatus } from '@/hooks/useLeads';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Clock, User, Plus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface LeadTransitionHistoryProps {
  leadId: string;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'In Progress',
  qualified: 'Submitted',
  converted: 'Assessing',
  approved: 'Approved',
  lost: 'Lost',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  converted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const StatusBadge = ({ status }: { status: LeadStatus }) => (
  <Badge variant="outline" className={`${STATUS_COLORS[status]} border-0`}>
    {STATUS_LABELS[status]}
  </Badge>
);

export const LeadTransitionHistory = ({ leadId }: LeadTransitionHistoryProps) => {
  const { data: transitions, isLoading } = useLeadTransitions(leadId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stage History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transitions || transitions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stage History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No stage transitions recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stage History</CardTitle>
        <CardDescription>Timeline of status changes</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-6 pb-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {transitions.map((transition, index) => (
                <TransitionItem 
                  key={transition.id} 
                  transition={transition} 
                  isFirst={index === 0}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const TransitionItem = ({ 
  transition, 
  isFirst 
}: { 
  transition: LeadTransition; 
  isFirst: boolean;
}) => {
  const isCreation = transition.fromStatus === null;
  
  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
        isFirst ? 'bg-primary text-primary-foreground' : 'bg-muted border-2 border-background'
      }`}>
        {isCreation ? (
          <Plus className="w-3 h-3" />
        ) : (
          <ArrowRight className="w-3 h-3" />
        )}
      </div>
      
      <div className="space-y-1">
        {/* Status change */}
        <div className="flex items-center gap-2 flex-wrap">
          {isCreation ? (
            <>
              <span className="text-sm font-medium">Created as</span>
              <StatusBadge status={transition.toStatus} />
            </>
          ) : (
            <>
              <StatusBadge status={transition.fromStatus!} />
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <StatusBadge status={transition.toStatus} />
            </>
          )}
        </div>
        
        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(transition.changedAt), { addSuffix: true })}
          </span>
          {transition.changedByName && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {transition.changedByName}
            </span>
          )}
        </div>
        
        {/* Notes */}
        {transition.notes && (
          <p className="text-sm text-muted-foreground italic">
            "{transition.notes}"
          </p>
        )}
      </div>
    </div>
  );
};
