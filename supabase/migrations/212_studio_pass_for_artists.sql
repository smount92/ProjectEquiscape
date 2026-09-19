-- 212: The studio pass, before a professional artist walks in
-- (2026-09-18). A well-known artist joined and said she'd try the Art
-- Studio this weekend; three read-only audits of the code found the
-- items below. Everything here is additive or narrowing; the app
-- degrades cleanly before the paste.
--
-- Paste as one run. Each statement stands alone (205 lesson).
SET lock_timeout = '4s';

-- ══════════════════════════════════════════════════════════════
-- 1. An artist can upload reel photos onto a client's horse.
--
-- /studio/log-work writes making-of photos to
--   horse-images / horses/{horseId}/making_{ts}_{bucket}_{i}.webp
-- but the bucket's INSERT policy (last set in 041) allows the horses/
-- leg ONLY when the uploader owns the horse. So the form's headline
-- case — "a work on someone else's horse asks their owner to confirm
-- the credit" — had every photo refused, the record saved with an
-- empty reel, and the success panel said it was on the wall. New leg:
-- a making_ file for a horse the uploader holds a live work record on.
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Horse image insert (owner)" ON storage.objects;
CREATE POLICY "Horse image insert (owner)" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (
        -- Standard horse photos
        ((storage.foldername(name))[1] = 'horses' AND EXISTS (SELECT 1 FROM public.user_horses WHERE id = ((storage.foldername(name))[2])::uuid AND owner_id = (SELECT auth.uid())))
        OR
        -- Making-of photos by the credited artist (202/204 work records)
        (
            (storage.foldername(name))[1] = 'horses'
            AND storage.filename(name) LIKE 'making\_%'
            AND EXISTS (
                SELECT 1 FROM public.customization_logs cl
                WHERE cl.horse_id = ((storage.foldername(name))[2])::uuid
                  AND cl.artist_user_id = (SELECT auth.uid())
                  AND cl.disavowed_at IS NULL
            )
        )
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

-- ══════════════════════════════════════════════════════════════
-- 2. Checkpoints can be saved. 203 built the workbench checkpoint
-- (metadata {title, acked_by, acked_at}) but the 028 CHECK on
-- update_type was never widened, so "☑️ Checkpoint — ask for sign-off"
-- failed with a raw 23514 every time.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE commission_updates DROP CONSTRAINT IF EXISTS commission_updates_update_type_check;
ALTER TABLE commission_updates ADD CONSTRAINT commission_updates_update_type_check
  CHECK (update_type IN (
    'wip_photo', 'status_change', 'message',
    'revision_request', 'approval', 'milestone', 'checkpoint'
  ));

-- ══════════════════════════════════════════════════════════════
-- 3. A commission is the two parties' business. The 170 SELECT policy
-- kept a "public queue" leg (is_public_in_queue defaults true, no UI
-- ever set it) that let ANY signed-in member read every active
-- commission row — description, budget, agreed price, terms snapshot,
-- client email, guest_token. No page ever rendered a public queue.
-- Participants only; guests keep going through the token-validated
-- admin read.
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "View commissions" ON commissions;
CREATE POLICY "View commissions" ON commissions
  FOR SELECT TO authenticated
  USING (
    artist_id = (SELECT auth.uid())
    OR client_id = (SELECT auth.uid())
  );

-- Thread entries are signed by whoever writes them.
DROP POLICY IF EXISTS "Commission participants create updates" ON commission_updates;
CREATE POLICY "Commission participants create updates"
  ON commission_updates FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM commissions c WHERE c.id = commission_id
      AND (c.artist_id = (SELECT auth.uid()) OR c.client_id = (SELECT auth.uid()))
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 4. The wall's "✓ Verified credit" reads the work record, not only
-- the commission stamp. Until now it read user_horses.
-- finishing_artist_verified, which only commission delivery sets — so
-- an owner confirming a logged work record turned the passport green
-- and left the wall blank. The view also carries disavowed_at and the
-- horse's deleted_at so the logged-in wall can filter like the anon
-- one already does (203).
-- ══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS v_artist_finished_horses;
CREATE VIEW v_artist_finished_horses
WITH (security_invoker = true) AS
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  uh.deleted_at                  AS horse_deleted_at,
  cl.id                          AS log_id,
  cl.artist_user_id,
  cl.commission_id,
  cl.work_type,
  cl.date_completed,
  cl.recorded_by,
  cl.owner_confirmed_at,
  cl.disavowed_at,
  -- One answer for "is this credit vouched for": a delivered
  -- commission, the counterparty's confirmation, the owner's own
  -- record, or the artist's own horse.
  (
    COALESCE(uh.finishing_artist_verified, false)
    OR cl.owner_confirmed_at IS NOT NULL
    OR cl.recorded_by IN ('owner', 'commission')
    OR cl.artist_user_id = uh.owner_id
  )                              AS credit_verified,
  -- Commission logs carry their own images; work records carry a reel.
  COALESCE(
    NULLIF(cl.image_urls, '{}'::TEXT[]),
    reel.urls,
    '{}'::TEXT[]
  )                              AS image_urls,
  COALESCE(sr.show_count, 0)     AS show_count,
  COALESCE(sr.nan_qualifying, 0) AS nan_qualifying_count,
  sr.best_placing,
  sr.latest_show_date,
  COALESCE(ht.titles, ARRAY[]::TEXT[]) AS titles
FROM customization_logs cl
JOIN user_horses uh ON uh.id = cl.horse_id
LEFT JOIN LATERAL (
  SELECT ARRAY[wm.image_urls[array_upper(wm.image_urls, 1)]] AS urls
  FROM work_moments wm
  WHERE wm.log_id = cl.id
    AND wm.is_public
    AND COALESCE(array_length(wm.image_urls, 1), 0) > 0
  ORDER BY wm.sort_order DESC, wm.created_at DESC
  LIMIT 1
) reel ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                   AS show_count,
    COUNT(*) FILTER (WHERE r.is_nan_qualifying)                AS nan_qualifying,
    MIN(NULLIF(regexp_replace(r."placing", '\D', '', 'g'), '')::INT) AS best_placing,
    MAX(r.show_date)                                           AS latest_show_date
  FROM show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE cl.artist_user_id IS NOT NULL;

COMMENT ON VIEW v_artist_finished_horses IS
  'An artist''s finished work with the competitive record each horse went on to earn. image_urls prefers the commission log''s own photos and falls back to the work record''s reel (208). credit_verified is the one answer for whether the credit is vouched for (212). security_invoker: the viewer''s own RLS on user_horses gates visibility.';

GRANT SELECT ON v_artist_finished_horses TO authenticated;

CREATE OR REPLACE FUNCTION get_studio_wall(p_user UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'horse_id', v.horse_id,
    'log_id', v.log_id,
    'horse_name', v.horse_name,
    'work_type', v.work_type,
    'date_completed', v.date_completed,
    'image_urls', COALESCE(v.image_urls, '{}'),
    'verified', COALESCE(v.credit_verified, false),
    'show_count', v.show_count,
    'nan_qualifying_count', v.nan_qualifying_count,
    'best_placing', v.best_placing,
    'titles', COALESCE(v.titles, ARRAY[]::TEXT[])
  ) ORDER BY v.date_completed DESC NULLS LAST), '[]'::jsonb)
  FROM public.v_artist_finished_horses v
  JOIN public.user_horses uh ON uh.id = v.horse_id
  WHERE v.artist_user_id = p_user
    AND uh.deleted_at IS NULL
    AND uh.visibility IN ('public', 'unlisted')
    AND v.disavowed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.user_id = p_user AND ap.portfolio_visible = true
    );
