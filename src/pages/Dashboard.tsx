import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Upload, ArrowRight, Sparkles, Calendar, Filter, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { CallsChart } from '@/components/dashboard/CallsChart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { TeamLeaderboard } from '@/components/dashboard/TeamLeaderboard';
import { DailyGoalProgress } from '@/components/dashboard/DailyGoalProgress';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { PerformanceInsights } from '@/components/dashboard/PerformanceInsights';
import { usePerformanceData, DashboardTimePeriod, DashboardLeadStatusFilter } from '@/hooks/usePerformanceData';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface FilterPreset {
  name: string;
  description: string;
  timePeriod: DashboardTimePeriod;
  leadStatus: DashboardLeadStatusFilter;
}

const filterPresets: FilterPreset[] = [
  { name: "Today's Focus", description: 'All activity today', timePeriod: 'today', leadStatus: 'all' },
  { name: 'Weekly Review', description: "This week's performance", timePeriod: 'this_week', leadStatus: 'all' },
  { name: 'Monthly Overview', description: 'Full month analysis', timePeriod: 'this_month', leadStatus: 'all' },
  { name: 'Hot Leads', description: "Today's matched leads", timePeriod: 'today', leadStatus: 'matched' },
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

  const handleTimePeriodChange = (value: DashboardTimePeriod) => {
    setTimePeriod(value);
    localStorage.setItem('dashboard-time-period', value);
  };

  const handleLeadStatusChange = (value: DashboardLeadStatusFilter) => {
    setLeadStatusFilter(value);
    localStorage.setItem('dashboard-lead-filter', value);
  };

  const applyPreset = (preset: FilterPreset) => {
    handleTimePeriodChange(preset.timePeriod);
    handleLeadStatusChange(preset.leadStatus);
  };
  
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
                  <Zap className="w-4 h-4 text-primary" />
                  Quick Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter Presets</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filterPresets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer"
                  >
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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