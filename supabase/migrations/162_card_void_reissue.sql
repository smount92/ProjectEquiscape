-- ============================================================
-- 162: Voided cards no longer block a replacement (owner
-- decision 2026-08-19, audit SEV-4).
--
-- The absolute UNIQUE (class_id, horse_id) counted voided cards,
-- so a card voided over a clerical error permanently closed that
-- class+horse slot — the horse lost a CH leg for a host's typo.
-- New rule: ONE LIVE CARD per class+horse. Voided cards stay on
-- record (status 'void', reason, audit columns) but a corrected
-- result can mint a fresh card with a fresh code.
--
-- The issuance planner already excludes voided cards from its
-- skip-list in the same deploy (cardIssuance.ts), so a republish
-- after a void + correction mints the replacement automatically.
-- ============================================================

ALTER TABLE qualification_cards
  DROP CONSTRAINT IF EXISTS qualification_cards_class_id_horse_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qualification_cards_live
  ON qualification_cards (class_id, horse_id)
  WHERE status <> 'void';
