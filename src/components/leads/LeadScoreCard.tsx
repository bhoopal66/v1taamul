import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Info, Zap } from 'lucide-react';
import { useLeadScoring, LeadScoreBreakdown, getScoreLabel } from '@/hooks/useLeadScoring';

interface LeadScoreCardProps {
  leadId: string;
  currentScore: number;
  compact?: boolean;
}

export const LeadScoreCard = ({ leadId, currentScore, compact = false }: LeadScoreCardProps) => {
  const { getScoreBreakdown, recalculateScores, isRecalculating } = useLeadScoring();
  const breakdown = getScoreBreakdown(leadId);
  const { label, color } = getScoreLabel(currentScore);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(currentScore / 100) * 100.53} 100.53`}
                    className={color.replace('text-', 'stroke-')}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  {currentScore}
                </span>
              </div>
              <Badge variant="outline" className={`${color} text-xs`}>
                {label}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent className="w-64 p-3">
            <ScoreBreakdownTooltip breakdown={breakdown} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Lead Score
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => recalculateScores()}
            disabled={isRecalculating}
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${(currentScore / 100) * 175.93} 175.93`}
                className={color.replace('text-', 'stroke-')}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              {currentScore}
            </span>
          </div>
          <div>
            <Badge className={`${color} bg-opacity-10`} variant="outline">
              {label} Lead
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Based on interaction history
            </p>
          </div>
        </div>

        {breakdown && (
          <div className="space-y-2 text-xs">
            <ScoreFactorRow 
              label="Base Score" 
              value={breakdown.baseScore} 
              type="neutral" 
            />
            <ScoreFactorRow 
              label="Interactions" 
              value={breakdown.interactionBonus} 
              type={breakdown.interactionBonus > 0 ? 'positive' : 'neutral'} 
            />
            <ScoreFactorRow 
              label="Interest Signals" 
              value={breakdown.interestBonus} 
              type={breakdown.interestBonus > 0 ? 'positive' : 'neutral'} 
            />
            <ScoreFactorRow 
              label="Callbacks" 
              value={breakdown.callbackBonus} 
              type={breakdown.callbackBonus > 0 ? 'positive' : 'neutral'} 
            />
            <ScoreFactorRow 
              label="Recency" 
              value={breakdown.recencyBonus} 
              type={breakdown.recencyBonus > 0 ? 'positive' : 'neutral'} 
            />
            <ScoreFactorRow 
              label="Deal Info" 
              value={breakdown.dealValueBonus + breakdown.closeDateBonus} 
              type={breakdown.dealValueBonus + breakdown.closeDateBonus > 0 ? 'positive' : 'neutral'} 
            />
            {breakdown.penalties !== 0 && (
              <ScoreFactorRow 
                label="Penalties" 
                value={breakdown.penalties} 
                type="negative" 
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ScoreFactorRow = ({ 
  label, 
  value, 
  type 
}: { 
  label: string; 
  value: number; 
  type: 'positive' | 'negative' | 'neutral';
}) => {
  const Icon = type === 'positive' ? TrendingUp : type === 'negative' ? TrendingDown : Minus;
  const colorClass = type === 'positive' 
    ? 'text-green-500' 
    : type === 'negative' 
    ? 'text-red-500' 
    : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1 ${colorClass}`}>
        <Icon className="h-3 w-3" />
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
};

const ScoreBreakdownTooltip = ({ breakdown }: { breakdown?: LeadScoreBreakdown }) => {
  if (!breakdown) {
    return <p className="text-xs">Score breakdown unavailable</p>;
  }

  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium mb-2">Score Breakdown</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span>Base:</span><span>+{breakdown.baseScore}</span>
        <span>Interactions:</span><span>+{breakdown.interactionBonus}</span>
        <span>Interest:</span><span>+{breakdown.interestBonus}</span>
        <span>Callbacks:</span><span>+{breakdown.callbackBonus}</span>
        <span>Recency:</span><span>+{breakdown.recencyBonus}</span>
        <span>Deal Info:</span><span>+{breakdown.dealValueBonus + breakdown.closeDateBonus}</span>
        {breakdown.penalties !== 0 && (
          <>
            <span className="text-red-400">Penalties:</span>
            <span className="text-red-400">{breakdown.penalties}</span>
          </>
        )}
      </div>
      <div className="border-t pt-1 mt-2 font-medium">
        Total: {breakdown.totalScore}/100
      </div>
    </div>
  );
};

export default LeadScoreCard;
