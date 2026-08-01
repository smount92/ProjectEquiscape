-- ══════════════════════════════════════════════════════════════
-- Migration 141: anon-safe public horse cards (Wave 2 — public record)
-- ══════════════════════════════════════════════════════════════
-- MHH qualification cards render only on the PRIVATE passport today
-- (qualification_cards is SELECT-scoped to the card's people, 118) —
-- the public passport /community/[id], the page a BUYER actually
-- sees, shows none. This DEFINER RPC returns the public face of a
-- horse's live cards (issued/transferred; never redeemed/void noise)
-- so the public passport can render the trust section for anyone.
--
-- Guard style copied from get_public_passport (135): join the
-- horse's own row and gate on visibility. STRICTER here — cards are
-- returned for visibility = 'public' ONLY; private AND unlisted
-- horses return zero rows (unlisted is link-only by design, and a
-- card list is an enumeration surface we keep off it).
--
-- Explicit field list (never SELECT *): code, place, class name,
-- show title, show_year, status, issued_at. No owner ids, no horse
-- fields — the passport around it already has the public horse.
-- Table stays uncrawlable: one horse id in, that horse's cards out.
-- Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_public_horse_cards(p_horse_id UUID)
RETURNS TABLE (
  code TEXT,
  earned_place INTEGER,
  status TEXT,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    qc.id,
    qc.earned_place,
    qc.status,
    qc.show_year,
    s.title,
    c.name,
    qc.issued_at
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

GRANT EXECUTE ON FUNCTION get_public_horse_cards(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 141 Complete — get_public_horse_cards().
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
