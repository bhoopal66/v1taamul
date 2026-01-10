import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Phone,
  Target,
  Users,
  Crown,
  Sparkles,
  Calendar,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Zap,
  Save,
  Trash2,
  Star,
  Download,
  UploadCloud,
  Link2,
  Check,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { useLeaderboard, TimePeriod, LeaderboardAgent, TeamStats, LeadStatusFilter } from '@/hooks/useLeaderboard';
import { useCustomFilterPresets, CustomPreset } from '@/hooks/useCustomFilterPresets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg">
        <Crown className="w-5 h-5" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow">
        <Medal className="w-5 h-5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow">
        <Award className="w-5 h-5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-bold">
      {rank}
    </div>
  );
};

const TrendIndicator: React.FC<{ trend: LeaderboardAgent['trend']; previousRank: number | null }> = ({ 
  trend, 
  previousRank 
}) => {
  if (trend === 'new') {
    return (
      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
        <Sparkles className="w-3 h-3 mr-1" />
        New
      </Badge>
    );
  }
  if (trend === 'up') {
    return (
      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
        <ArrowUp className="w-3 h-3 mr-1" />
        Up
      </Badge>
    );
  }
  if (trend === 'down') {
    return (
      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
        <ArrowDown className="w-3 h-3 mr-1" />
        Down
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      <Minus className="w-3 h-3 mr-1" />
      Same
    </Badge>
  );
};

const TopThreeCards: React.FC<{ agents: LeaderboardAgent[] }> = ({ agents }) => {
  const top3 = agents.slice(0, 3);
  
  if (top3.length === 0) return null;

  const getGradient = (rank: number) => {
    if (rank === 1) return 'from-yellow-400/20 via-amber-400/10 to-transparent border-yellow-400/50';
    if (rank === 2) return 'from-slate-300/20 via-slate-300/10 to-transparent border-slate-400/50';
    if (rank === 3) return 'from-amber-600/20 via-amber-600/10 to-transparent border-amber-600/50';
    return '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {top3.map((agent, index) => (
        <Card 
          key={agent.id} 
          className={cn(
            'relative overflow-hidden border-2',
            getGradient(index + 1),
            index === 0 && 'md:order-2 md:scale-105 md:z-10',
            index === 1 && 'md:order-1',
            index === 2 && 'md:order-3'
          )}
        >
          <div className={cn(
            'absolute inset-0 bg-gradient-to-b opacity-50',
            getGradient(index + 1)
          )} />
          <CardContent className="relative pt-6 text-center">
            <div className="mb-4">
              <RankBadge rank={index + 1} />
            </div>
            <Avatar className="w-16 h-16 mx-auto mb-3 ring-4 ring-background shadow-xl">
              <AvatarImage src={agent.avatarUrl || ''} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {agent.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-bold text-lg">{agent.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">@{agent.username}</p>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Calls</p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.interestedCalls}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-lg font-bold">{agent.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conv.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const TeamComparisonCard: React.FC<{ teams: TeamStats[] }> = ({ teams }) => {
  if (teams.length === 0) return null;

  const maxCalls = Math.max(...teams.map(t => t.totalCalls), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team Comparison
        </CardTitle>
        <CardDescription>Compare performance across teams</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {teams.map((team, index) => (
          <div key={team.supervisorId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm w-6">#{index + 1}</span>
                <span className="font-medium">{team.teamName}'s Team</span>
                <Badge variant="outline" className="text-xs">
                  {team.totalAgents} agents
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {team.totalCalls}
                </span>
                <span className="text-muted-foreground">
                  <Target className="w-3 h-3 inline mr-1" />
                  {team.totalLeads}
                </span>
                <Badge variant="secondary">{team.avgConversionRate}%</Badge>
              </div>
            </div>
            <Progress 
              value={(team.totalCalls / maxCalls) * 100} 
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const Leaderboard: React.FC = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(() => {
    const saved = localStorage.getItem('leaderboard-time-period');
    return (saved as TimePeriod) || 'this_week';
  });
  
  const [teamFilter, setTeamFilter] = useState<string>(() => {
    return localStorage.getItem('leaderboard-team-filter') || 'all';
  });
  
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatusFilter>(() => {
    const saved = localStorage.getItem('leaderboard-lead-filter');
    return (saved as LeadStatusFilter) || 'all';
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  
  const { customPresets, savePreset, deletePreset, exportPresets, importPresets, generateShareLink, getPendingSharedPresets, importFromData, trackPresetUsage, getPresetAnalytics, resetUsageStats } = useCustomFilterPresets('leaderboard-custom-presets');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [linkCopied, setLinkCopied] = React.useState(false);

  // Handle shared presets from URL
  useEffect(() => {
    const pending = getPendingSharedPresets();
    if (pending && pending.length > 0) {
      const result = importFromData(pending);
      toast.success(`Imported ${result.imported} shared preset(s) from link`);
    }
  }, [getPendingSharedPresets, importFromData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await importPresets(file);
      toast.success(`Imported ${result.imported} preset(s)${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import presets');
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    if (customPresets.length === 0) {
      toast.error('No custom presets to export');
      return;
    }
    exportPresets();
    toast.success(`Exported ${customPresets.length} preset(s)`);
  };

  const handleShareLink = async () => {
    if (customPresets.length === 0) {
      toast.error('No custom presets to share');
      return;
    }
    const link = generateShareLink('/leaderboard');
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleTimePeriodChange = (value: TimePeriod) => {
    setTimePeriod(value);
    localStorage.setItem('leaderboard-time-period', value);
  };

  const handleTeamFilterChange = (value: string) => {
    setTeamFilter(value);
    localStorage.setItem('leaderboard-team-filter', value);
  };

  const handleLeadStatusChange = (value: LeadStatusFilter) => {
    setLeadStatusFilter(value);
    localStorage.setItem('leaderboard-lead-filter', value);
  };
  
  const { agents, teamStats, totalAgents, periodLabel, isLoading } = useLeaderboard({
    timePeriod,
    teamFilter: teamFilter === 'all' ? null : teamFilter,
    leadStatusFilter,
  });

  const getTimePeriodLabel = (period: TimePeriod) => {
    const labels: Record<TimePeriod, string> = {
      today: 'Today',
      this_week: 'This Week',
      last_week: 'Last Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      six_months: '6 Months',
      all_time: 'All Time',
    };
    return labels[period];
  };

  const getLeadStatusLabel = (status: LeadStatusFilter) => {
    const labels: Record<LeadStatusFilter, string> = {
      all: 'All Leads',
      matched: 'Matched',
      unmatched: 'Unmatched',
    };
    return labels[status];
  };

  const getTeamName = () => {
    if (teamFilter === 'all') return null;
    const team = teamStats.find(t => t.supervisorId === teamFilter);
    return team ? `${team.teamName}'s Team` : null;
  };

  const hasActiveFilters = timePeriod !== 'this_week' || leadStatusFilter !== 'all' || teamFilter !== 'all';

  interface FilterPreset {
    name: string;
    description: string;
    timePeriod: TimePeriod;
    leadStatus: LeadStatusFilter;
    shortcut?: string;
  }

  const filterPresets: FilterPreset[] = [
    { name: "Today's Rankings", description: 'Live standings today', timePeriod: 'today', leadStatus: 'all', shortcut: '1' },
    { name: 'Weekly Performance', description: 'This week rankings', timePeriod: 'this_week', leadStatus: 'all', shortcut: '2' },
    { name: 'Monthly Champions', description: 'Full month standings', timePeriod: 'this_month', leadStatus: 'all', shortcut: '3' },
    { name: 'Top Converters', description: 'This week with leads', timePeriod: 'this_week', leadStatus: 'matched', shortcut: '4' },
    { name: 'All-Time Legends', description: 'Career rankings', timePeriod: 'all_time', leadStatus: 'all' },
    { name: 'Need Support', description: 'No leads this week', timePeriod: 'this_week', leadStatus: 'unmatched' },
    { name: 'Last Week Review', description: 'Previous week analysis', timePeriod: 'last_week', leadStatus: 'all' },
  ];

  const applyPreset = useCallback((preset: FilterPreset | CustomPreset) => {
    handleTimePeriodChange(preset.timePeriod as TimePeriod);
    handleLeadStatusChange(preset.leadStatus as LeadStatusFilter);
    // Track usage for custom presets
    if ('id' in preset && preset.id.startsWith('custom-')) {
      trackPresetUsage(preset.id);
    }
  }, [trackPresetUsage]);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }
    savePreset(newPresetName.trim(), timePeriod, leadStatusFilter);
    toast.success(`Saved preset "${newPresetName.trim()}"`);
    setNewPresetName('');
    setSaveDialogOpen(false);
  };

  const handleDeletePreset = (preset: CustomPreset) => {
    deletePreset(preset.id);
    toast.success(`Deleted preset "${preset.name}"`);
  };

  const handleResetUsageStats = () => {
    resetUsageStats();
    toast.success('Usage statistics reset');
  };

  // Keyboard shortcuts for filter presets (Ctrl+1, Ctrl+2, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const preset = filterPresets.find(p => p.shortcut === e.key);
        if (preset) {
          e.preventDefault();
          applyPreset(preset);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyPreset]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalAgents} agents ranked · {periodLabel}
          </p>
          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {timePeriod !== 'this_week' && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Calendar className="w-3 h-3" />
                  {getTimePeriodLabel(timePeriod)}
                  <button
                    onClick={() => handleTimePeriodChange('this_week')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {leadStatusFilter !== 'all' && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Filter className="w-3 h-3" />
                  {getLeadStatusLabel(leadStatusFilter)}
                  <button
                    onClick={() => handleLeadStatusChange('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {teamFilter !== 'all' && getTeamName() && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Users className="w-3 h-3" />
                  {getTeamName()}
                  <button
                    onClick={() => handleTeamFilterChange('all')}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Filters Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Quick Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Built-in Presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </div>
                  {preset.shortcut && (
                    <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
                      <span className="text-xs">⌘</span>{preset.shortcut}
                    </kbd>
                  )}
                </DropdownMenuItem>
              ))}
              
              {customPresets.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    My Presets
                  </DropdownMenuLabel>
                  {customPresets.map((preset) => {
                    const analytics = getPresetAnalytics().find(a => a.id === preset.id);
                    return (
                      <DropdownMenuItem
                        key={preset.id}
                        className="flex items-center justify-between gap-2 cursor-pointer group"
                      >
                        <div 
                          className="flex flex-col gap-0.5 flex-1"
                          onClick={() => applyPreset(preset)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{preset.name}</span>
                            {analytics && analytics.useCount > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5 cursor-help">
                                      <BarChart3 className="w-2.5 h-2.5" />
                                      {analytics.useCount}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p className="font-medium">Used {analytics.useCount} time{analytics.useCount !== 1 ? 's' : ''}</p>
                                    {analytics.lastUsedAt && (
                                      <p className="text-muted-foreground">
                                        Last used {formatDistanceToNow(analytics.lastUsedAt, { addSuffix: true })}
                                        <br />
                                        {format(analytics.lastUsedAt, 'MMM d, yyyy h:mm a')}
                                      </p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {getTimePeriodLabel(preset.timePeriod as TimePeriod)} · {getLeadStatusLabel(preset.leadStatus as LeadStatusFilter)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePreset(preset);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </DropdownMenuItem>
                    );
                  })}
                  
                  {/* Usage Analytics Summary */}
                  {getPresetAnalytics().some(a => a.useCount > 0) && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            Usage Analytics
                          </span>
                          <button
                            onClick={handleResetUsageStats}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Reset
                          </button>
                        </div>
                        <div className="space-y-1">
                          {getPresetAnalytics().slice(0, 3).map(a => (
                            <div key={a.id} className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${a.usagePercentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-8 text-right">
                                {a.usagePercentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Save Current Filters */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Save className="w-4 h-4" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Save Filter Preset</DialogTitle>
                <DialogDescription>
                  Save your current filter combination for quick access later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-name">Preset Name</Label>
                  <Input
                    id="preset-name"
                    placeholder="e.g., Top Performers This Month"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  />
                </div>
                <div className="rounded-lg bg-muted p-3 space-y-1">
                  <p className="text-sm font-medium">Current Filters:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {getTimePeriodLabel(timePeriod)}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Filter className="w-3 h-3" />
                      {getLeadStatusLabel(leadStatusFilter)}
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePreset} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Preset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Import/Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <UploadCloud className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Manage Presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShareLink} className="gap-2 cursor-pointer">
                {linkCopied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                Share via Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer">
                <Download className="w-4 h-4" />
                Export as File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                Import from File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          
          <Select value={timePeriod} onValueChange={handleTimePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="six_months">6 Months</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={leadStatusFilter} onValueChange={handleLeadStatusChange}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Lead status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leads</SelectItem>
              <SelectItem value="matched">Matched (Has Leads)</SelectItem>
              <SelectItem value="unmatched">Unmatched (No Leads)</SelectItem>
            </SelectContent>
          </Select>
          
          {teamStats.length > 0 && (
            <Select value={teamFilter} onValueChange={handleTeamFilterChange}>
              <SelectTrigger className="w-[160px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamStats.map(team => (
                  <SelectItem key={team.supervisorId} value={team.supervisorId}>
                    {team.teamName}'s Team
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Top 3 Showcase */}
      <TopThreeCards agents={agents} />

      {/* Tabs for Rankings and Teams */}
      <Tabs defaultValue="rankings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rankings" className="gap-2">
            <Medal className="w-4 h-4" />
            Full Rankings
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            Team Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle>Full Rankings</CardTitle>
              <CardDescription>All agents ranked by call volume</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Trend</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Interested</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No data available for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((agent) => (
                      <TableRow 
                        key={agent.id}
                        className={cn(
                          agent.rank <= 3 && 'bg-muted/30'
                        )}
                      >
                        <TableCell>
                          <RankBadge rank={agent.rank} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={agent.avatarUrl || ''} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {agent.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                @{agent.username}
                                {agent.supervisorName && ` · ${agent.supervisorName}'s team`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <TrendIndicator trend={agent.trend} previousRank={agent.previousRank} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {agent.totalCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-success">{agent.interestedCalls}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-info">{agent.leadsGenerated}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={agent.conversionRate >= 25 ? 'default' : 'secondary'}
                            className={agent.conversionRate >= 25 ? 'bg-success' : ''}
                          >
                            {agent.conversionRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams">
          <TeamComparisonCard teams={teamStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
