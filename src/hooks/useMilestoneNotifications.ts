import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { EarnedMilestone } from './useStreakMilestones';
import { GoalMetric } from './useAgentGoals';
import { playCelebrationSound } from './useCelebrationSound';

const SEEN_MILESTONES_KEY = 'seen_streak_milestones';

const metricLabels: Record<GoalMetric, string> = {
  calls: 'Calls',
  interested: 'Interested',
  leads: 'Leads',
  conversion: 'Conversion',
  talk_time: 'Talk Time',
};

const rarityEmojis: Record<string, string> = {
  common: '🎉',
  uncommon: '✨',
  rare: '💫',
  epic: '🌟',
  legendary: '🏆',
};

const rarityMessages: Record<string, string> = {
  common: 'Nice work!',
  uncommon: 'Great achievement!',
  rare: 'Impressive streak!',
  epic: 'Outstanding dedication!',
  legendary: 'LEGENDARY! You are unstoppable!',
};

const getSeenMilestones = (): Set<string> => {
  try {
    const stored = localStorage.getItem(SEEN_MILESTONES_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Failed to load seen milestones:', e);
  }
  return new Set();
};

const saveSeen = (ids: Set<string>) => {
  try {
    localStorage.setItem(SEEN_MILESTONES_KEY, JSON.stringify([...ids]));
  } catch (e) {
    console.error('Failed to save seen milestones:', e);
  }
};

export const useMilestoneNotifications = (earnedMilestones: EarnedMilestone[]) => {
  const hasNotified = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);

  useEffect(() => {
    if (earnedMilestones.length === 0) return;

    // Load previously seen milestones
    const seenMilestones = getSeenMilestones();
    
    // On first load, mark all current milestones as seen without notifying
    if (!isInitialized.current) {
      isInitialized.current = true;
      const currentIds = earnedMilestones.map(m => `${m.id}-${m.metric}-${m.goalType}`);
      currentIds.forEach(id => seenMilestones.add(id));
      saveSeen(seenMilestones);
      return;
    }

    // Check for new milestones
    earnedMilestones.forEach((milestone) => {
      const milestoneKey = `${milestone.id}-${milestone.metric}-${milestone.goalType}`;
      
      // Skip if already seen or already notified this session
      if (seenMilestones.has(milestoneKey) || hasNotified.current.has(milestoneKey)) {
        return;
      }

      // Mark as notified
      hasNotified.current.add(milestoneKey);
      seenMilestones.add(milestoneKey);
      saveSeen(seenMilestones);

      // Get message for rarity
      const message = rarityMessages[milestone.rarity] || 'Congratulations!';
      const metricLabel = metricLabels[milestone.metric];
      
      // Delay slightly for dramatic effect, then play sound and show toast
      setTimeout(() => {
        // Play celebration sound based on rarity
        playCelebrationSound(milestone.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary');
        
        if (milestone.rarity === 'legendary') {
          toast.success(
            `${milestone.icon} LEGENDARY BADGE UNLOCKED! ${milestone.name} - ${milestone.description} (${metricLabel} ${milestone.goalType})`,
            {
              duration: 10000,
              id: `milestone-${milestoneKey}`,
              description: 'You are a true legend! 🏆',
            }
          );
        } else if (milestone.rarity === 'epic') {
          toast.success(
            `${milestone.icon} Epic Badge Earned: ${milestone.name}`,
            {
              duration: 8000,
              id: `milestone-${milestoneKey}`,
              description: `${milestone.description} - Outstanding dedication!`,
            }
          );
        } else if (milestone.rarity === 'rare') {
          toast.success(
            `${milestone.icon} Rare Badge: ${milestone.name}`,
            {
              duration: 7000,
              id: `milestone-${milestoneKey}`,
              description: `${milestone.description} - Impressive streak!`,
            }
          );
        } else {
          toast.success(
            `${milestone.icon} ${milestone.name} Unlocked!`,
            {
              duration: 6000,
              id: `milestone-${milestoneKey}`,
              description: `${milestone.description} - ${message}`,
            }
          );
        }
      }, 500);
    });
  }, [earnedMilestones]);

  // Function to reset seen milestones (for testing)
  const resetSeenMilestones = () => {
    localStorage.removeItem(SEEN_MILESTONES_KEY);
    hasNotified.current.clear();
    isInitialized.current = false;
  };

  return { resetSeenMilestones };
};
