import { useState } from 'react';
import { useCases, Case, CaseStatus, CASE_STAGES, BANK_OPTIONS } from '@/hooks/useCases';
import { CaseKanbanBoard } from '@/components/cases/CaseKanbanBoard';
import { CaseDocumentUpload } from '@/components/cases/CaseDocumentUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  Building2,
  RefreshCw,
  Filter,
  LayoutGrid,
  List,
  Calendar,
  DollarSign,
  Phone,
  User,
  Banknote,
  FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';

type ViewMode = 'kanban' | 'list';

export const CasesPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  
  const { cases, stats, isLoading, refetch, updateCaseStatus, updateCase, isUpdating } = useCases();

  // Filter cases by bank
  const filteredCases = bankFilter === 'all' 
    ? cases 
    : cases.filter(c => c.bank === bankFilter);

  const handleEditCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setEditNotes(caseItem.notes || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCase) return;
    updateCase({
      caseId: selectedCase.id,
      updates: {
        notes: editNotes,
      },
    });
    setEditDialogOpen(false);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Case Management
          </h1>
          <p className="text-muted-foreground">
            Manage and track cases through the bank submission process
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.new + stats.documentCollection}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.underReview + stats.submittedToBank}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-950/50">
                <Building2 className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.bankProcessing}</p>
                <p className="text-xs text-muted-foreground">At Bank</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/50">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.declined}</p>
                <p className="text-xs text-muted-foreground">Declined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Bank:</span>
          </div>
          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Banks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Banks</SelectItem>
              {BANK_OPTIONS.map(bank => (
                <SelectItem key={bank.value} value={bank.value}>
                  {bank.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            ({filteredCases.length} cases)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'kanban' ? (
        <CaseKanbanBoard
          cases={filteredCases}
          onUpdateStatus={updateCaseStatus}
          onEditCase={handleEditCase}
          isUpdating={isUpdating}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No cases found</p>
                <p className="text-sm">Cases will appear here when approved leads are converted</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCases.map(caseItem => (
                  <div
                    key={caseItem.id}
                    onClick={() => handleEditCase(caseItem)}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="font-mono text-sm text-primary font-semibold">
                          #{caseItem.caseNumber}
                        </span>
                        <h4 className="font-medium">{caseItem.companyName}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {caseItem.contactPersonName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{caseItem.bank}</Badge>
                      <Badge variant="secondary">
                        {CASE_STAGES.find(s => s.status === caseItem.status)?.label || caseItem.status}
                      </Badge>
                      {caseItem.dealValue && (
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(caseItem.dealValue)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Case Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Case #{selectedCase?.caseNumber}
            </DialogTitle>
            <DialogDescription>
              View and manage case details
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Case Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Company</Label>
                    <p className="font-medium">{selectedCase.companyName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Contact Person</Label>
                    <p className="font-medium">{selectedCase.contactPersonName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Phone</Label>
                    <a href={`tel:${selectedCase.phoneNumber}`} className="font-medium text-primary hover:underline">
                      {selectedCase.phoneNumber}
                    </a>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Trade License</Label>
                    <p className="font-medium">{selectedCase.tradeLicenseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Bank</Label>
                    <Badge variant="outline" className="mt-1">
                      <Banknote className="w-3 h-3 mr-1" />
                      {BANK_OPTIONS.find(b => b.value === selectedCase.bank)?.label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Product Type</Label>
                    <Badge variant="secondary" className="mt-1">
                      {selectedCase.productType === 'account' ? 'Account' : 'Loan'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Deal Value</Label>
                    <p className="font-medium text-green-600">{formatCurrency(selectedCase.dealValue)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Expected Completion</Label>
                    <p className="font-medium">
                      {selectedCase.expectedCompletionDate 
                        ? format(new Date(selectedCase.expectedCompletionDate), 'PPP')
                        : 'Not set'}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <Label className="text-muted-foreground text-xs">Current Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={CASE_STAGES.find(s => s.status === selectedCase.status)?.bgColor}>
                      {CASE_STAGES.find(s => s.status === selectedCase.status)?.label}
                    </Badge>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this case..."
                    rows={4}
                    className="mt-1"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isUpdating}>
                    Save Changes
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <CaseDocumentUpload
                  caseId={selectedCase.id}
                  caseNumber={selectedCase.caseNumber}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CasesPage;
