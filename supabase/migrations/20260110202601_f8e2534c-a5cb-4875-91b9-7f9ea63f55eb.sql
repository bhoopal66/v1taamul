-- Add login streak tracking columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS login_streak_current INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS login_streak_longest INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date DATE DEFAULT NULL;

-- Create a function to update login streak when user logs in
CREATE OR REPLACE FUNCTION public.update_login_streak(user_id UUID)
RETURNS TABLE(
  current_streak INTEGER,
  longest_streak INTEGER,
  streak_bonus_xp INTEGER,
  is_new_day BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
  v_is_new_day BOOLEAN := FALSE;
  v_bonus_xp INTEGER := 0;
BEGIN
  -- Get current streak data
  SELECT 
    p.last_login_date,
    COALESCE(p.login_streak_current, 0),
    COALESCE(p.login_streak_longest, 0)
  INTO v_last_login_date, v_current_streak, v_longest_streak
  FROM profiles p
  WHERE p.id = user_id;

  -- Check if this is a new day login
  IF v_last_login_date IS NULL OR v_last_login_date < v_today THEN
    v_is_new_day := TRUE;
    
    IF v_last_login_date = v_today - INTERVAL '1 day' THEN
      -- Consecutive day - increment streak
      v_current_streak := v_current_streak + 1;
    ELSIF v_last_login_date IS NULL OR v_last_login_date < v_today - INTERVAL '1 day' THEN
      -- Streak broken or first login - reset to 1
      v_current_streak := 1;
    END IF;

    -- Update longest streak if current is higher
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    -- Calculate bonus XP based on streak
    -- Base: 10 XP per day, with milestones
    v_bonus_xp := 10;
    IF v_current_streak >= 7 THEN v_bonus_xp := v_bonus_xp + 5; END IF;  -- Week bonus
    IF v_current_streak >= 30 THEN v_bonus_xp := v_bonus_xp + 10; END IF; -- Month bonus
    IF v_current_streak >= 100 THEN v_bonus_xp := v_bonus_xp + 25; END IF; -- Century bonus

    -- Update the profile
    UPDATE profiles
    SET 
      last_login_date = v_today,
      last_login = NOW(),
      login_streak_current = v_current_streak,
      login_streak_longest = v_longest_streak,
      updated_at = NOW()
    WHERE id = user_id;
  END IF;

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_bonus_xp, v_is_new_day;
END;
$$;