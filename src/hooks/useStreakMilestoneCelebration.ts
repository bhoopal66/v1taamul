import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { playCelebrationSound } from './useCelebrationSound';

export interface StreakMilestone {
  days: number;
  name: string;
  emoji: string;
  colors: string[];
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 7,
    name: 'Week Warrior',
    emoji: '🗓️',
    colors: ['#3b82f6', '#60a5fa', '#93c5fd'], // Blue theme
    rarity: 'rare',
  },
  {
    days: 30,
    name: 'Monthly Master',
    emoji: '🌟',
    colors: ['#a855f7', '#c084fc', '#d8b4fe'], // Purple theme
    rarity: 'epic',
  },
  {
    days: 100,
    name: 'Century Legend',
    emoji: '👑',
    colors: ['#f59e0b', '#fbbf24', '#fcd34d'], // Gold theme
    rarity: 'legendary',
  },
];

// Check if a streak count is exactly at a milestone
export const getExactMilestone = (streak: number): StreakMilestone | null => {
  return STREAK_MILESTONES.find(m => m.days === streak) || null;
};

// Get the next milestone for a given streak
export const getNextMilestone = (streak: number): StreakMilestone | null => {
  return STREAK_MILESTONES.find(m => m.days > streak) || null;
};

// Fire special confetti pattern for milestones
const fireMilestoneConfetti = (milestone: StreakMilestone) => {
  const { colors, days } = milestone;
  
  // Intensity scales with milestone importance
  const particleMultiplier = days >= 100 ? 3 : days >= 30 ? 2 : 1;
  const duration = days >= 100 ? 5000 : days >= 30 ? 4000 : 3000;
  const animationEnd = Date.now() + duration;

  // Fire initial burst
  confetti({
    particleCount: 80 * particleMultiplier,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors,
    zIndex: 9999,
    startVelocity: 45,
    gravity: 0.8,
  });

  // Continuous side bursts
  const frame = () => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return;

    confetti({
      particleCount: 2 * particleMultiplier,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors,
      zIndex: 9999,
    });

    confetti({
      particleCount: 2 * particleMultiplier,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors,
      zIndex: 9999,
    });

    requestAnimationFrame(frame);
  };

  frame();

  // For legendary milestone (100 days), add extra celebration
  if (days >= 100) {
    // Star shower from top
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { x: 0.5, y: 0 },
        colors,
        zIndex: 9999,
        startVelocity: 30,
        gravity: 1.2,
        shapes: ['star'],
        scalar: 1.2,
      });
    }, 500);

    // Final burst
    setTimeout(() => {
      confetti({
        particleCount: 200,
        spread: 120,
        origin: { x: 0.5, y: 0.6 },
        colors,
        zIndex: 9999,
        startVelocity: 55,
      });
    }, 1500);
  }
};

export const useStreakMilestoneCelebration = () => {
  const celebrateMilestone = useCallback((streak: number) => {
    const milestone = getExactMilestone(streak);
    
    if (milestone) {
      // Play celebration sound
      playCelebrationSound(milestone.rarity);
      
      // Fire confetti
      fireMilestoneConfetti(milestone);
      
      return milestone;
    }
    
    return null;
  }, []);

  const triggerMilestoneCelebration = useCallback((milestone: StreakMilestone) => {
    playCelebrationSound(milestone.rarity);
    fireMilestoneConfetti(milestone);
  }, []);

  return {
    celebrateMilestone,
    triggerMilestoneCelebration,
    milestones: STREAK_MILESTONES,
    getExactMilestone,
    getNextMilestone,
  };
};
