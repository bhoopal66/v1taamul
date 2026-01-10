import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Crown, TrendingUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopPerformer {
  id: string;
  name: string;
  avatar?: string;
  totalCalls: number;
  interested: number;
  conversionRate: number;
  rank: number;
}

interface TopPerformersCardProps {
  performers: TopPerformer[];
  isLoading: boolean;
  currentUserId?: string;
}

const rankIcons = [
  { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/10' },
  { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10' },
];

export const TopPerformersCard: React.FC<TopPerformersCardProps> = ({
  performers,
  isLoading,
  currentUserId,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-4 h-4 text-primary" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-2 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const topThree = performers.slice(0, 3);

  if (topThree.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-4 h-4 text-primary" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            No performance data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-primary" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {topThree.map((performer, index) => {
          const RankIcon = rankIcons[index]?.icon || Star;
          const rankStyle = rankIcons[index] || { color: 'text-muted-foreground', bg: 'bg-muted' };
          const isCurrentUser = performer.id === currentUserId;

          return (
            <div 
              key={performer.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                isCurrentUser && "bg-primary/5 border border-primary/20",
                !isCurrentUser && "hover:bg-muted/50"
              )}
            >
              {/* Rank */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                rankStyle.bg
              )}>
                <RankIcon className={cn("w-4 h-4", rankStyle.color)} />
              </div>

              {/* Avatar & Name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={performer.avatar} />
                  <AvatarFallback className="text-xs">
                    {performer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isCurrentUser && "text-primary"
                  )}>
                    {performer.name}
                    {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {performer.totalCalls} calls
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-col items-end gap-0.5">
                <Badge variant="secondary" className="text-xs gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {performer.conversionRate}%
                </Badge>
                <span className="text-xs text-green-600 font-medium">
                  {performer.interested} interested
                </span>
              </div>
            </div>
          );
        })}

        {/* Current user not in top 3 hint */}
        {currentUserId && !topThree.some(p => p.id === currentUserId) && (
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Keep pushing to reach the top 3! 💪
          </div>
        )}
      </CardContent>
    </Card>
  );
};
