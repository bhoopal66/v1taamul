import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TeamTrendSummary } from '@/hooks/useTeamPerformanceTrends';
import { Phone, ThumbsUp, Target, Calendar, TrendingUp, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamTrendsSummaryCardsProps {
  summary: TeamTrendSummary;
  isLoading: boolean;
  days: number;
}

export const TeamTrendsSummaryCards: React.FC<TeamTrendsSummaryCardsProps> = ({
  summary,
  isLoading,
  days,
}) => {
  const stats = [
    {
      label: `Total Calls (${days}d)`,
      value: summary.totalCalls.toLocaleString(),
      icon: Phone,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Interested Leads',
      value: summary.totalInterested.toLocaleString(),
      icon: ThumbsUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Leads Generated',
      value: summary.totalLeads.toLocaleString(),
      icon: Target,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Avg Conversion',
      value: `${summary.avgConversionRate}%`,
      icon: TrendingUp,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
    {
      label: 'Avg Calls/Day',
      value: summary.avgCallsPerDay.toLocaleString(),
      icon: Activity,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent/50',
    },
    {
      label: 'Best Day',
      value: summary.bestDay,
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-10 w-10 rounded-lg mb-3" />
              <Skeleton className="h-6 w-16 mb-1" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`p-2.5 rounded-lg ${stat.bgColor} w-fit mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
