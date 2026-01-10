import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RadialBarChart, RadialBar, ResponsiveContainer, Legend } from 'recharts';
import { PerformanceStats } from '@/hooks/usePerformanceData';
import { Target } from 'lucide-react';

interface FeedbackBreakdownChartProps {
  stats: PerformanceStats;
  isLoading: boolean;
}

const chartConfig = {
  interested: {
    label: 'Interested',
    color: 'hsl(142, 76%, 36%)',
  },
  notInterested: {
    label: 'Not Interested',
    color: 'hsl(0, 84%, 60%)',
  },
  notAnswered: {
    label: 'Not Answered',
    color: 'hsl(45, 93%, 47%)',
  },
  callback: {
    label: 'Callback',
    color: 'hsl(217, 91%, 60%)',
  },
};

export const FeedbackBreakdownChart: React.FC<FeedbackBreakdownChartProps> = ({ stats, isLoading }) => {
  const total = stats.totalCalls || 1;
  
  const data = [
    { 
      name: 'Interested', 
      value: stats.interested, 
      percentage: Math.round((stats.interested / total) * 100),
      fill: 'hsl(142, 76%, 36%)' 
    },
    { 
      name: 'Not Interested', 
      value: stats.notInterested, 
      percentage: Math.round((stats.notInterested / total) * 100),
      fill: 'hsl(0, 84%, 60%)' 
    },
    { 
      name: 'Not Answered', 
      value: stats.notAnswered, 
      percentage: Math.round((stats.notAnswered / total) * 100),
      fill: 'hsl(45, 93%, 47%)' 
    },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            Feedback Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.totalCalls === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            Feedback Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No feedback data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-4 h-4 text-primary" />
          Feedback Breakdown
        </CardTitle>
        <CardDescription className="text-xs">
          Distribution of call outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="30%" 
            outerRadius="90%" 
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background
              dataKey="percentage"
              cornerRadius={4}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                      <p className="font-medium">{data.name}</p>
                      <p className="text-muted-foreground">
                        {data.value} calls ({data.percentage}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadialBarChart>
        </ChartContainer>
        
        {/* Compact Legend */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="font-medium ml-auto">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
