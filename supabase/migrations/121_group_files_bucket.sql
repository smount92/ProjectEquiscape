-- ============================================================
-- Migration 121: group-files Storage Bucket + RLS
--
-- Creates a PRIVATE storage bucket for group file uploads.
-- Files are uploaded by group admins/mods and accessed via
-- signed URLs generated server-side after group membership is
-- verified (the group_files table RLS gates row visibility).
--
-- NOTE: if this migration is not run against the hosted project,
-- the bucket must be created manually in the Supabase dashboard:
-- name "group-files", private, 10MB file size limit, allowed
-- MIME types matching the list below.
-- ============================================================

-- 1. Create the private bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'group-files',
    'group-files',
    false,                -- PRIVATE — requires signed URLs for reads
    10485760,             -- 10MB limit per file
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Upload policy: authenticated users can upload to their own folder
--    Storage path pattern: {user_id}/{group_id}/{uuid}-{filename}
CREATE POLICY "Users can upload group files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'group-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Read policy: users can read their own uploaded files
--    (other group members read via server-generated signed URLs,
--     which bypass RLS using the service role key)
CREATE POLICY "Users can read own group files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'group-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Delete policy: users can delete their own uploaded files
CREATE POLICY "Users can delete own group files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'group-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
