import { useState } from 'react';
import { useLeads, Lead, LeadStatus, LeadSource, ProductType, BankName, PRODUCT_TYPES, ACCOUNT_BANKS, LOAN_BANKS, createLeadSource, parseLeadSource, LEAD_SOURCES } from '@/hooks/useLeads';
import { LeadTypeFilter } from '@/components/leads/LeadKanbanBoard';
import { useLeadScoring, getScoreLabel } from '@/hooks/useLeadScoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LeadKanbanBoard } from '@/components/leads/LeadKanbanBoard';
import { LeadAnalytics } from '@/components/leads/LeadAnalytics';
import { LeadFollowUpList } from '@/components/leads/LeadFollowUpList';
import { LeadActivityTimeline } from '@/components/leads/LeadActivityTimeline';
import { LeadSourceAnalytics } from '@/components/leads/LeadSourceAnalytics';
import { LeadTransitionsFeed } from '@/components/leads/LeadTransitionsFeed';
import { LeadTransitionHistory } from '@/components/leads/LeadTransitionHistory';
import { StageDurationWidget } from '@/components/leads/StageDurationWidget';
import { BulkLeadImport } from '@/components/leads/BulkLeadImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, 
  Phone, 
  Building2, 
  MapPin, 
  Factory, 
  DollarSign,
  Calendar,
  Star,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  LayoutGrid,
  List,
  BarChart3,
  RefreshCw,
  Zap,
  Bell,
  Megaphone,
  History,
} from 'lucide-react';
import { format } from 'date-fns';

type ViewMode = 'list' | 'kanban' | 'analytics' | 'followup' | 'sources' | 'history';

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; icon: React.ElementType }[] = [
  { status: 'new', label: 'New', color: 'bg-blue-500', icon: Sparkles },
  { status: 'contacted', label: 'Contacted', color: 'bg-yellow-500', icon: Phone },
  { status: 'qualified', label: 'Qualified', color: 'bg-purple-500', icon: CheckCircle },
  { status: 'converted', label: 'Converted', color: 'bg-green-500', icon: Target },
  { status: 'lost', label: 'Lost', color: 'bg-red-500', icon: XCircle },
];

