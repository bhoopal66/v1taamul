import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { playCelebrationSound } from './useCelebrationSound';
import { getExactMilestone, getNextMilestone, STREAK_MILESTONES } from './useStreakMilestoneCelebration';
import confetti from 'canvas-confetti';

interface LoginStreakData {
  currentStreak: number;
  longestStreak: number;
  bonusXP: number;
  isNewDay: boolean;
  lastLoginDate: string | null;
}

const LAST_STREAK_CHECK_KEY = 'last_login_streak_check';

export const useLoginStreak = () => {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<LoginStreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  const checkLoginStreak = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    // Check if we already checked today (prevent duplicate toasts)
    const lastCheck = localStorage.getItem(LAST_STREAK_CHECK_KEY);
    const today = new Date().toDateString();
    
    if (lastCheck === today) {
      // Already checked today, just fetch current data
      const { data: profile } = await supabase
        .from('profiles')
        .select('login_streak_current, login_streak_longest, last_login_date')
        .eq('id', user.id)
        .single();

      if (profile) {
        setStreakData({
          currentStreak: profile.login_streak_current || 0,
          longestStreak: profile.login_streak_longest || 0,
          bonusXP: 0,
          isNewDay: false,
          lastLoginDate: profile.last_login_date,
        });
      }
      setIsLoading(false);
      return;
    }

    try {
      // Call the update_login_streak function
      const { data, error } = await supabase.rpc('update_login_streak', {
        user_id: user.id,
      });

      if (error) {
        console.error('Error updating login streak:', error);
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        setStreakData({
          currentStreak: result.current_streak,
          longestStreak: result.longest_streak,
          bonusXP: result.streak_bonus_xp,
          isNewDay: result.is_new_day,
          lastLoginDate: new Date().toISOString().split('T')[0],
        });

        // Mark as checked today
        localStorage.setItem(LAST_STREAK_CHECK_KEY, today);

        // Show welcome toast if new day
        if (result.is_new_day && !hasShownWelcome) {
          setHasShownWelcome(true);
          
          const streak = result.current_streak;
          const milestone = getExactMilestone(streak);
          const nextMilestone = getNextMilestone(streak);
          
          // Determine celebration level
          let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
          
          if (streak >= 100) rarity = 'legendary';
          else if (streak >= 30) rarity = 'epic';
          else if (streak >= 7) rarity = 'rare';
          else if (streak >= 3) rarity = 'uncommon';

          // Check if hitting a milestone - trigger special confetti
          if (milestone) {
            setTimeout(() => {
              // Fire milestone-specific confetti
              const duration = milestone.days >= 100 ? 5000 : milestone.days >= 30 ? 4000 : 3000;
              const particleMultiplier = milestone.days >= 100 ? 3 : milestone.days >= 30 ? 2 : 1;
              const animationEnd = Date.now() + duration;

              // Initial burst
              confetti({
                particleCount: 80 * particleMultiplier,
                spread: 100,
                origin: { x: 0.5, y: 0.5 },
                colors: milestone.colors,
                zIndex: 9999,
                startVelocity: 45,
              });

              // Side bursts
              const frame = () => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return;

                confetti({
                  particleCount: 2 * particleMultiplier,
                  angle: 60,
                  spread: 55,
                  origin: { x: 0, y: 0.65 },
                  colors: milestone.colors,
                  zIndex: 9999,
                });

                confetti({
                  particleCount: 2 * particleMultiplier,
                  angle: 120,
                  spread: 55,
                  origin: { x: 1, y: 0.65 },
                  colors: milestone.colors,
                  zIndex: 9999,
                });

                requestAnimationFrame(frame);
              };

              frame();

              // Extra celebration for 100-day milestone
              if (milestone.days >= 100) {
                setTimeout(() => {
                  confetti({
                    particleCount: 150,
                    spread: 180,
                    origin: { x: 0.5, y: 0 },
                    colors: milestone.colors,
                    zIndex: 9999,
                    startVelocity: 30,
                    gravity: 1.2,
                    shapes: ['star'],
                    scalar: 1.2,
                  });
                }, 500);
              }

              playCelebrationSound(milestone.rarity);
            }, 300);

            // Show milestone toast
            setTimeout(() => {
              toast.success(
                `${milestone.emoji} ${milestone.name} Unlocked!`,
                {
                  duration: 8000,
                  description: `${streak}-day streak achieved! +${result.streak_bonus_xp} XP bonus!`,
                }
              );
            }, 500);
          } else {
            // Regular streak celebration (not a milestone)
            if (streak >= 3) {
              setTimeout(() => playCelebrationSound(rarity), 300);
            }

            // Show appropriate toast
            setTimeout(() => {
              const daysToNext = nextMilestone ? nextMilestone.days - streak : 0;
              const nextInfo = nextMilestone 
                ? ` (${daysToNext} days to ${nextMilestone.name}!)` 
                : '';

              if (streak >= 100) {
                toast.success(
                  `🔥 LEGENDARY ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                  {
                    duration: 8000,
                    description: 'You are absolutely unstoppable! 🏆',
                  }
                );
              } else if (streak >= 30) {
                toast.success(
                  `🔥 Amazing ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                  {
                    duration: 6000,
                    description: `A full month of dedication!${nextInfo}`,
                  }
                );
              } else if (streak >= 7) {
                toast.success(
                  `🔥 ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                  {
                    duration: 5000,
                    description: `One week strong!${nextInfo}`,
                  }
                );
              } else if (streak >= 3) {
                toast.success(
                  `🔥 ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                  {
                    duration: 4000,
                    description: `You're building momentum!${nextInfo}`,
                  }
                );
              } else {
                toast.success(
                  `Welcome back! +${result.streak_bonus_xp} XP`,
                  {
                    duration: 3000,
                    description: streak === 1 
                      ? `Start of a new streak!${nextInfo}` 
                      : `Day ${streak} of your streak${nextInfo}`,
                  }
                );
              }
            }, 500);
          }
        }
      }
    } catch (err) {
      console.error('Error checking login streak:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, hasShownWelcome]);

  useEffect(() => {
    checkLoginStreak();
  }, [checkLoginStreak]);

  return {
    streakData,
    isLoading,
    refreshStreak: checkLoginStreak,
  };
};
