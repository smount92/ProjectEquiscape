-- 204: Stages belong to the artist, not the schema (2026-09-01).
--
-- 202 shipped stage as a fixed six-value CHECK — blank/prep/base/
-- detail/finished/progress — which is a PAINTER's ladder. A sculptor's
-- stages are armature/bulked/refined/molded/cast; a china painter's
-- are greenware/bisque/glaze firings; a tack maker's are cut/tooled/
-- hardware/assembled; and a finishwork artist may want "base coat 3 —
-- dappling" as its own named chapter. The breed-field lesson applies
-- word for word: there is no closed stage list good enough to lock
-- the whole ecosystem into.
--
-- So: stage becomes the artist's own label. The UI offers
-- per-discipline suggested ladders (src/lib/studio/making.ts) and the
-- reel groups by label in the order the artist used them. The old six
-- values remain valid labels, so nothing existing breaks.
ALTER TABLE work_moments DROP CONSTRAINT IF EXISTS work_moments_stage_check;
ALTER TABLE work_moments ADD CONSTRAINT work_moments_stage_length
  CHECK (char_length(stage) BETWEEN 1 AND 40);

COMMENT ON COLUMN work_moments.stage IS
  'The artist''s own label for this chapter of the work (suggested ladders per discipline live in the app). Groups the reel; ordered by first use, not by any fixed ladder.';

-- ── Owner credits round out the handshake ───────────────────────────
-- The hobby works in relays (sculpted, cast, prepped, painted,
-- restored — different hands), and the OWNER is usually the only one
-- who knows the whole chain; many links will never have an account.
-- Owner-recorded credits (recorded_by='owner') therefore display on
-- the owner's own passport WITHOUT the confirmation stamp — creating
-- the record IS the owner's consent; the stamp exists to protect
-- owners from artist-claimed content, not from their own entries.
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
    'moments', COALESCE((
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
    ), '[]'::jsonb)
  ) ORDER BY COALESCE(cl.date_completed, cl.created_at::date) DESC), '[]'::jsonb)
  FROM public.customization_logs cl
  JOIN public.user_horses uh ON uh.id = cl.horse_id
  JOIN public.users u ON u.id = uh.owner_id
  WHERE cl.horse_id = p_horse
    AND uh.deleted_at IS NULL
    AND uh.visibility IN ('public', 'unlisted')
    AND COALESCE(u.is_suspended, false) = false
    AND cl.disavowed_at IS NULL
    AND cl.reel_public
    AND (
      cl.owner_confirmed_at IS NOT NULL
      OR cl.artist_user_id = uh.owner_id
      OR cl.recorded_by = 'owner'
    );
$$;

-- And the confirmation stamp becomes the COUNTERPARTY's signature:
--   artist-recorded → the horse's OWNER confirms (as before);
--   owner-recorded  → the CREDITED ARTIST confirms (new) — so a
--   chain link like "painted by Black Fox Farm", typed in by the
--   owner, turns ✓ verified the moment Amanda taps confirm.
CREATE OR REPLACE FUNCTION confirm_work_record(p_log UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.work_record_stamp', '1', true);
  UPDATE public.customization_logs cl
     SET owner_confirmed_at = now()
    FROM public.user_horses uh
   WHERE cl.id = p_log
     AND uh.id = cl.horse_id
     AND cl.owner_confirmed_at IS NULL
     AND cl.disavowed_at IS NULL
     AND (
       (cl.recorded_by = 'artist' AND uh.owner_id = (SELECT auth.uid()))
       OR (cl.recorded_by = 'owner' AND cl.artist_user_id = (SELECT auth.uid())
           AND cl.artist_user_id IS DISTINCT FROM uh.owner_id)
     );
  RETURN FOUND;
END;
$$;

-- ✅ Migration 204 Complete — free stage labels, owner credits, two-way confirm
