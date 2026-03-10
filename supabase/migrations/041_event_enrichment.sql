-- ============================================================
-- Migration 041: Event Enrichment
-- Event comments, event photos, attendee visibility
-- ============================================================

-- ── Event Comments ──
CREATE TABLE IF NOT EXISTS event_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments on any event
CREATE POLICY "event_comments_select"
  ON event_comments FOR SELECT TO authenticated USING (true);

-- Users can post their own comments
CREATE POLICY "event_comments_insert"
  ON event_comments FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Author or event creator can delete
CREATE POLICY "event_comments_delete"
  ON event_comments FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_comments.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_event_comments_event ON event_comments (event_id, created_at);

-- ── Event Photos ──
CREATE TABLE IF NOT EXISTS event_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path  TEXT NOT NULL,  -- storage path in horse-images/events/{eventId}/{userId}_{ts}.webp
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_photos_select"
  ON event_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "event_photos_insert"
  ON event_photos FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Author or event creator can delete photos
CREATE POLICY "event_photos_delete"
  ON event_photos FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_photos.event_id
      AND e.created_by = (SELECT auth.uid())
    )
  );

CREATE INDEX idx_event_photos_event ON event_photos (event_id);

-- ── Storage RLS for event photos ──
-- Update the master INSERT policy to include events/ path
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
        -- Social feed photos (V5)
        ((storage.foldername(name))[1] = 'social' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text)
        OR
        -- Event photos (V6)
        ((storage.foldername(name))[1] = 'events')
    )
);

-- Update READ policy to include events/
DROP POLICY IF EXISTS "Horse image read (public horses)" ON storage.objects;
CREATE POLICY "Horse image read (public horses)" ON storage.objects FOR SELECT TO authenticated, anon
USING (
    bucket_id = 'horse-images'
    AND (
        (storage.foldername(name))[1] = 'social'
        OR (storage.foldername(name))[1] = 'events'
        OR (
            (storage.foldername(name))[1] = 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR (
            (storage.foldername(name))[1] != 'horses'
            AND (storage.foldername(name))[1] != 'social'
            AND (storage.foldername(name))[1] != 'events'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
    )
);
