import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentDailyStats, AgentOption } from '@/hooks/useAllAgentsPerformance';
import { Skeleton } from '@/components/ui/skeleton';

interface AgentComparisonRadarProps {
  agents: AgentOption[];
  agentStats: AgentDailyStats[];
  isLoading: boolean;
}

const chartConfig = {
  agent1: { label: 'Agent 1', color: 'hsl(var(--primary))' },
  agent2: { label: 'Agent 2', color: 'hsl(var(--chart-2))' },
  agent3: { label: 'Agent 3', color: 'hsl(var(--chart-3))' },
};

export const AgentComparisonRadar = ({ agents, agentStats, isLoading }: AgentComparisonRadarProps) => {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const handleAgentSelect = (index: number, agentId: string) => {
    const newSelected = [...selectedAgents];
    newSelected[index] = agentId;
    setSelectedAgents(newSelected);
  };

  // Normalize data for radar chart
  const getRadarData = () => {
    const metrics = ['Calls', 'Interested', 'Conv. Rate', 'Leads', 'Response'];
    const maxValues = {
      totalCalls: Math.max(...agentStats.map(a => a.totalCalls), 1),
      interested: Math.max(...agentStats.map(a => a.interested), 1),
      conversionRate: 100,
      leadsGenerated: Math.max(...agentStats.map(a => a.leadsGenerated), 1),
      responseRate: 100,
    };

    return metrics.map((metric, idx) => {
      const data: any = { metric };
      
      selectedAgents.forEach((agentId, agentIdx) => {
        const agent = agentStats.find(a => a.agentId === agentId);
        if (agent) {
          let value = 0;
          switch (idx) {
            case 0: value = (agent.totalCalls / maxValues.totalCalls) * 100; break;
            case 1: value = (agent.interested / maxValues.interested) * 100; break;
            case 2: value = agent.conversionRate; break;
            case 3: value = (agent.leadsGenerated / maxValues.leadsGenerated) * 100; break;
            case 4: value = agent.totalCalls > 0 ? ((agent.totalCalls - agent.notAnswered) / agent.totalCalls) * 100 : 0; break;
          }
          data[`agent${agentIdx + 1}`] = Math.round(value);
        }
      });
      
      return data;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const radarData = getRadarData();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Agent Comparison</CardTitle>
        <CardDescription>Compare agent performance across metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {[0, 1, 2].map((index) => (
            <Select
              key={index}
              value={selectedAgents[index] || ''}
              onValueChange={(value) => handleAgentSelect(index, value)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder={`Agent ${index + 1}`} />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter(a => !selectedAgents.includes(a.id) || selectedAgents[index] === a.id)
                  .map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        {selectedAgents.filter(Boolean).length > 0 ? (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              {selectedAgents.map((agentId, idx) => agentId && (
                <Radar
                  key={agentId}
                  name={agents.find(a => a.id === agentId)?.name || `Agent ${idx + 1}`}
                  dataKey={`agent${idx + 1}`}
                  stroke={`var(--color-agent${idx + 1})`}
                  fill={`var(--color-agent${idx + 1})`}
                  fillOpacity={0.2}
                />
              ))}
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
            </RadarChart>
          </ChartContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Select agents to compare
          </div>
        )}
      </CardContent>
    </Card>
  );
};
