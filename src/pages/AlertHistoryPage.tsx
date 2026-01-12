import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle, 
  Clock, 
  History, 
  Filter, 
  Users, 
  User,
  Calendar,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCheck,
  Eye
} from 'lucide-react';
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';

interface AlertHistoryItem {
  id: string;
  target_id: string;
  alert_type: 'team' | 'agent';
  team_id: string | null;
  agent_id: string | null;
  metric: string;
  target_value: number;
  actual_value: number;
  percentage_achieved: number;
  alert_status: 'active' | 'acknowledged' | 'resolved';
  severity: 'warning' | 'critical';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  team_name?: string;
  agent_name?: string;
}

const METRIC_LABELS: Record<string, string> = {
  calls: 'Calls',
  leads: 'Leads',
  conversion_rate: 'Conversion Rate',
  total_calls: 'Total Calls',
  interested_count: 'Interested',
  leads_generated: 'Leads Generated',
};

const DATE_PRESETS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const AlertHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Selection state
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  
  // Filter states
  const [datePreset, setDatePreset] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  // Fetch all alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alert-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_alerts')
        .select(`
          *,
          teams:team_id(name),
          profiles:agent_id(full_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((alert: any) => ({
        ...alert,
        team_name: alert.teams?.name,
        agent_name: alert.profiles?.full_name || alert.profiles?.username,
      })) as AlertHistoryItem[];
    },
    enabled: !!user?.id,
  });

  // Fetch teams for filter
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch agents for filter
  const { data: agents = [] } = useQuery({
    queryKey: ['agents-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Calculate date range
  const dateRange = useMemo(() => {
    if (customStartDate && customEndDate) {
      return {
        start: startOfDay(new Date(customStartDate)),
        end: endOfDay(new Date(customEndDate)),
      };
    }

    const now = new Date();
    switch (datePreset) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case '90d':
        return { start: subDays(now, 90), end: now };
      default:
        return { start: null, end: null };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Date filter
      if (dateRange.start && dateRange.end) {
        const alertDate = new Date(alert.created_at);
        if (alertDate < dateRange.start || alertDate > dateRange.end) {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && alert.alert_status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && alert.alert_type !== typeFilter) {
        return false;
      }

      // Team filter
      if (teamFilter !== 'all' && alert.team_id !== teamFilter) {
        return false;
      }

      // Agent filter
      if (agentFilter !== 'all' && alert.agent_id !== agentFilter) {
        return false;
      }

      return true;
    });
  }, [alerts, dateRange, severityFilter, statusFilter, typeFilter, teamFilter, agentFilter]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, severityFilter, statusFilter, typeFilter, teamFilter, agentFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAlerts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

  // Stats
  const stats = useMemo(() => {
    const total = filteredAlerts.length;
    const critical = filteredAlerts.filter(a => a.severity === 'critical').length;
    const warning = filteredAlerts.filter(a => a.severity === 'warning').length;
    const active = filteredAlerts.filter(a => a.alert_status === 'active').length;
    const resolved = filteredAlerts.filter(a => a.alert_status === 'resolved').length;
    return { total, critical, warning, active, resolved };
  }, [filteredAlerts]);

  // Selection helpers
  const actionableAlerts = useMemo(() => 
    paginatedAlerts.filter(a => a.alert_status !== 'resolved'),
    [paginatedAlerts]
  );

  const selectedCount = selectedAlerts.size;
  const allPageSelected = actionableAlerts.length > 0 && 
    actionableAlerts.every(a => selectedAlerts.has(a.id));
  const somePageSelected = actionableAlerts.some(a => selectedAlerts.has(a.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      // Deselect all on current page
      const newSelection = new Set(selectedAlerts);
      actionableAlerts.forEach(a => newSelection.delete(a.id));
      setSelectedAlerts(newSelection);
    } else {
      // Select all actionable on current page
      const newSelection = new Set(selectedAlerts);
      actionableAlerts.forEach(a => newSelection.add(a.id));
      setSelectedAlerts(newSelection);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedAlerts);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAlerts(newSelection);
  };

  const clearSelection = () => setSelectedAlerts(new Set());

  // Bulk acknowledge mutation
  const bulkAcknowledge = useMutation({
    mutationFn: async (alertIds: string[]) => {
      const { error } = await supabase
        .from('performance_alerts')
        .update({
          alert_status: 'acknowledged',
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .in('id', alertIds);
      
      if (error) throw error;
    },
    onSuccess: (_, alertIds) => {
      toast.success(`${alertIds.length} alert(s) acknowledged`);
      queryClient.invalidateQueries({ queryKey: ['alert-history'] });
      queryClient.invalidateQueries({ queryKey: ['performance-alerts'] });
      clearSelection();
    },
    onError: (error) => {
      toast.error('Failed to acknowledge alerts: ' + error.message);
    },
  });

  // Bulk resolve mutation
  const bulkResolve = useMutation({
    mutationFn: async (alertIds: string[]) => {
      const { error } = await supabase
        .from('performance_alerts')
        .update({ alert_status: 'resolved' })
        .in('id', alertIds);
      
      if (error) throw error;
    },
    onSuccess: (_, alertIds) => {
      toast.success(`${alertIds.length} alert(s) resolved`);
      queryClient.invalidateQueries({ queryKey: ['alert-history'] });
      queryClient.invalidateQueries({ queryKey: ['performance-alerts'] });
      clearSelection();
    },
    onError: (error) => {
      toast.error('Failed to resolve alerts: ' + error.message);
    },
  });

  const handleBulkAcknowledge = () => {
    const ids = Array.from(selectedAlerts);
    if (ids.length > 0) {
      bulkAcknowledge.mutate(ids);
    }
  };

  const handleBulkResolve = () => {
    const ids = Array.from(selectedAlerts);
    if (ids.length > 0) {
      bulkResolve.mutate(ids);
    }
  };

  const clearFilters = () => {
    setDatePreset('30d');
    setCustomStartDate('');
    setCustomEndDate('');
    setSeverityFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setTeamFilter('all');
    setAgentFilter('all');
  };

  const hasActiveFilters = 
    datePreset !== '30d' || 
    customStartDate || 
    customEndDate || 
    severityFilter !== 'all' || 
    statusFilter !== 'all' || 
    typeFilter !== 'all' || 
    teamFilter !== 'all' || 
    agentFilter !== 'all';

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Team/Agent', 'Metric', 'Target', 'Actual', '% Achieved', 'Severity', 'Status'];
    const rows = filteredAlerts.map(alert => [
      format(new Date(alert.created_at), 'yyyy-MM-dd HH:mm'),
      alert.alert_type,
      alert.alert_type === 'team' ? alert.team_name : alert.agent_name,
      METRIC_LABELS[alert.metric] || alert.metric,
      alert.target_value,
      alert.actual_value,
      alert.percentage_achieved.toFixed(1),
      alert.severity,
      alert.alert_status,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alert-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityConfig = (severity: 'warning' | 'critical') => {
    if (severity === 'critical') {
      return {
        icon: <AlertOctagon className="w-4 h-4 text-destructive" />,
        badgeClass: 'bg-destructive text-destructive-foreground',
        bgClass: 'bg-destructive/5 border-destructive/30',
      };
    }
    return {
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      badgeClass: 'bg-amber-500 text-white',
      bgClass: 'bg-amber-500/5 border-amber-500/30',
    };
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { icon: <AlertTriangle className="w-3 h-3" />, label: 'Active', variant: 'destructive' as const };
      case 'acknowledged':
        return { icon: <Clock className="w-3 h-3" />, label: 'Acknowledged', variant: 'secondary' as const };
      case 'resolved':
        return { icon: <CheckCircle className="w-3 h-3" />, label: 'Resolved', variant: 'outline' as const };
      default:
        return { icon: null, label: status, variant: 'outline' as const };
    }
  };

  if (alertsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alert History</h1>
            <p className="text-muted-foreground">View and analyze past performance alerts</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportToCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Alerts</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
            <p className="text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-500">{stats.warning}</div>
            <p className="text-sm text-muted-foreground">Warning</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={datePreset} onValueChange={(v) => {
                setDatePreset(v);
                setCustomStartDate('');
                setCustomEndDate('');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {datePreset === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)} 
                  />
                </div>
              </>
            )}

            {/* Severity */}
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Team */}
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent */}
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg">
                Alerts ({filteredAlerts.length})
              </CardTitle>
              <CardDescription>
                {dateRange.start && dateRange.end 
                  ? `From ${format(dateRange.start, 'MMM d, yyyy')} to ${format(dateRange.end, 'MMM d, yyyy')}`
                  : 'All time'
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Show:</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => {
                setPageSize(Number(v));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {(selectedCount > 0 || actionableAlerts.length > 0) && (
            <div className="flex items-center justify-between mt-4 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all on page"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount > 0 
                    ? `${selectedCount} selected` 
                    : `Select alerts (${actionableAlerts.length} actionable on this page)`
                  }
                </span>
                {selectedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleBulkAcknowledge}
                  disabled={selectedCount === 0 || bulkAcknowledge.isPending}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Acknowledge ({selectedCount})
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleBulkResolve}
                  disabled={selectedCount === 0 || bulkResolve.isPending}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Resolve ({selectedCount})
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No alerts found matching your filters</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {paginatedAlerts.map((alert) => {
                    const severityConfig = getSeverityConfig(alert.severity || 'warning');
                    const statusConfig = getStatusConfig(alert.alert_status);
                    const isPercentage = alert.metric === 'conversion_rate';

                    const isActionable = alert.alert_status !== 'resolved';
                    const isSelected = selectedAlerts.has(alert.id);

                    return (
                      <div 
                        key={alert.id} 
                        className={`p-4 border rounded-lg space-y-3 ${alert.alert_status === 'active' ? severityConfig.bgClass : ''} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {isActionable && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(alert.id)}
                              aria-label={`Select alert`}
                              className="mt-1"
                            />
                          )}
                          {!isActionable && <div className="w-4" />}
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {severityConfig.icon}
                                <Badge variant={alert.alert_type === 'team' ? 'default' : 'secondary'}>
                                  {alert.alert_type === 'team' ? (
                                    <><Users className="w-3 h-3 mr-1" /> {alert.team_name}</>
                                  ) : (
                                    <><User className="w-3 h-3 mr-1" /> {alert.agent_name}</>
                                  )}
                                </Badge>
                                <Badge className={severityConfig.badgeClass}>
                                  {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={statusConfig.variant} className="gap-1">
                                  {statusConfig.icon}
                                  {statusConfig.label}
                                </Badge>
                              </div>
                            </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            {METRIC_LABELS[alert.metric] || alert.metric} below target
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Achieved {alert.actual_value}{isPercentage ? '%' : ''} of {alert.target_value}{isPercentage ? '%' : ''} target 
                            ({alert.percentage_achieved.toFixed(1)}%)
                          </p>
                        </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                <span title={format(new Date(alert.created_at), 'PPpp')}>
                                  {format(new Date(alert.created_at), 'MMM d, yyyy h:mm a')}
                                </span>
                                <span className="text-muted-foreground/60">
                                  ({formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })})
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1 mx-2">
                      {/* Show page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertHistoryPage;
