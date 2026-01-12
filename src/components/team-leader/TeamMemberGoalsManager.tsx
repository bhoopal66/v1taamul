import React, { useState } from 'react';
import { useTeamLeaderData } from '@/hooks/useTeamLeaderData';
import { useTeamMemberGoals } from '@/hooks/useTeamMemberGoals';
import { GoalType, GoalMetric } from '@/hooks/useAgentGoals';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  Plus,
  Phone,
  ThumbsUp,
  Users,
  TrendingUp,
  Clock,
  Trash2,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const metricConfig: Record<GoalMetric, { label: string; icon: React.ReactNode; unit: string; color: string }> = {
  calls: { label: 'Calls', icon: <Phone className="w-4 h-4" />, unit: 'calls', color: 'text-blue-500' },
  interested: { label: 'Interested', icon: <ThumbsUp className="w-4 h-4" />, unit: 'interested', color: 'text-green-500' },
  leads: { label: 'Leads', icon: <Users className="w-4 h-4" />, unit: 'leads', color: 'text-amber-500' },
  conversion: { label: 'Conversion Rate', icon: <TrendingUp className="w-4 h-4" />, unit: '%', color: 'text-purple-500' },
  talk_time: { label: 'Talk Time', icon: <Clock className="w-4 h-4" />, unit: 'minutes', color: 'text-cyan-500' },
};

interface SetGoalDialogProps {
  teamMembers: { agentId: string; agentName: string; username: string }[];
  onSubmit: (data: { agent_id: string; goal_type: GoalType; metric: GoalMetric; target_value: number }) => void;
  isCreating: boolean;
  trigger?: React.ReactNode;
}

const SetGoalDialog: React.FC<SetGoalDialogProps> = ({ teamMembers, onSubmit, isCreating, trigger }) => {
  const [open, setOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [goalType, setGoalType] = useState<GoalType>('weekly');
  const [metric, setMetric] = useState<GoalMetric>('calls');
  const [targetValue, setTargetValue] = useState<string>('');

  const handleSubmit = () => {
    if (!selectedAgent || !targetValue) return;
    onSubmit({
      agent_id: selectedAgent,
      goal_type: goalType,
      metric,
      target_value: parseInt(targetValue),
    });
    setOpen(false);
    setSelectedAgent('');
    setTargetValue('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Set Goal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Team Member Goal</DialogTitle>
          <DialogDescription>
            Create a performance goal for a team member
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Team Member</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.agentId} value={member.agentId}>
                    {member.agentName} (@{member.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Goal Type</Label>
            <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly Goal</SelectItem>
                <SelectItem value="monthly">Monthly Goal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Metric</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(metricConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span className={config.color}>{config.icon}</span>
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Target Value ({metricConfig[metric].unit})</Label>
            <Input
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={`Enter target ${metricConfig[metric].unit}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAgent || !targetValue || isCreating}>
            {isCreating ? 'Creating...' : 'Set Goal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TeamMemberGoalsManager: React.FC = () => {
  const { teamMembers, isLoading: membersLoading } = useTeamLeaderData();
  const { teamGoals, isLoading: goalsLoading, createGoal, deleteGoal, isCreating } = useTeamMemberGoals();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isLoading = membersLoading || goalsLoading;

  // Group goals by agent
  const goalsByAgent = teamGoals.reduce((acc, goal) => {
    const agentId = goal.agent_id;
    if (!acc[agentId]) {
      acc[agentId] = [];
    }
    acc[agentId].push(goal);
    return acc;
  }, {} as Record<string, typeof teamGoals>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Team Member Goals
          </CardTitle>
          <CardDescription>Set and manage performance goals for your team</CardDescription>
        </div>
        <SetGoalDialog
          teamMembers={teamMembers.map((m) => ({
            agentId: m.agentId,
            agentName: m.agentName,
            username: m.username,
          }))}
          onSubmit={createGoal}
          isCreating={isCreating}
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No team members found
          </div>
        ) : (
          <div className="space-y-4">
            {teamMembers.map((member) => {
              const memberGoals = goalsByAgent[member.agentId] || [];
              return (
                <div
                  key={member.agentId}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(member.agentName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.agentName}</p>
                      <p className="text-xs text-muted-foreground">@{member.username}</p>
                    </div>
                    <SetGoalDialog
                      teamMembers={[{
                        agentId: member.agentId,
                        agentName: member.agentName,
                        username: member.username,
                      }]}
                      onSubmit={createGoal}
                      isCreating={isCreating}
                      trigger={
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Plus className="w-3 h-3" />
                          Add Goal
                        </Button>
                      }
                    />
                  </div>

                  {memberGoals.length === 0 ? (
                    <p className="text-sm text-muted-foreground pl-13">No active goals</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pl-13">
                      {memberGoals.map((goal) => {
                        const config = metricConfig[goal.metric as GoalMetric];
                        return (
                          <div
                            key={goal.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 group"
                          >
                            <span className={config.color}>{config.icon}</span>
                            <div className="text-sm">
                              <span className="font-medium">{goal.target_value}</span>
                              <span className="text-muted-foreground"> {config.unit}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {goal.goal_type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteGoal(goal.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
