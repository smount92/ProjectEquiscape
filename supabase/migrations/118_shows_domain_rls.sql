-- ============================================================
-- Migration 118: Shows Domain — RLS + helper functions
-- (companion to 117_shows_domain.sql)
-- ============================================================
-- Access model:
--   * Hosts/co-hosts manage their show's rows.
--   * Stewards can RECORD (class status, placings, callbacks,
--     entry day-of updates) but not edit show structure.
--   * Judges can record placings/callbacks.
--   * Public (anon included) reads any non-draft show tree.
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

CREATE POLICY "Host deletes own show"
  ON shows FOR DELETE
  TO authenticated
  USING (host_id = (SELECT auth.uid()));

-- ══════════════════════════════════════════════════════════════
-- show_staff — host manages; staff see their shows' rosters
-- ══════════════════════════════════════════════════════════════

ALTER TABLE show_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff roster visible for public shows and to staff"
  ON show_staff FOR SELECT
  TO authenticated, anon
  USING (
    show_is_public(show_id)
    OR user_id = (SELECT auth.uid())
    OR show_role_check(show_id, ARRAY['host', 'co_host', 'steward', 'judge'])
  );

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

CREATE POLICY "Owner enters while entries open"
  ON show_class_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
    )
  );

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
    (owner_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM shows s
      WHERE s.id = show_class_entries.show_id
        AND s.status = 'entries_open'
    ))
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
CREATE POLICY "Managers issue cards"
  ON qualification_cards FOR INSERT
  TO authenticated
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host']));

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

-- ============================================================
-- ✅ Migration 118 Complete
-- RLS enabled on all 10 shows-domain tables; helper functions
-- show_role_check / show_is_public / show_id_of_section;
-- verify_qualification_card RPC; reorder_show_nodes RPC.
-- ============================================================
