import React, { useState } from 'react';
import { usePerformanceAlerts, PerformanceTarget } from '@/hooks/usePerformanceAlerts';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Target, Plus, Trash2, Users, User, Phone, TrendingUp, Percent, Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';

const METRICS = [
  { value: 'calls', label: 'Total Calls', icon: Phone },
  { value: 'leads', label: 'Leads Generated', icon: TrendingUp },
  { value: 'conversion_rate', label: 'Conversion Rate (%)', icon: Percent },
  { value: 'talk_time', label: 'Talk Time (mins)', icon: Clock },
];

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const PerformanceTargetsManager: React.FC = () => {
  const { targets, isLoading, isAdmin, createTarget, deleteTarget, updateTarget } = usePerformanceAlerts();
  const { teams, agents } = useTeamManagement();
  const { canDeleteRecords } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState<'team' | 'agent'>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [metric, setMetric] = useState<string>('calls');
  const [targetValue, setTargetValue] = useState<string>('');
  const [thresholdPercentage, setThresholdPercentage] = useState<string>('80');
  const [period, setPeriod] = useState<string>('daily');

  const resetForm = () => {
    setTargetType('team');
    setSelectedTeamId('');
    setSelectedAgentId('');
    setMetric('calls');
    setTargetValue('');
    setThresholdPercentage('80');
    setPeriod('daily');
  };

  const handleCreateTarget = () => {
    if (!targetValue || parseFloat(targetValue) <= 0) return;

    createTarget.mutate({
      target_type: targetType,
      team_id: targetType === 'team' ? selectedTeamId : undefined,
      agent_id: targetType === 'agent' ? selectedAgentId : undefined,
      metric,
      target_value: parseFloat(targetValue),
      threshold_percentage: parseFloat(thresholdPercentage),
      period,
    });

    setDialogOpen(false);
    resetForm();
  };

  const handleToggleActive = (target: PerformanceTarget) => {
    updateTarget.mutate({
      id: target.id,
      is_active: !target.is_active,
    });
  };

  const getMetricLabel = (metricValue: string) => {
    return METRICS.find(m => m.value === metricValue)?.label || metricValue;
  };

  const getPeriodLabel = (periodValue: string) => {
    return PERIODS.find(p => p.value === periodValue)?.label || periodValue;
  };

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance Targets
          </CardTitle>
          <CardDescription>Set targets for teams and agents to trigger alerts</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Target
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Performance Target</DialogTitle>
              <DialogDescription>
                Set a target for a team or agent. Alerts will be triggered when performance falls below the threshold.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as 'team' | 'agent')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Team
                      </div>
                    </SelectItem>
                    <SelectItem value="agent">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Agent
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'team' && (
                <div className="space-y-2">
                  <Label>Select Team</Label>
                  <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {targetType === 'agent' && (
                <div className="space-y-2">
                  <Label>Select Agent</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter(a => a.is_active).map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name || agent.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <m.icon className="w-4 h-4" />
                          {m.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Value</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder={metric === 'conversion_rate' ? 'e.g., 25' : 'e.g., 50'}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alert Threshold (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g., 80"
                    value={thresholdPercentage}
                    onChange={(e) => setThresholdPercentage(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {p.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateTarget} 
                disabled={
                  !targetValue || 
                  (targetType === 'team' && !selectedTeamId) || 
                  (targetType === 'agent' && !selectedAgentId)
                }
              >
                Create Target
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {targets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No performance targets set yet.</p>
            <p className="text-sm">Create targets to start monitoring performance.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map(target => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Badge variant={target.target_type === 'team' ? 'default' : 'secondary'}>
                      {target.target_type === 'team' ? (
                        <><Users className="w-3 h-3 mr-1" /> Team</>
                      ) : (
                        <><User className="w-3 h-3 mr-1" /> Agent</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {target.team_name || target.agent_name || 'Unknown'}
                  </TableCell>
                  <TableCell>{getMetricLabel(target.metric)}</TableCell>
                <TableCell>
                    {target.target_value}
                    {target.metric === 'conversion_rate' && '%'}
                    {target.metric === 'talk_time' && ' mins'}
                  </TableCell>
                  <TableCell>{target.threshold_percentage}%</TableCell>
                  <TableCell>{getPeriodLabel(target.period)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={target.is_active}
                      onCheckedChange={() => handleToggleActive(target)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {canDeleteRecords && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Target?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the target and all associated alerts. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteTarget.mutate(target.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
