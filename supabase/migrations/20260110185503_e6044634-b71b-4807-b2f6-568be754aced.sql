-- Fix the overly permissive RLS policy on upload_rejections
DROP POLICY IF EXISTS "System can insert rejections" ON public.upload_rejections;

CREATE POLICY "Agents can insert rejections for their uploads" ON public.upload_rejections
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.call_sheet_uploads u 
            WHERE u.id = upload_id AND u.agent_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
    );

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'agent');
    
    RETURN NEW;
END;
$$;