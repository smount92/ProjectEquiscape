-- ══════════════════════════════════════════════════════════════
-- Migration 167: Barns (Groups re-launch)
--
-- ADDITIVE ONLY. `groups` and `group_memberships` keep their names
-- and every existing row — "Barn" is the user-facing name for the
-- same thing. Nothing is dropped or renamed.
--
-- What this adds:
--   1. groups.is_private — THE canonical privacy flag.
--   2. A visibility ⇄ is_private sync trigger so the legacy
--      three-state `visibility` column stays truthful for any code
--      (or human) still reading it.
--   3. barn_join_requests — request/approve joining a private barn.
--   4. RLS: private barns are LISTED (name + "Private" badge) but
--      their member roster and board are members-only.
--
-- ── is_public vs visibility reconciliation ──
-- `groups` never had an `is_public` column; the split was between
-- the DB's three-state `visibility` ('public' | 'restricted' |
-- 'private') and the product's actual two states. The feed
-- workstream needs a plain boolean, so:
--
--   * `groups.is_private` (BOOLEAN, default false) is CANONICAL.
--     All new code reads and writes it.
--   * `groups.visibility` is DERIVED and kept for compatibility:
--     the trigger below forces it to 'private' when is_private and
--     to 'public' when not, and mirrors a manual visibility write
--     back into is_private. 'restricted' collapses to public+listed
--     (it was never implemented in the app).
-- ══════════════════════════════════════════════════════════════

-- ── 1. The canonical privacy flag ──
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the legacy column so existing private groups stay private.
UPDATE groups SET is_private = true
WHERE visibility = 'private' AND is_private = false;

CREATE INDEX IF NOT EXISTS idx_groups_is_private ON groups (is_private);

-- ── 2. Keep the legacy `visibility` column honest ──
-- Bi-directional: whichever of the two an INSERT/UPDATE touches,
-- the other follows. is_private wins when both change at once.
CREATE OR REPLACE FUNCTION public.sync_barn_privacy()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_private THEN
      NEW.visibility := 'private';
    ELSIF NEW.visibility = 'private' THEN
      NEW.is_private := true;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: is_private is canonical when it moved.
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    NEW.visibility := CASE WHEN NEW.is_private THEN 'private' ELSE 'public' END;
  ELSIF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    NEW.is_private := (NEW.visibility = 'private');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barn_privacy ON groups;
CREATE TRIGGER trg_sync_barn_privacy
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION public.sync_barn_privacy();

-- ── 3. Membership helpers (SECURITY DEFINER) ──
-- group_memberships policies below need to ask "is the viewer a
-- member of this barn?" — a self-reference that would recurse under
-- RLS. SECURITY DEFINER short-circuits that. Both are read-only.
CREATE OR REPLACE FUNCTION public.barn_member_role(p_group_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT gm.role
  FROM public.group_memberships gm
  WHERE gm.group_id = p_group_id AND gm.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.barn_is_private(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT COALESCE(g.is_private, false) FROM public.groups g WHERE g.id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.barn_created_by(p_group_id UUID)
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT g.created_by FROM public.groups g WHERE g.id = p_group_id;
$$;

REVOKE ALL ON FUNCTION public.barn_member_role(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barn_is_private(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barn_created_by(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.barn_member_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barn_is_private(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barn_created_by(UUID) TO authenticated;

-- ── 4. Barns are LISTED even when private ──
-- Migration 031 hid `visibility = 'private'` rows entirely, which
-- means a private barn could not appear in the directory at all.
-- The Barns model instead lists every barn (name, description,
-- member count) and gates the CONTENTS. Board posts are already
-- members-only via the posts_select policy in migration 042; the
-- roster is gated in step 5 below.
DROP POLICY IF EXISTS "groups_select" ON groups;
CREATE POLICY "groups_select"
  ON groups FOR SELECT TO authenticated
  USING (true);

-- ── 5. Private barn rosters are members-only ──
-- 031 had `USING (true)` — every membership row readable by anyone.
-- Now: your own rows always; public barns' rosters always; a private
-- barn's roster only if you are in it.
DROP POLICY IF EXISTS "membership_select" ON group_memberships;
CREATE POLICY "membership_select"
  ON group_memberships FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR NOT public.barn_is_private(group_id)
    OR public.barn_member_role(group_id, (SELECT auth.uid())) IS NOT NULL
  );

-- ── 6. Joining a private barn requires approval ──
-- Self-join stays open for public barns (and for the founder's own
-- owner row at creation time). Staff may insert anyone — that is how
-- an approved join request becomes a membership.
DROP POLICY IF EXISTS "membership_insert" ON group_memberships;
CREATE POLICY "membership_insert"
  ON group_memberships FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT auth.uid()) = user_id
      AND (
        NOT public.barn_is_private(group_id)
        OR public.barn_created_by(group_id) = (SELECT auth.uid())
      )
    )
    OR public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin', 'moderator')
  );

-- Staff may also remove members (031 only allowed self-delete, so
-- removeMember() silently no-opped for admins).
DROP POLICY IF EXISTS "membership_delete_staff" ON group_memberships;
CREATE POLICY "membership_delete_staff"
  ON group_memberships FOR DELETE TO authenticated
  USING (public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin'));

-- Role changes (promote/demote) — 031 had no UPDATE policy at all.
DROP POLICY IF EXISTS "membership_update_owner" ON group_memberships;
CREATE POLICY "membership_update_owner"
  ON group_memberships FOR UPDATE TO authenticated
  USING (public.barn_member_role(group_id, (SELECT auth.uid())) = 'owner')
  WITH CHECK (public.barn_member_role(group_id, (SELECT auth.uid())) = 'owner');

-- ── 7. Join requests ──
CREATE TABLE IF NOT EXISTS barn_join_requests (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_barn_join_requests_pending
  ON barn_join_requests (group_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE barn_join_requests ENABLE ROW LEVEL SECURITY;

-- Requester sees their own; barn staff see all of their barn's.
DROP POLICY IF EXISTS "barn_join_requests_select" ON barn_join_requests;
CREATE POLICY "barn_join_requests_select"
  ON barn_join_requests FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin', 'moderator')
  );

-- Anyone may ask to join a barn they are not already in.
DROP POLICY IF EXISTS "barn_join_requests_insert" ON barn_join_requests;
CREATE POLICY "barn_join_requests_insert"
  ON barn_join_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND public.barn_member_role(group_id, (SELECT auth.uid())) IS NULL
  );

-- Only staff decide.
DROP POLICY IF EXISTS "barn_join_requests_update" ON barn_join_requests;
CREATE POLICY "barn_join_requests_update"
  ON barn_join_requests FOR UPDATE TO authenticated
  USING (public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin', 'moderator'))
  WITH CHECK (public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin', 'moderator'));

-- Requester may withdraw; staff may clear.
DROP POLICY IF EXISTS "barn_join_requests_delete" ON barn_join_requests;
CREATE POLICY "barn_join_requests_delete"
  ON barn_join_requests FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.barn_member_role(group_id, (SELECT auth.uid())) IN ('owner', 'admin', 'moderator')
  );
