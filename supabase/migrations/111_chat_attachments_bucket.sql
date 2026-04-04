-- ============================================================
-- Migration 111: chat-attachments Storage Bucket + RLS
--
-- Creates a PRIVATE storage bucket for DM image attachments.
-- Photos are uploaded by the sender and accessed via signed URLs
-- generated server-side after verifying conversation membership.
-- ============================================================

-- 1. Create the private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    false,                -- PRIVATE — requires signed URLs for reads
    5242880,              -- 5MB limit per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Upload policy: authenticated users can upload to their own folder
--    Storage path pattern: {user_id}/{conversation_id}/{filename}
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Read policy: users can read their own uploaded files
--    (the OTHER participant reads via server-generated signed URLs,
--     which bypass RLS using the service role key)
CREATE POLICY "Users can read own chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Delete policy: users can delete their own uploaded files
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
