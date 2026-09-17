-- 210: Qualification cards beyond NAN — OMEQ (2026-09-17).
--
-- A member asked (2026-06-25) for "OMEQ qualified" next to NAN. OMEQ
-- (Online Model Equine Qualifiers, run by USOMHS) is the photo-show
-- counterpart to NAN: 1st/2nd in open classes at a sanctioned online
-- show earns a colour-coded card (blue = breed/halter, orange =
-- collectibility/workmanship, purple = performance) that stays with
-- the horse. We TRACK what a shower earned; the cards are theirs.
--
-- The NAN columns from 030 (is_nan_qualifying / nan_card_type /
-- nan_year) are NAN-shaped by name. Rather than bend them, records
-- get a program-agnostic set; the app mirrors NAN into the 030
-- columns so the legacy readers (NAN export, studio counts) keep
-- working, and the backfill below brings existing NAN rows across.
--
-- Paste as one run; each ALTER is its own statement (205 lesson).
SET lock_timeout = '4s';

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS qualifier_program TEXT
  CHECK (qualifier_program IN ('nan', 'omeq'));

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS qualifier_card TEXT
  CHECK (qualifier_card IN ('green', 'yellow', 'pink', 'blue', 'orange', 'purple'));

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS qualifier_year INTEGER
  CHECK (qualifier_year IS NULL OR qualifier_year BETWEEN 1990 AND 2100);

ALTER TABLE show_records ADD COLUMN IF NOT EXISTS qualifier_card_id TEXT
  CHECK (qualifier_card_id IS NULL OR char_length(qualifier_card_id) <= 40);

COMMENT ON COLUMN show_records.qualifier_program IS
  'Which qualifier program the card belongs to: nan (NAMHSA) or omeq (USOMHS). NULL = no card on this record.';
COMMENT ON COLUMN show_records.qualifier_card IS
  'Card colour as the program prints it. NAN: green/yellow/pink. OMEQ: blue/orange/purple.';
COMMENT ON COLUMN show_records.qualifier_card_id IS
  'The ID printed on the card when the program prints one (OMEQ does). Free text, owner-entered.';

-- Existing NAN cards (competition engine + manual) come across.
UPDATE show_records
SET qualifier_program = 'nan',
    qualifier_card    = nan_card_type,
    qualifier_year    = nan_year
WHERE is_nan_qualifying = true
  AND qualifier_program IS NULL
  AND nan_card_type IN ('green', 'yellow', 'pink');

CREATE INDEX IF NOT EXISTS idx_show_records_qualifier
  ON show_records (horse_id, qualifier_program, qualifier_year)
  WHERE qualifier_program IS NOT NULL;

-- ✅ Migration 210 Complete — qualifier cards (NAN + OMEQ) on show records