$$;

GRANT EXECUTE ON FUNCTION get_studio_wall(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 5. "Hide reel from passport" hides the reel, not the credit. The
-- 202 column comment promised "the record itself (credit, dates) is
-- provenance and stays", but the public read dropped the whole record
-- when reel_public was off, erasing the artist's credit line for
-- everyone else. Now the record stays and its moments come back empty.
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_public_making(p_horse UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cl.id,
    'work_type', cl.work_type,
    'artist_alias', cl.artist_alias,
    'artist_user_id', cl.artist_user_id,
    'summary', cl.summary,
    'claimed_start', cl.claimed_start,
    'date_completed', cl.date_completed,
    'recorded_by', cl.recorded_by,
    'verified', (cl.owner_confirmed_at IS NOT NULL),
    'reel_public', cl.reel_public,
    'moments', CASE WHEN cl.reel_public THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', wm.id,
        'stage', wm.stage,
        'caption', wm.caption,
        'image_urls', wm.image_urls,
        'claimed_date', wm.claimed_date,
        'created_at', wm.created_at
      ) ORDER BY wm.sort_order, wm.created_at)
      FROM public.work_moments wm
      WHERE wm.log_id = cl.id AND wm.is_public
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  ) ORDER BY COALESCE(cl.date_completed, cl.created_at::date) DESC), '[]'::jsonb)
  FROM public.customization_logs cl
  JOIN public.user_horses uh ON uh.id = cl.horse_id
  JOIN public.users u ON u.id = uh.owner_id
  WHERE cl.horse_id = p_horse
    AND uh.deleted_at IS NULL
    AND uh.visibility IN ('public', 'unlisted')
    AND COALESCE(u.is_suspended, false) = false
    AND cl.disavowed_at IS NULL
    AND (
      cl.owner_confirmed_at IS NOT NULL
      OR cl.artist_user_id = uh.owner_id
      OR cl.recorded_by = 'owner'
    );
$$;

GRANT EXECUTE ON FUNCTION get_public_making(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 6. Somewhere to put Instagram, Facebook and a website. An artist
-- arriving with a following had no way to connect the two audiences.
-- Keys: instagram, facebook, website, etsy — values are URLs or
-- handles; the app normalises on save and renders with icons.
-- ══════════════════════════════════════════════════════════════
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN artist_profiles.links IS
  'Outbound links the artist chose to show: {instagram, facebook, website, etsy} as full URLs (212).';

-- The anon owner card carries them so the storefront can render
-- them without a session.
CREATE OR REPLACE FUNCTION get_studio_owner_card(p_user UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'alias_name', u.alias_name,
    'avatar_url', u.avatar_url,
    'links', COALESCE(ap.links, '{}'::jsonb)
  )
  FROM public.users u
  JOIN public.artist_profiles ap ON ap.user_id = u.id
  WHERE u.id = p_user
    AND ap.portfolio_visible = true
    AND COALESCE(u.is_suspended, false) = false;
$$;

GRANT EXECUTE ON FUNCTION get_studio_owner_card(UUID) TO anon, authenticated;

-- ✅ Migration 212 Complete — the studio pass for artists
