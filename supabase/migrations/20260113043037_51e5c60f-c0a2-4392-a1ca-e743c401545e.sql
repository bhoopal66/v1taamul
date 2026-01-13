-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('case-documents', 'case-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for case documents bucket
CREATE POLICY "Coordinators can upload case documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'case-documents' 
  AND (
    public.is_coordinator(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

CREATE POLICY "Coordinators can view case documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-documents' 
  AND (
    public.is_coordinator(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'supervisor', 'operations_head')
    )
  )
);

CREATE POLICY "Coordinators can delete case documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'case-documents' 
  AND (
    public.is_coordinator(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);