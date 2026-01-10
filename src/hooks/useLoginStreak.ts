import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { playCelebrationSound } from './useCelebrationSound';

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
          
          // Determine celebration level
          const streak = result.current_streak;
          let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
          
          if (streak >= 100) rarity = 'legendary';
          else if (streak >= 30) rarity = 'epic';
          else if (streak >= 7) rarity = 'rare';
          else if (streak >= 3) rarity = 'uncommon';

          // Play sound for streaks >= 3
          if (streak >= 3) {
            setTimeout(() => playCelebrationSound(rarity), 300);
          }

          // Show appropriate toast
          setTimeout(() => {
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
                  description: 'A full month of dedication!',
                }
              );
            } else if (streak >= 7) {
              toast.success(
                `🔥 ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                {
                  duration: 5000,
                  description: 'One week strong! Keep it up!',
                }
              );
            } else if (streak >= 3) {
              toast.success(
                `🔥 ${streak}-Day Streak! +${result.streak_bonus_xp} XP`,
                {
                  duration: 4000,
                  description: 'You\'re building momentum!',
                }
              );
            } else {
              toast.success(
                `Welcome back! +${result.streak_bonus_xp} XP`,
                {
                  duration: 3000,
                  description: streak === 1 ? 'Start of a new streak!' : `Day ${streak} of your streak`,
                }
              );
            }
          }, 500);
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
