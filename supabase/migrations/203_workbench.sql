-- 203: The Workbench — the commission thread grows up (2026-09-01).
--
-- Owner's design (2026-08-31): a commission needs a verified,
-- horse-tied thread — "here's the locked terms, here's progress,
-- we've both checked off." The pipeline already had the checks;
-- this migration adds what was missing:
--
--   1. 'received' — the client's last checkbox. "Delivered" was the
--      artist's word alone; nothing ever confirmed arrival.
--   2. Typed thread entries — metadata for checkpoints (proposed by
--      the artist, acked by the client, both stamps kept).
--   3. Per-moment publication — is_public marks a WIP update for the
--      horse's public Making reel at delivery. Private by default:
--      the workbench is a workbench, publishing is deliberate.
--   4. A PRIVATE workbench bucket. WIP photos used to land in the
--      public horse-images bucket, uncompressed and unvalidated,
--      readable by anyone with the URL — the opposite of "not to be
--      seen public." New uploads are private; parties read through
--      server-minted signed URLs (the chat-attachments posture, 111).
--   5. confirm_work_records_on_claim — a park-claim confirms the
--      parker-artist's work records on that horse (202's stamps),
--      service-role only.

-- ── 1. 'received' ───────────────────────────────────────────────────
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN (
    -- current pipeline
    'requested', 'quoted', 'accepted', 'in_progress',
    'awaiting_approval', 'completed', 'delivered', 'received',
    'declined', 'cancelled',
    -- legacy, read-only
    'review', 'revision', 'shipping'
  ));

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
COMMENT ON COLUMN commissions.received_at IS
  'When the client confirmed the piece arrived — the last checkbox of the workbench thread.';

-- ── 2 + 3. Typed entries and per-moment publication ─────────────────
ALTER TABLE commission_updates
  ADD COLUMN IF NOT EXISTS metadata  JSONB   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN commission_updates.metadata IS
  'Typed-entry payload. Checkpoints: {"checkpoint": {"title": text, "acked_by": uuid, "acked_at": timestamptz}}. Written only through server actions.';
COMMENT ON COLUMN commission_updates.is_public IS
  'Artist''s mark: publish this WIP moment to the horse''s Making reel at delivery. Default false — the workbench is private, publishing is deliberate.';

-- ── 4. The private workbench bucket ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'workbench',
    'workbench',
    false,                -- PRIVATE — reads via server-minted signed URLs
    10485760,             -- 10MB per file (matches horse-images)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: only into your own folder. Path: {user_id}/commissions/{...}
DROP POLICY IF EXISTS "workbench_upload_own" ON storage.objects;
CREATE POLICY "workbench_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'workbench'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- Read/delete your own uploads directly; the OTHER party reads via
-- signed URLs the server mints after verifying commission membership
-- (service role bypasses RLS) — the 111 chat-attachments posture.
DROP POLICY IF EXISTS "workbench_read_own" ON storage.objects;
CREATE POLICY "workbench_read_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'workbench'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "workbench_delete_own" ON storage.objects;
CREATE POLICY "workbench_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'workbench'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- ── 4½. The studio's barn ───────────────────────────────────────────
-- A studio is a place, and places have rooms: the barn (an ordinary
-- group) is the studio's community room — followers, clients, WIP
-- chatter. One nullable pointer; the studio page renders the card
-- when it is set.
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS barn_group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- ── 5. Claim → confirm the parker's work records ────────────────────
-- Claiming a parked horse IS accepting it with its story (owner
-- decision 2026-09-01): the new owner's claim stamps the parking
-- artist's records owner-confirmed, so the credit reads ✓ from the
-- first minute in the new stable. Service-role only — called from the
-- claim action after claim_parked_horse_atomic succeeds.
CREATE OR REPLACE FUNCTION confirm_work_records_on_claim(p_horse UUID, p_parker UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  n INTEGER;
BEGIN
  PERFORM set_config('app.work_record_stamp', '1', true);
  UPDATE public.customization_logs
     SET owner_confirmed_at = now()
   WHERE horse_id = p_horse
     AND artist_user_id = p_parker
     AND owner_confirmed_at IS NULL
     AND disavowed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION confirm_work_records_on_claim(UUID, UUID) FROM anon, authenticated, public;

-- ── 6. The anon storefront ──────────────────────────────────────────
-- Opening /studio/[slug] to the logged-out world (the proxy change
-- riding with this migration) exposed two RLS gaps that were
-- invisible while the page was login-walled: the owner's alias reads
-- "@Unknown" (users is authenticated-only) and the works wall is
-- empty (v_artist_finished_horses is security_invoker). The wall IS
-- the pitch — "the one URL an artist pastes into a Facebook group"
-- has to show the work. Two narrow DEFINER reads, both gated to
-- portfolio-visible studios and public horses only.

CREATE OR REPLACE FUNCTION get_studio_owner_card(p_user UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object('alias_name', u.alias_name, 'avatar_url', u.avatar_url)
  FROM public.users u
  JOIN public.artist_profiles ap ON ap.user_id = u.id
  WHERE u.id = p_user
    AND ap.portfolio_visible = true
    AND COALESCE(u.is_suspended, false) = false;
$$;

CREATE OR REPLACE FUNCTION get_studio_wall(p_user UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'horse_id', v.horse_id,
    'horse_name', v.horse_name,
    'work_type', v.work_type,
    'date_completed', v.date_completed,
    'image_urls', COALESCE(v.image_urls, '{}'),
    'verified', COALESCE(v.finishing_artist_verified, false),
    'show_count', v.show_count,
    'nan_qualifying_count', v.nan_qualifying_count,
    'best_placing', v.best_placing,
    'titles', COALESCE(v.titles, ARRAY[]::TEXT[])
  ) ORDER BY v.date_completed DESC NULLS LAST), '[]'::jsonb)
  FROM public.v_artist_finished_horses v
  JOIN public.user_horses uh ON uh.id = v.horse_id
  JOIN public.customization_logs cl ON cl.id = v.log_id
  WHERE v.artist_user_id = p_user
    AND uh.deleted_at IS NULL
    AND uh.visibility IN ('public', 'unlisted')
    AND cl.disavowed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.artist_profiles ap
      WHERE ap.user_id = p_user AND ap.portfolio_visible = true
    );
$$;

GRANT EXECUTE ON FUNCTION get_studio_owner_card(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_studio_wall(UUID) TO anon, authenticated;

-- ✅ Migration 203 Complete — received, typed entries, workbench bucket, claim-confirm, anon storefront
