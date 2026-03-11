-- ============================================================
-- Migration 050: Universal Ledger — Event Sourcing (Phase 5)
-- Grand Unification Plan — FINAL PHASE
-- Replace horse_timeline with v_horse_hoofprint view
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: MIGRATE MANUAL NOTES TO POSTS
-- ══════════════════════════════════════════════════════════════

-- Manual 'note' and 'photo_update' entries that don't have a
-- source-of-truth table get migrated to posts.
-- This makes them editable, commentable, and visible in the UniversalFeed.

INSERT INTO posts (
  author_id, horse_id, content, created_at, updated_at
)
SELECT
  ht.user_id,
  ht.horse_id,
  CASE
    WHEN ht.description IS NOT NULL AND ht.description != ''
      THEN ht.title || E'\n\n' || ht.description
    ELSE ht.title
  END,
  COALESCE(ht.event_date::timestamptz, ht.created_at),
  COALESCE(ht.event_date::timestamptz, ht.created_at)
FROM horse_timeline ht
WHERE ht.event_type IN ('note', 'photo_update')
  AND ht.horse_id IS NOT NULL
  AND ht.user_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 2: CREATE THE HOOFPRINT VIEW
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_horse_hoofprint AS

-- 1. Creation event (from user_horses row itself)
SELECT
  uh.id AS source_id,
  uh.id AS horse_id,
  uh.owner_id AS user_id,
  'acquired' AS event_type,
  'Added to stable' AS title,
  uh.custom_name || ' was registered on Model Horse Hub.' AS description,
  uh.created_at::date AS event_date,
  jsonb_build_object('life_stage', COALESCE(uh.life_stage, 'completed')) AS metadata,
  true AS is_public,
  uh.created_at AS created_at,
  'user_horses' AS source_table
FROM user_horses uh

UNION ALL

-- 2. Ownership transfers (from horse_ownership_history)
SELECT
  oh.id AS source_id,
  oh.horse_id,
  oh.owner_id AS user_id,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'transferred'
    ELSE 'acquired'
  END AS event_type,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'Transferred to new owner'
    ELSE 'Acquired by ' || oh.owner_alias
  END AS title,
  oh.notes AS description,
  COALESCE(oh.released_at, oh.acquired_at)::date AS event_date,
  jsonb_build_object(
    'acquisition_type', oh.acquisition_type,
    'sale_price', CASE WHEN oh.is_price_public THEN oh.sale_price ELSE NULL END
  ) AS metadata,
  true AS is_public,
  COALESCE(oh.released_at, oh.acquired_at) AS created_at,
  'horse_ownership_history' AS source_table
FROM horse_ownership_history oh
WHERE oh.acquisition_type != 'original'  -- Skip original (covered by user_horses row)

UNION ALL

-- 3. Condition changes (from condition_history)
SELECT
  ch.id AS source_id,
  ch.horse_id,
  ch.changed_by AS user_id,
  'condition_change' AS event_type,
  'Condition: ' || ch.new_condition AS title,
  CASE
    WHEN ch.old_condition IS NOT NULL
      THEN 'Changed from ' || ch.old_condition || ' to ' || ch.new_condition
    ELSE 'Condition set to ' || ch.new_condition
  END AS description,
  ch.created_at::date AS event_date,
  jsonb_build_object('old_condition', ch.old_condition, 'new_condition', ch.new_condition) AS metadata,
  true AS is_public,
  ch.created_at,
  'condition_history' AS source_table
FROM condition_history ch

UNION ALL

-- 4. Show records (from show_records)
SELECT
  sr.id AS source_id,
  sr.horse_id,
  sr.user_id,
  'show_result' AS event_type,
  COALESCE(sr."placing", 'Competed') || ' at ' || sr.show_name AS title,
  CASE
    WHEN sr.class_name IS NOT NULL THEN 'Class: ' || sr.class_name
    ELSE NULL
  END AS description,
  sr.show_date AS event_date,
  jsonb_build_object(
    'show_name', sr.show_name,
    'placing', sr."placing",
    'show_type', sr.show_type,
    'is_nan_qualifying', sr.is_nan_qualifying,
    'verification_tier', sr.verification_tier
  ) AS metadata,
  true AS is_public,
  sr.created_at,
  'show_records' AS source_table
