import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LeadScoringFactors {
  interactionCount: number;
  interestedCount: number;
  callbackCount: number;
  notAnsweredCount: number;
  notInterestedCount: number;
  daysSinceLastContact: number;
  hasDealValue: boolean;
  hasExpectedCloseDate: boolean;
}

export interface LeadScoreBreakdown {
  baseScore: number;
  interactionBonus: number;
  interestBonus: number;
  callbackBonus: number;
  recencyBonus: number;
  dealValueBonus: number;
  closeDateBonus: number;
  penalties: number;
  totalScore: number;
}

// Score calculation weights
const SCORING_WEIGHTS = {
  BASE_SCORE: 10,
  PER_INTERACTION: 5,
  MAX_INTERACTION_BONUS: 25,
  INTERESTED_CALL: 20,
  CALLBACK_SCHEDULED: 10,
  RECENT_CONTACT_7_DAYS: 15,
  RECENT_CONTACT_14_DAYS: 10,
  RECENT_CONTACT_30_DAYS: 5,
  HAS_DEAL_VALUE: 10,
  HAS_CLOSE_DATE: 5,
  NOT_ANSWERED_PENALTY: -3,
  NOT_INTERESTED_PENALTY: -10,
  STALE_LEAD_PENALTY: -15, // No contact in 30+ days
};

export const calculateLeadScore = (factors: LeadScoringFactors): LeadScoreBreakdown => {
  // Base score for being a lead
  const baseScore = SCORING_WEIGHTS.BASE_SCORE;

  // Interaction bonus (capped)
  const interactionBonus = Math.min(
    factors.interactionCount * SCORING_WEIGHTS.PER_INTERACTION,
    SCORING_WEIGHTS.MAX_INTERACTION_BONUS
  );

  // Interest signals
  const interestBonus = factors.interestedCount * SCORING_WEIGHTS.INTERESTED_CALL;

  // Callback bonus
  const callbackBonus = factors.callbackCount * SCORING_WEIGHTS.CALLBACK_SCHEDULED;

  // Recency bonus
  let recencyBonus = 0;
  if (factors.daysSinceLastContact <= 7) {
    recencyBonus = SCORING_WEIGHTS.RECENT_CONTACT_7_DAYS;
  } else if (factors.daysSinceLastContact <= 14) {
    recencyBonus = SCORING_WEIGHTS.RECENT_CONTACT_14_DAYS;
  } else if (factors.daysSinceLastContact <= 30) {
    recencyBonus = SCORING_WEIGHTS.RECENT_CONTACT_30_DAYS;
  }

  // Deal value and close date bonuses
  const dealValueBonus = factors.hasDealValue ? SCORING_WEIGHTS.HAS_DEAL_VALUE : 0;
  const closeDateBonus = factors.hasExpectedCloseDate ? SCORING_WEIGHTS.HAS_CLOSE_DATE : 0;

  // Penalties
  let penalties = 0;
  penalties += factors.notAnsweredCount * SCORING_WEIGHTS.NOT_ANSWERED_PENALTY;
  penalties += factors.notInterestedCount * SCORING_WEIGHTS.NOT_INTERESTED_PENALTY;
  if (factors.daysSinceLastContact > 30) {
    penalties += SCORING_WEIGHTS.STALE_LEAD_PENALTY;
  }

  // Total score (minimum 0, maximum 100)
  const rawScore = baseScore + interactionBonus + interestBonus + callbackBonus + 
                   recencyBonus + dealValueBonus + closeDateBonus + penalties;
  const totalScore = Math.max(0, Math.min(100, rawScore));

  return {
    baseScore,
    interactionBonus,
    interestBonus,
    callbackBonus,
    recencyBonus,
    dealValueBonus,
    closeDateBonus,
    penalties,
    totalScore: Math.round(totalScore),
  };
};

