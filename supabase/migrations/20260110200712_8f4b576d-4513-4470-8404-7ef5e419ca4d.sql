-- Add completed_at column to track when goals were achieved
ALTER TABLE public.agent_goals 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for streak calculations
CREATE INDEX idx_agent_goals_completed ON public.agent_goals(agent_id, goal_type, metric, completed_at)
WHERE completed_at IS NOT NULL;