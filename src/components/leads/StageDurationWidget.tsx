import { useStageDuration } from '@/hooks/useStageDuration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  qualified: 'bg-purple-500',
  converted: 'bg-orange-500',
  approved: 'bg-green-500',
  lost: 'bg-red-500',
};

const STAGE_TEXT_COLORS: Record<string, string> = {
  new: 'text-blue-600',
  contacted: 'text-yellow-600',
  qualified: 'text-purple-600',
  converted: 'text-orange-600',
  approved: 'text-green-600',
  lost: 'text-red-600',
};

export const StageDurationWidget = () => {
  const { data: stageDurations, isLoading } = useStageDuration();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Average Stage Duration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = stageDurations && stageDurations.some(s => s.count > 0);

  // Find the max duration for scaling the bars
  const maxDuration = stageDurations 
    ? Math.max(...stageDurations.map(s => s.avgDurationHours), 1) 
    : 1;

  // Calculate overall average (excluding lost and stages with no data)
  const activeStages = stageDurations?.filter(s => s.stage !== 'lost' && s.count > 0) || [];
  const overallAvgHours = activeStages.length > 0
    ? activeStages.reduce((sum, s) => sum + s.avgDurationHours, 0) / activeStages.length
    : 0;

  const formatOverallDuration = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${hours.toFixed(1)} hours`;
    const days = hours / 24;
    if (days < 7) return `${days.toFixed(1)} days`;
    return `${(days / 7).toFixed(1)} weeks`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Average Stage Duration
        </CardTitle>
        <CardDescription>
          How long leads typically spend in each stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No stage transition data yet.</p>
            <p className="text-xs mt-1">Move leads through stages to see timing insights.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary stat */}
            {overallAvgHours > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Avg. Pipeline Duration</span>
                </div>
                <span className="text-sm font-bold text-primary">
                  {formatOverallDuration(overallAvgHours)}
                </span>
              </div>
            )}

            {/* Stage breakdown */}
            <div className="space-y-3">
              {stageDurations?.filter(s => s.stage !== 'lost').map(stage => {
                const widthPercent = maxDuration > 0 
                  ? (stage.avgDurationHours / maxDuration) * 100 
                  : 0;

                return (
                  <TooltipProvider key={stage.stage}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="space-y-1 cursor-help">
                          <div className="flex items-center justify-between text-sm">
                            <span className={`font-medium ${STAGE_TEXT_COLORS[stage.stage]}`}>
                              {stage.label}
                            </span>
                            <span className="text-muted-foreground">
                              {stage.avgDurationFormatted}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${STAGE_COLORS[stage.stage]} transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.max(widthPercent, stage.count > 0 ? 5 : 0)}%` }}
                            />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Based on {stage.count} lead{stage.count !== 1 ? 's' : ''} that moved past this stage
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>

            {/* Lost leads insight */}
            {stageDurations?.find(s => s.stage === 'lost' && s.count > 0) && (
              <div className="pt-3 mt-3 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>
                    Lost leads avg: {stageDurations.find(s => s.stage === 'lost')?.avgDurationFormatted || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