export const LeadsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<LeadTypeFilter>('all');
  const [editForm, setEditForm] = useState({
    dealValue: '',
    expectedCloseDate: '',
    notes: '',
    leadScore: '',
    productType: 'account' as ProductType,
    bankName: 'RAK' as BankName,
  });

  const { leads, stats, isLoading, refetch, updateLeadStatus, updateLeadDetails, convertToLead, isUpdating, isConverting } = useLeads(statusFilter);
  const { recalculateScores, isRecalculating, getScoreBreakdown } = useLeadScoring();

  const filteredLeads = leads.filter(lead => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.companyName.toLowerCase().includes(query) ||
      lead.contactPersonName.toLowerCase().includes(query) ||
      lead.phoneNumber.includes(query) ||
      (lead.city?.toLowerCase().includes(query)) ||
      (lead.industry?.toLowerCase().includes(query))
    );
  });

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    const parsed = parseLeadSource(lead.leadSource);
    setEditForm({
      dealValue: lead.dealValue?.toString() || '',
      expectedCloseDate: lead.expectedCloseDate || '',
      notes: lead.notes || '',
      leadScore: lead.leadScore?.toString() || '0',
      productType: parsed?.product || 'account',
      bankName: parsed?.bank || 'RAK',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedLead) return;
    updateLeadDetails(selectedLead.id, {
      deal_value: editForm.dealValue ? parseFloat(editForm.dealValue) : null,
      expected_close_date: editForm.expectedCloseDate || null,
      notes: editForm.notes || null,
      lead_score: parseInt(editForm.leadScore) || 0,
      lead_source: createLeadSource(editForm.productType, editForm.bankName),
    });
    setEditDialogOpen(false);
    setSelectedLead(null);
  };

  // Get available banks based on selected product type
  const getAvailableBanks = () => {
    return editForm.productType === 'loan' ? LOAN_BANKS : ACCOUNT_BANKS;
  };

  // Handle product type change - reset bank if not available for new product
  const handleProductTypeChange = (product: ProductType) => {
    const availableBanks = product === 'loan' ? LOAN_BANKS : ACCOUNT_BANKS;
    const currentBankAvailable = availableBanks.some(b => b.value === editForm.bankName);
    setEditForm(f => ({
      ...f,
      productType: product,
      bankName: currentBankAvailable ? f.bankName : availableBanks[0].value,
    }));
  };

  const handleMoveToStage = (leadId: string, status: LeadStatus) => {
    updateLeadStatus(leadId, status);
  };

  const getStatusBadgeVariant = (status: LeadStatus) => {
    const variants: Record<LeadStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'default',
      contacted: 'secondary',
      qualified: 'default',
      converted: 'secondary',
      approved: 'default',
      lost: 'destructive',
    };
    return variants[status];
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" />
            Sales Pipeline
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-3">
            Track opportunities and leads through the sales funnel
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-amber-600 border-amber-400">
                {stats.opportunities} Opportunities
              </Badge>
              <Badge variant="default" className="bg-green-600">
                {stats.leads} Leads
              </Badge>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/50">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="w-4 h-4 mr-1" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('analytics')}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Analytics
            </Button>
            <Button
              variant={viewMode === 'followup' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('followup')}
            >
              <Bell className="w-4 h-4 mr-1" />
              Follow-ups
            </Button>
            <Button
              variant={viewMode === 'sources' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('sources')}
            >
              <Megaphone className="w-4 h-4 mr-1" />
              Sources
            </Button>
            <Button
              variant={viewMode === 'history' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('history')}
            >
              <History className="w-4 h-4 mr-1" />
              History
            </Button>
          </div>
          <BulkLeadImport onImportComplete={() => refetch()} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => recalculateScores()}
                  disabled={isRecalculating}
                  className="h-10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                  {isRecalculating ? 'Scoring...' : 'Recalculate Scores'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Update all lead scores based on interaction history</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Pipeline</p>
                <p className="font-bold text-lg">{formatCurrency(stats.totalDealValue)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Pipeline Stats - Only show in list view */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map(stage => {
            const count = stats[stage.status];
            const Icon = stage.icon;
            return (
              <Card 
                key={stage.status} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  statusFilter === stage.status ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setStatusFilter(statusFilter === stage.status ? 'all' : stage.status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-full ${stage.color} bg-opacity-20`}>
                      <Icon className={`w-4 h-4 ${stage.color.replace('bg-', 'text-')}`} />
                    </div>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{stage.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search and Filters - Only show in list view */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company, contact, phone, city, or industry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {PIPELINE_STAGES.map(stage => (
                    <SelectItem key={stage.status} value={stage.status}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <LeadKanbanBoard
          leads={leads}
          onUpdateStatus={updateLeadStatus}
          onEditLead={handleEditLead}
          onConvertToLead={convertToLead}
          isUpdating={isUpdating}
          isConverting={isConverting}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      )}

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <LeadAnalytics leads={leads} />
      )}

      {/* Follow-up Reminders View */}
      {viewMode === 'followup' && (
        <LeadFollowUpList
          leads={leads}
          onEditLead={handleEditLead}
          onUpdateStatus={updateLeadStatus}
        />
      )}

      {/* Lead Source Analytics View */}
      {viewMode === 'sources' && (
        <LeadSourceAnalytics leads={leads} />
      )}

      {/* Pipeline History View */}
      {viewMode === 'history' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LeadTransitionsFeed />
            </div>
            <StageDurationWidget />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Stage Distribution</CardTitle>
              <CardDescription>How leads are distributed across the pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {['new', 'contacted', 'qualified', 'converted', 'approved', 'lost'].map((status) => {
                  const count = leads.filter(l => l.leadStatus === status).length;
                  const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
                  const statusLabels: Record<string, string> = {
                    new: 'New',
                    contacted: 'In Progress',
                    qualified: 'Submitted',
                    converted: 'Assessing',
                    approved: 'Approved',
                    lost: 'Lost',
                  };
                  const statusColors: Record<string, string> = {
                    new: 'bg-blue-500',
                    contacted: 'bg-yellow-500',
                    qualified: 'bg-purple-500',
                    converted: 'bg-orange-500',
                    approved: 'bg-green-500',
                    lost: 'bg-red-500',
                  };
                  const statusTextColors: Record<string, string> = {
                    new: 'text-blue-600',
                    contacted: 'text-yellow-600',
                    qualified: 'text-purple-600',
                    converted: 'text-orange-600',
                    approved: 'text-green-600',
                    lost: 'text-red-600',
                  };
                  return (
                    <div key={status} className="text-center p-3 rounded-lg bg-muted/50">
                      <div className={`text-2xl font-bold ${statusTextColors[status]}`}>
                        {count}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {statusLabels[status]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {percentage.toFixed(0)}%
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${statusColors[status]} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leads List - Only show in list view */}
      {viewMode === 'list' && filteredLeads.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No leads found</h3>
            <p className="text-muted-foreground mt-1">
              {statusFilter !== 'all' 
                ? `No leads in the "${statusFilter}" stage. Try another filter.`
                : 'Start making calls to generate interested leads!'}
            </p>
          </CardContent>
        </Card>
      )}
      {viewMode === 'list' && filteredLeads.length > 0 && (
        <div className="space-y-4">
          {filteredLeads.map(lead => {
            const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.status === lead.leadStatus);
            const StageIcon = PIPELINE_STAGES[currentStageIndex]?.icon || Target;

            return (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${PIPELINE_STAGES[currentStageIndex]?.color || 'bg-gray-500'} bg-opacity-20`}>
                          <StageIcon className={`w-5 h-5 ${(PIPELINE_STAGES[currentStageIndex]?.color || 'bg-gray-500').replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{lead.companyName}</h3>
                            <Badge variant={getStatusBadgeVariant(lead.leadStatus)}>
                              {PIPELINE_STAGES.find(s => s.status === lead.leadStatus)?.label}
                            </Badge>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={`gap-1 ${getScoreLabel(lead.leadScore).color}`}
                                  >
                                    <Zap className="w-3 h-3" />
                                    {lead.leadScore}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="w-48">
                                  <p className="font-medium">{getScoreLabel(lead.leadScore).label} Lead</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Based on call outcomes & interactions
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {lead.contactPersonName}
                            </span>
                            <a 
                              href={`tel:${lead.phoneNumber}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Phone className="w-3 h-3" />
                              {lead.phoneNumber}
                            </a>
                            {lead.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {lead.city}
                              </span>
                            )}
                            {lead.industry && (
                              <span className="flex items-center gap-1">
                                <Factory className="w-3 h-3" />
                                {lead.industry}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Deal Info & Timestamps */}
                    <div className="flex items-center gap-6 text-sm">
                      {lead.dealValue && (
                        <div className="text-center">
                          <p className="text-muted-foreground text-xs">Deal Value</p>
                          <p className="font-bold text-green-600">{formatCurrency(lead.dealValue)}</p>
                        </div>
                      )}
                      {lead.expectedCloseDate && (
                        <div className="text-center">
                          <p className="text-muted-foreground text-xs">Expected Close</p>
                          <p className="font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(lead.expectedCloseDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-muted-foreground text-xs">Created</p>
                        <p className="font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {lead.updatedAt !== lead.createdAt && (
                        <div className="text-center">
                          <p className="text-muted-foreground text-xs">Last Updated</p>
                          <p className="font-medium flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            {format(new Date(lead.updatedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditLead(lead)}
                      >
                        Edit Details
                      </Button>
                      
                      {/* Stage progression buttons */}
                      {lead.leadStatus !== 'converted' && lead.leadStatus !== 'lost' && (
                        <>
                          {lead.leadStatus === 'new' && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handleMoveToStage(lead.id, 'contacted')}
                              disabled={isUpdating}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Move to Contacted
                            </Button>
                          )}
                          {lead.leadStatus === 'contacted' && (
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handleMoveToStage(lead.id, 'qualified')}
                              disabled={isUpdating}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Qualify
                            </Button>
                          )}
                          {lead.leadStatus === 'qualified' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleMoveToStage(lead.id, 'converted')}
                              disabled={isUpdating}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Convert
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleMoveToStage(lead.id, 'lost')}
                            disabled={isUpdating}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Lost
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {lead.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span> {lead.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Lead Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Lead Details</DialogTitle>
            <DialogDescription>
              Update the deal information for {selectedLead?.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-6 py-4">
              {/* Left Column - Edit Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dealValue">Deal Value (AED)</Label>
                    <Input
                      id="dealValue"
                      type="number"
                      placeholder="0"
                      value={editForm.dealValue}
                      onChange={(e) => setEditForm(f => ({ ...f, dealValue: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leadScore">Lead Score (0-100)</Label>
                    <Input
                      id="leadScore"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.leadScore}
                      onChange={(e) => setEditForm(f => ({ ...f, leadScore: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                    <Input
                      id="expectedCloseDate"
                      type="date"
                      value={editForm.expectedCloseDate}
                      onChange={(e) => setEditForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productType">Product Type</Label>
                    <Select 
                      value={editForm.productType} 
                      onValueChange={(v) => handleProductTypeChange(v as ProductType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map(product => (
                          <SelectItem key={product.value} value={product.value}>
                            <span className="flex items-center gap-2">
                              <span>{product.icon}</span>
                              <span>{product.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank</Label>
                  <Select 
                    value={editForm.bankName} 
                    onValueChange={(v) => setEditForm(f => ({ ...f, bankName: v as BankName }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableBanks().map(bank => (
                        <SelectItem key={bank.value} value={bank.value}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this lead..."
                    value={editForm.notes}
                    onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              {/* Right Column - Activity Timeline & Stage History */}
              <div className="border-l pl-6">
                {selectedLead && (
                  <Tabs defaultValue="activity" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="activity" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Activity
                      </TabsTrigger>
                      <TabsTrigger value="stages" className="text-xs">
                        <History className="w-3 h-3 mr-1" />
                        Stage History
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="activity" className="mt-0">
                      <LeadActivityTimeline contactId={selectedLead.contactId} />
                    </TabsContent>
                    <TabsContent value="stages" className="mt-0">
                      <LeadTransitionHistory leadId={selectedLead.id} />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsPage;
