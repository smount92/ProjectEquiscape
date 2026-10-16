-- Un-qualify the three archived test shows (MHH-046, owner request 2026-10-15).
--
-- "Test Show", "Test Show #2" and "Test 5" (all archived, July 2026) still
-- carry is_mhh_qualifying = true, so they sit in the standings footer.
-- This turns the flag off and voids any qualification card they issued (a
-- card from a test show is not a real qualification; voided, never deleted).
--
-- Run it once in the Supabase SQL editor. Expect-guarded: each show changes
-- only if it still has this id, this title and status 'archived'. Safe to
-- run twice. The first SELECT shows what will change; the last one, after.

-- Before
SELECT s.title, s.status, s.is_mhh_qualifying,
       (SELECT count(*) FROM public.qualification_cards c WHERE c.show_id = s.id AND c.status <> 'void') AS live_cards
FROM public.shows s
WHERE s.id IN ('1f34b64c-c19e-4884-a0ef-be61df5852d5', 'f0f55886-1031-4ae1-ad82-6c88b9c4df05', 'a82c8fcb-725d-417c-af42-08a7bf66dfab');

BEGIN;

CREATE TEMP TABLE _test_shows ON COMMIT DROP AS
SELECT s.id
FROM public.shows s
JOIN (VALUES
  ('1f34b64c-c19e-4884-a0ef-be61df5852d5'::uuid, 'Test Show'),
  ('f0f55886-1031-4ae1-ad82-6c88b9c4df05'::uuid, 'Test Show #2'),
  ('a82c8fcb-725d-417c-af42-08a7bf66dfab'::uuid, 'Test 5')
) AS t(id, title) ON t.id = s.id AND t.title = s.title
WHERE s.status = 'archived';

UPDATE public.qualification_cards c
SET status = 'void',
    voided_at = now(),
    void_reason = 'Issued by an archived test show, not a real qualification (2026-10-15).'
WHERE c.show_id IN (SELECT id FROM _test_shows)
  AND c.status <> 'void';

UPDATE public.shows s
SET is_mhh_qualifying = false
WHERE s.id IN (SELECT id FROM _test_shows)
  AND s.is_mhh_qualifying = true;

COMMIT;

-- After: all three should read false, with 0 live cards.
SELECT s.title, s.status, s.is_mhh_qualifying,
       (SELECT count(*) FROM public.qualification_cards c WHERE c.show_id = s.id AND c.status <> 'void') AS live_cards
FROM public.shows s
WHERE s.id IN ('1f34b64c-c19e-4884-a0ef-be61df5852d5', 'f0f55886-1031-4ae1-ad82-6c88b9c4df05', 'a82c8fcb-725d-417c-af42-08a7bf66dfab');
