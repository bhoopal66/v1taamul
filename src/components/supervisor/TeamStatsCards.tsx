import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Phone, Target, TrendingUp, FileCheck, Clock } from 'lucide-react';
import { TeamStats } from '@/hooks/useSupervisorData';

interface TeamStatsCardsProps {
  stats: TeamStats;
  isLoading: boolean;
}

const formatDuration = (mins: number) => {
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m`;
};

export const TeamStatsCards: React.FC<TeamStatsCardsProps> = ({ stats, isLoading }) => {
  const cards = [
    {
      label: 'Total Agents',
      value: stats.totalAgents,
      icon: Users,
      color: 'bg-primary text-primary-foreground',
      description: 'Team members',
    },
    {
      label: 'Active Today',
      value: stats.activeAgents,
      icon: UserCheck,
      color: 'bg-success text-success-foreground',
      description: 'Agents with activity',
    },
    {
      label: 'Team Calls',
      value: stats.totalCallsToday,
      icon: Phone,
      color: 'bg-info text-info-foreground',
      description: 'Total calls today',
    },
    {
      label: 'Talk Time',
      value: formatDuration(stats.totalTalkTimeToday),
      icon: Clock,
      color: 'bg-violet-500 text-white',
      description: 'Total talk time today',
    },
    {
      label: 'Team Leads',
      value: stats.totalLeadsToday,
      icon: Target,
      color: 'bg-accent text-accent-foreground',
      description: 'Generated today',
    },
    {
      label: 'Avg Conversion',
      value: `${stats.avgConversionRate}%`,
      icon: TrendingUp,
      color: 'bg-warning text-warning-foreground',
      description: 'Team average',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className={`p-2 rounded-lg ${card.color}`}>
              <card.icon className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="h-8 w-12 bg-muted animate-pulse rounded" />
              ) : (
                card.value
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
