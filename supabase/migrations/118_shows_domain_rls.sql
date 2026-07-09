-- ============================================================
-- Migration 118: Shows Domain — RLS + helper functions
-- (companion to 117_shows_domain.sql)
-- ============================================================
-- Access model:
--   * Hosts/co-hosts manage their show's rows.
--   * Stewards can RECORD (class status, placings, callbacks,
--     entry day-of updates) but not edit show structure.
--   * Judges can record placings/callbacks.
--   * Public (anon included) reads any non-draft show tree —
--     EXCEPT show_staff, whose COI columns stay private; the
--     public roster goes through get_show_staff_public().
--   * Entrants write their own entries while entries are open.
--   * Cards: readable by their people; publicly verifiable via
--     the verify_qualification_card() RPC.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- Helper: does the current user hold one of these roles on the
-- show? SECURITY DEFINER so policies on show_staff can call it
-- without recursing into their own table's RLS.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION show_role_check(p_show_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shows s
    WHERE s.id = p_show_id
      AND s.host_id = (SELECT auth.uid())
      AND 'host' = ANY (p_roles)
  ) OR EXISTS (
    SELECT 1 FROM show_staff st
    WHERE st.show_id = p_show_id
      AND st.user_id = (SELECT auth.uid())
      AND st.role = ANY (p_roles)
  );
$$;

-- Public visibility: every status except draft is world-readable.
CREATE OR REPLACE FUNCTION show_is_public(p_show_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM shows s
    WHERE s.id = p_show_id AND s.status <> 'draft'
  );
$$;

-- ══════════════════════════════════════════════════════════════
-- shows
-- ══════════════════════════════════════════════════════════════

ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads non-draft shows"
  ON shows FOR SELECT
  TO authenticated, anon
  USING (
    status <> 'draft'
    OR host_id = (SELECT auth.uid())
    OR show_role_check(id, ARRAY['co_host', 'steward', 'judge'])
  );

CREATE POLICY "Host creates shows"
  ON shows FOR INSERT
  TO authenticated
  WITH CHECK (host_id = (SELECT auth.uid()));

CREATE POLICY "Host and co-host update show"
  ON shows FOR UPDATE
  TO authenticated
  USING (
    host_id = (SELECT auth.uid())
    OR show_role_check(id, ARRAY['co_host'])
  )
  WITH CHECK (
    host_id = (SELECT auth.uid())
    OR show_role_check(id, ARRAY['co_host'])
  );

-- Deletion is only for shows that never took entries: once a show
-- is past 'published' it holds competition history (entries,
-- placings, cards) and must be archived, not deleted. Cards also
-- carry ON DELETE RESTRICT FKs as a second lock (117).
CREATE POLICY "Host deletes own unstarted show"
  ON shows FOR DELETE
  TO authenticated
  USING (
    host_id = (SELECT auth.uid())
    AND status IN ('draft', 'published')
  );

-- ══════════════════════════════════════════════════════════════
-- show_staff — host manages; staff see their shows' rosters
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_staff ENABLE ROW LEVEL SECURITY;

-- Direct table reads are for the show's own people only: the row
-- carries coi_flag/coi_note, which must never be world-readable.
-- The public roster goes through get_show_staff_public() below,
-- which returns only (show_id, user_id, role) for non-draft shows.
CREATE POLICY "Staff and self read the roster"
  ON show_staff FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

-- Public roster of a non-draft show — the safe subset of columns
-- (no COI data). SECURITY DEFINER so anon/entrants can list who is
-- hosting/judging without table access.
CREATE OR REPLACE FUNCTION get_show_staff_public(p_show_id UUID)
RETURNS TABLE (show_id UUID, user_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT st.show_id, st.user_id, st.role
  FROM show_staff st
  WHERE st.show_id = p_show_id
    AND show_is_public(p_show_id);
$$;

CREATE POLICY "Host manages staff"
  ON show_staff FOR INSERT
  TO authenticated
  WITH CHECK (show_role_check(show_id, ARRAY['host']));

CREATE POLICY "Host updates staff"
  ON show_staff FOR UPDATE
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host']))
  WITH CHECK (show_role_check(show_id, ARRAY['host']));

CREATE POLICY "Host removes staff"
  ON show_staff FOR DELETE
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host']));

-- ══════════════════════════════════════════════════════════════
-- show_divisions / show_sections / show_classes
-- Structure is host/co-host territory; stewards may update CLASS
-- STATUS day-of (called/judging/placed) but not create/delete.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads divisions of visible shows"
  ON show_divisions FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id)
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

