import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { FunnelChart, Funnel, LabelList, Cell } from 'recharts';
import { FunnelStage } from '@/hooks/useDashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown } from 'lucide-react';

interface LeadPipelineFunnelProps {
  data: FunnelStage[];
  isLoading: boolean;
}

const chartConfig = {
  value: { label: 'Count' },
};

export const LeadPipelineFunnel = ({ data, isLoading }: LeadPipelineFunnelProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate conversion rates between stages
  const getConversionRate = (index: number) => {
    if (index === 0 || data[index - 1].value === 0) return null;
    return Math.round((data[index].value / data[index - 1].value) * 100);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Lead Pipeline</CardTitle>
        <CardDescription>This week's conversion funnel</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage, index) => {
            const width = data[0].value > 0 ? (stage.value / data[0].value) * 100 : 0;
            const conversionRate = getConversionRate(index);
            
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stage.stage}</span>
                  <span className="text-sm text-muted-foreground">{stage.value}</span>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.max(width, 5)}%`,
                      backgroundColor: stage.fill,
                    }}
                  />
                </div>
                {conversionRate !== null && (
                  <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
                    <ArrowDown className="w-3 h-3" />
                    <span>{conversionRate}% conversion</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Overall conversion summary */}
        {data[0].value > 0 && data[4].value > 0 && (
          <div className="mt-4 pt-3 border-t text-center">
            <span className="text-sm text-muted-foreground">Overall: </span>
            <span className="text-sm font-semibold text-primary">
              {Math.round((data[4].value / data[0].value) * 100)}% calls → conversions
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
