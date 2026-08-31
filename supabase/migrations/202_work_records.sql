-- 202: Work records — the studio's atom (2026-09-01).
--
-- WHY. A stable is what you OWN; a studio is what you've MADE. The
-- connecting entity — this horse + this studio + what was done + the
-- making-of reel — already half-exists as customization_logs (horse,
-- artist account, alias, work type, images, commission link), so this
-- migration EXTENDS it rather than growing a parallel table, and adds
-- work_moments: the chronological, staged, captioned photo reel that
-- renders as "The Making" on the passport and on the studio wall.
--
-- Verification follows the manual-vs-verified show-record pattern:
--   recorded_by 'commission' → born verified (client approved delivery)
--   recorded_by 'artist'     → "recorded by artist" until the horse's
--                              owner confirms (a park-claim confirms it)
--   recorded_by 'owner'      → owner credits an artist; the named
--                              studio may confirm or disavow.
-- The passport shows the reel only with the owner's consent
-- (owner_confirmed_at, or the artist owns the horse); the studio wall
-- shows the artist's own records always, honestly labeled. Disavowed
-- records leave every credit surface.

-- ── A. customization_logs → the work record ─────────────────────────
ALTER TABLE customization_logs
  ADD COLUMN IF NOT EXISTS summary            TEXT,
  ADD COLUMN IF NOT EXISTS claimed_start      DATE,
  ADD COLUMN IF NOT EXISTS recorded_by        TEXT NOT NULL DEFAULT 'commission',
  ADD COLUMN IF NOT EXISTS owner_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disavowed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reel_public        BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE customization_logs DROP CONSTRAINT IF EXISTS customization_logs_recorded_by_check;
ALTER TABLE customization_logs ADD CONSTRAINT customization_logs_recorded_by_check
  CHECK (recorded_by IN ('commission', 'artist', 'owner'));

COMMENT ON COLUMN customization_logs.claimed_start IS
  'Artist-claimed start of the work. date_completed is the claimed end. Both are claims about the past — created_at stays the honest record of when this was logged.';
COMMENT ON COLUMN customization_logs.reel_public IS
  'Owner''s switch: show The Making reel on the horse''s passport. The record itself (credit, dates) is provenance and stays.';

