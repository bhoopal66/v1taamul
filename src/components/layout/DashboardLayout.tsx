import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AppSidebar } from './AppSidebar';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { PerformanceCoachChat } from '@/components/coach/PerformanceCoachChat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const DashboardLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { hasPageAccess, getUnauthorizedRedirect } = usePermissions();
  
  // Initialize browser notifications subscription
  useBrowserNotifications();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has access to the current route
  const currentPath = location.pathname;
  const hasAccess = hasPageAccess(currentPath);

  // If no access, redirect to appropriate page
  if (!hasAccess) {
    const redirectPath = getUnauthorizedRedirect(currentPath);
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
      <PerformanceCoachChat />
    </div>
  );
};
