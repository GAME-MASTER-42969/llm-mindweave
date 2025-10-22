-- Create storage buckets for node attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('node-images', 'node-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('node-documents', 'node-documents', false, 52428800, NULL);

-- RLS policies for node-images bucket
CREATE POLICY "Users can view their own node images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'node-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own node images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'node-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own node images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'node-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for node-documents bucket
CREATE POLICY "Users can view their own node documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'node-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own node documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'node-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own node documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'node-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);