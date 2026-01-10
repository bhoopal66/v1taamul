import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';
import { AgentDailyStats } from '@/hooks/useAllAgentsPerformance';

interface AgentPerformanceListProps {
  agents: AgentDailyStats[];
  isLoading: boolean;
}

export const AgentPerformanceList: React.FC<AgentPerformanceListProps> = ({ agents, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No activity recorded for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Agent Performance ({agents.length} agents)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Interested</TableHead>
              <TableHead className="text-right">Not Interested</TableHead>
              <TableHead className="text-right">Not Answered</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="w-32">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent, index) => (
              <TableRow key={agent.agentId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{agent.agentName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{agent.totalCalls}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    {agent.interested}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {agent.notInterested}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    {agent.notAnswered}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="default">{agent.leadsGenerated}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={agent.conversionRate} className="h-2 flex-1" />
                    <span className="text-xs font-medium w-8">{agent.conversionRate}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
