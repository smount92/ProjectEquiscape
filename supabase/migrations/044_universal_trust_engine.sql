-- ============================================================
-- Migration 044: Universal Trust & Commerce Engine (Phase 2)
-- Grand Unification Plan — reviews decoupled from DM conversations
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Universal Transactions ──
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN (
    'transfer',          -- Hoofprint transfer code claim
    'parked_sale',       -- Parked Horse PIN claim (off-platform)
    'commission',        -- Art Studio commission delivery
    'marketplace_sale'   -- DM-based marketplace sale
  )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'cancelled'
  )),
  party_a_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_b_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  horse_id        UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  commission_id   UUID REFERENCES commissions(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- ── Universal Reviews ──
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars           SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  content         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT reviews_unique UNIQUE (transaction_id, reviewer_id),
  CONSTRAINT reviews_no_self CHECK (reviewer_id != target_id)
);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_transactions_party_a      ON transactions (party_a_id, created_at DESC);
CREATE INDEX idx_transactions_party_b      ON transactions (party_b_id, created_at DESC);
CREATE INDEX idx_transactions_horse        ON transactions (horse_id) WHERE horse_id IS NOT NULL;
CREATE INDEX idx_transactions_status       ON transactions (status) WHERE status = 'completed';
CREATE INDEX idx_transactions_commission   ON transactions (commission_id) WHERE commission_id IS NOT NULL;
CREATE INDEX idx_transactions_conversation ON transactions (conversation_id) WHERE conversation_id IS NOT NULL;

CREATE INDEX idx_reviews_target     ON reviews (target_id, created_at DESC);
CREATE INDEX idx_reviews_reviewer   ON reviews (reviewer_id);
CREATE INDEX idx_reviews_txn        ON reviews (transaction_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "txn_select" ON transactions FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = party_a_id
  OR (SELECT auth.uid()) = party_b_id
);

CREATE POLICY "txn_update" ON transactions FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = party_a_id
  OR (SELECT auth.uid()) = party_b_id
);

-- Reviews: public trust signals
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = reviewer_id
  AND reviewer_id != target_id
  AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND t.status = 'completed'
    AND ((SELECT auth.uid()) = t.party_a_id OR (SELECT auth.uid()) = t.party_b_id)
  )
);

CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = reviewer_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: DATA MIGRATION (Zero Data Loss)
-- ══════════════════════════════════════════════════════════════

-- 4a: Create one transaction per unique conversation that has ratings
-- conversations table has buyer_id and seller_id
INSERT INTO transactions (type, status, party_a_id, party_b_id, conversation_id, horse_id, completed_at, created_at)
SELECT
  'marketplace_sale',
  'completed',
  c.seller_id,
  c.buyer_id,
  c.id,
  c.horse_id,
  MIN(ur.created_at),
  MIN(ur.created_at)
FROM user_ratings ur
JOIN conversations c ON c.id = ur.conversation_id
GROUP BY c.id, c.seller_id, c.buyer_id, c.horse_id;

-- 4b: Migrate existing ratings → reviews
INSERT INTO reviews (reviewer_id, target_id, stars, content, created_at, transaction_id)
SELECT
  ur.reviewer_id,
  ur.reviewed_id,
  ur.stars,
  ur.review_text,
  ur.created_at,
  t.id
FROM user_ratings ur
JOIN transactions t ON t.conversation_id = ur.conversation_id AND t.type = 'marketplace_sale';

-- ══════════════════════════════════════════════════════════════
-- STEP 5: RETROACTIVE TRANSACTIONS
-- For completed transfers and parked sales that happened before this migration
-- ══════════════════════════════════════════════════════════════

-- 5a: Hoofprint transfers (completed, no PIN = not parked)
INSERT INTO transactions (type, status, party_a_id, party_b_id, horse_id, completed_at, created_at, metadata)
SELECT
  'transfer',
  'completed',
  ht.sender_id,
  ht.claimed_by,
  ht.horse_id,
  ht.claimed_at,
  ht.created_at,
  jsonb_build_object('transfer_code', ht.transfer_code)
FROM horse_transfers ht
WHERE ht.status = 'claimed'
  AND ht.claimed_by IS NOT NULL
  AND ht.claim_pin IS NULL;

-- 5b: Parked horse claims (completed, has PIN)
INSERT INTO transactions (type, status, party_a_id, party_b_id, horse_id, completed_at, created_at, metadata)
SELECT
  'parked_sale',
  'completed',
  ht.sender_id,
  ht.claimed_by,
  ht.horse_id,
  ht.claimed_at,
  ht.created_at,
  jsonb_build_object('pin', ht.claim_pin)
FROM horse_transfers ht
WHERE ht.status = 'claimed'
  AND ht.claim_pin IS NOT NULL
  AND ht.claimed_by IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: UPDATE VIEW — discover_users_view reads from reviews now
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW discover_users_view AS
SELECT  
    u.id, 
    u.alias_name, 
    u.created_at, 
    u.avatar_url,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count
FROM users u
WHERE u.account_status = 'active';

-- ══════════════════════════════════════════════════════════════
-- STEP 7: VERIFICATION (run manually after migration)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'user_ratings' AS source, count(*) FROM user_ratings
-- UNION ALL SELECT 'reviews', count(*) FROM reviews
-- UNION ALL SELECT 'conversations with ratings', count(DISTINCT conversation_id) FROM user_ratings
-- UNION ALL SELECT 'transactions (marketplace_sale)', count(*) FROM transactions WHERE type = 'marketplace_sale'
-- UNION ALL SELECT 'transactions (transfer)', count(*) FROM transactions WHERE type = 'transfer'
-- UNION ALL SELECT 'transactions (parked_sale)', count(*) FROM transactions WHERE type = 'parked_sale';

-- ══════════════════════════════════════════════════════════════
-- STEP 8: DROP LEGACY — separate migration 045 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS user_ratings CASCADE;