FROM show_records sr

UNION ALL

-- 5. Customization work (from customization_logs)
SELECT
  cl.id AS source_id,
  cl.horse_id,
  uh2.owner_id AS user_id,
  'customization' AS event_type,
  cl.work_type || COALESCE(' by ' || cl.artist_alias, '') AS title,
  cl.materials_used AS description,
  cl.date_completed AS event_date,
  jsonb_build_object('work_type', cl.work_type, 'artist_alias', cl.artist_alias) AS metadata,
  true AS is_public,
  COALESCE(cl.date_completed::timestamptz, now()) AS created_at,
  'customization_logs' AS source_table
FROM customization_logs cl
JOIN user_horses uh2 ON uh2.id = cl.horse_id

UNION ALL

-- 6. User-authored notes (from posts where horse_id is set)
SELECT
  p.id AS source_id,
  p.horse_id,
  p.author_id AS user_id,
  'note' AS event_type,
  LEFT(p.content, 80) AS title,
  p.content AS description,
  p.created_at::date AS event_date,
  '{}'::jsonb AS metadata,
  true AS is_public,
  p.created_at,
  'posts' AS source_table
FROM posts p
WHERE p.horse_id IS NOT NULL
  AND p.parent_id IS NULL;   -- top-level posts only, not replies

-- ══════════════════════════════════════════════════════════════
-- STEP 3: GRANT ACCESS
-- ══════════════════════════════════════════════════════════════

-- Views inherit RLS from underlying tables, but we need
-- the authenticated role to be able to SELECT from the view.
GRANT SELECT ON v_horse_hoofprint TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: UPDATE ATOMIC RPCs — REMOVE horse_timeline INSERTS
-- ══════════════════════════════════════════════════════════════

-- 4a. claim_transfer_atomic — remove horse_timeline INSERT
CREATE OR REPLACE FUNCTION claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD;
    v_horse RECORD;
    v_sender_alias TEXT;
    v_receiver_alias TEXT;
    v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM horse_transfers
    WHERE transfer_code = upper(trim(p_code)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed transfer code.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This transfer code has expired.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot claim your own horse.');
    END IF;

    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    -- Close sender's ownership record with ghost snapshot
    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    -- Create receiver's ownership record
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via transfer');

    -- Transfer ownership
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- ⚡ REMOVED: horse_timeline INSERT — now derived from v_horse_hoofprint view

    -- Clear financial vault
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias
    );
END;
$$;

-- 4b. claim_parked_horse_atomic — remove horse_timeline INSERT
CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD; v_horse RECORD; v_sender_alias TEXT; v_receiver_alias TEXT; v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM horse_transfers WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending' FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN.'); END IF;
    IF v_transfer.expires_at < now() THEN UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id; RETURN jsonb_build_object('success', false, 'error', 'Expired PIN.'); END IF;
    IF v_transfer.sender_id = p_claimant_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot claim your own horse.'); END IF;

    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE horse_ownership_history SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes) VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via CoA PIN');

    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed' WHERE id = v_transfer.horse_id;
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- ⚡ REMOVED: horse_timeline INSERT — now derived from v_horse_hoofprint view

    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL WHERE horse_id = v_transfer.horse_id;
    RETURN jsonb_build_object('success', true, 'horse_id', v_transfer.horse_id, 'horse_name', v_horse.custom_name, 'sender_id', v_transfer.sender_id, 'sender_alias', v_sender_alias, 'receiver_alias', v_receiver_alias);
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'horse_timeline total' AS source, count(*) FROM horse_timeline
-- UNION ALL SELECT 'v_hoofprint total', count(*) FROM v_horse_hoofprint
-- UNION ALL SELECT 'timeline notes migrated to posts', count(*) FROM posts WHERE horse_id IS NOT NULL AND parent_id IS NULL;
--
-- Spot-check a specific horse:
-- SELECT * FROM v_horse_hoofprint WHERE horse_id = '<some-horse-uuid>' ORDER BY event_date DESC;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: DROP horse_timeline — separate migration 051 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS horse_timeline CASCADE;
