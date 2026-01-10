import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Upload, ArrowRight, Sparkles, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [timePeriod, setTimePeriod] = useState<DashboardTimePeriod>('today');
  const [leadStatusFilter, setLeadStatusFilter] = useState<DashboardLeadStatusFilter>('all');
  
  const { myStats, hourlyData, weeklyData, recentActivity, leaderboard, isLoading, refetch } = usePerformanceData({
    timePeriod,
    leadStatusFilter,
  });

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
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
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
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as DashboardTimePeriod)}>
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
            
            <Select value={leadStatusFilter} onValueChange={(v) => setLeadStatusFilter(v as DashboardLeadStatusFilter)}>
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
          <div className="flex flex-col sm:flex-row gap-3">
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
