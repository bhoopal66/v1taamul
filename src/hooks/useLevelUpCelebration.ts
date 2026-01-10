import { useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useCelebrationSound } from './useCelebrationSound';
import { toast } from 'sonner';
import { LevelTier } from './useAgentLevel';

const LEVEL_UP_STORAGE_KEY = 'agent_last_level';

// Color themes for different level tiers
const levelConfettiColors: Record<string, string[]> = {
  slate: ['#64748b', '#94a3b8', '#cbd5e1'],
  green: ['#22c55e', '#10b981', '#34d399'],
  blue: ['#3b82f6', '#6366f1', '#818cf8'],
  purple: ['#a855f7', '#8b5cf6', '#c084fc'],
  amber: ['#f59e0b', '#fbbf24', '#fcd34d'],
  orange: ['#f97316', '#fb923c', '#fdba74'],
  rose: ['#f43f5e', '#fb7185', '#fda4af'],
  red: ['#ef4444', '#f87171', '#fca5a5'],
  indigo: ['#6366f1', '#818cf8', '#a5b4fc'],
  yellow: ['#eab308', '#facc15', '#fde047'],
};

// Rarity mapping based on level
const getLevelRarity = (level: number): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' => {
  if (level >= 10) return 'legendary';
  if (level >= 8) return 'epic';
  if (level >= 5) return 'rare';
  if (level >= 3) return 'uncommon';
  return 'common';
};

interface UseLevelUpCelebrationProps {
  currentLevel: LevelTier;
  totalXP: number;
}

export const useLevelUpCelebration = ({ currentLevel, totalXP }: UseLevelUpCelebrationProps) => {
  const { play: playSound } = useCelebrationSound();
  const hasTriggeredRef = useRef(false);

  const fireConfetti = useCallback((colors: string[]) => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    // Create multiple bursts
    const frame = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return;

      // Left side burst
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
        zIndex: 9999,
      });

      // Right side burst
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
        zIndex: 9999,
      });

      requestAnimationFrame(frame);
    };

    // Initial big burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors,
      zIndex: 9999,
    });

    frame();
  }, []);

  const fireCelebration = useCallback((level: LevelTier) => {
    const colors = levelConfettiColors[level.color] || levelConfettiColors.slate;
    const rarity = getLevelRarity(level.level);

    // Play celebration sound
    playSound(rarity);

    // Fire confetti with level-specific colors
    fireConfetti(colors);

    // Show toast notification
    toast.success(
      `🎉 Level Up! You're now ${level.title}!`,
      {
        description: `Welcome to Level ${level.level}! New perks unlocked: ${level.perks.join(', ')}`,
        duration: 5000,
      }
    );
  }, [playSound, fireConfetti]);

  useEffect(() => {
    // Get the last known level from storage
    const storedLevel = localStorage.getItem(LEVEL_UP_STORAGE_KEY);
    const lastLevel = storedLevel ? parseInt(storedLevel, 10) : null;

    // If this is the first time or user leveled up
    if (lastLevel !== null && currentLevel.level > lastLevel && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      
      // Small delay to ensure the UI has updated
      setTimeout(() => {
        fireCelebration(currentLevel);
      }, 500);
    }

    // Always update the stored level
    localStorage.setItem(LEVEL_UP_STORAGE_KEY, currentLevel.level.toString());

    // Reset the trigger flag when level changes
    return () => {
      hasTriggeredRef.current = false;
    };
  }, [currentLevel.level, fireCelebration]);

  // Manual trigger for testing or specific scenarios
  const triggerCelebration = useCallback(() => {
    fireCelebration(currentLevel);
  }, [currentLevel, fireCelebration]);

  return { triggerCelebration };
};
