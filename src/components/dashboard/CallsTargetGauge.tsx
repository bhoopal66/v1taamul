import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CallsTargetGaugeProps {
  currentCalls: number;
  targetCalls: number;
  isLoading: boolean;
}

const chartConfig = {
  progress: { label: 'Progress', color: 'hsl(var(--primary))' },
};

export const CallsTargetGauge = ({ currentCalls, targetCalls, isLoading }: CallsTargetGaugeProps) => {
  const percentage = Math.min(Math.round((currentCalls / targetCalls) * 100), 100);
  const remaining = Math.max(targetCalls - currentCalls, 0);
  
  // Calculate projected total (assuming 8-hour work day)
  const now = new Date();
  const hoursWorked = Math.max(now.getHours() - 8, 1);
  const hoursRemaining = Math.max(18 - now.getHours(), 0);
  const projectedTotal = Math.round(currentCalls + (currentCalls / hoursWorked) * hoursRemaining);

  const getColor = () => {
    if (percentage >= 100) return 'hsl(var(--chart-2))'; // Green
    if (percentage >= 75) return 'hsl(var(--primary))';
    if (percentage >= 50) return 'hsl(var(--chart-4))'; // Yellow
    return 'hsl(var(--destructive))'; // Red
  };

  const data = [{ name: 'Progress', value: percentage, fill: getColor() }];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Target</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Daily Target</CardTitle>
            <CardDescription>{targetCalls} calls goal</CardDescription>
          </div>
          <Target className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="h-40 w-full">
          <RadialBarChart
            innerRadius="60%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={10}
              fill={getColor()}
            />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
            >
              <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold">
                {percentage}%
              </tspan>
              <tspan x="50%" dy="1.5em" fontSize="12" className="fill-muted-foreground">
                {currentCalls}/{targetCalls}
              </tspan>
            </text>
          </RadialBarChart>
        </ChartContainer>
        
        <div className="grid grid-cols-2 gap-2 mt-2 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-lg font-semibold">{remaining}</p>
            <p className="text-xs text-muted-foreground">To go</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <p className="text-lg font-semibold">{projectedTotal}</p>
            <p className="text-xs text-muted-foreground">Projected</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
