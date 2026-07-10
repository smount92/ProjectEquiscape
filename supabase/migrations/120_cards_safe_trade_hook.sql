-- ============================================================
-- Migration 120: Shows Domain — Safe-Trade card transfer hook
-- (Phase F; companion to 117/118/119)
-- ============================================================
-- Three additions:
--   1. Cards follow the horse. When a horse's ownership legally
--      changes hands, its issued/transferred qualification cards
--      move to the new owner automatically — the thing physical
--      NAN cards do with cardstock and anxiety.
--   2. verify_qualification_card gains the horse's name so the
--      public /cards/[code] page can show WHICH horse earned it.
--   3. show_string_entries.v2_class_id — the packer's FK into the
--      v2 classlist (closes the open packer-linking decision at
--      the schema level; no packer UI changes yet).
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. The Safe-Trade hook — trigger on user_horses.owner_id
-- ══════════════════════════════════════════════════════════════
-- WHY THIS ATTACHMENT POINT: ownership legally changes in exactly
-- one place — `UPDATE user_horses SET owner_id = …`. Every transfer
-- path funnels through it: claim_parked_horse_atomic (036 and its
-- later revisions 038/050/056/064/092), the marketplace Safe-Trade
-- flow (verifyFundsAndRelease parks the horse; the buyer's PIN
-- claim runs the same claim RPC), and any future/admin correction.
-- Hooking the COLUMN rather than any one RPC means no path can
-- move a horse and leave its cards behind.
--
-- SECURITY DEFINER: the claimant executing the claim RPC has no
-- UPDATE rights on qualification_cards rows they don't yet own —
-- the trigger must act with definer rights. search_path pinned per
-- the 117/118 convention.

CREATE OR REPLACE FUNCTION trg_qualification_cards_follow_horse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bearer semantics (src/lib/shows/cards.ts state machine):
  --   issued | transferred → transferred (repeatable — every sale
  --   re-points current_owner_id);
  --   redeemed / void are terminal and never touched.
  UPDATE qualification_cards
  SET current_owner_id = NEW.owner_id,
      status = 'transferred'
  WHERE horse_id = NEW.id
    AND status IN ('issued', 'transferred');
  RETURN NEW;
END;
$$;

-- AFTER (not BEFORE): the cards update is a side effect of a
-- committed ownership change, and must see the row's final state.
-- The WHEN guard keeps unrelated user_horses updates free.
DROP TRIGGER IF EXISTS trg_user_horses_cards_follow ON user_horses;
CREATE TRIGGER trg_user_horses_cards_follow
  AFTER UPDATE OF owner_id ON user_horses
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION trg_qualification_cards_follow_horse();

-- ══════════════════════════════════════════════════════════════
-- 2. verify_qualification_card — add the horse's name
-- ══════════════════════════════════════════════════════════════
-- The public verify page should say which horse earned the card —
-- that is the whole point of checking a card before a purchase.
-- The horse's custom_name is already semi-public (it appears in
-- published show results); no other user_horses columns leak.
-- DROP first: CREATE OR REPLACE cannot change a function's
-- RETURNS TABLE shape.

DROP FUNCTION IF EXISTS verify_qualification_card(TEXT);

CREATE FUNCTION verify_qualification_card(p_code TEXT)
RETURNS TABLE (
  code TEXT,
  status TEXT,
  earned_place INTEGER,
  show_year INTEGER,
  show_title TEXT,
  class_name TEXT,
  horse_name TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qc.id, qc.status, qc.earned_place, qc.show_year,
         s.title, c.name, h.custom_name, qc.issued_at
  FROM qualification_cards qc
  JOIN shows s ON s.id = qc.show_id
  JOIN show_classes c ON c.id = qc.class_id
  JOIN user_horses h ON h.id = qc.horse_id
  WHERE qc.id = p_code;
$$;

-- ══════════════════════════════════════════════════════════════
-- 3. Packer → v2 classlist link (schema only)
-- ══════════════════════════════════════════════════════════════
-- The show-string packer (entrant-side planning tool) keeps its
-- legacy shape but gains a proper FK into the v2 classlist, per
-- design doc §7 ("show_strings / packer: kept … gains a proper FK
-- to show_classes"). SET NULL on delete: a split/combined/deleted
-- class un-links the packing row rather than destroying the
-- entrant's plan. No packer UI writes this yet — Phase F records
-- the decision at the schema level so later UI work is additive.

ALTER TABLE show_string_entries
  ADD COLUMN IF NOT EXISTS v2_class_id UUID REFERENCES show_classes(id) ON DELETE SET NULL;

COMMENT ON COLUMN show_string_entries.v2_class_id IS
  'Optional link from a packing-list row to the v2 show_classes row it targets. Nullable: legacy strings and free-form plans carry no link.';

CREATE INDEX IF NOT EXISTS idx_show_string_entries_v2_class
  ON show_string_entries (v2_class_id) WHERE v2_class_id IS NOT NULL;

-- ============================================================
-- ✅ Migration 120 Complete
-- Safe-Trade hook: trg_user_horses_cards_follow on
--   user_horses.owner_id → issued/transferred cards re-point to
--   the new owner (redeemed/void untouched).
-- verify_qualification_card now returns horse_name.
-- show_string_entries.v2_class_id FK added (packer link, schema
--   only).
-- ============================================================
