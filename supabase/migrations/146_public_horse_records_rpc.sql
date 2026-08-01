-- ══════════════════════════════════════════════════════════════
-- Migration 146: anon-safe public horse show records (Wave 5a — commerce)
-- ══════════════════════════════════════════════════════════════
-- The show record renders only for AUTHENTICATED viewers today:
-- show_records_select (022/027) is FOR SELECT TO authenticated, so the
-- logged-out public passport (AnonPassport) — the page a prospective
-- BUYER lands on from a share link — shows a horse with no record at
-- all. "The horse's record is the product": this DEFINER RPC returns
-- the public face of a public horse's show records so AnonPassport can
-- render the trust section for anyone.
--
-- Guard style copied from get_public_horse_cards (141): join the
-- horse's own row and gate on visibility = 'public' ONLY — private AND
-- unlisted horses return zero rows (unlisted is link-only by design,
-- and a record list is an enumeration surface we keep off it).
--
-- Explicit field list (never SELECT *): the placing line a buyer sees
-- on the market quick-look. NO user_id, NO judge_name, NO notes, NO
-- show_location — those stay members-only. show_id is included so rows
-- can link to the public /shows/[id] page for independent verification.
-- Bounded (LIMIT 200, matching MAX_DETAIL_RECORDS in actions/market.ts)
-- and uncrawlable: one horse id in, that horse's records out.
-- Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_public_horse_records(p_horse_id UUID)
RETURNS TABLE (
  id UUID,
  show_name TEXT,
  show_id UUID,
  show_date DATE,
  show_date_text TEXT,
  division TEXT,
  class_name TEXT,
  "placing" TEXT,
  ribbon_color TEXT,
  verification_tier TEXT,
  is_nan BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    sr.id,
    sr.show_name,
    sr.show_id,
    sr.show_date,
    sr.show_date_text,
    sr.division,
    sr.class_name,
    sr."placing",
    sr.ribbon_color,
    sr.verification_tier,
    sr.is_nan
  FROM public.show_records sr
  JOIN public.user_horses uh ON uh.id = sr.horse_id
  WHERE sr.horse_id = p_horse_id
    AND uh.visibility = 'public'
    AND uh.deleted_at IS NULL
  ORDER BY sr.show_date DESC NULLS LAST, sr.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_public_horse_records(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 146 Complete — get_public_horse_records().
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
