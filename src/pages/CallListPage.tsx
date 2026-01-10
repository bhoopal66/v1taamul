import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  Calendar,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { exportContactsToCSV, exportContactsToExcel, ContactExportData } from '@/utils/contactsExport';
import { format } from 'date-fns';
import { useCallList, CallListContact, FeedbackStatus } from '@/hooks/useCallList';
import { cn } from '@/lib/utils';

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
  const { profile } = useAuth();
  const { callList, stats, isLoading, refetch, logFeedback, isLogging, skipContact, isSkipping } = useCallList();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'called' | 'skipped'>('all');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CallListContact | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackStatus | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');

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

  const handleExport = (format: 'csv' | 'excel') => {
    const exportData: ContactExportData[] = filteredList.map(contact => ({
      callOrder: contact.callOrder,
      companyName: contact.companyName,
      contactPersonName: contact.contactPersonName,
      phoneNumber: contact.phoneNumber,
      tradeLicenseNumber: contact.tradeLicenseNumber,
      city: contact.city,
      industry: contact.industry,
      callStatus: contact.callStatus,
      lastFeedback: contact.lastFeedback,
      lastNotes: contact.lastNotes,
      calledAt: contact.calledAt,
    }));

    try {
      if (format === 'csv') {
        exportContactsToCSV(exportData);
        toast.success('Contacts exported to CSV');
      } else {
        exportContactsToExcel(exportData);
        toast.success('Contacts exported to Excel');
      }
    } catch (error) {
      toast.error('Failed to export contacts');
    }
  };

  const filteredList = callList.filter(contact => {
    const matchesSearch = 
      contact.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.contactPersonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumber.includes(searchQuery);

    const matchesFilter = 
      filterStatus === 'all' || 
      contact.callStatus === filterStatus;

    return matchesSearch && matchesFilter;
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={callList.length === 0}>
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, contact, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
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
                      {contact.city}
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
    </div>
  );
};
