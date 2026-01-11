import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Upload, ArrowRight, Sparkles, Calendar, Filter, X, Zap, Save, Trash2, Star, Download, UploadCloud, Link2, Check, BarChart3, RotateCcw, Tag, Plus, Pencil, Palette, Copy, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow, startOfMonth, endOfMonth, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { CallsChart } from '@/components/dashboard/CallsChart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { TeamLeaderboard } from '@/components/dashboard/TeamLeaderboard';
import { DailyGoalProgress } from '@/components/dashboard/DailyGoalProgress';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { PerformanceInsights } from '@/components/dashboard/PerformanceInsights';
import { AllAgentsStatsGrid } from '@/components/dashboard/AllAgentsStatsGrid';
import { AgentPerformanceList } from '@/components/dashboard/AgentPerformanceList';
import { FeedbackBreakdownChart } from '@/components/dashboard/FeedbackBreakdownChart';

import { TopPerformersCard } from '@/components/dashboard/TopPerformersCard';
import { usePerformanceData, DashboardTimePeriod, DashboardLeadStatusFilter } from '@/hooks/usePerformanceData';
import { useAllAgentsPerformance } from '@/hooks/useAllAgentsPerformance';
import { useCustomFilterPresets, CustomPreset, DEFAULT_CATEGORIES, CUSTOM_CATEGORY_COLORS } from '@/hooks/useCustomFilterPresets';
import { CategoryColorPicker } from '@/components/ui/CategoryColorPicker';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
interface FilterPreset {
  name: string;
  description: string;
  timePeriod: DashboardTimePeriod;
  leadStatus: DashboardLeadStatusFilter;
  shortcut?: string;
}

const filterPresets: FilterPreset[] = [
  { name: "Today's Focus", description: 'All activity today', timePeriod: 'today', leadStatus: 'all', shortcut: '1' },
  { name: 'Weekly Review', description: "This week's performance", timePeriod: 'this_week', leadStatus: 'all', shortcut: '2' },
  { name: 'Monthly Overview', description: 'Full month analysis', timePeriod: 'this_month', leadStatus: 'all', shortcut: '3' },
  { name: 'Hot Leads', description: "Today's matched leads", timePeriod: 'today', leadStatus: 'matched', shortcut: '4' },
  { name: 'Weekly Conversions', description: "This week's matched leads", timePeriod: 'this_week', leadStatus: 'matched' },
  { name: 'Needs Follow-up', description: 'Unmatched this week', timePeriod: 'this_week', leadStatus: 'unmatched' },
  { name: '6 Month Trend', description: 'Long-term performance', timePeriod: 'six_months', leadStatus: 'all' },
];