CREATE POLICY "Managers write divisions"
  ON show_divisions FOR ALL
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host']))
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host']));

ALTER TABLE show_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads sections of visible shows"
  ON show_sections FOR SELECT
  TO authenticated, anon
  USING (EXISTS (
    SELECT 1 FROM show_divisions d
    WHERE d.id = show_sections.division_id
      AND (show_is_public(d.show_id)
           OR show_role_check(d.show_id, ARRAY['host', 'co_host', 'steward', 'judge']))
  ));

CREATE POLICY "Managers write sections"
  ON show_sections FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_divisions d
    WHERE d.id = show_sections.division_id
      AND show_role_check(d.show_id, ARRAY['host', 'co_host'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM show_divisions d
    WHERE d.id = show_sections.division_id
      AND show_role_check(d.show_id, ARRAY['host', 'co_host'])
  ));

ALTER TABLE show_classes ENABLE ROW LEVEL SECURITY;

-- Section → show lookup used by class + entry policies.
CREATE OR REPLACE FUNCTION show_id_of_section(p_section_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT d.show_id
  FROM show_sections s
  JOIN show_divisions d ON d.id = s.division_id
  WHERE s.id = p_section_id;
$$;

CREATE POLICY "Public reads classes of visible shows"
  ON show_classes FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id_of_section(section_id))
    OR show_role_check(show_id_of_section(section_id),
                       ARRAY['host', 'co_host', 'steward', 'judge'])
  );

CREATE POLICY "Managers insert classes"
  ON show_classes FOR INSERT
  TO authenticated
  WITH CHECK (show_role_check(show_id_of_section(section_id), ARRAY['host', 'co_host']));

-- Stewards need UPDATE for day-of status flips (called → judging
-- → placed); structural edits are gated in the actions layer.
CREATE POLICY "Managers and stewards update classes"
  ON show_classes FOR UPDATE
  TO authenticated
  USING (show_role_check(show_id_of_section(section_id), ARRAY['host', 'co_host', 'steward']))
  WITH CHECK (show_role_check(show_id_of_section(section_id), ARRAY['host', 'co_host', 'steward']));

CREATE POLICY "Managers delete classes"
  ON show_classes FOR DELETE
  TO authenticated
  USING (show_role_check(show_id_of_section(section_id), ARRAY['host', 'co_host']));

-- ══════════════════════════════════════════════════════════════
-- show_class_entries — entrants own their entries while entries
-- are open; staff manage day-of (scratch, entry numbers, status).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_class_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads entries of visible shows"
  ON show_class_entries FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id)
    OR owner_id = (SELECT auth.uid())
    OR handler_id = (SELECT auth.uid())
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

-- Entering requires: you are the entry's owner, the show is taking
-- entries, AND the horse is actually yours — without the horse
-- check anyone could enter someone else's horse and burn its one
-- breed-halter slot. Cross-show class injection (show_id pointing
-- at one show, class_id at another) is blocked by the
-- trg_show_class_entries_show_guard trigger in 117.
CREATE POLICY "Owner enters own horse while entries open"
  ON show_class_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
    )
    AND EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = show_class_entries.horse_id
        AND h.owner_id = (SELECT auth.uid())
    )
  );

-- Owner updates reuse the full INSERT conditions in WITH CHECK so
-- an owner can't relocate an entry onto a horse they don't own or
-- into a show that isn't open; the 117 show-guard trigger keeps
-- show_id/class_id consistent on every update as well.
CREATE POLICY "Owner updates own entry while open, staff anytime"
  ON show_class_entries FOR UPDATE
  TO authenticated
  USING (
    (owner_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
    ))
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward'])
  )
  WITH CHECK (
    (
      owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM shows s
        WHERE s.id = show_class_entries.show_id
          AND s.status = 'entries_open'
      )
      AND EXISTS (
        SELECT 1 FROM user_horses h
        WHERE h.id = show_class_entries.horse_id
          AND h.owner_id = (SELECT auth.uid())
      )
    )
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward'])
  );

