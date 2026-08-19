-- ============================================================
-- 153: Card gates + STAKES (Championship program §2)
--
-- A qualification card now records the competition it was won
-- against: the class's live entry count and distinct-exhibitor
-- count at issuance, plus a STAKES flag for the big fields
-- (≥15 entries from ≥6 exhibitors — the "major" analog).
--
-- The gate itself (Season 1: ≥3 entries/≥2 exhibitors for show
-- year 2026; permanent 5-and-3 from 2027) is enforced in the
-- issuance planner (src/lib/shows/cardIssuance.ts) at publish
-- time — cards that don't clear it are simply never minted.
--
-- Existing Season 1 cards predate the stamp: their counts stay
-- NULL and the UI degrades gracefully (no field line shown).
-- ============================================================

ALTER TABLE qualification_cards
  ADD COLUMN IF NOT EXISTS class_entry_count INTEGER,
  ADD COLUMN IF NOT EXISTS class_exhibitor_count INTEGER,
  ADD COLUMN IF NOT EXISTS is_stakes BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN qualification_cards.class_entry_count IS
  'Live (non-scratched) entries in the class at issuance.';
COMMENT ON COLUMN qualification_cards.class_exhibitor_count IS
  'Distinct exhibitors in the class at issuance.';
COMMENT ON COLUMN qualification_cards.is_stakes IS
  'Won in a STAKES-sized field (>=15 entries from >=6 exhibitors).';

-- ── verify_qualification_card: surface the field on /cards/[code] ──
-- Return type changes, so DROP + CREATE (OR REPLACE can't alter
-- OUT parameters).

DROP FUNCTION IF EXISTS verify_qualification_card(TEXT);

CREATE FUNCTION verify_qualification_card(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  status TEXT,
  earned_place INTEGER,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  issued_at TIMESTAMPTZ,
  class_entry_count INTEGER,
  class_exhibitor_count INTEGER,
  is_stakes BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qc.id, qc.status, qc.earned_place, qc.show_year,
         s.title, c.name, qc.issued_at,
         qc.class_entry_count, qc.class_exhibitor_count, qc.is_stakes
  FROM qualification_cards qc
  JOIN shows s ON s.id = qc.show_id
  JOIN show_classes c ON c.id = qc.class_id
  WHERE qc.id = p_code;
$$;

-- ── get_public_horse_cards: passports show the field too ──

DROP FUNCTION IF EXISTS get_public_horse_cards(UUID);

CREATE FUNCTION get_public_horse_cards(p_horse_id UUID)
RETURNS TABLE (
  code TEXT,
  earned_place INTEGER,
  status TEXT,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  issued_at TIMESTAMPTZ,
  class_entry_count INTEGER,
  class_exhibitor_count INTEGER,
  is_stakes BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    qc.id,
    qc.earned_place,
    qc.status,
    qc.show_year,
    s.title,
    c.name,
    qc.issued_at,
    qc.class_entry_count,
    qc.class_exhibitor_count,
    qc.is_stakes
  FROM public.qualification_cards qc
  JOIN public.user_horses uh ON uh.id = qc.horse_id
  JOIN public.shows s ON s.id = qc.show_id
  JOIN public.show_classes c ON c.id = qc.class_id
  WHERE qc.horse_id = p_horse_id
    AND qc.status IN ('issued', 'transferred')
    AND uh.visibility = 'public'
    AND uh.deleted_at IS NULL
  ORDER BY qc.issued_at DESC;
$$;
