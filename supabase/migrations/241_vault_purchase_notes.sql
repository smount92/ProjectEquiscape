-- ============================================================
-- 241: Purchase notes in the Financial Vault
--
-- Release 3 (2026-10). A member asked (2026-10-16) for a place in the
-- vault to write down where a horse was bought, from whom, and the
-- receipt or listing link. Until now the vault had one free-text field,
-- insurance_notes, and people were squeezing provenance into it.
--
-- 1. financial_vault.purchase_notes: free text, up to 2,000 characters.
-- 2. When a horse changes owner, the seller's purchase notes are wiped,
--    so the buyer never inherits "bought from X for $Y" written by the
--    person who sold it to them. The vault row is the current owner's
--    (its row policies follow user_horses.owner_id), so a note left
--    behind would become readable by the buyer.
--
-- Privacy: the four row policies on financial_vault (022:
-- financial_vault_select_own / insert_own / update_own / delete_own)
-- allow a row only to the owner of its horse. Row policies cover every
-- column, and this table has no column grants, so the new column is
-- owner-only with no policy change. No policies are re-created here.
--
-- Additive and safe to paste twice. The app works before the paste: it
-- saves the other vault fields and tells the member purchase notes are
-- coming. After the paste: npm run gen-types.
-- ============================================================

ALTER TABLE public.financial_vault
  ADD COLUMN IF NOT EXISTS purchase_notes TEXT;

ALTER TABLE public.financial_vault
  DROP CONSTRAINT IF EXISTS financial_vault_purchase_notes_length;
ALTER TABLE public.financial_vault
  ADD CONSTRAINT financial_vault_purchase_notes_length
  CHECK (purchase_notes IS NULL OR char_length(purchase_notes) <= 2000);

COMMENT ON COLUMN public.financial_vault.purchase_notes IS
  'Owner-only notes about the purchase: where and from whom, receipt or listing links. Up to 2,000 characters. Cleared when the horse changes owner.';

-- ── The seller's notes never pass to the buyer ──────────────────
-- AFTER UPDATE OF owner_id, like 120's cards trigger: every way a horse
-- changes hands (PIN claim, transfer code, any later path) goes through
-- that column, so one trigger covers them all. SECURITY DEFINER so the
-- clear never depends on who is running the transfer; it touches one
-- column on one row and nothing else. It never raises, so neither the
-- SQL editor nor a transfer can be stopped by it. (A trigger function
-- can't be called directly, so there is nothing to revoke.)
CREATE OR REPLACE FUNCTION public.trg_financial_vault_clear_purchase_notes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.financial_vault
     SET purchase_notes = NULL
   WHERE horse_id = NEW.id
     AND purchase_notes IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_horses_clear_purchase_notes ON public.user_horses;
CREATE TRIGGER trg_user_horses_clear_purchase_notes
  AFTER UPDATE OF owner_id ON public.user_horses
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION public.trg_financial_vault_clear_purchase_notes();
