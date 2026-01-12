-- Fix WhatsApp messages content exposure by restricting agents to their own message threads
-- Drop existing policies
DROP POLICY IF EXISTS "Agents can view their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Agents can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Agents can update their messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Agents can delete their messages" ON public.whatsapp_messages;

-- Create new restrictive policies - agents can ONLY see/manage their own messages
CREATE POLICY "Agents can view their own messages only" 
ON public.whatsapp_messages 
FOR SELECT 
USING (
  agent_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin')
  )
);

CREATE POLICY "Agents can insert their own messages only" 
ON public.whatsapp_messages 
FOR INSERT 
WITH CHECK (
  agent_id = auth.uid()
);

CREATE POLICY "Agents can update their own messages only" 
ON public.whatsapp_messages 
FOR UPDATE 
USING (
  agent_id = auth.uid()
);

CREATE POLICY "Agents can delete their own messages only" 
ON public.whatsapp_messages 
FOR DELETE 
USING (
  agent_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('operations_head', 'admin', 'super_admin')
  )
);