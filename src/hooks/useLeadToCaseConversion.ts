import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Lead, parseLeadSource } from './useLeads';
import { CaseBank, ProductType } from './useCases';

interface Coordinator {
  id: string;
  fullName: string;
  maxCaseCapacity: number;
  activeCaseCount: number;
  availableCapacity: number;
  workloadPercentage: number;
}

interface ConversionResult {
  caseId: string;
  caseNumber: string;
  coordinatorId: string;
  coordinatorName: string;
}

export const useLeadToCaseConversion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch coordinators with their workload
  const { data: coordinators, isLoading: isLoadingCoordinators } = useQuery({
    queryKey: ['coordinators-workload'],
    queryFn: async (): Promise<Coordinator[]> => {
      // Get all coordinators
      const { data: coordinatorRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'coordinator');

      if (rolesError) throw rolesError;
      if (!coordinatorRoles?.length) return [];

      const coordinatorIds = coordinatorRoles.map(r => r.user_id);

      // Get coordinator profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, max_case_capacity')
        .in('id', coordinatorIds)
        .eq('is_active', true);

      if (profilesError) throw profilesError;
      if (!profiles?.length) return [];

      // Get active case counts for each coordinator
      const { data: caseCounts, error: casesError } = await supabase
        .from('cases')
        .select('coordinator_id')
        .in('coordinator_id', coordinatorIds)
        .not('status', 'in', '("approved","declined","cancelled")');

      if (casesError) throw casesError;

      // Count cases per coordinator
      const caseCountMap: Record<string, number> = {};
      (caseCounts || []).forEach(c => {
        caseCountMap[c.coordinator_id] = (caseCountMap[c.coordinator_id] || 0) + 1;
      });

      return profiles.map(profile => {
        const maxCapacity = profile.max_case_capacity || 20; // Default capacity
        const activeCases = caseCountMap[profile.id] || 0;
        return {
          id: profile.id,
          fullName: profile.full_name || 'Unknown',
          maxCaseCapacity: maxCapacity,
          activeCaseCount: activeCases,
          availableCapacity: Math.max(0, maxCapacity - activeCases),
          workloadPercentage: Math.round((activeCases / maxCapacity) * 100),
        };
      });
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Find the best coordinator based on workload
  const findBestCoordinator = (): Coordinator | null => {
    if (!coordinators?.length) return null;

    // Sort by available capacity (descending) then by workload percentage (ascending)
    const sorted = [...coordinators].sort((a, b) => {
      // First priority: available capacity
      if (a.availableCapacity !== b.availableCapacity) {
        return b.availableCapacity - a.availableCapacity;
      }
      // Second priority: workload percentage
      return a.workloadPercentage - b.workloadPercentage;
    });

    // Return the coordinator with most available capacity
    const best = sorted[0];
    if (best && best.availableCapacity > 0) {
      return best;
    }

    // If all are at capacity, still return the one with lowest workload
    return sorted[0] || null;
  };

  // Convert lead to case mutation
  const convertMutation = useMutation({
    mutationFn: async (lead: Lead): Promise<ConversionResult> => {
      // Find best coordinator
      const coordinator = findBestCoordinator();
      if (!coordinator) {
        throw new Error('No available coordinators found. Please contact an administrator.');
      }

      // Parse lead source to get bank and product type
      const parsed = parseLeadSource(lead.leadSource);
      if (!parsed) {
        throw new Error('Invalid lead source. Please update the lead details.');
      }

      // Validate bank is valid for cases
      const validBanks: CaseBank[] = ['RAK', 'NBF', 'UBL', 'RUYA', 'MASHREQ', 'WIO'];
      if (!validBanks.includes(parsed.bank as CaseBank)) {
        throw new Error(`Invalid bank: ${parsed.bank}`);
      }

      // Validate product type
      const validProducts: ProductType[] = ['account', 'loan'];
      if (!validProducts.includes(parsed.product as ProductType)) {
        throw new Error(`Invalid product type: ${parsed.product}`);
      }

      // Generate case number using the database function
      const { data: caseNumberData, error: caseNumberError } = await supabase
        .rpc('generate_case_number');

      if (caseNumberError) {
        console.error('Case number generation error:', caseNumberError);
        // Fallback: generate a simple case number
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        throw new Error('Failed to generate case number. Please try again.');
      }

      const caseNumber = caseNumberData as string;

      // Create the case
      const { data: newCase, error: insertError } = await supabase
        .from('cases')
        .insert({
          case_number: caseNumber,
          lead_id: lead.id,
          contact_id: lead.contactId,
          coordinator_id: coordinator.id,
          original_agent_id: lead.agentId,
          bank: parsed.bank as CaseBank,
          product_type: parsed.product as ProductType,
          status: 'new',
          priority: 2, // Default priority
          deal_value: lead.dealValue,
          notes: lead.notes,
        })
        .select('id, case_number')
        .single();

      if (insertError) {
        console.error('Case insert error:', insertError);
        throw new Error(`Failed to create case: ${insertError.message}`);
      }

      // Update lead status to 'converted' to indicate it's now a case
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          lead_status: 'converted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error('Lead update error:', updateError);
        // Don't throw - case was created successfully
      }

      // Create audit trail entry
      await supabase.from('case_audit_trail').insert({
        case_id: newCase.id,
        action: 'case_created',
        performed_by: user?.id || lead.agentId,
        notes: `Case created from approved lead. Assigned to coordinator based on workload (${coordinator.activeCaseCount}/${coordinator.maxCaseCapacity} cases).`,
        new_value: {
          status: 'new',
          coordinator: coordinator.fullName,
          bank: parsed.bank,
          product_type: parsed.product,
        },
      });

      return {
        caseId: newCase.id,
        caseNumber: newCase.case_number,
        coordinatorId: coordinator.id,
        coordinatorName: coordinator.fullName,
      };
    },
    onSuccess: (result) => {
      toast.success('📋 Case Created Successfully!', {
        description: `Case ${result.caseNumber} assigned to ${result.coordinatorName}`,
        duration: 8000,
        action: {
          label: 'View Case',
          onClick: () => {
            window.location.href = `/cases?caseId=${result.caseId}`;
          },
        },
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['coordinators-workload'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create case', {
        description: error.message,
      });
    },
  });

  const convertLeadToCase = (lead: Lead) => {
    // Validate lead status
    if (lead.leadStatus !== 'approved') {
      toast.error('Only approved leads can be converted to cases');
      return;
    }

    // Validate trade license
    if (!lead.tradeLicenseNumber) {
      toast.error('Trade license required', {
        description: 'Please add a trade license number before converting to a case.',
      });
      return;
    }

    convertMutation.mutate(lead);
  };

  return {
    coordinators: coordinators || [],
    isLoadingCoordinators,
    convertLeadToCase,
    isConverting: convertMutation.isPending,
    findBestCoordinator,
  };
};
