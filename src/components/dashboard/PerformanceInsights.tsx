import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Lightbulb, 
  TrendingUp, 
  Clock, 
  Target,
  Zap,
  Award
} from 'lucide-react';
import { PerformanceStats, HourlyCallData } from '@/hooks/usePerformanceData';

interface PerformanceInsightsProps {
  stats: PerformanceStats;
  hourlyData: HourlyCallData[];
  isLoading: boolean;
}

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const PerformanceInsights: React.FC<PerformanceInsightsProps> = ({ 
  stats, 
  hourlyData, 
  isLoading 
}) => {
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    // Conversion rate insight
    if (stats.conversionRate >= 25) {
      insights.push({
        type: 'success',
        icon: <Award className="w-4 h-4" />,
        title: 'Excellent Conversion Rate',
        description: `Your ${stats.conversionRate}% conversion rate is above average. Keep up the great work!`,
      });
    } else if (stats.conversionRate > 0 && stats.conversionRate < 10) {
      insights.push({
        type: 'warning',
        icon: <Target className="w-4 h-4" />,
        title: 'Room for Improvement',
        description: 'Consider refining your pitch. Focus on understanding customer needs better.',
      });
    }

    // Peak hours insight
    const peakHour = hourlyData.reduce((max, current) => 
      current.calls > max.calls ? current : max, 
      { hour: 'N/A', calls: 0, interested: 0, notInterested: 0 }
    );
    
    if (peakHour.calls > 0) {
      insights.push({
        type: 'info',
        icon: <Clock className="w-4 h-4" />,
        title: 'Peak Performance Time',
        description: `You're most productive at ${peakHour.hour}. Consider scheduling important calls during this time.`,
      });
    }

    // Call volume insight
    if (stats.totalCalls >= 30) {
      insights.push({
        type: 'success',
        icon: <Zap className="w-4 h-4" />,
        title: 'High Activity',
        description: `You've made ${stats.totalCalls} calls today. Great momentum!`,
      });
    } else if (stats.totalCalls < 10 && stats.totalCalls > 0) {
      insights.push({
        type: 'tip',
        icon: <TrendingUp className="w-4 h-4" />,
        title: 'Build Momentum',
        description: 'Try to reach at least 30 calls today to maximize your chances of success.',
      });
    }

    // WhatsApp follow-up insight
    if (stats.interested > 0 && stats.whatsappSent < stats.interested) {
      insights.push({
        type: 'tip',
        icon: <Lightbulb className="w-4 h-4" />,
        title: 'Follow-up Opportunity',
        description: `${stats.interested - stats.whatsappSent} interested contacts haven't received a WhatsApp follow-up.`,
      });
    }

    // Default insight if none
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        icon: <Lightbulb className="w-4 h-4" />,
        title: 'Get Started',
        description: 'Start making calls to see personalized performance insights.',
      });
    }

    return insights.slice(0, 3); // Limit to 3 insights
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success/5 border-success/20 text-success';
      case 'warning':
        return 'bg-warning/5 border-warning/20 text-warning';
      case 'info':
        return 'bg-info/5 border-info/20 text-info';
      case 'tip':
        return 'bg-primary/5 border-primary/20 text-primary';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = generateInsights();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Performance Insights
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            AI-Powered
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border ${getInsightStyle(insight.type)} transition-all hover:scale-[1.01]`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full bg-current/10`}>
                {insight.icon}
              </div>
              <div>
                <h4 className="font-medium text-foreground">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
