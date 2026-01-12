import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canUseFeature } from '@/config/rolePermissions';
import { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  CalendarIcon,
  Building2,
  User,
  MapPin,
  Briefcase,
  MoreVertical,
  MessageSquare,
  SkipForward,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  PhoneForwarded,
  Star,
  FileText,
  Download,
  FileSpreadsheet,
  X,
  Edit3,
  CheckSquare,
  Square,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportContactsToCSV, exportContactsToExcel, ContactExportData } from '@/utils/contactsExport';
import { format, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { useCallList, CallListContact, FeedbackStatus } from '@/hooks/useCallList';
import { cn } from '@/lib/utils';

type AppRole = Database['public']['Enums']['app_role'];

const feedbackOptions: { status: FeedbackStatus; label: string; icon: React.ReactNode; color: string; description: string }[] = [
  { 
    status: 'interested', 
    label: 'Interested', 
    icon: <ThumbsUp className="w-4 h-4" />, 
    color: 'bg-green-500 hover:bg-green-600',
    description: 'Contact showed interest - creates a lead'
  },
  { 
    status: 'not_interested', 
    label: 'Not Interested', 
    icon: <ThumbsDown className="w-4 h-4" />, 
    color: 'bg-orange-500 hover:bg-orange-600',
    description: 'Contact declined'
  },
  { 
    status: 'not_answered', 
    label: 'Not Answered', 
    icon: <PhoneMissed className="w-4 h-4" />, 
    color: 'bg-yellow-500 hover:bg-yellow-600',
    description: 'No answer or voicemail'
  },
  { 
    status: 'callback', 
    label: 'Callback', 
    icon: <PhoneForwarded className="w-4 h-4" />, 
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Asked to call back later'
  },
  { 
    status: 'wrong_number', 
    label: 'Wrong Number', 
    icon: <AlertCircle className="w-4 h-4" />, 
    color: 'bg-red-500 hover:bg-red-600',
    description: 'Invalid or wrong contact'
  },
];

export const CallListPage: React.FC = () => {
  const { profile, userRole } = useAuth();
  const { callList, stats, isLoading, refetch, logFeedback, isLogging, skipContact, isSkipping } = useCallList();
  
  // Feature-level permissions
  const canExport = canUseFeature(userRole as AppRole, 'export_call_list');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'called' | 'skipped'>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CallListContact | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackStatus | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv');
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(undefined);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(undefined);
  const [exportTeamId, setExportTeamId] = useState<string>('all');
  const [isLoadingTeamData, setIsLoadingTeamData] = useState(false);
  const [teamCallList, setTeamCallList] = useState<CallListContact[]>([]);

  // Fetch teams for super_admin export filter
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-for-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: canExport,
  });

  // Get unique areas and cities from call list
  const uniqueAreas = Array.from(
    new Set(callList.map(c => c.area).filter((area): area is string => !!area))
  ).sort();

  const uniqueCities = Array.from(
    new Set(callList.map(c => c.city).filter((city): city is string => !!city))
  ).sort();

  const handleOpenFeedback = (contact: CallListContact) => {
    setSelectedContact(contact);
    setSelectedFeedback(null);
    setFeedbackNotes('');
    setFeedbackDialogOpen(true);
  };

  const handleSubmitFeedback = () => {
    if (!selectedContact || !selectedFeedback) return;

    logFeedback({
      callListId: selectedContact.callListId,
      contactId: selectedContact.contactId,
      status: selectedFeedback,
      notes: feedbackNotes || undefined,
    });

    setFeedbackDialogOpen(false);
    setSelectedContact(null);
    setSelectedFeedback(null);
    setFeedbackNotes('');
  };

  const handleQuickFeedback = (contact: CallListContact, status: FeedbackStatus) => {
    logFeedback({
      callListId: contact.callListId,
      contactId: contact.contactId,
      status,
    });
  };

  const handleSkip = (contact: CallListContact) => {
    skipContact(contact.callListId);
  };

  const openExportDialog = (format: 'csv' | 'excel') => {
    setExportFormat(format);
    setExportStartDate(undefined);
    setExportEndDate(undefined);
    setExportTeamId('my_list');
    setTeamCallList([]);
    setExportDialogOpen(true);
  };

  // Fetch team call list when team is selected
  const fetchTeamCallList = async (teamId: string) => {
    if (teamId === 'my_list') {
      setTeamCallList([]);
      return;
    }

    setIsLoadingTeamData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const dayStart = startOfDay(new Date()).toISOString();
      const dayEnd = endOfDay(new Date()).toISOString();

      // If "all_teams" is selected, fetch data for all teams
      if (teamId === 'all_teams') {
        // Get all team members with their team info
        const { data: allMembers, error: membersError } = await supabase
          .from('profiles')
          .select('id, full_name, username, team_id')
          .not('team_id', 'is', null);

        if (membersError) throw membersError;
        if (!allMembers || allMembers.length === 0) {
          setTeamCallList([]);
          setIsLoadingTeamData(false);
          return;
        }

        const memberIds = allMembers.map(m => m.id);

        // Fetch call lists for all members
        const { data: callListData, error: callListError } = await supabase
          .from('approved_call_list')
          .select('*')
          .in('agent_id', memberIds)
          .eq('list_date', today)
          .order('call_order', { ascending: true });

        if (callListError) throw callListError;

        if (!callListData || callListData.length === 0) {
          setTeamCallList([]);
          setIsLoadingTeamData(false);
          return;
        }

        // Get contact IDs
        const contactIds = callListData.map(c => c.contact_id);

        // Fetch contact details
        const { data: contacts, error: contactsError } = await supabase
          .from('master_contacts')
          .select('*')
          .in('id', contactIds);

        if (contactsError) throw contactsError;

        // Fetch feedback
        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('*')
          .in('agent_id', memberIds)
          .in('contact_id', contactIds)
          .gte('call_timestamp', dayStart)
          .lte('call_timestamp', dayEnd)
          .order('call_timestamp', { ascending: false });

        // Create maps
        const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
        const feedbackMap = new Map<string, { status: FeedbackStatus; notes: string | null }>();
        const agentMap = new Map(allMembers.map(m => [m.id, { name: m.full_name || m.username, teamId: m.team_id }]));
        const teamMap = new Map(teams.map(t => [t.id, t.name]));

        feedback?.forEach(f => {
          if (!feedbackMap.has(f.contact_id)) {
            feedbackMap.set(f.contact_id, {
              status: f.feedback_status as FeedbackStatus,
              notes: f.notes
            });
          }
        });

        const result: (CallListContact & { agentName?: string; teamName?: string })[] = callListData.map(item => {
          const contact = contactMap.get(item.contact_id);
          const fb = feedbackMap.get(item.contact_id);
          const agentInfo = agentMap.get(item.agent_id);

          return {
            id: item.id,
            callListId: item.id,
            contactId: item.contact_id,
            companyName: contact?.company_name || 'Unknown',
            contactPersonName: contact?.contact_person_name || 'Unknown',
            phoneNumber: contact?.phone_number || '',
            tradeLicenseNumber: contact?.trade_license_number || '',
            city: contact?.city || null,
            industry: contact?.industry || null,
            area: (contact as { area?: string | null })?.area || null,
            callOrder: item.call_order,
            callStatus: item.call_status as 'pending' | 'called' | 'skipped',
            calledAt: item.called_at,
            lastFeedback: fb?.status || null,
            lastNotes: fb?.notes || null,
            agentName: agentInfo?.name || 'Unknown Agent',
            teamName: agentInfo?.teamId ? teamMap.get(agentInfo.teamId) || 'Unknown Team' : 'No Team',
          };
        });

        setTeamCallList(result);
      } else {
        // Fetch for specific team
        const { data: teamMembers, error: membersError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .eq('team_id', teamId);

        if (membersError) throw membersError;
        if (!teamMembers || teamMembers.length === 0) {
          setTeamCallList([]);
          setIsLoadingTeamData(false);
          return;
        }

        const memberIds = teamMembers.map(m => m.id);

        // Fetch call lists for all team members
        const { data: callListData, error: callListError } = await supabase
          .from('approved_call_list')
          .select('*')
          .in('agent_id', memberIds)
          .eq('list_date', today)
          .order('call_order', { ascending: true });

        if (callListError) throw callListError;

        if (!callListData || callListData.length === 0) {
          setTeamCallList([]);
          setIsLoadingTeamData(false);
          return;
        }

        // Get contact IDs
        const contactIds = callListData.map(c => c.contact_id);

        // Fetch contact details
        const { data: contacts, error: contactsError } = await supabase
          .from('master_contacts')
          .select('*')
          .in('id', contactIds);

        if (contactsError) throw contactsError;

        // Fetch feedback
        const { data: feedback } = await supabase
          .from('call_feedback')
          .select('*')
          .in('agent_id', memberIds)
          .in('contact_id', contactIds)
          .gte('call_timestamp', dayStart)
          .lte('call_timestamp', dayEnd)
          .order('call_timestamp', { ascending: false });

        // Create maps
        const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
        const feedbackMap = new Map<string, { status: FeedbackStatus; notes: string | null }>();
        const agentMap = new Map(teamMembers.map(m => [m.id, m.full_name || m.username]));

        feedback?.forEach(f => {
          if (!feedbackMap.has(f.contact_id)) {
            feedbackMap.set(f.contact_id, {
              status: f.feedback_status as FeedbackStatus,
              notes: f.notes
            });
          }
        });

        const result: (CallListContact & { agentName?: string })[] = callListData.map(item => {
          const contact = contactMap.get(item.contact_id);
          const fb = feedbackMap.get(item.contact_id);

          return {
            id: item.id,
            callListId: item.id,
            contactId: item.contact_id,
            companyName: contact?.company_name || 'Unknown',
            contactPersonName: contact?.contact_person_name || 'Unknown',
            phoneNumber: contact?.phone_number || '',
            tradeLicenseNumber: contact?.trade_license_number || '',
            city: contact?.city || null,
            industry: contact?.industry || null,
            area: (contact as { area?: string | null })?.area || null,
            callOrder: item.call_order,
            callStatus: item.call_status as 'pending' | 'called' | 'skipped',
            calledAt: item.called_at,
            lastFeedback: fb?.status || null,
            lastNotes: fb?.notes || null,
            agentName: agentMap.get(item.agent_id) || 'Unknown Agent',
          };
        });

        setTeamCallList(result);
      }
    } catch (error) {
      console.error('Error fetching team call list:', error);
      toast.error('Failed to fetch team data');
    } finally {
      setIsLoadingTeamData(false);
    }
  };

  const handleExport = () => {
    // Use team call list if a team is selected, otherwise use filtered list
    const sourceList = exportTeamId !== 'my_list' ? teamCallList : filteredList;
    
    // Filter contacts by date range if specified
    let contactsToExport = sourceList;
    
    if (exportStartDate || exportEndDate) {
      contactsToExport = sourceList.filter(contact => {
        if (!contact.calledAt) return false;
        const calledDate = new Date(contact.calledAt);
        
        if (exportStartDate && exportEndDate) {
          return isWithinInterval(calledDate, {
            start: startOfDay(exportStartDate),
            end: endOfDay(exportEndDate)
          });
        } else if (exportStartDate) {
          return calledDate >= startOfDay(exportStartDate);
        } else if (exportEndDate) {
          return calledDate <= endOfDay(exportEndDate);
        }
        return true;
      });
    }

    const exportData: (ContactExportData & { agentName?: string })[] = contactsToExport.map(contact => ({
      callOrder: contact.callOrder,
      companyName: contact.companyName,
      contactPersonName: contact.contactPersonName,
      phoneNumber: contact.phoneNumber,
      tradeLicenseNumber: contact.tradeLicenseNumber,
      city: contact.city,
      area: contact.area,
      industry: contact.industry,
      callStatus: contact.callStatus,
      lastFeedback: contact.lastFeedback,
      lastNotes: contact.lastNotes,
      calledAt: contact.calledAt,
      agentName: (contact as any).agentName,
      teamName: (contact as any).teamName,
    }));

    if (exportData.length === 0) {
      toast.error('No contacts found for the selected filters');
      return;
    }

    try {
      const teamName = exportTeamId === 'all_teams' 
        ? 'all_teams'
        : exportTeamId !== 'my_list' 
        ? teams.find(t => t.id === exportTeamId)?.name || 'team'
        : '';
      const teamSuffix = teamName ? `_${teamName.replace(/\s+/g, '_')}` : '';
      const dateRangeSuffix = exportStartDate && exportEndDate 
        ? `_${format(exportStartDate, 'yyyy-MM-dd')}_to_${format(exportEndDate, 'yyyy-MM-dd')}`
        : exportStartDate 
        ? `_from_${format(exportStartDate, 'yyyy-MM-dd')}`
        : exportEndDate
        ? `_until_${format(exportEndDate, 'yyyy-MM-dd')}`
        : '';
      
      const filename = `call_list${teamSuffix}${dateRangeSuffix}.${exportFormat === 'csv' ? 'csv' : 'xlsx'}`;
      
      if (exportFormat === 'csv') {
        exportContactsToCSV(exportData, filename);
        toast.success(`Exported ${exportData.length} contacts to CSV`);
      } else {
        exportContactsToExcel(exportData, filename);
        toast.success(`Exported ${exportData.length} contacts to Excel`);
      }
      setExportDialogOpen(false);
    } catch (error) {
      toast.error('Failed to export contacts');
    }
  };

  const setQuickDateRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setExportStartDate(start);
    setExportEndDate(end);
  };

  const filteredList = callList.filter(contact => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      contact.companyName.toLowerCase().includes(searchLower) ||
      contact.contactPersonName.toLowerCase().includes(searchLower) ||
      contact.phoneNumber.includes(searchQuery) ||
      (contact.city && contact.city.toLowerCase().includes(searchLower)) ||
      (contact.area && contact.area.toLowerCase().includes(searchLower)) ||
      (contact.industry && contact.industry.toLowerCase().includes(searchLower));

    const matchesFilter = 
      filterStatus === 'all' || 
      contact.callStatus === filterStatus;

    const matchesArea = 
      filterArea === 'all' || 
      contact.area === filterArea;

    const matchesCity = 
      filterCity === 'all' || 
      contact.city === filterCity;

    return matchesSearch && matchesFilter && matchesArea && matchesCity;
  });

  const pendingContacts = filteredList.filter(c => c.callStatus === 'pending');
  const calledContacts = filteredList.filter(c => c.callStatus === 'called');
  const progressPercent = stats.total > 0 ? Math.round((stats.called / stats.total) * 100) : 0;

  const getStatusBadge = (contact: CallListContact) => {
    if (contact.callStatus === 'skipped') {
      return <Badge variant="outline" className="text-muted-foreground"><SkipForward className="w-3 h-3 mr-1" /> Skipped</Badge>;
    }
    if (contact.callStatus === 'called') {
      const feedbackLabels: Record<FeedbackStatus, { label: string; className: string }> = {
        interested: { label: 'Interested', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
        not_interested: { label: 'Not Interested', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
        not_answered: { label: 'Not Answered', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
        callback: { label: 'Callback', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
        wrong_number: { label: 'Wrong #', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
      };
      const fb = contact.lastFeedback ? feedbackLabels[contact.lastFeedback] : null;
      if (fb) {
        return <Badge variant="outline" className={fb.className}>{fb.label}</Badge>;
      }
      return <Badge variant="outline" className="bg-muted"><CheckCircle2 className="w-3 h-3 mr-1" /> Called</Badge>;
    }
    return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Phone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Call List</h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(), 'EEEE, MMMM d')} • {stats.total} contacts to call
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={callList.length === 0}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem onClick={() => openExportDialog('csv')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openExportDialog('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Today's Progress</span>
              <span className="text-2xl font-bold">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.called} called</span>
              <span>{stats.pending} remaining</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ThumbsUp className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.interested}</p>
            <p className="text-xs text-muted-foreground">Interested</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PhoneMissed className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-2xl font-bold text-yellow-600">{stats.notAnswered}</p>
            <p className="text-xs text-muted-foreground">No Answer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ThumbsDown className="w-5 h-5 mx-auto text-orange-600 mb-1" />
            <p className="text-2xl font-bold text-orange-600">{stats.notInterested}</p>
            <p className="text-xs text-muted-foreground">Not Interested</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <PhoneForwarded className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{stats.callback}</p>
            <p className="text-xs text-muted-foreground">Callbacks</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by company, contact, area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {uniqueCities.length > 0 && (
            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="w-[180px]">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map(city => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {uniqueAreas.length > 0 && (
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-[180px]">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {uniqueAreas.map(area => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'called', 'skipped'] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="capitalize"
            >
              {status === 'all' ? `All (${stats.total})` : 
               status === 'pending' ? `Pending (${stats.pending})` :
               status === 'called' ? `Called (${stats.called})` :
               `Skipped (${stats.skipped})`}
            </Button>
          ))}
          {filterCity !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="w-3 h-3" />
              {filterCity}
              <button onClick={() => setFilterCity('all')} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filterArea !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <MapPin className="w-3 h-3" />
              {filterArea}
              <button onClick={() => setFilterArea('all')} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* Call List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
            <p className="text-muted-foreground">
              {callList.length === 0 
                ? "You don't have any approved contacts for today. Upload a call sheet to get started."
                : "No contacts match your search criteria."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredList.map((contact) => (
            <Card 
              key={contact.id} 
              className={cn(
                "transition-all hover:shadow-md",
                contact.callStatus === 'called' && "opacity-75",
                contact.lastFeedback === 'interested' && "ring-2 ring-green-500/20"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{contact.companyName}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {contact.contactPersonName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusBadge(contact)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenFeedback(contact)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Log Call with Notes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSkip(contact)} disabled={contact.callStatus !== 'pending'}>
                          <SkipForward className="w-4 h-4 mr-2" />
                          Skip Contact
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <a 
                    href={`tel:${contact.phoneNumber}`}
                    className="flex items-center gap-2 text-primary hover:underline font-mono"
                  >
                    <Phone className="w-4 h-4" />
                    {contact.phoneNumber}
                  </a>
                  {contact.city && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {contact.city}{contact.area && `, ${contact.area}`}
                    </p>
                  )}
                  {!contact.city && contact.area && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {contact.area}
                    </p>
                  )}
                  {contact.industry && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Briefcase className="w-4 h-4" />
                      {contact.industry}
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    License: {contact.tradeLicenseNumber}
                  </p>
                </div>

                {contact.lastNotes && (
                  <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground mb-4">
                    <span className="font-medium">Last note:</span> {contact.lastNotes}
                  </div>
                )}

                {/* Quick Action Buttons */}
                {contact.callStatus === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    {feedbackOptions.slice(0, 3).map((option) => (
                      <TooltipProvider key={option.status}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              className={cn("flex-1 text-white", option.color)}
                              onClick={() => handleQuickFeedback(contact, option.status)}
                              disabled={isLogging}
                            >
                              {option.icon}
                              <span className="ml-1 hidden sm:inline">{option.label}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{option.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenFeedback(contact)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {contact.callStatus === 'called' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOpenFeedback(contact)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Update Feedback
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-primary" />
              Log Call Outcome
            </DialogTitle>
            <DialogDescription>
              {selectedContact && (
                <>
                  <span className="font-medium">{selectedContact.companyName}</span>
                  {' • '}{selectedContact.contactPersonName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {feedbackOptions.map((option) => (
                <Button
                  key={option.status}
                  variant={selectedFeedback === option.status ? 'default' : 'outline'}
                  className={cn(
                    "justify-start gap-2 h-auto py-3",
                    selectedFeedback === option.status && option.color.replace('hover:', '')
                  )}
                  onClick={() => setSelectedFeedback(option.status)}
                >
                  {option.icon}
                  <div className="text-left">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs opacity-70">{option.description}</p>
                  </div>
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Add any notes about this call..."
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitFeedback}
              disabled={!selectedFeedback || isLogging}
            >
              {isLogging ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Log Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Export Contacts
            </DialogTitle>
            <DialogDescription>
              Select a date range to filter contacts by when they were called. Leave empty to export all contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Team Filter for Super Admin */}
            {canExport && teams.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select Team
                </Label>
                <Select 
                  value={exportTeamId} 
                  onValueChange={(value) => {
                    setExportTeamId(value);
                    fetchTeamCallList(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="my_list">My Call List</SelectItem>
                    <SelectItem value="all_teams">All Teams</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingTeamData && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading team data...
                  </div>
                )}
                {exportTeamId !== 'my_list' && !isLoadingTeamData && (
                  <div className="text-sm text-muted-foreground">
                    {teamCallList.length} contacts found {exportTeamId === 'all_teams' ? 'across all teams' : 'for this team'}
                  </div>
                )}
              </div>
            )}

            {/* Quick Date Range Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(7)}>
                Last 7 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(30)}>
                Last 30 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange(90)}>
                Last 90 days
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setExportStartDate(undefined); setExportEndDate(undefined); }}
              >
                All time
              </Button>
            </div>

            {/* Date Range Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !exportStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportStartDate ? format(exportStartDate, "PP") : "Pick date"}
                      {exportStartDate && (
                        <X 
                          className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                          onClick={(e) => { e.stopPropagation(); setExportStartDate(undefined); }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={exportStartDate}
                      onSelect={setExportStartDate}
                      disabled={(date) => date > new Date() || (exportEndDate ? date > exportEndDate : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !exportEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportEndDate ? format(exportEndDate, "PP") : "Pick date"}
                      {exportEndDate && (
                        <X 
                          className="ml-auto h-4 w-4 opacity-50 hover:opacity-100" 
                          onClick={(e) => { e.stopPropagation(); setExportEndDate(undefined); }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={exportEndDate}
                      onSelect={setExportEndDate}
                      disabled={(date) => date > new Date() || (exportStartDate ? date < exportStartDate : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Selected Range Display */}
            {(exportStartDate || exportEndDate) && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-medium">Selected range: </span>
                {exportStartDate && exportEndDate 
                  ? `${format(exportStartDate, "PP")} to ${format(exportEndDate, "PP")}`
                  : exportStartDate 
                  ? `From ${format(exportStartDate, "PP")}`
                  : `Until ${format(exportEndDate!, "PP")}`
                }
              </div>
            )}

            {/* Format Display */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {exportFormat === 'csv' ? (
                <FileText className="w-4 h-4" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Exporting as {exportFormat === 'csv' ? 'CSV' : 'Excel'} file
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isLoadingTeamData}>
              {isLoadingTeamData ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
