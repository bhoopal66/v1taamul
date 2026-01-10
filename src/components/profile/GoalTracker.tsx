import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  Plus,
  Phone,
  TrendingUp,
  Users,
  Percent,
  Trophy,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  Flame,
} from 'lucide-react';
import { useAgentGoals, GoalType, GoalMetric, GoalWithProgress, GoalStreak, CreateGoalInput } from '@/hooks/useAgentGoals';
import { cn } from '@/lib/utils';

const metricConfig: Record<GoalMetric, { label: string; icon: React.ReactNode; unit: string; color: string }> = {
  calls: { 
    label: 'Total Calls', 
    icon: <Phone className="w-4 h-4" />, 
    unit: 'calls',
    color: 'text-primary'
  },
  interested: { 
    label: 'Interested Calls', 
    icon: <TrendingUp className="w-4 h-4" />, 
    unit: 'interested',
    color: 'text-success'
  },
  leads: { 
    label: 'Leads Generated', 
    icon: <Users className="w-4 h-4" />, 
    unit: 'leads',
    color: 'text-info'
  },
  conversion: { 
    label: 'Conversion Rate', 
    icon: <Percent className="w-4 h-4" />, 
    unit: '%',
    color: 'text-warning'
  },
};

interface GoalCardProps {
  goal: GoalWithProgress;
  onDelete: (id: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onDelete }) => {
  const config = metricConfig[goal.metric];
  const progressColor = goal.isCompleted 
    ? 'bg-success' 
    : goal.progressPercentage >= 75 
      ? 'bg-warning' 
      : 'bg-primary';

  return (
    <Card className={cn(
      'relative overflow-hidden transition-all',
      goal.isCompleted && 'ring-2 ring-success/50 bg-success/5'
    )}>
      {goal.isCompleted && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-success gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed!
          </Badge>
        </div>
      )}
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-muted', config.color)}>
              {config.icon}
            </div>
            <div>
              <h4 className="font-medium">{config.label}</h4>
              <Badge variant="outline" className="mt-1 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {goal.goal_type === 'weekly' ? 'Weekly' : 'Monthly'}
              </Badge>
            </div>
          </div>
          {!goal.isCompleted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(goal.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold">{goal.currentValue}</span>
              <span className="text-muted-foreground">/{goal.target_value} {config.unit}</span>
            </div>
            <span className="text-2xl font-bold text-muted-foreground">
              {goal.progressPercentage}%
            </span>
          </div>

          <Progress 
            value={goal.progressPercentage} 
            className={cn('h-3', `[&>div]:${progressColor}`)}
          />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {goal.daysRemaining} days remaining
            </div>
            {goal.progressPercentage >= 50 && !goal.isCompleted && (
              <div className="flex items-center gap-1 text-warning">
                <Flame className="w-3 h-3" />
                On track!
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface StreakDisplayProps {
  streaks: GoalStreak[];
}

const StreakDisplay: React.FC<StreakDisplayProps> = ({ streaks }) => {
  if (streaks.length === 0) return null;

  // Get best streak for display
  const bestCurrentStreak = streaks.reduce((best, s) => 
    s.currentStreak > (best?.currentStreak || 0) ? s : best
  , streaks[0]);

  const totalCompletions = streaks.reduce((sum, s) => sum + s.longestStreak, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
        <div className="p-2 rounded-full bg-warning/20">
          <Flame className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="text-2xl font-bold">{bestCurrentStreak?.currentStreak || 0}</p>
          <p className="text-xs text-muted-foreground">Current Streak</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
        <div className="p-2 rounded-full bg-primary/20">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">
            {Math.max(...streaks.map(s => s.longestStreak), 0)}
          </p>
          <p className="text-xs text-muted-foreground">Best Streak</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
        <div className="p-2 rounded-full bg-success/20">
          <CheckCircle2 className="w-5 h-5 text-success" />
        </div>
        <div>
          <p className="text-2xl font-bold">{streaks.length}</p>
          <p className="text-xs text-muted-foreground">Active Streaks</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-info/10 to-info/5 border border-info/20">
        <div className="p-2 rounded-full bg-info/20">
          <Target className="w-5 h-5 text-info" />
        </div>
        <div>
          <p className="text-2xl font-bold">{totalCompletions}</p>
          <p className="text-xs text-muted-foreground">Goals Completed</p>
        </div>
      </div>
    </div>
  );
};

// Detailed streak cards
const StreakCards: React.FC<{ streaks: GoalStreak[] }> = ({ streaks }) => {
  if (streaks.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
        <Flame className="w-4 h-4" />
        Your Goal Streaks
      </h4>
      <div className="grid gap-2 md:grid-cols-2">
        {streaks.map((streak) => {
          const config = metricConfig[streak.metric];
          return (
            <div 
              key={`${streak.goalType}-${streak.metric}`}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-1.5 rounded bg-muted', config.color)}>
                  {config.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{config.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{streak.goalType}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold flex items-center gap-1">
                    {streak.currentStreak > 0 && <Flame className="w-4 h-4 text-warning" />}
                    {streak.currentStreak}
                  </p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-muted-foreground">{streak.longestStreak}</p>
                  <p className="text-xs text-muted-foreground">Best</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CreateGoalDialogProps {
  onSubmit: (input: CreateGoalInput) => void;
  isLoading: boolean;
  existingGoals: GoalWithProgress[];
}

const CreateGoalDialog: React.FC<CreateGoalDialogProps> = ({ onSubmit, isLoading, existingGoals }) => {
  const [open, setOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('weekly');
  const [metric, setMetric] = useState<GoalMetric>('calls');
  const [targetValue, setTargetValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(targetValue);
    if (value > 0) {
      onSubmit({ goal_type: goalType, metric, target_value: value });
      setOpen(false);
      setTargetValue('');
    }
  };

  // Check if this goal type + metric already exists
  const existingGoalTypes = existingGoals.map(g => `${g.goal_type}-${g.metric}`);
  const isGoalExists = existingGoalTypes.includes(`${goalType}-${metric}`);

  const suggestedTargets: Record<GoalMetric, { weekly: number; monthly: number }> = {
    calls: { weekly: 100, monthly: 400 },
    interested: { weekly: 25, monthly: 100 },
    leads: { weekly: 10, monthly: 40 },
    conversion: { weekly: 25, monthly: 25 },
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Set New Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Create New Goal
          </DialogTitle>
          <DialogDescription>
            Set a target to track your progress and stay motivated
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Goal Period</Label>
              <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Metric</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(metricConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Target Value</Label>
            <Input
              type="number"
              min="1"
              placeholder={`e.g., ${suggestedTargets[metric][goalType]}`}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Suggested: {suggestedTargets[metric][goalType]} {metricConfig[metric].unit} per {goalType === 'weekly' ? 'week' : 'month'}
            </p>
          </div>

          {isGoalExists && (
            <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm">
              You already have an active {goalType} goal for {metricConfig[metric].label.toLowerCase()}. 
              Creating a new one will replace it.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !targetValue}>
              {isLoading ? 'Creating...' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const GoalTracker: React.FC = () => {
  const { goals, streaks, completedCount, isLoading, createGoal, deleteGoal, isCreating } = useAgentGoals();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedGoals = goals.filter(g => g.isCompleted);
  const activeGoals = goals.filter(g => !g.isCompleted);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Goal Tracker
            </CardTitle>
            <CardDescription className="mt-1">
              Set targets and track your progress
            </CardDescription>
          </div>
          <CreateGoalDialog 
            onSubmit={createGoal} 
            isLoading={isCreating} 
            existingGoals={goals}
          />
        </div>

        {/* Summary Stats */}
        {(goals.length > 0 || streaks.length > 0) && (
          <div className="flex gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-success" />
              <span className="font-medium">{completedCount}</span>
              <span className="text-muted-foreground">all-time completed</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-medium">{activeGoals.length}</span>
              <span className="text-muted-foreground">in progress</span>
            </div>
            {streaks.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Flame className="w-4 h-4 text-warning" />
                <span className="font-medium">
                  {Math.max(...streaks.map(s => s.currentStreak), 0)}
                </span>
                <span className="text-muted-foreground">best streak</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Streak Display */}
        {streaks.length > 0 && <StreakDisplay streaks={streaks} />}
        
        {/* Streak Cards */}
        {streaks.length > 0 && <StreakCards streaks={streaks} />}

        {goals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No goals set yet</p>
            <p className="text-sm mt-1">Create your first goal to start tracking progress</p>
          </div>
        ) : (
          <>
            <h4 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Current Goals
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map(goal => (
                <GoalCard 
                  key={goal.id} 
                  goal={goal} 
                  onDelete={deleteGoal}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
