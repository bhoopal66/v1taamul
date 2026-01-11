import { Card, CardContent } from '@/components/ui/card';
import { Flame, Trophy, Target, Zap } from 'lucide-react';
import { StreakData } from '@/hooks/useDashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceStreakCardsProps {
  data: StreakData;
  isLoading: boolean;
}

export const PerformanceStreakCards = ({ data, isLoading }: PerformanceStreakCardsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      icon: Flame,
      label: 'Current Streak',
      value: `${data.currentStreak} days`,
      color: data.isHotStreak ? 'text-orange-500' : 'text-muted-foreground',
      bgColor: data.isHotStreak ? 'bg-orange-500/10' : 'bg-muted',
      badge: data.isHotStreak ? '🔥 Hot!' : null,
    },
    {
      icon: Trophy,
      label: 'Best Day',
      value: data.bestDay,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      badge: null,
    },
    {
      icon: Target,
      label: 'Days Above Target',
      value: `${data.daysAboveTarget}/14`,
      color: data.daysAboveTarget >= 10 ? 'text-green-500' : 'text-muted-foreground',
      bgColor: data.daysAboveTarget >= 10 ? 'bg-green-500/10' : 'bg-muted',
      badge: data.daysAboveTarget >= 10 ? '⭐ Great!' : null,
    },
    {
      icon: Zap,
      label: 'Performance',
      value: data.currentStreak >= 5 ? 'Excellent' : data.currentStreak >= 3 ? 'Good' : 'Building',
      color: data.currentStreak >= 5 ? 'text-primary' : 'text-muted-foreground',
      bgColor: data.currentStreak >= 5 ? 'bg-primary/10' : 'bg-muted',
      badge: data.currentStreak >= 5 ? '🏆' : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              {card.badge && (
                <span className="text-xs font-medium">{card.badge}</span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-lg font-semibold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