-- Existing rows: the delivery hook wrote the commission-born ones (the
-- client approved before delivery — that IS the owner's confirmation);
-- anything else predating this migration could only have entered
-- through the owner's own INSERT policy.
UPDATE customization_logs
   SET recorded_by = CASE WHEN commission_id IS NOT NULL THEN 'commission' ELSE 'owner' END;
UPDATE customization_logs
   SET owner_confirmed_at = COALESCE(owner_confirmed_at, created_at, now())
 WHERE commission_id IS NOT NULL AND owner_confirmed_at IS NULL;

-- ── B. Edit boundaries by role ──────────────────────────────────────
-- The 022 policies let the horse's OWNER update/delete ANY record on
-- their horse. Once credit is worth something that is a vandalism
-- surface: an owner could rewrite an artist's credit line. New rule:
-- you edit what you recorded. Owners control passport VISIBILITY via
-- the stamp functions below, never the record's content.
DROP POLICY IF EXISTS "customization_logs_update_own" ON customization_logs;
CREATE POLICY "customization_logs_update_own"
  ON customization_logs FOR UPDATE TO authenticated
  USING (
    recorded_by = 'owner'
    AND EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    recorded_by = 'owner'
    AND EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "customization_logs_delete_own" ON customization_logs;
CREATE POLICY "customization_logs_delete_own"
  ON customization_logs FOR DELETE TO authenticated
  USING (
    recorded_by = 'owner'
    AND EXISTS (
      SELECT 1 FROM user_horses
      WHERE user_horses.id = customization_logs.horse_id
        AND user_horses.owner_id = (SELECT auth.uid())
    )
  );

-- The artist logs, edits, and may withdraw their own past work. The
-- target horse must be visible to them (user_horses RLS inside the
-- EXISTS — a stranger's private horse can't be targeted). Passport
-- display still needs the owner's confirmation, so this can only put
-- content on the artist's own wall.
DROP POLICY IF EXISTS "artist_records_own_work" ON customization_logs;
CREATE POLICY "artist_records_own_work" ON customization_logs FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = 'artist'
    AND artist_user_id = (SELECT auth.uid())
    AND commission_id IS NULL
    AND EXISTS (SELECT 1 FROM user_horses uh WHERE uh.id = horse_id)
  );

DROP POLICY IF EXISTS "artist_updates_own_record" ON customization_logs;
CREATE POLICY "artist_updates_own_record" ON customization_logs FOR UPDATE TO authenticated
  USING (recorded_by = 'artist' AND artist_user_id = (SELECT auth.uid()))
  WITH CHECK (recorded_by = 'artist' AND artist_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "artist_deletes_own_record" ON customization_logs;
CREATE POLICY "artist_deletes_own_record" ON customization_logs FOR DELETE TO authenticated
  USING (recorded_by = 'artist' AND artist_user_id = (SELECT auth.uid()) AND commission_id IS NULL);

-- Guard: verification/visibility stamps move only through the stamp
-- functions (which set the flag below). Without this, the update
-- policies would let an artist stamp their own owner_confirmed_at.
CREATE OR REPLACE FUNCTION guard_work_record_stamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.work_record_stamp', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_confirmed_at IS DISTINCT FROM OLD.owner_confirmed_at
     OR NEW.disavowed_at IS DISTINCT FROM OLD.disavowed_at
     OR NEW.reel_public IS DISTINCT FROM OLD.reel_public THEN
    RAISE EXCEPTION 'Verification and visibility stamps change only through their functions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_work_record_stamps ON customization_logs;
CREATE TRIGGER trg_guard_work_record_stamps
  BEFORE UPDATE ON customization_logs
  FOR EACH ROW
  EXECUTE FUNCTION guard_work_record_stamps();

-- ── C. The stamps: confirm / reel switch (owner), disavow (artist) ──
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
     AND uh.owner_id = (SELECT auth.uid())
     AND cl.owner_confirmed_at IS NULL
     AND cl.disavowed_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION set_work_record_reel_public(p_log UUID, p_public BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.work_record_stamp', '1', true);
  UPDATE public.customization_logs cl
     SET reel_public = p_public
    FROM public.user_horses uh
   WHERE cl.id = p_log
     AND uh.id = cl.horse_id
     AND uh.owner_id = (SELECT auth.uid());
  RETURN FOUND;
END;
$$;

-- "Not my work." Only the CREDITED PLATFORM ACCOUNT can disavow — the
-- false-credit defense: once credit is worth something, someone will
-- claim it falsely. (An artist withdraws their OWN record by deleting
-- it; disavowal is for records someone else wrote naming them.)
CREATE OR REPLACE FUNCTION disavow_work_record(p_log UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.work_record_stamp', '1', true);
  UPDATE public.customization_logs cl
     SET disavowed_at = now()
   WHERE cl.id = p_log
     AND cl.artist_user_id = (SELECT auth.uid())
     AND cl.recorded_by <> 'artist'
     AND cl.disavowed_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION confirm_work_record(UUID) FROM anon, public;
REVOKE ALL ON FUNCTION set_work_record_reel_public(UUID, BOOLEAN) FROM anon, public;
REVOKE ALL ON FUNCTION disavow_work_record(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION confirm_work_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_work_record_reel_public(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION disavow_work_record(UUID) TO authenticated;

-- ── D. work_moments — the reel ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_moments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id       UUID NOT NULL REFERENCES customization_logs(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  stage        TEXT NOT NULL DEFAULT 'progress'
               CHECK (stage IN ('blank', 'prep', 'base', 'detail', 'finished', 'progress')),
  caption      TEXT,
  image_urls   TEXT[] NOT NULL DEFAULT '{}',
  claimed_date DATE,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_moments_log
  ON work_moments (log_id, sort_order, created_at);

COMMENT ON TABLE work_moments IS
  'One moment of a work record''s making-of reel: staged, captioned photos. claimed_date is the artist''s date for past work; created_at is when it was posted.';

ALTER TABLE work_moments ENABLE ROW LEVEL SECURITY;

-- Read: a public moment is visible to whoever can see its work record
-- (customization_logs RLS already inherits horse visibility, and runs
-- inside this EXISTS under the caller's own policies). A private
-- moment belongs to its author and the credited artist — studio notes.
DROP POLICY IF EXISTS "work_moments_read" ON work_moments;
CREATE POLICY "work_moments_read" ON work_moments FOR SELECT TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM customization_logs cl
        WHERE cl.id = work_moments.log_id
          AND (work_moments.is_public OR cl.artist_user_id = (SELECT auth.uid()))
    )
  );

-- Write: only a party to the record — the credited artist account or
-- the horse's current owner — and only as themselves.
DROP POLICY IF EXISTS "work_moments_insert" ON work_moments;
CREATE POLICY "work_moments_insert" ON work_moments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM customization_logs cl
      LEFT JOIN user_horses uh ON uh.id = cl.horse_id
      WHERE cl.id = work_moments.log_id
        AND (cl.artist_user_id = (SELECT auth.uid()) OR uh.owner_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "work_moments_update_own" ON work_moments;
CREATE POLICY "work_moments_update_own" ON work_moments FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "work_moments_delete_own" ON work_moments;
CREATE POLICY "work_moments_delete_own" ON work_moments FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()));

-- ── E. The public reel: one RPC for anon passports ──────────────────
-- Mirrors get_public_passport's posture (135): public/unlisted horses,
-- suspended owners excluded (199), and only what the passport itself
-- would show — owner-consented, non-disavowed records with their
-- public moments.
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
    AND (cl.owner_confirmed_at IS NOT NULL OR cl.artist_user_id = uh.owner_id);
$$;

GRANT EXECUTE ON FUNCTION get_public_making(UUID) TO anon, authenticated;

-- ✅ Migration 202 Complete — work records + reels + stamps + public RPC
