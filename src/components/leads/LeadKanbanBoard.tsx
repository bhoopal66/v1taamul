import { useState } from 'react';
import { Lead, LeadStatus, parseLeadSource, ACCOUNT_BANKS, LOAN_BANKS } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ConvertToLeadDialog } from './ConvertToLeadDialog';
import { toast } from 'sonner';
import { 
  Target, 
  Phone, 
  Building2, 
  MapPin, 
  Factory, 
  DollarSign,
  Calendar,
  Star,
  Users,
  CheckCircle,
  XCircle,
  Sparkles,
  GripVertical,
  Zap,
  FileText,
  AlertTriangle,
  ArrowUpCircle,
  UserCircle,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { getScoreLabel } from '@/hooks/useLeadScoring';

// Helper to get bank label from bank code
const getBankLabel = (bankCode: string): string => {
  const allBanks = [...ACCOUNT_BANKS, ...LOAN_BANKS];
  const bank = allBanks.find(b => b.value === bankCode);
  return bank?.label || bankCode;
};

// Helper to get product label (Group 1 = Account, Group 2 = Loan)
const getProductLabel = (product: string): { label: string; group: string } => {
  if (product === 'account') return { label: 'Account', group: 'Group 1' };
  if (product === 'loan') return { label: 'Loan', group: 'Group 2' };
  return { label: product, group: '' };
};

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; bgColor: string; icon: React.ElementType }[] = [
  { status: 'new', label: 'New', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', icon: Sparkles },
  { status: 'contacted', label: 'In Progress', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30', icon: Phone },
  { status: 'qualified', label: 'Submitted', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', icon: CheckCircle },
  { status: 'converted', label: 'Assessing', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30', icon: Target },
  { status: 'approved', label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', icon: CheckCircle },
  { status: 'declined', label: 'Declined', color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-950/30', icon: XCircle },
  { status: 'lost', label: 'Lost', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30', icon: XCircle },
];

export type LeadTypeFilter = 'all' | 'leads' | 'opportunities';

interface LeadKanbanBoardProps {
  leads: Lead[];
  onUpdateStatus: (leadId: string, status: LeadStatus, notes?: string) => void;
  onEditLead: (lead: Lead) => void;
  onConvertToLead: (contactId: string, tradeLicenseNumber: string) => void;
  isUpdating: boolean;
  isConverting: boolean;
  typeFilter: LeadTypeFilter;
  onTypeFilterChange: (filter: LeadTypeFilter) => void;
}

export const LeadKanbanBoard = ({ 
  leads, 
  onUpdateStatus, 
  onEditLead, 
  onConvertToLead, 
  isUpdating, 
  isConverting,
  typeFilter,
  onTypeFilterChange,
}: LeadKanbanBoardProps) => {
  const { userRole } = useAuth();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Lead | null>(null);
  
  // Decline dialog state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [leadToDecline, setLeadToDecline] = useState<Lead | null>(null);

  const isAdminOrSuperAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'supervisor' || userRole === 'operations_head';

  // Filter leads based on type filter
  const filteredLeads = leads.filter(lead => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'leads') return lead.isLead;
    if (typeFilter === 'opportunities') return !lead.isLead;
    return true;
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return filteredLeads.filter(lead => lead.leadStatus === status);
  };

  const getColumnTotal = (status: LeadStatus) => {
    return getLeadsByStatus(status).reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
  };

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
    // Add a slight delay to show the dragging state
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedLead && draggedLead.leadStatus !== targetStatus) {
      // Check if moving to qualified/converted and trade license is missing
      if ((targetStatus === 'qualified' || targetStatus === 'converted') && !draggedLead.tradeLicenseNumber) {
        toast.error('Trade License Required', {
          description: 'Please add a trade license number before qualifying this lead.',
          duration: 5000,
        });
        setDraggedLead(null);
        return;
      }
      
      // If declining, show the decline dialog
      if (targetStatus === 'declined') {
        setLeadToDecline(draggedLead);
        setDeclineReason('');
        setDeclineDialogOpen(true);
        setDraggedLead(null);
        return;
      }
      
      onUpdateStatus(draggedLead.id, targetStatus);
    }
    setDraggedLead(null);
  };

  const handleDeclineConfirm = () => {
    if (!leadToDecline || !declineReason.trim()) {
      toast.error('Please provide a reason for declining');
      return;
    }
    
    onUpdateStatus(leadToDecline.id, 'declined', declineReason.trim());
    setDeclineDialogOpen(false);
    setLeadToDecline(null);
    setDeclineReason('');
  };

  const handleDeclineCancel = () => {
    setDeclineDialogOpen(false);
    setLeadToDecline(null);
    setDeclineReason('');
  };

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Show:</span>
        <ToggleGroup 
          type="single" 
          value={typeFilter} 
          onValueChange={(value) => value && onTypeFilterChange(value as LeadTypeFilter)}
          className="bg-muted/50 rounded-lg p-1"
        >
          <ToggleGroupItem value="all" className="px-3 h-8 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="leads" className="px-3 h-8 text-xs data-[state=on]:bg-green-100 data-[state=on]:text-green-700 dark:data-[state=on]:bg-green-950/50 dark:data-[state=on]:text-green-400">
            <FileText className="w-3 h-3 mr-1" />
            Leads
          </ToggleGroupItem>
          <ToggleGroupItem value="opportunities" className="px-3 h-8 text-xs data-[state=on]:bg-amber-100 data-[state=on]:text-amber-700 dark:data-[state=on]:bg-amber-950/50 dark:data-[state=on]:text-amber-400">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Opportunities
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="text-xs text-muted-foreground">
          ({filteredLeads.length} shown)
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map(stage => {
        const stageLeads = getLeadsByStatus(stage.status);
        const columnTotal = getColumnTotal(stage.status);
        const Icon = stage.icon;
        const isDragOver = dragOverColumn === stage.status;

        return (
          <div
            key={stage.status}
            className={`flex-shrink-0 w-80 rounded-lg border transition-all ${
              isDragOver 
                ? 'border-primary border-2 bg-primary/5' 
                : 'border-border'
            } ${stage.bgColor}`}
            onDragOver={(e) => handleDragOver(e, stage.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.status)}
          >
            {/* Column Header */}
            <div className="p-3 border-b bg-background/50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${stage.color}`} />
                  <h3 className="font-semibold">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                </div>
              </div>
              {columnTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {formatCurrency(columnTotal)}
                </p>
              )}
            </div>

            {/* Cards Container */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="p-2 space-y-2">
                {stageLeads.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    {isDragOver ? 'Drop here' : 'No leads'}
                  </div>
                ) : (
                  stageLeads.map(lead => (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${
                        draggedLead?.id === lead.id ? 'opacity-50 ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            {/* Company & Score */}
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-medium text-sm truncate">{lead.companyName}</h4>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs gap-0.5 flex-shrink-0 ${getScoreLabel(lead.leadScore).color}`}
                                    >
                                      <Zap className="w-2.5 h-2.5" />
                                      {lead.leadScore}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{getScoreLabel(lead.leadScore).label} Lead</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            {/* Agent Name - Show for admins */}
                            {isAdminOrSuperAdmin && lead.agentName && (
                              <p className="text-xs text-primary/80 flex items-center gap-1 mt-1 font-medium">
                                <UserCircle className="w-3 h-3" />
                                {lead.agentName}
                              </p>
                            )}

                            {/* Contact */}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3" />
                              {lead.contactPersonName}
                            </p>

                            {/* Phone */}
                            <a 
                              href={`tel:${lead.phoneNumber}`}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />
                              {lead.phoneNumber}
                            </a>

                            {/* Location & Industry */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {lead.city && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {lead.city}
                                </span>
                              )}
                              {lead.industry && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Factory className="w-2.5 h-2.5" />
                                  {lead.industry}
                                </span>
                              )}
                            </div>

                            {/* Bank Name & Group */}
                            {lead.leadSource && (() => {
                              const parsed = parseLeadSource(lead.leadSource);
                              if (!parsed) return null;
                              const productInfo = getProductLabel(parsed.product);
                              const bankLabel = getBankLabel(parsed.bank);
                              return (
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300">
                                    <Banknote className="w-2.5 h-2.5 mr-1" />
                                    {bankLabel}
                                  </Badge>
                                  <Badge variant="outline" className={`text-xs ${parsed.product === 'account' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-300'}`}>
                                    {parsed.product === 'account' ? <CreditCard className="w-2.5 h-2.5 mr-1" /> : <Banknote className="w-2.5 h-2.5 mr-1" />}
                                    {productInfo.group}
                                  </Badge>
                                </div>
                              );
                            })()}

                            {/* Lead vs Opportunity Badge */}
                            <div className="mt-1 flex items-center gap-2">
                              {lead.isLead ? (
                                <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                                  <FileText className="w-2.5 h-2.5 mr-1" />
                                  Lead
                                </Badge>
                              ) : (
                                <>
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
                                    <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                                    Opportunity
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-xs text-primary hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOpportunity(lead);
                                      setConvertDialogOpen(true);
                                    }}
                                  >
                                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                                    Convert
                                  </Button>
                                </>
                              )}
                            </div>

                            {/* Decline Reason - Show only for declined leads */}
                            {lead.leadStatus === 'declined' && lead.notes && (
                              <div className="mt-2 p-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                                <p className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1">
                                  <XCircle className="w-3 h-3" />
                                  Decline Reason
                                </p>
                                <p className="text-xs text-rose-600 dark:text-rose-300 line-clamp-2">
                                  {lead.notes}
                                </p>
                              </div>
                            )}

                            {/* Created Date & Time */}
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>{format(new Date(lead.createdAt), 'MMM d, yyyy')}</span>
                              <span className="text-muted-foreground/60">•</span>
                              <span>{format(new Date(lead.createdAt), 'h:mm a')}</span>
                            </div>

                            {/* Deal Value & Close Date */}
                            <div className="flex items-center justify-between mt-1.5">
                              {lead.dealValue ? (
                                <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                                  <DollarSign className="w-3 h-3" />
                                  {formatCurrency(lead.dealValue)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">No deal value</span>
                              )}
                              {lead.expectedCloseDate && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {format(new Date(lead.expectedCloseDate), 'MMM d')}
                                </span>
                              )}
                            </div>

                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2 h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditLead(lead);
                              }}
                            >
                              Edit Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}

      </div>

      {/* Convert to Lead Dialog */}
      <ConvertToLeadDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        lead={selectedOpportunity}
        onConvert={onConvertToLead}
        isConverting={isConverting}
      />

      {/* Decline Lead Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              Decline Lead
            </DialogTitle>
            <DialogDescription>
              {leadToDecline && (
                <span>
                  You are about to decline <strong>{leadToDecline.companyName}</strong>. 
                  Please provide a reason for declining this lead.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="decline-reason" className="text-sm font-medium">
                Reason for Declining <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="decline-reason"
                placeholder="Enter the reason for declining this lead..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {declineReason.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDeclineCancel}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeclineConfirm}
              disabled={!declineReason.trim()}
            >
              Decline Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
