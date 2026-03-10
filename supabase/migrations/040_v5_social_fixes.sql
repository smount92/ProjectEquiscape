-- ============================================================
-- Migration 040: V5 Social Bug Fixes
-- 1. Storage RLS for social/ image uploads
-- 2. FK from horse_comments.user_id to public.users for PostgREST joins
-- ============================================================

-- 1. Fix Storage RLS — add social/ path to insert policy
DROP POLICY IF EXISTS "Horse image insert (owner)" ON storage.objects;
CREATE POLICY "Horse image insert (owner)" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (
        -- Standard horse photos
        ((storage.foldername(name))[1] = 'horses' AND EXISTS (SELECT 1 FROM public.user_horses WHERE id = ((storage.foldername(name))[2])::uuid AND owner_id = (SELECT auth.uid())))
        OR 
        -- Help ID photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'help-id')
        OR
        -- Art Studio WIP photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'commissions')
        OR
        -- Social feed image posts (social/{user_id}/...)
        ((storage.foldername(name))[1] = 'social' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
    )
);

-- Also allow read access for social images (public, no horse ownership needed)
-- The existing read policy checks horse ownership — add social path fallthrough
DROP POLICY IF EXISTS "Horse image read (public horses)" ON storage.objects;
CREATE POLICY "Horse image read (public horses)" ON storage.objects FOR SELECT TO authenticated, anon
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
        (
            (storage.foldername(name))[1] != 'horses'
            AND (storage.foldername(name))[1] != 'social'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR
        -- Social images — always readable by authenticated users
        ((storage.foldername(name))[1] = 'social')
    )
);

-- 2. Add FK from horse_comments.user_id to public.users for PostgREST joins
-- The original FK points to auth.users(id), which PostgREST can't join.
-- Add a second FK to public.users(id) so PostgREST can resolve the join.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'horse_comments_user_id_fkey' 
        AND table_name = 'horse_comments'
    ) THEN
        ALTER TABLE horse_comments 
        ADD CONSTRAINT horse_comments_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;
