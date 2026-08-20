-- ============================================================
-- 164: Anon-safe card reads for the season-felt wave.
--
-- qualification_cards is deliberately card-people-only at the
-- table level (118). Two narrow DEFINER windows:
--
--   get_class_cards(class_id)  — the class room's ribbon rail
--     marks which placings minted a card ("Card AbCd1234 · STAKES")
--     but ONLY once that class's results are announced (same
--     predicate as the placings policy, 160).
--   get_exhibitor_card_count(user_id) — the profile strap's
--     "MHH Cards" stat (count only, no codes — profiles must not
--     become a card-enumeration surface).
-- ============================================================

CREATE OR REPLACE FUNCTION get_class_cards(p_class_id UUID)
RETURNS TABLE (horse_id UUID, code TEXT, is_stakes BOOLEAN, earned_place INTEGER)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qc.horse_id, qc.id, qc.is_stakes, qc.earned_place
  FROM qualification_cards qc
  WHERE qc.class_id = p_class_id
    AND qc.status <> 'void'
    AND placings_announced(p_class_id);
$$;

CREATE OR REPLACE FUNCTION get_exhibitor_card_count(p_user_id UUID)
RETURNS TABLE (live_cards INTEGER, stakes_cards INTEGER)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE is_stakes)::int
  FROM qualification_cards
  WHERE current_owner_id = p_user_id
    AND status IN ('issued', 'transferred');
$$;
