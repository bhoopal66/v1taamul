import { useState, useEffect, useMemo } from 'react';

interface LoginStreakReminderData {
  isAtRisk: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  hasLoggedInToday: boolean;
  currentStreak: number;
}

const LOGIN_STREAK_REMINDER_DISMISSED_KEY = 'login_streak_reminder_dismissed_date';

export const useLoginStreakReminder = (
  currentStreak: number,
  lastLoginDate: string | null,
  isNewDay: boolean
) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if reminder was dismissed today
  useEffect(() => {
    const dismissedDate = localStorage.getItem(LOGIN_STREAK_REMINDER_DISMISSED_KEY);
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setIsDismissed(true);
    } else {
      setIsDismissed(false);
    }
  }, []);

  const reminderData = useMemo((): LoginStreakReminderData => {
    const now = new Date();
    const today = now.toDateString();
    
    // Check if user has already logged in today
    const hasLoggedInToday = lastLoginDate 
      ? new Date(lastLoginDate).toDateString() === today || isNewDay
      : false;

    // Calculate time until midnight (end of day)
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const msRemaining = endOfDay.getTime() - now.getTime();
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

    // Determine urgency level based on time remaining
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (hoursRemaining < 1) {
      urgencyLevel = 'critical';
    } else if (hoursRemaining < 3) {
      urgencyLevel = 'high';
    } else if (hoursRemaining < 6) {
      urgencyLevel = 'medium';
    }

    // Streak is at risk if:
    // 1. User has a streak > 0
    // 2. User hasn't logged in today
    // 3. There's less than 12 hours remaining in the day
    const isAtRisk = currentStreak > 0 && !hasLoggedInToday && hoursRemaining < 12;

    return {
      isAtRisk,
      hoursRemaining,
      minutesRemaining,
      urgencyLevel,
      hasLoggedInToday,
      currentStreak,
    };
  }, [currentStreak, lastLoginDate, isNewDay]);

  const dismissReminder = () => {
    const today = new Date().toDateString();
    localStorage.setItem(LOGIN_STREAK_REMINDER_DISMISSED_KEY, today);
    setIsDismissed(true);
  };

  const shouldShowReminder = reminderData.isAtRisk && !isDismissed;

  return {
    ...reminderData,
    shouldShowReminder,
    dismissReminder,
  };
};
