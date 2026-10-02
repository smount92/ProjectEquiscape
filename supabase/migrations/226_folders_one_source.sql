-- 226: Folders — one source of membership (2026-10-02).
--
-- A horse's folders have lived in two places since 077: the
-- horse_collections junction (a horse in several folders) and the older
-- user_horses.collection_id column. 077 copied the column into the
-- junction ONCE; three write paths (bulk move, quick add, CSV import)
-- kept writing only the column, so the two drifted — a member's public
-- folder showed 15 of its 58 horses because the profile read one source
-- and her stable read both (2026-09-28).
--
-- The app now writes the junction on every path and reads through one
-- module. This migration brings the data level with it:
--   1. Backfill the junction from the column again (idempotent).
--   2. Let anyone read a junction row whose horse is public and whose
--      folder is public — so a public profile reads membership with the
--      visitor's own client instead of the service key.
-- The column stays (nothing is dropped); it is now a mirror, not a source.

INSERT INTO public.horse_collections (horse_id, collection_id)
SELECT h.id, h.collection_id
FROM public.user_horses h
JOIN public.user_collections c ON c.id = h.collection_id
WHERE h.collection_id IS NOT NULL
ON CONFLICT (horse_id, collection_id) DO NOTHING;

DROP POLICY IF EXISTS "Public folder links are readable" ON public.horse_collections;
CREATE POLICY "Public folder links are readable" ON public.horse_collections
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_horses h
            JOIN public.user_collections c ON c.id = horse_collections.collection_id
            WHERE h.id = horse_collections.horse_id
              AND h.visibility = 'public'
              AND h.deleted_at IS NULL
              AND c.is_public = true
        )
    );
