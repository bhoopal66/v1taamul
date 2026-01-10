import { useMemo } from 'react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Calendar, 
  Phone, 
  Building2, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { format, differenceInDays, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { getScoreLabel } from '@/hooks/useLeadScoring';

interface LeadFollowUpListProps {
  leads: Lead[];
  onEditLead: (lead: Lead) => void;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
}

type UrgencyLevel = 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'upcoming';

interface FollowUpLead extends Lead {
  urgency: UrgencyLevel;
  daysUntilClose: number;
}

const getUrgencyConfig = (urgency: UrgencyLevel) => {
  const configs: Record<UrgencyLevel, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
    overdue: { 
      label: 'Overdue', 
      color: 'text-red-600', 
      bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      icon: AlertTriangle 
    },
    today: { 
      label: 'Due Today', 
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
      icon: Bell 
    },
    tomorrow: { 
      label: 'Due Tomorrow', 
      color: 'text-yellow-600', 
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
      icon: Clock 
    },
    'this-week': { 
      label: 'This Week', 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
      icon: Calendar 
    },
    upcoming: { 
      label: 'Upcoming', 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800',
      icon: Calendar 
    },
  };
  return configs[urgency];
};

export const LeadFollowUpList = ({ leads, onEditLead, onUpdateStatus }: LeadFollowUpListProps) => {
  const followUpLeads = useMemo(() => {
    const now = new Date();
    const nextTwoWeeks = addDays(now, 14);

    return leads
      .filter(lead => {
        // Only include active leads (not converted or lost) with expected close dates
        if (!lead.expectedCloseDate) return false;
        if (lead.leadStatus === 'converted' || lead.leadStatus === 'lost') return false;
        
        const closeDate = new Date(lead.expectedCloseDate);
        // Include overdue and upcoming within 14 days
        return isPast(closeDate) || closeDate <= nextTwoWeeks;
      })
      .map(lead => {
        const closeDate = new Date(lead.expectedCloseDate!);
        const daysUntilClose = differenceInDays(closeDate, now);
        
        let urgency: UrgencyLevel;
        if (isPast(closeDate) && !isToday(closeDate)) {
          urgency = 'overdue';
        } else if (isToday(closeDate)) {
          urgency = 'today';
        } else if (isTomorrow(closeDate)) {
          urgency = 'tomorrow';
        } else if (daysUntilClose <= 7) {
          urgency = 'this-week';
        } else {
          urgency = 'upcoming';
        }

        return {
          ...lead,
          urgency,
          daysUntilClose,
        } as FollowUpLead;
      })
      .sort((a, b) => {
        // Sort by urgency priority first
        const urgencyOrder: Record<UrgencyLevel, number> = {
          overdue: 0,
          today: 1,
          tomorrow: 2,
          'this-week': 3,
          upcoming: 4,
        };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        
        // Then by days until close
        return a.daysUntilClose - b.daysUntilClose;
      });
  }, [leads]);

  const groupedLeads = useMemo(() => {
    const groups: Record<UrgencyLevel, FollowUpLead[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      'this-week': [],
      upcoming: [],
    };

    followUpLeads.forEach(lead => {
      groups[lead.urgency].push(lead);
    });

    return groups;
  }, [followUpLeads]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (followUpLeads.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold">All caught up!</h3>
          <p className="text-muted-foreground mt-1">
            No leads with approaching close dates in the next 2 weeks.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['overdue', 'today', 'tomorrow', 'this-week', 'upcoming'] as UrgencyLevel[]).map(urgency => {
          const config = getUrgencyConfig(urgency);
          const count = groupedLeads[urgency].length;
          const Icon = config.icon;
          
          return (
            <Card key={urgency} className={`${count > 0 ? config.bgColor : ''} border`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${count > 0 ? config.color : 'text-muted-foreground'}`} />
                  <span className={`text-xl font-bold ${count > 0 ? config.color : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Follow-up List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Follow-up Reminders
            <Badge variant="secondary" className="ml-2">
              {followUpLeads.length} leads
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {(['overdue', 'today', 'tomorrow', 'this-week', 'upcoming'] as UrgencyLevel[]).map(urgency => {
                const leadsInGroup = groupedLeads[urgency];
                if (leadsInGroup.length === 0) return null;

                const config = getUrgencyConfig(urgency);
                const Icon = config.icon;

                return (
                  <div key={urgency}>
                    {/* Group Header */}
                    <div className={`px-4 py-2 ${config.bgColor} sticky top-0 z-10`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className={`font-medium text-sm ${config.color}`}>
                          {config.label}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {leadsInGroup.length}
                        </Badge>
                      </div>
                    </div>

                    {/* Leads in Group */}
                    {leadsInGroup.map(lead => (
                      <div
                        key={lead.id}
                        className="px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium truncate">{lead.companyName}</h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getScoreLabel(lead.leadScore).color}`}
                              >
                                <Zap className="w-2.5 h-2.5 mr-0.5" />
                                {lead.leadScore}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {lead.contactPersonName}
                              </span>
                              <a 
                                href={`tel:${lead.phoneNumber}`}
                                className="flex items-center gap-1 hover:text-primary"
                              >
                                <Phone className="w-3 h-3" />
                                {lead.phoneNumber}
                              </a>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              <span className={`flex items-center gap-1 ${config.color}`}>
                                <Calendar className="w-3 h-3" />
                                {format(new Date(lead.expectedCloseDate!), 'MMM d, yyyy')}
                                {lead.daysUntilClose < 0 && (
                                  <span className="font-medium">
                                    ({Math.abs(lead.daysUntilClose)} days overdue)
                                  </span>
                                )}
                                {lead.daysUntilClose > 0 && (
                                  <span className="text-muted-foreground">
                                    (in {lead.daysUntilClose} days)
                                  </span>
                                )}
                              </span>
                              {lead.dealValue && (
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(lead.dealValue)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditLead(lead)}
                            >
                              Edit
                            </Button>
                            {lead.leadStatus === 'qualified' && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => onUpdateStatus(lead.id, 'converted')}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Convert
                              </Button>
                            )}
                            {lead.leadStatus !== 'qualified' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onUpdateStatus(lead.id, 'qualified')}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                Qualify
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadFollowUpList;
