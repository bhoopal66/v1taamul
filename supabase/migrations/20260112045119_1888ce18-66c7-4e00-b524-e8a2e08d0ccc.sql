-- Add approval workflow columns to agent_submissions
ALTER TABLE public.agent_submissions
ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN reviewed_at TIMESTAMPTZ,
ADD COLUMN review_notes TEXT;

-- Create policy for supervisors to view team submissions
CREATE POLICY "Supervisors can view team submissions"
ON public.agent_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = agent_id
    AND p.supervisor_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.teams t ON p.team_id = t.id
    WHERE p.id = agent_id
    AND t.leader_id = auth.uid()
  )
  OR
  public.has_role(auth.uid(), 'supervisor')
  OR
  public.has_role(auth.uid(), 'admin')
  OR
  public.has_role(auth.uid(), 'super_admin')
);

-- Create policy for supervisors to update submissions (approve/reject)
CREATE POLICY "Supervisors can update team submissions"
ON public.agent_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = agent_id
    AND p.supervisor_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.teams t ON p.team_id = t.id
    WHERE p.id = agent_id
    AND t.leader_id = auth.uid()
  )
  OR
  public.has_role(auth.uid(), 'supervisor')
  OR
  public.has_role(auth.uid(), 'admin')
  OR
  public.has_role(auth.uid(), 'super_admin')
);