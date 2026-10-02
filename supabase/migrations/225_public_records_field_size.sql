-- 225: The size of the field on public show records (2026-10-02).
--
-- "3rd out of #" — a member asked for it, and the home page already
-- promises it ("the judge, the date, the size of the field").
-- show_records.total_entries has carried the class size since 030 (live
-- entries for a show run here; the "Class size" column of an import);
-- signed-in pages now print it. Logged-out visitors read records only
-- through get_public_horse_records (146), which did not return it.
--
-- The return type changes, so DROP then CREATE. Same guard as 146:
-- public, live horses only; unlisted and private return zero rows.

DROP FUNCTION IF EXISTS get_public_horse_records(UUID);

CREATE FUNCTION get_public_horse_records(p_horse_id UUID)
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
  is_nan BOOLEAN,
  total_entries INTEGER
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
    sr.is_nan,
    sr.total_entries
  FROM public.show_records sr
  JOIN public.user_horses uh ON uh.id = sr.horse_id
  WHERE sr.horse_id = p_horse_id
    AND uh.visibility = 'public'
    AND uh.deleted_at IS NULL
  ORDER BY sr.show_date DESC NULLS LAST, sr.created_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_public_horse_records(UUID) TO anon, authenticated;
