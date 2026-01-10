import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Upload, ArrowRight, Sparkles, Calendar, Filter, X, Zap, Save, Trash2, Star, Download, UploadCloud, Link2, Check, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { CallsChart } from '@/components/dashboard/CallsChart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { TeamLeaderboard } from '@/components/dashboard/TeamLeaderboard';
import { DailyGoalProgress } from '@/components/dashboard/DailyGoalProgress';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { PerformanceInsights } from '@/components/dashboard/PerformanceInsights';
import { usePerformanceData, DashboardTimePeriod, DashboardLeadStatusFilter } from '@/hooks/usePerformanceData';
import { useCustomFilterPresets, CustomPreset } from '@/hooks/useCustomFilterPresets';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
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
  const { profile } = useAuth();
  
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
  
  const { customPresets, savePreset, deletePreset, exportPresets, importPresets, generateShareLink, getPendingSharedPresets, importFromData, trackPresetUsage, getPresetAnalytics } = useCustomFilterPresets('dashboard-custom-presets');
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
    savePreset(newPresetName.trim(), timePeriod, leadStatusFilter);
    toast.success(`Saved preset "${newPresetName.trim()}"`);
    setNewPresetName('');
    setSaveDialogOpen(false);
  };

  const handleDeletePreset = (preset: CustomPreset) => {
    deletePreset(preset.id);
    toast.success(`Deleted preset "${preset.name}"`);
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
              {greeting()}, {profile?.full_name?.split(' ')[0] || 'Agent'}!
            </h1>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Here's your real-time performance dashboard. Track your calls, monitor your goals, and stay ahead of the competition.
            </p>
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
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                    <BarChart3 className="w-2.5 h-2.5" />
                                    {analytics.useCount}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {getTimePeriodLabel(preset.timePeriod as DashboardTimePeriod)} · {getLeadStatusLabel(preset.leadStatus as DashboardLeadStatusFilter)}
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
                            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              Usage Analytics
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

      {/* Bottom Row - Insights & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PerformanceInsights 
          stats={myStats} 
          hourlyData={hourlyData} 
          isLoading={isLoading} 
        />
        <div className="lg:col-span-2">
          <TeamLeaderboard data={leaderboard} isLoading={isLoading} />
        </div>
      </div>

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