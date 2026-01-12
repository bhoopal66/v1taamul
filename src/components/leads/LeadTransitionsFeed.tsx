import { useAllLeadTransitions } from '@/hooks/useLeadTransitions';
import { useAuth } from '@/contexts/AuthContext';
import { LeadStatus } from '@/hooks/useLeads';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Clock, Building2, Plus, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  <Badge variant="outline" className={`${STATUS_COLORS[status]} border-0 text-xs`}>
    {STATUS_LABELS[status]}
  </Badge>
);

export const LeadTransitionsFeed = () => {
  const { user } = useAuth();
  const { data: transitions, isLoading } = useAllLeadTransitions(user?.id || null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recent Pipeline Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-10 w-full" />
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
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recent Pipeline Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No pipeline activity yet. Stage changes will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Recent Pipeline Activity
        </CardTitle>
        <CardDescription>Latest stage transitions across all leads</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px]">
          <div className="px-6 pb-4 space-y-1">
            {transitions.map((transition) => {
              const isCreation = transition.fromStatus === null;
              
              return (
                <div 
                  key={transition.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0"
                >
                  {/* Icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isCreation 
                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                      : transition.toStatus === 'approved'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : transition.toStatus === 'lost'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : 'bg-muted'
                  }`}>
                    {isCreation ? (
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm truncate max-w-[150px]">
                        {transition.companyName}
                      </span>
                      {isCreation ? (
                        <>
                          <span className="text-xs text-muted-foreground">→</span>
                          <StatusBadge status={transition.toStatus} />
                        </>
                      ) : (
                        <>
                          <StatusBadge status={transition.fromStatus!} />
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <StatusBadge status={transition.toStatus} />
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Time */}
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(transition.changedAt), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
