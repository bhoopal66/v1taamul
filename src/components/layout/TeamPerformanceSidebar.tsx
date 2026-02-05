import React from 'react';
import { Phone, ThumbsUp, Target, Users } from 'lucide-react';
import { useTeamPerformanceSidebar } from '@/hooks/useTeamPerformanceSidebar';
import { cn } from '@/lib/utils';

export const TeamPerformanceSidebar: React.FC = () => {
  const { stats, isLoading, isTeamViewer, hasGlobalAccess } = useTeamPerformanceSidebar();

  if (!isTeamViewer) return null;

  const items = [
    {
      icon: Users,
      label: 'Members',
      value: stats.teamMemberCount,
      color: 'text-primary',
    },
    {
      icon: Phone,
      label: 'Calls',
      value: stats.totalCalls,
      color: 'text-info',
    },
    {
      icon: ThumbsUp,
      label: 'Interested',
      value: stats.interestedCount,
      color: 'text-success',
    },
    {
      icon: Target,
      label: 'Leads',
      value: stats.leadsGenerated,
      color: 'text-warning',
    },
  ];

  return (
    <div className="px-4 py-3 border-b border-sidebar-border">
      <p className="text-xs font-bold text-sidebar-muted uppercase tracking-wider mb-2">
        {hasGlobalAccess ? 'All Teams Today' : 'Team Today'}
      </p>
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-col items-center p-1.5 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors"
            >
              <Icon className={cn('w-3.5 h-3.5 mb-0.5', item.color)} />
              {isLoading ? (
                <div className="h-4 w-5 bg-sidebar-muted/30 animate-pulse rounded" />
              ) : (
                <span className="text-sm font-bold text-sidebar-foreground">
                  {item.value}
                </span>
              )}
              <span className="text-[10px] text-sidebar-muted font-medium">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
