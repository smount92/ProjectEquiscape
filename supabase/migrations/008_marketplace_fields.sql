-- ============================================================
-- Migration 008: Marketplace Listing Fields
-- ============================================================

-- listing_price: optional asking price for 'For Sale' / 'Open to Offers' horses
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS listing_price NUMERIC(10, 2) DEFAULT NULL;

-- marketplace_notes: optional seller notes (e.g. "Will ship anywhere", "Trades welcome")
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS marketplace_notes TEXT DEFAULT NULL;
