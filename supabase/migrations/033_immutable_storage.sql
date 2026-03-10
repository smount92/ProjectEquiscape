-- ============================================================
-- Migration 033: Immutable Storage Paths
-- Changes image storage from {user_id}/{horse_id}/ to horses/{horse_id}/
-- Adds dynamic RLS policy on storage.objects for horse-images bucket
-- ============================================================

-- Allow authenticated users to INSERT images for horses they own
CREATE POLICY "Horse image insert (owner)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow authenticated users to UPDATE images for horses they own
CREATE POLICY "Horse image update (owner)"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow authenticated users to DELETE images for horses they own
CREATE POLICY "Horse image delete (owner)"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow anyone (including anon) to SELECT/read images for public horses
-- This enables signed URLs to work for public passport pages
CREATE POLICY "Horse image read (public horses)"
ON storage.objects FOR SELECT TO authenticated, anon
USING (
    bucket_id = 'horse-images'
    AND (
        -- New path format: horses/{horse_id}/...
        (
            (storage.foldername(name))[1] = 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR
        -- Legacy path format: {user_id}/{horse_id}/...
        -- Keep until all images are migrated
        (
            (storage.foldername(name))[1] != 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
    )
);
