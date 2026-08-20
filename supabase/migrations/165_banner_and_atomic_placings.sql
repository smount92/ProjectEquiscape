-- ============================================================
-- 165: Announcement banner (phase 1) + atomic placing writes.
--
-- 1. announcements — the site-wide rolling banner (owner-authored
--    in phase 1; a future paid "bulletin board" slot can reuse the
--    table with a new placement value). World-readable while live;
--    NO client write policies — the admin server action writes via
--    service role after an explicit ADMIN_EMAIL check.
--
-- 2. record_class_placings_atomic — the audit's M1 fix: the old
--    delete-then-insert placing writes could lose a judge's whole
--    slate if the insert half failed. One function, one
--    transaction: the slate replaces atomically or not at all.
--    SECURITY DEFINER, so it re-checks authorization itself
--    (staff role + not suspended) — same rules as the RLS it
--    bypasses.
-- ============================================================

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  link_url TEXT CHECK (link_url IS NULL OR char_length(link_url) <= 500),
  placement TEXT NOT NULL DEFAULT 'site' CHECK (placement IN ('site', 'stable', 'shows')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live announcements are public"
  ON announcements FOR SELECT
  TO authenticated, anon
  USING (starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
-- No INSERT/UPDATE/DELETE policies: service-role writes only.

-- ── 2. Atomic placing slate ──
-- p_placings: [{"entry_id": uuid, "place": 1..6|null, "note": text|null}]

CREATE OR REPLACE FUNCTION record_class_placings_atomic(
  p_class_id UUID,
  p_placings JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_show_id UUID;
  v_row JSONB;
BEGIN
  SELECT d.show_id INTO v_show_id
  FROM show_classes c
  JOIN show_sections s ON s.id = c.section_id
  JOIN show_divisions d ON d.id = s.division_id
  WHERE c.id = p_class_id;
  IF v_show_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  -- Same authorization the RLS policy enforced (DEFINER bypasses it,
  -- so it must be re-checked here): recorder role + not suspended.
  IF NOT show_role_check(v_show_id, ARRAY['host', 'co_host', 'steward', 'judge']) THEN
    RAISE EXCEPTION 'Only show staff may record placings';
  END IF;
  IF is_caller_suspended() THEN
    RAISE EXCEPTION 'Suspended accounts may not record placings';
  END IF;

  -- The atomic swap. The 117 trigger (entry belongs to class) and
  -- unique constraints still fire per inserted row; ANY failure
  -- rolls the whole function back — the old slate survives.
  DELETE FROM show_placings WHERE class_id = p_class_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_placings, '[]'::jsonb))
  LOOP
    INSERT INTO show_placings (class_id, entry_id, place, note, judge_id)
    VALUES (
      p_class_id,
      (v_row->>'entry_id')::uuid,
      NULLIF(v_row->>'place', '')::int,
      NULLIF(v_row->>'note', ''),
      (SELECT auth.uid())
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_class_placings_atomic(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_class_placings_atomic(UUID, JSONB) TO authenticated;