CREATE POLICY "Owner withdraws while open, managers anytime"
  ON show_class_entries FOR DELETE
  TO authenticated
  USING (
    (owner_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
    ))
    OR show_role_check(show_id, ARRAY['host', 'co_host'])
  );

-- ══════════════════════════════════════════════════════════════
-- show_placings — recorded by staff (host/co-host/steward/judge)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_placings ENABLE ROW LEVEL SECURITY;

-- Class → show lookup (SECURITY DEFINER: avoids re-evaluating
-- show_classes RLS inside every placings policy check).
CREATE OR REPLACE FUNCTION show_id_of_class(p_class_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT d.show_id
  FROM show_classes c
  JOIN show_sections s ON s.id = c.section_id
  JOIN show_divisions d ON d.id = s.division_id
  WHERE c.id = p_class_id;
$$;

CREATE POLICY "Public reads placings of visible shows"
  ON show_placings FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id_of_class(class_id))
    OR show_role_check(show_id_of_class(class_id),
                       ARRAY['host', 'co_host', 'steward', 'judge'])
  );

CREATE POLICY "Show staff record placings"
  ON show_placings FOR ALL
  TO authenticated
  USING (show_role_check(show_id_of_class(class_id),
                         ARRAY['host', 'co_host', 'steward', 'judge']))
  WITH CHECK (show_role_check(show_id_of_class(class_id),
                              ARRAY['host', 'co_host', 'steward', 'judge']));

-- ══════════════════════════════════════════════════════════════
-- show_callbacks
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads callbacks of visible shows"
  ON show_callbacks FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id)
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

CREATE POLICY "Show staff record callbacks"
  ON show_callbacks FOR ALL
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge']))
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge']));

-- ══════════════════════════════════════════════════════════════
-- qualification_cards
-- Readable by earner, current owner, and show managers. Public
-- verification goes through verify_qualification_card(code) so
-- the table itself can't be crawled.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE qualification_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Card people read their cards"
  ON qualification_cards FOR SELECT
  TO authenticated
  USING (
    current_owner_id = (SELECT auth.uid())
    OR earned_by_owner_id = (SELECT auth.uid())
    OR show_role_check(show_id, ARRAY['host', 'co_host'])
  );

-- Issuance/void by show managers. Transfer + redemption flip
-- through the Safe-Trade hook / championship registrar (Phase F,
-- service role — no user-facing UPDATE beyond managers for now).
-- A card is only mintable when (a) the class really belongs to the
-- card's show and (b) that horse holds a REAL 1st/2nd placing in
-- that class — managers cannot fabricate qualifications.
CREATE POLICY "Managers issue cards"
  ON qualification_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    show_role_check(show_id, ARRAY['host', 'co_host'])
    AND show_id_of_class(class_id) = show_id
    AND EXISTS (
      SELECT 1
      FROM show_placings p
      JOIN show_class_entries e ON e.id = p.entry_id
      WHERE p.class_id = qualification_cards.class_id
        AND e.horse_id = qualification_cards.horse_id
        AND p.place IN (1, 2)
    )
  );

CREATE POLICY "Managers update cards"
  ON qualification_cards FOR UPDATE
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host']))
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host']));

-- Public card verification by short code (anon-safe: returns the
-- card's public face only, never bulk-listable).
CREATE OR REPLACE FUNCTION verify_qualification_card(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  status TEXT,
  earned_place INTEGER,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qc.id, qc.status, qc.earned_place, qc.show_year,
         s.title, c.name, qc.issued_at
  FROM qualification_cards qc
  JOIN shows s ON s.id = qc.show_id
  JOIN show_classes c ON c.id = qc.class_id
  WHERE qc.id = p_code;
$$;

-- ══════════════════════════════════════════════════════════════
-- show_results_docs
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_results_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads results docs of visible shows"
  ON show_results_docs FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id)
    OR show_role_check(show_id, ARRAY['host', 'co_host'])
  );

CREATE POLICY "Managers write results docs"
  ON show_results_docs FOR ALL
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host']))
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host']));