export const Dashboard: React.FC = () => {
  const { profile, userRole } = useAuth();
  
  // View mode: 'personal' or 'team'
  const [viewMode, setViewMode] = useState<'personal' | 'team'>(() => {
    const saved = localStorage.getItem('dashboard-view-mode');
    return (saved as 'personal' | 'team') || 'team';
  });
  
  // Team view filters
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => endOfMonth(new Date()));
  
  const [timePeriod, setTimePeriod] = useState<DashboardTimePeriod>(() => {
    const saved = localStorage.getItem('dashboard-time-period');
    return (saved as DashboardTimePeriod) || 'today';
  });
  
  const [leadStatusFilter, setLeadStatusFilter] = useState<DashboardLeadStatusFilter>(() => {
    const saved = localStorage.getItem('dashboard-lead-filter');
    return (saved as DashboardLeadStatusFilter) || 'all';
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('Rose');
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [presetToDuplicate, setPresetToDuplicate] = useState<CustomPreset | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  
  const { customPresets, savePreset, deletePreset, duplicatePreset, exportPresets, importPresets, generateShareLink, getPendingSharedPresets, importFromData, trackPresetUsage, getPresetAnalytics, resetUsageStats, getCategories, getPresetsByCategory, addCategory, updateCategoryColor, deleteCategory, isDefaultCategory, getCategoryColor, customCategories } = useCustomFilterPresets('dashboard-custom-presets');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [linkCopied, setLinkCopied] = React.useState(false);
  
  // All agents performance hook
  const { 
    agents, 
    agentStats, 
    summary: allAgentsSummary, 
    isLoading: allAgentsLoading, 
    refetch: refetchAllAgents 
  } = useAllAgentsPerformance({
    selectedAgentId,
    dateFrom,
    dateTo,
  });

  const handleViewModeChange = (mode: 'personal' | 'team') => {
    setViewMode(mode);
    localStorage.setItem('dashboard-view-mode', mode);
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgentId(value === 'all' ? null : value);
  };

  const dateRangeLabel = `${format(dateFrom, 'MMM d')} - ${format(dateTo, 'MMM d, yyyy')}`;

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
    const link = generateShareLink('/dashboard');
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleTimePeriodChange = (value: DashboardTimePeriod) => {
    setTimePeriod(value);
    localStorage.setItem('dashboard-time-period', value);
  };

  const handleLeadStatusChange = (value: DashboardLeadStatusFilter) => {
    setLeadStatusFilter(value);
    localStorage.setItem('dashboard-lead-filter', value);
  };

  const applyPreset = useCallback((preset: FilterPreset | CustomPreset) => {
    handleTimePeriodChange(preset.timePeriod as DashboardTimePeriod);
    handleLeadStatusChange(preset.leadStatus as DashboardLeadStatusFilter);
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
    savePreset(newPresetName.trim(), timePeriod, leadStatusFilter, newPresetCategory || undefined);
    toast.success(`Saved preset "${newPresetName.trim()}"`);
    setNewPresetName('');
    setNewPresetCategory('');
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setSaveDialogOpen(false);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    const success = addCategory(newCategoryName.trim(), newCategoryColor);
    if (success) {
      setNewPresetCategory(newCategoryName.trim());
      toast.success(`Created category "${newCategoryName.trim()}"`);
    } else {
      toast.error('Category already exists');
    }
    setNewCategoryName('');
    setNewCategoryColor('Rose');
    setIsCreatingCategory(false);
  };

  const handleUpdateCategoryColor = (category: string, colorName: string) => {
    const success = updateCategoryColor(category, colorName);
    if (success) {
      toast.success(`Updated color for "${category}"`);
    }
  };

  const handleDeleteCategory = (category: string) => {
    const success = deleteCategory(category);
    if (success) {
      toast.success(`Deleted category "${category}"`);
      if (newPresetCategory === category) {
        setNewPresetCategory('');
      }
    } else {
      toast.error('Cannot delete default categories');
    }
  };

  const handleDeletePreset = (preset: CustomPreset) => {
    deletePreset(preset.id);
    toast.success(`Deleted preset "${preset.name}"`);
  };

  const handleResetUsageStats = () => {
    resetUsageStats();
    toast.success('Usage statistics reset');
  };

  const handleOpenDuplicateDialog = (preset: CustomPreset) => {
    setPresetToDuplicate(preset);
    setDuplicateName(`${preset.name} (Copy)`);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicatePreset = () => {
    if (!presetToDuplicate || !duplicateName.trim()) {
      toast.error('Please enter a name for the duplicate');
      return;
    }
    const result = duplicatePreset(presetToDuplicate.id, duplicateName.trim());
    if (result) {
      toast.success(`Created duplicate "${duplicateName.trim()}"`);
      setDuplicateDialogOpen(false);
      setPresetToDuplicate(null);
      setDuplicateName('');
    } else {
      toast.error('Failed to duplicate preset');
    }
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
  
  const { myStats, hourlyData, weeklyData, recentActivity, leaderboard, isLoading, refetch } = usePerformanceData({
    timePeriod,
    leadStatusFilter,
  });

  const getTimePeriodLabel = (period: DashboardTimePeriod) => {
    const labels: Record<DashboardTimePeriod, string> = {
      today: 'Today',
      this_week: 'This Week',
      this_month: 'This Month',
      six_months: '6 Months',
    };
    return labels[period];
  };

  const getLeadStatusLabel = (status: DashboardLeadStatusFilter) => {
    const labels: Record<DashboardLeadStatusFilter, string> = {
      all: 'All Leads',
      matched: 'Matched',
      unmatched: 'Unmatched',
    };
    return labels[status];
  };

  const hasActiveFilters = timePeriod !== 'today' || leadStatusFilter !== 'all';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {viewMode === 'team' ? 'Team Dashboard' : `${greeting()}, ${profile?.full_name?.split(' ')[0] || 'Agent'}!`}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-lg">
              {viewMode === 'team' 
                ? 'Overview of all agents performance. Filter by agent and date range.'
                : 'Here\'s your real-time performance dashboard. Track your calls, monitor your goals, and stay ahead of the competition.'}
            </p>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant={viewMode === 'team' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('team')}
                className={`gap-2 ${viewMode === 'team' ? 'bg-sidebar-background text-sidebar-foreground hover:bg-sidebar-background/90' : ''}`}
              >
                <Users className="w-4 h-4" />
                Team View
              </Button>
              <Button
                variant={viewMode === 'personal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('personal')}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                My Performance
              </Button>
            </div>
            
            {/* Team View Filters */}
            {viewMode === 'team' && (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Select value={selectedAgentId || 'all'} onValueChange={handleAgentChange}>
                  <SelectTrigger className="w-[200px] bg-background/80">
                    <Users className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-background/80">
                      <Calendar className="w-4 h-4" />
                      {dateRangeLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex">
                      <div className="p-3 border-r">
                        <p className="text-sm font-medium mb-2">From</p>
                        <CalendarComponent
                          mode="single"
                          selected={dateFrom}
                          onSelect={(date) => date && setDateFrom(date)}
                          initialFocus
                        />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium mb-2">To</p>
                        <CalendarComponent
                          mode="single"
                          selected={dateTo}
                          onSelect={(date) => date && setDateTo(date)}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                {selectedAgentId && (
                  <Badge variant="secondary" className="gap-1">
                    Agent: {agents.find(a => a.id === selectedAgentId)?.name}
                    <button onClick={() => setSelectedAgentId(null)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
            {/* Active Filter Badges */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">Active filters:</span>
                {timePeriod !== 'today' && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    {getTimePeriodLabel(timePeriod)}
                    <button
                      onClick={() => handleTimePeriodChange('today')}
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
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {/* Filter Presets */}
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
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
                      {Object.entries(getPresetsByCategory).map(([category, presets]) => {
                        const categoryColor = getCategoryColor(category);
                        return (
                        <React.Fragment key={category}>
                          {Object.keys(getPresetsByCategory).length > 1 && (
                            <div className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5 ${categoryColor.text}`}>
                              <span className={`w-2 h-2 rounded-full ${categoryColor.dot}`} />
                              {category}
                            </div>
                          )}
                          {presets.map((preset) => {
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
                                            {preset.lastUsedAt ? (
                                              <span>Last used {formatDistanceToNow(new Date(preset.lastUsedAt), { addSuffix: true })}</span>
                                            ) : (
                                              <span>Never used</span>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {getTimePeriodLabel(preset.timePeriod as DashboardTimePeriod)} · {getLeadStatusLabel(preset.leadStatus as DashboardLeadStatusFilter)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDuplicateDialog(preset);
                                    }}
                                    className="p-1 hover:text-primary"
                                    title="Duplicate preset"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePreset(preset);
                                    }}
                                    className="p-1 hover:text-destructive"
                                    title="Delete preset"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </React.Fragment>
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
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    Reset
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Reset Usage Statistics?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will clear all usage counts and last used dates for your custom presets. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleResetUsageStats}>
                                      Reset Stats
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                  <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
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
                        placeholder="e.g., My Weekly Review"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preset-category">Category (optional)</Label>
                      {isCreatingCategory ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="New category name"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                              autoFocus
                              className="flex-1"
                            />
                            <Button size="sm" onClick={handleCreateCategory}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setIsCreatingCategory(false);
                              setNewCategoryName('');
                              setNewCategoryColor('Rose');
                            }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Color:</Label>
                            <CategoryColorPicker
                              selectedColor={newCategoryColor}
                              onColorSelect={setNewCategoryColor}
                            />
                          </div>
                        </div>
                      ) : (
                        <Select value={newPresetCategory} onValueChange={setNewPresetCategory}>
                          <SelectTrigger id="preset-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No category</SelectItem>
                            {getCategories.map((cat) => {
                              const catColor = getCategoryColor(cat);
                              return (
                              <SelectItem key={cat} value={cat}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full ${catColor.dot}`} />
                                  <span className={catColor.text}>{cat}</span>
                                  {!isDefaultCategory(cat) && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Custom</Badge>
                                  )}
                                </div>
                              </SelectItem>
                              );
                            })}
                            <DropdownMenuSeparator />
                            <div 
                              className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                              onClick={() => setIsCreatingCategory(true)}
                            >
                              <Plus className="w-3 h-3" />
                              Create new category
                            </div>
                          </SelectContent>
                        </Select>
                      )}
                      {/* Show custom categories with color picker and delete option */}
                      {customCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {customCategories.map(cat => {
                            const catColor = getCategoryColor(cat.name);
                            return (
                            <Badge key={cat.name} variant="outline" className={`gap-1 text-xs ${catColor.bg} ${catColor.text} ${catColor.border} group`}>
                              <span className={`w-2 h-2 rounded-full ${catColor.dot}`} />
                              {cat.name}
                              <CategoryColorPicker
                                selectedColor={cat.colorName}
                                onColorSelect={(color) => handleUpdateCategoryColor(cat.name, color)}
                                triggerClassName="h-5 px-1 py-0 border-0 bg-transparent hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                              <button
                                onClick={() => handleDeleteCategory(cat.name)}
                                className="ml-0.5 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                            );
                          })}
                        </div>
                      )}
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

              {/* Duplicate Preset Dialog */}
              <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Duplicate Preset</DialogTitle>
                    <DialogDescription>
                      Create a copy of "{presetToDuplicate?.name}" with a new name.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="duplicate-name">New Preset Name</Label>
                      <Input
                        id="duplicate-name"
                        placeholder="Enter name for the duplicate"
                        value={duplicateName}
                        onChange={(e) => setDuplicateName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDuplicatePreset()}
                        autoFocus
                      />
                    </div>
                    {presetToDuplicate && (
                      <div className="rounded-lg bg-muted p-3 space-y-1">
                        <p className="text-sm font-medium">Original Preset Settings:</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            {getTimePeriodLabel(presetToDuplicate.timePeriod as DashboardTimePeriod)}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Filter className="w-3 h-3" />
                            {getLeadStatusLabel(presetToDuplicate.leadStatus as DashboardLeadStatusFilter)}
                          </Badge>
                          {presetToDuplicate.category && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Tag className="w-3 h-3" />
                              {presetToDuplicate.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleDuplicatePreset} className="gap-2">
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              
              {/* Import/Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
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
            </div>
            {/* Custom Filters */}
            <div className="flex flex-wrap gap-2">
              <Select value={timePeriod} onValueChange={handleTimePeriodChange}>
                <SelectTrigger className="w-[140px] bg-background/50 backdrop-blur-sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="six_months">6 Months</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={leadStatusFilter} onValueChange={handleLeadStatusChange}>
                <SelectTrigger className="w-[150px] bg-background/50 backdrop-blur-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Lead status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2 bg-background/50 backdrop-blur-sm">
                <Link to="/upload">
                  <Upload className="w-4 h-4" />
                  Upload Contacts
                </Link>
              </Button>
              <Button asChild className="gap-2 shadow-lg">
                <Link to="/call-list">
                  <Phone className="w-4 h-4" />
                  Start Calling
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'team' ? (
        <>
          {/* Team Stats Grid */}
          <AllAgentsStatsGrid 
            summary={allAgentsSummary} 
            isLoading={allAgentsLoading} 
            onRefresh={refetchAllAgents}
            dateRangeLabel={dateRangeLabel}
          />
          
          {/* Agent Performance List */}
          <AgentPerformanceList 
            agents={agentStats} 
            isLoading={allAgentsLoading} 
            summary={allAgentsSummary}
            dateRangeLabel={dateRangeLabel}
          />
          
          {/* Team Leaderboard */}
          <TeamLeaderboard data={leaderboard} isLoading={isLoading} />
        </>
      ) : (
        <>
          {/* Stats Grid */}
          <StatsGrid stats={myStats} isLoading={isLoading} onRefresh={refetch} />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Charts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Hourly Calls & Conversion */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <CallsChart data={hourlyData} isLoading={isLoading} />
                <ConversionChart stats={myStats} isLoading={isLoading} />
              </div>
              
              {/* Weekly Trend */}
              <WeeklyTrendChart data={weeklyData} isLoading={isLoading} />
            </div>

            {/* Right Column - Goals & Activity */}
            <div className="space-y-6">
              <DailyGoalProgress stats={myStats} isLoading={isLoading} />
              <RecentActivityFeed activities={recentActivity} isLoading={isLoading} />
            </div>
          </div>

          {/* Middle Row - New Analytics Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeedbackBreakdownChart stats={myStats} isLoading={isLoading} />
            <TopPerformersCard 
              performers={leaderboard.slice(0, 3).map(l => ({
                id: l.agentId,
                name: l.agentName,
                totalCalls: l.totalCalls,
                interested: l.interested,
                conversionRate: l.conversionRate,
                rank: l.rank,
              }))}
              isLoading={isLoading}
              currentUserId={profile?.id}
            />
            <PerformanceInsights 
              stats={myStats} 
              hourlyData={hourlyData} 
              isLoading={isLoading} 
            />
          </div>

          {/* Bottom Row - Leaderboard */}
          <TeamLeaderboard data={leaderboard} isLoading={isLoading} />
        </>
      )}

      {/* Quick Actions Card */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="default" className="gap-2">
            <Link to="/call-list">
              <Phone className="w-4 h-4" />
              Continue Calling
            </Link>
          </Button>
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/upload">
              <Upload className="w-4 h-4" />
              Upload New Contacts
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};