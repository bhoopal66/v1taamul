import { useState } from 'react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { getScoreLabel } from '@/hooks/useLeadScoring';

const PIPELINE_STAGES: { status: LeadStatus; label: string; color: string; bgColor: string; icon: React.ElementType }[] = [
  { status: 'new', label: 'New', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30', icon: Sparkles },
  { status: 'contacted', label: 'Contacted', color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30', icon: Phone },
  { status: 'qualified', label: 'Qualified', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30', icon: CheckCircle },
  { status: 'converted', label: 'Converted', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', icon: Target },
  { status: 'lost', label: 'Lost', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30', icon: XCircle },
];

interface LeadKanbanBoardProps {
  leads: Lead[];
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onEditLead: (lead: Lead) => void;
  isUpdating: boolean;
}

export const LeadKanbanBoard = ({ leads, onUpdateStatus, onEditLead, isUpdating }: LeadKanbanBoardProps) => {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter(lead => lead.leadStatus === status);
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
      onUpdateStatus(draggedLead.id, targetStatus);
    }
    setDraggedLead(null);
  };

  return (
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

                            {/* Trade License Warning */}
                            {!lead.tradeLicenseNumber && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-1.5 py-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>No trade license</span>
                              </div>
                            )}

                            {/* Deal Value & Close Date */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
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
  );
};