export const getScoreLabel = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: 'Hot', color: 'text-red-500' };
  if (score >= 60) return { label: 'Warm', color: 'text-orange-500' };
  if (score >= 40) return { label: 'Lukewarm', color: 'text-yellow-500' };
  if (score >= 20) return { label: 'Cool', color: 'text-blue-500' };
  return { label: 'Cold', color: 'text-slate-500' };
};

export const useLeadScoring = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch scoring factors for all leads
  const { data: scoringData, isLoading } = useQuery({
    queryKey: ['lead-scoring', user?.id],
    queryFn: async () => {
      // Get all leads for the user
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, contact_id, deal_value, expected_close_date')
        .eq('agent_id', user?.id);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return new Map<string, LeadScoreBreakdown>();

      const contactIds = leads.map(l => l.contact_id);

      // Get all call feedback for these contacts
      const { data: feedback, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('contact_id, feedback_status, call_timestamp')
        .eq('agent_id', user?.id)
        .in('contact_id', contactIds)
        .order('call_timestamp', { ascending: false });

      if (feedbackError) throw feedbackError;

      // Get contact history
      const { data: history, error: historyError } = await supabase
        .from('contact_history')
        .select('contact_id, action_type, action_date, feedback_status')
        .eq('agent_id', user?.id)
        .in('contact_id', contactIds);

      if (historyError) throw historyError;

      // Calculate scores for each lead
      const scoreMap = new Map<string, LeadScoreBreakdown>();

      for (const lead of leads) {
        const contactFeedback = feedback?.filter(f => f.contact_id === lead.contact_id) || [];
        const contactHistory = history?.filter(h => h.contact_id === lead.contact_id) || [];

        // Calculate days since last contact
        const allDates = [
          ...contactFeedback.map(f => new Date(f.call_timestamp || 0)),
          ...contactHistory.map(h => new Date(h.action_date || 0)),
        ].filter(d => d.getTime() > 0);

        const lastContactDate = allDates.length > 0 
          ? Math.max(...allDates.map(d => d.getTime()))
          : Date.now() - 365 * 24 * 60 * 60 * 1000; // Default to 1 year ago if no contact

        const daysSinceLastContact = Math.floor(
          (Date.now() - lastContactDate) / (1000 * 60 * 60 * 24)
        );

        const factors: LeadScoringFactors = {
          interactionCount: contactFeedback.length + contactHistory.length,
          interestedCount: contactFeedback.filter(f => f.feedback_status === 'interested').length,
          callbackCount: contactFeedback.filter(f => f.feedback_status === 'callback').length,
          notAnsweredCount: contactFeedback.filter(f => f.feedback_status === 'not_answered').length,
          notInterestedCount: contactFeedback.filter(f => f.feedback_status === 'not_interested').length,
          daysSinceLastContact,
          hasDealValue: !!lead.deal_value && Number(lead.deal_value) > 0,
          hasExpectedCloseDate: !!lead.expected_close_date,
        };

        scoreMap.set(lead.id, calculateLeadScore(factors));
      }

      return scoreMap;
    },
    enabled: !!user?.id,
  });

  // Mutation to recalculate and update lead scores in database
  const recalculateScores = useMutation({
    mutationFn: async () => {
      if (!scoringData) return;

      const updates = Array.from(scoringData.entries()).map(([leadId, breakdown]) => ({
        id: leadId,
        score: breakdown.totalScore,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('leads')
          .update({ lead_score: update.score, updated_at: new Date().toISOString() })
          .eq('id', update.id);

        if (error) throw error;
      }

      return updates.length;
    },
    onSuccess: (count) => {
      toast.success(`Updated scores for ${count} leads`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-scoring'] });
    },
    onError: (error) => {
      toast.error(`Failed to update scores: ${error.message}`);
    },
  });

  const getScoreBreakdown = (leadId: string): LeadScoreBreakdown | undefined => {
    return scoringData?.get(leadId);
  };

  return {
    scoringData,
    isLoading,
    getScoreBreakdown,
    getScoreLabel,
    recalculateScores: recalculateScores.mutate,
    isRecalculating: recalculateScores.isPending,
  };
};
