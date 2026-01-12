-- Tighten profiles SELECT access:
-- - Users: only their own profile
-- - Supervisors: only their direct reports
-- - Ops/Admin: all profiles

DROP POLICY IF EXISTS "Users can view accessible profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Supervisors can view direct reports"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role)
  AND supervisor_id = auth.uid()
);

CREATE POLICY "Management can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);