-- ══════════════════════════════════════════════════════════════
-- Batch reorder RPC — one statement instead of N per-row updates
-- from the classlist builder. SECURITY INVOKER: the caller's RLS
-- UPDATE policies still gate every touched row.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reorder_show_nodes(
  p_kind TEXT,          -- 'division' | 'section' | 'class'
  p_ids UUID[],
  p_sort_orders INTEGER[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  IF array_length(p_ids, 1) IS DISTINCT FROM array_length(p_sort_orders, 1) THEN
    RAISE EXCEPTION 'ids and sort_orders must be the same length';
  END IF;

  IF p_kind = 'division' THEN
    UPDATE show_divisions d SET sort_order = x.sort_order
    FROM unnest(p_ids, p_sort_orders) AS x(id, sort_order)
    WHERE d.id = x.id;
  ELSIF p_kind = 'section' THEN
    UPDATE show_sections s SET sort_order = x.sort_order
    FROM unnest(p_ids, p_sort_orders) AS x(id, sort_order)
    WHERE s.id = x.id;
  ELSIF p_kind = 'class' THEN
    UPDATE show_classes c SET sort_order = x.sort_order
    FROM unnest(p_ids, p_sort_orders) AS x(id, sort_order)
    WHERE c.id = x.id;
  ELSE
    RAISE EXCEPTION 'unknown kind: %', p_kind;
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- Split / combine RPCs — each is one transaction so a failure
-- midway can never leave a half-split or half-combined classlist.
-- SECURITY INVOKER: the caller's RLS policies still gate every
-- row touched (class inserts/updates need host/co-host; entry
-- moves ride the staff branch of the entries UPDATE policy).
-- ══════════════════════════════════════════════════════════════

-- Scratched-entry contract for BOTH RPCs: scratched entries are
-- history and always STAY in their source class; only live entries
-- move. split refuses a selection containing scratched entries
-- rather than silently dropping them.
CREATE OR REPLACE FUNCTION split_show_class(
  p_class_id UUID,
  p_new_name TEXT,
  p_new_class_number TEXT,
  p_entry_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  src show_classes%ROWTYPE;
  new_class_id UUID;
  moved_count INTEGER;
BEGIN
  SELECT * INTO src FROM show_classes WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found.';
  END IF;
  IF src.status NOT IN ('scheduled', 'called') THEN
    RAISE EXCEPTION 'Only scheduled or called classes can be split.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_entry_ids) AS x(id)
    LEFT JOIN show_class_entries e ON e.id = x.id AND e.class_id = p_class_id
    WHERE e.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Some selected entries do not belong to this class.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM show_class_entries e
    WHERE e.id = ANY (p_entry_ids) AND e.status = 'scratched'
  ) THEN
    RAISE EXCEPTION 'Scratched entries stay with the original class and cannot be moved.';
  END IF;

  -- New class inherits the original's eligibility rules; lineage
  -- via split_from_class_id.
  INSERT INTO show_classes (
    section_id, name, class_number, status, split_from_class_id,
    max_per_entrant, allowed_scales, allowed_finishes,
    is_qualifying, sort_order
  )
  VALUES (
    src.section_id, p_new_name, p_new_class_number, 'scheduled', p_class_id,
    src.max_per_entrant, src.allowed_scales, src.allowed_finishes,
    src.is_qualifying, src.sort_order + 1
  )
  RETURNING id INTO new_class_id;

  UPDATE show_class_entries
  SET class_id = new_class_id
  WHERE id = ANY (p_entry_ids);
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  IF moved_count <> COALESCE(array_length(p_entry_ids, 1), 0) THEN
    -- RLS filtered some rows out from under us — abort the whole split.
    RAISE EXCEPTION 'Not all selected entries could be moved.';
  END IF;

  RETURN new_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION combine_show_classes(
  p_class_ids UUID[],
  p_new_name TEXT,
  p_new_class_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_class_id UUID;
  first_class show_classes%ROWTYPE;
  found_count INTEGER;
  show_count INTEGER;
  all_qualifying BOOLEAN;
  uniform_max BOOLEAN;
  uniform_scales BOOLEAN;
  uniform_finishes BOOLEAN;
  moved_count INTEGER;
  live_count INTEGER;
BEGIN
  IF COALESCE(array_length(p_class_ids, 1), 0) < 2 THEN
    RAISE EXCEPTION 'Combining requires at least two classes.';
  END IF;

  SELECT COUNT(*) INTO found_count
  FROM show_classes WHERE id = ANY (p_class_ids);
  IF found_count <> array_length(p_class_ids, 1) THEN
    RAISE EXCEPTION 'One or more classes were not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM show_classes
    WHERE id = ANY (p_class_ids) AND status NOT IN ('scheduled', 'called')
  ) THEN
    RAISE EXCEPTION 'Only scheduled or called classes can be combined.';
  END IF;

  -- Every source class must live in ONE show.
  SELECT COUNT(DISTINCT d.show_id) INTO show_count
  FROM show_classes c
  JOIN show_sections s ON s.id = c.section_id
  JOIN show_divisions d ON d.id = s.division_id
  WHERE c.id = ANY (p_class_ids);
  IF show_count <> 1 THEN
    RAISE EXCEPTION 'Classes from different shows cannot be combined.';
  END IF;

  SELECT * INTO first_class FROM show_classes WHERE id = p_class_ids[1];

  -- Eligibility inheritance: keep a rule only when it is uniform
  -- across every source; otherwise NULL (unrestricted) — the
  -- combined class is a day-of merge and hosts can re-tighten it.
  SELECT
    bool_and(is_qualifying),
    COUNT(DISTINCT COALESCE(max_per_entrant, -1)) = 1,
    COUNT(DISTINCT COALESCE(allowed_scales, '{}'::text[])) = 1,
    COUNT(DISTINCT COALESCE(allowed_finishes, '{}'::text[])) = 1
  INTO all_qualifying, uniform_max, uniform_scales, uniform_finishes
  FROM show_classes WHERE id = ANY (p_class_ids);

  -- The combined class qualifies only if every source did.
  INSERT INTO show_classes (
    section_id, name, class_number, status,
    max_per_entrant, allowed_scales, allowed_finishes, is_qualifying
  )
  VALUES (
    first_class.section_id, p_new_name, p_new_class_number, 'scheduled',
    CASE WHEN uniform_max THEN first_class.max_per_entrant END,
    CASE WHEN uniform_scales THEN first_class.allowed_scales END,
    CASE WHEN uniform_finishes THEN first_class.allowed_finishes END,
    all_qualifying
  )
  RETURNING id INTO new_class_id;

  -- A horse entered in several source classes may only arrive in
  -- the combined class ONCE (partial unique index, 117). Keep the
  -- earliest entry; scratch later duplicates IN PLACE with a note —
  -- they stay in their source class as history.
  UPDATE show_class_entries e
  SET status = 'scratched',
      note = COALESCE(e.note || ' ', '')
             || 'Auto-scratched: duplicate entry of the same horse when classes were combined.'
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY horse_id ORDER BY created_at, id) AS rn
    FROM show_class_entries
    WHERE class_id = ANY (p_class_ids) AND status <> 'scratched'
  ) ranked
  WHERE e.id = ranked.id AND ranked.rn > 1;

  -- Move all remaining live entries; scratched stay behind.
  SELECT COUNT(*) INTO live_count
  FROM show_class_entries
  WHERE class_id = ANY (p_class_ids) AND status <> 'scratched';

  UPDATE show_class_entries
  SET class_id = new_class_id
  WHERE class_id = ANY (p_class_ids) AND status <> 'scratched';
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  IF moved_count <> live_count THEN
    RAISE EXCEPTION 'Not all live entries could be moved.';
  END IF;

  -- Close out the source classes with lineage.
  UPDATE show_classes
  SET status = 'combined', combined_into_class_id = new_class_id
  WHERE id = ANY (p_class_ids);

  RETURN new_class_id;
END;
$$;

-- ============================================================
-- ✅ Migration 118 Complete
-- RLS enabled on all 10 shows-domain tables; helper functions
-- show_role_check / show_is_public / show_id_of_section /
-- show_id_of_class / get_show_staff_public;
-- verify_qualification_card RPC; reorder_show_nodes RPC;
-- split_show_class / combine_show_classes transactional RPCs.
-- ============================================================
