import { useState } from 'react';
import { Case, CaseStatus, CASE_STAGES, BANK_OPTIONS } from '@/hooks/useCases';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { 
  Building2, 
  Phone, 
  User,
  Calendar,
  DollarSign,
  GripVertical,
  FileText,
  Banknote,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Pause,
  Send,
  Search,
  Building,
} from 'lucide-react';
import { format } from 'date-fns';

const getStageIcon = (status: CaseStatus) => {
  const icons: Record<CaseStatus, React.ElementType> = {
    new: FileText,
    document_collection: Search,
    under_review: Clock,
    submitted_to_bank: Send,
    bank_processing: Building,
    approved: CheckCircle2,
    declined: XCircle,
    on_hold: Pause,
    cancelled: XCircle,
  };
  return icons[status] || FileText;
};

const getBankLabel = (bankCode: string): string => {
  const bank = BANK_OPTIONS.find(b => b.value === bankCode);
  return bank?.label || bankCode;
};

const getPriorityBadge = (priority: number) => {
  if (priority === 1) return { label: 'Urgent', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' };
  if (priority === 2) return { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' };
  if (priority === 3) return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' };
  return { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-950/50 dark:text-gray-400' };
};

interface CaseKanbanBoardProps {
  cases: Case[];
  onUpdateStatus: (caseId: string, status: CaseStatus) => void;
  onEditCase: (caseItem: Case) => void;
  isUpdating: boolean;
}

export const CaseKanbanBoard = ({ 
  cases, 
  onUpdateStatus, 
  onEditCase, 
  isUpdating,
}: CaseKanbanBoardProps) => {
  const [draggedCase, setDraggedCase] = useState<Case | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CaseStatus | null>(null);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getCasesByStatus = (status: CaseStatus) => {
    return cases.filter(c => c.status === status);
  };

  const getColumnTotal = (status: CaseStatus) => {
    return getCasesByStatus(status).reduce((sum, c) => sum + (c.dealValue || 0), 0);
  };

  const handleDragStart = (e: React.DragEvent, caseItem: Case) => {
    setDraggedCase(caseItem);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', caseItem.id);
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedCase(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: CaseStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: CaseStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedCase && draggedCase.status !== targetStatus) {
      onUpdateStatus(draggedCase.id, targetStatus);
    }
    setDraggedCase(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {CASE_STAGES.map(stage => {
        const stageCases = getCasesByStatus(stage.status);
        const columnTotal = getColumnTotal(stage.status);
        const Icon = getStageIcon(stage.status);
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
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {stageCases.length}
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
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-2 space-y-2">
                {stageCases.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    {isDragOver ? 'Drop here' : 'No cases'}
                  </div>
                ) : (
                  stageCases.map(caseItem => {
                    const priorityInfo = getPriorityBadge(caseItem.priority);
                    
                    return (
                      <Card
                        key={caseItem.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, caseItem)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onEditCase(caseItem)}
                        className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-all group ${
                          draggedCase?.id === caseItem.id ? 'opacity-50 ring-2 ring-primary' : ''
                        }`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              {/* Case Number & Priority */}
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-mono text-xs text-primary font-semibold">
                                  #{caseItem.caseNumber}
                                </span>
                                <Badge variant="outline" className={`text-xs ${priorityInfo.className}`}>
                                  {priorityInfo.label}
                                </Badge>
                              </div>

                              {/* Company Name */}
                              <h4 className="font-medium text-sm truncate">{caseItem.companyName}</h4>

                              {/* Contact Person */}
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <User className="w-3 h-3" />
                                {caseItem.contactPersonName}
                              </p>

                              {/* Phone */}
                              <a 
                                href={`tel:${caseItem.phoneNumber}`}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="w-3 h-3" />
                                {caseItem.phoneNumber}
                              </a>

                              {/* Bank & Product Type */}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300">
                                  <Banknote className="w-2.5 h-2.5 mr-1" />
                                  {getBankLabel(caseItem.bank)}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${caseItem.productType === 'account' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300' : 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-300'}`}>
                                  {caseItem.productType === 'account' ? <CreditCard className="w-2.5 h-2.5 mr-1" /> : <Banknote className="w-2.5 h-2.5 mr-1" />}
                                  {caseItem.productType === 'account' ? 'Account' : 'Loan'}
                                </Badge>
                              </div>

                              {/* Deal Value & Expected Date */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                {caseItem.dealValue && (
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {formatCurrency(caseItem.dealValue)}
                                  </span>
                                )}
                                {caseItem.expectedCompletionDate && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          {format(new Date(caseItem.expectedCompletionDate), 'MMM d')}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Expected completion: {format(new Date(caseItem.expectedCompletionDate), 'PPP')}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};
