import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Target, ThumbsUp, ThumbsDown, PhoneOff, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AllAgentsSummary } from '@/hooks/useAllAgentsPerformance';

interface AllAgentsStatsGridProps {
  summary: AllAgentsSummary;
  isLoading: boolean;
  onRefresh: () => void;
  dateRangeLabel: string;
}

export const AllAgentsStatsGrid: React.FC<AllAgentsStatsGridProps> = ({ 
  summary, 
  isLoading, 
  onRefresh,
  dateRangeLabel 
}) => {
  const statCards = [
    { 
      label: 'Active Agents', 
      value: summary.totalAgents, 
      icon: Users, 
      color: 'bg-primary text-primary-foreground',
      description: 'Agents with activity'
    },
    { 
      label: 'Total Calls', 
      value: summary.totalCalls, 
      icon: Phone, 
      color: 'bg-info text-info-foreground',
      description: 'All calls made'
    },
    { 
      label: 'Interested', 
      value: summary.totalInterested, 
      icon: ThumbsUp, 
      color: 'bg-success text-success-foreground',
      description: 'Positive responses'
    },
    { 
      label: 'Not Interested', 
      value: summary.totalNotInterested, 
      icon: ThumbsDown, 
      color: 'bg-destructive text-destructive-foreground',
      description: 'Declined'
    },
    { 
      label: 'Not Answered', 
      value: summary.totalNotAnswered, 
      icon: PhoneOff, 
      color: 'bg-warning text-warning-foreground',
      description: 'No response'
    },
    { 
      label: 'Leads Generated', 
      value: summary.totalLeads, 
      icon: Target, 
      color: 'bg-accent text-accent-foreground',
      description: 'Qualified leads'
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Team Performance</h2>
            <p className="text-sm text-muted-foreground">
              {dateRangeLabel} • Avg Conversion: <span className="font-bold text-primary">{summary.avgConversionRate}%</span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Card 
            key={index} 
            className="hover:shadow-md transition-all duration-200"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="h-8 w-12 bg-muted animate-pulse rounded" />
                ) : (
                  stat.value
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
