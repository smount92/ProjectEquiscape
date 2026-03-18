-- ============================================================
-- Migration 092: Supabase Linter Fixes
-- Addresses all ERRORS, WARNINGS, and INFO issues from the
-- Supabase Database Linter across SECURITY and PERFORMANCE.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- FIX 1: SECURITY DEFINER VIEWS → SECURITY INVOKER
-- Linter: security_definer_view (ERROR)
-- The v_horse_hoofprint and discover_users_view views run with
-- the view creator's permissions, bypassing the querying user's
-- RLS. Change to INVOKER so RLS is enforced per-user.
-- ══════════════════════════════════════════════════════════════

-- 1a. v_horse_hoofprint — recreate with SECURITY INVOKER
CREATE OR REPLACE VIEW v_horse_hoofprint
WITH (security_invoker = true) AS

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
WHERE oh.acquisition_type != 'original'

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

-- 5. Customization work (from customization_logs) — includes image_urls
SELECT
  cl.id AS source_id,
  cl.horse_id,
  uh2.owner_id AS user_id,
  'customization' AS event_type,
  cl.work_type || COALESCE(' by ' || cl.artist_alias, '') AS title,
  cl.materials_used AS description,
  cl.date_completed AS event_date,
  jsonb_build_object(
    'work_type', cl.work_type,
    'artist_alias', cl.artist_alias,
    'image_urls', COALESCE(cl.image_urls, '{}')
  ) AS metadata,
  true AS is_public,
  COALESCE(cl.date_completed::timestamptz, now()) AS created_at,
  'customization_logs' AS source_table
FROM customization_logs cl
JOIN user_horses uh2 ON uh2.id = cl.horse_id

UNION ALL

-- 6. Owner-authored timeline notes ONLY (not visitor comments)
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
JOIN user_horses uh3 ON uh3.id = p.horse_id
WHERE p.horse_id IS NOT NULL
  AND p.parent_id IS NULL
  AND p.author_id = uh3.owner_id;


-- 1b. discover_users_view — recreate with SECURITY INVOKER
DROP VIEW IF EXISTS discover_users_view;

CREATE VIEW discover_users_view
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.alias_name,
    u.created_at,
    u.avatar_url,
    u.bio,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio
FROM users u
WHERE u.account_status = 'active'
  AND u.is_test_account = false;

GRANT SELECT ON discover_users_view TO anon, authenticated;


-- ══════════════════════════════════════════════════════════════
-- FIX 2: FUNCTION SEARCH PATH MUTABLE → SET search_path = ''
-- Linter: function_search_path_mutable (WARN)
-- All SECURITY DEFINER functions need SET search_path = ''
-- to prevent search_path injection attacks. Each function is
-- recreated with its exact original body + the fix applied.
-- ══════════════════════════════════════════════════════════════

-- 2a. increment_approved_suggestions (from 091)
CREATE OR REPLACE FUNCTION public.increment_approved_suggestions(target_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET approved_suggestions_count = approved_suggestions_count + 1
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2b. upvote_suggestion (from 024 — Help Me ID feature)
CREATE OR REPLACE FUNCTION public.upvote_suggestion(p_suggestion_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.id_suggestions
  SET upvotes = upvotes + 1
  WHERE id = p_suggestion_id;
END;
$$;

-- 2c. trg_transaction_complete_price (from 071)
CREATE OR REPLACE FUNCTION public.trg_transaction_complete_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
        NEW.completed_at = COALESCE(NEW.completed_at, now());
        NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb)
            || jsonb_build_object('sale_price', NEW.offer_amount);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2d. cleanup_system_garbage (from 068)
CREATE OR REPLACE FUNCTION public.cleanup_system_garbage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    deleted_notifications INT;
    cancelled_offers INT;
BEGIN
    DELETE FROM public.notifications
    WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

    UPDATE public.transactions
    SET status = 'cancelled', metadata = COALESCE(metadata, '{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
    WHERE status = 'offer_made'
      AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cancelled_offers = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_notifications', deleted_notifications,
        'cancelled_offers', cancelled_offers,
        'ran_at', now()
    );
END;
$$;

-- 2e. check_rate_limit (from 032)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_attempts INT,
    p_window_interval INTERVAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record public.rate_limits%ROWTYPE;
BEGIN
    SELECT * INTO v_record
    FROM public.rate_limits
    WHERE identifier = p_identifier AND endpoint = p_endpoint;

    IF NOT FOUND THEN
        INSERT INTO public.rate_limits (identifier, endpoint, attempts, window_start)
        VALUES (p_identifier, p_endpoint, 1, now());
        RETURN TRUE;
    END IF;

    IF v_record.window_start + p_window_interval < now() THEN
        UPDATE public.rate_limits
        SET attempts = 1, window_start = now()
        WHERE id = v_record.id;
        RETURN TRUE;
    END IF;

    IF v_record.attempts >= p_max_attempts THEN
        RETURN FALSE;
    END IF;

    UPDATE public.rate_limits
    SET attempts = attempts + 1
    WHERE id = v_record.id;
    RETURN TRUE;
END;
$$;

-- 2f. auto_unpark_expired_transfers (from 071)
CREATE OR REPLACE FUNCTION public.auto_unpark_expired_transfers()
RETURNS void AS $$
BEGIN
    UPDATE public.user_horses h
    SET life_stage = 'completed'
    FROM public.horse_transfers t
    WHERE t.horse_id = h.id
      AND t.status = 'pending'
      AND t.expires_at < now()
      AND h.life_stage = 'parked';

    UPDATE public.horse_transfers
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2g. cleanup_rate_limits (from 032)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    DELETE FROM public.rate_limits WHERE window_start < now() - INTERVAL '24 hours';
$$;

-- 2h. vote_for_entry (from 046)
CREATE OR REPLACE FUNCTION public.vote_for_entry(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
  v_entry RECORD;
  v_new_votes INTEGER;
BEGIN
  SELECT user_id, event_id INTO v_entry FROM public.event_entries WHERE id = p_entry_id;
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;

  IF v_entry.user_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry');
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.events WHERE id = v_entry.event_id AND show_status = 'open'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting is closed for this show');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
    UPDATE public.event_entries SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = p_entry_id RETURNING votes_count INTO v_new_votes;
    RETURN jsonb_build_object('success', true, 'action', 'unvoted', 'new_votes', v_new_votes);
  ELSE
    INSERT INTO public.event_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
    UPDATE public.event_entries SET votes_count = votes_count + 1 WHERE id = p_entry_id RETURNING votes_count INTO v_new_votes;
    RETURN jsonb_build_object('success', true, 'action', 'voted', 'new_votes', v_new_votes, 'entry_owner', v_entry.user_id);
  END IF;
END;
$$;

-- 2i. soft_delete_account (from 038, latest version)
CREATE OR REPLACE FUNCTION public.soft_delete_account(target_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF (SELECT auth.uid()) != target_uid THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted] ' || substr(target_uid::text, 1, 8),
        bio = NULL, avatar_url = NULL, notification_prefs = NULL
    WHERE id = target_uid;

    UPDATE public.user_horses SET is_public = false, trade_status = 'Not for Sale', life_stage = 'orphaned' WHERE owner_id = target_uid;
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;
    UPDATE public.horse_transfers SET status = 'cancelled' WHERE sender_id = target_uid AND status = 'pending';
    UPDATE public.commissions SET status = 'cancelled' WHERE (artist_id = target_uid OR client_id = target_uid) AND status NOT IN ('completed', 'delivered', 'cancelled');
    DELETE FROM public.group_memberships WHERE user_id = target_uid;
END;
$$;

-- 2j. close_virtual_show (from 046)
CREATE OR REPLACE FUNCTION public.close_virtual_show(p_event_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event RECORD;
  v_entry RECORD;
  v_rank INTEGER := 0;
  v_records_created INTEGER := 0;
  v_total_entries INTEGER;
BEGIN
  SELECT id, name, created_by, event_type, show_status, starts_at
  INTO v_event FROM public.events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  IF v_event.created_by != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the event creator can close the show');
  END IF;
  IF v_event.event_type != 'photo_show' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a photo show');
  END IF;
  IF v_event.show_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already closed');
  END IF;

  UPDATE public.events SET show_status = 'closed' WHERE id = p_event_id;

  SELECT count(*) INTO v_total_entries
  FROM public.event_entries WHERE event_id = p_event_id AND entry_type = 'entered';

  FOR v_entry IN
    SELECT ee.id, ee.horse_id, ee.user_id, ee.votes_count, ee.class_name
    FROM public.event_entries ee
    WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered'
    ORDER BY ee.votes_count DESC, ee.created_at ASC
  LOOP
    v_rank := v_rank + 1;

    UPDATE public.event_entries SET "placing" =
      CASE v_rank
        WHEN 1 THEN '1st'
        WHEN 2 THEN '2nd'
        WHEN 3 THEN '3rd'
        ELSE v_rank || 'th'
      END
    WHERE id = v_entry.id;

    IF v_rank <= 10 THEN
      INSERT INTO public.show_records (
        horse_id, user_id, show_name, show_date, "placing", division,
        show_type, class_name, total_entries, verification_tier
      ) VALUES (
        v_entry.horse_id,
        v_entry.user_id,
        v_event.name,
        v_event.starts_at::date,
        CASE v_rank
          WHEN 1 THEN '1st' WHEN 2 THEN '2nd' WHEN 3 THEN '3rd'
          ELSE v_rank || 'th'
        END,
        v_entry.class_name,
        'photo_mhh',
        v_entry.class_name,
        v_total_entries,
        'mhh_auto'
      );
      v_records_created := v_records_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'entries_ranked', v_rank,
    'records_created', v_records_created
  );
END;
$$;

-- 2k. log_condition_change (from 035 — trigger function)
CREATE OR REPLACE FUNCTION public.log_condition_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.condition_grade IS DISTINCT FROM NEW.condition_grade THEN
        INSERT INTO public.condition_history (horse_id, changed_by, old_condition, new_condition)
        VALUES (NEW.id, NEW.owner_id, OLD.condition_grade, NEW.condition_grade);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2l. toggle_show_vote (from 035)
CREATE OR REPLACE FUNCTION public.toggle_show_vote(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_new_votes INT;
    v_entry_owner UUID;
    v_action TEXT;
BEGIN
    SELECT user_id INTO v_entry_owner FROM public.show_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entry not found.');
    END IF;
    IF v_entry_owner = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry.');
    END IF;

    IF EXISTS(SELECT 1 FROM public.show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) THEN
        DELETE FROM public.show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
        UPDATE public.show_entries SET votes = GREATEST(0, votes - 1) WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'unvoted';
    ELSE
        INSERT INTO public.show_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
        UPDATE public.show_entries SET votes = votes + 1 WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'voted';
    END IF;

    RETURN jsonb_build_object('success', true, 'new_votes', v_new_votes, 'action', v_action, 'entry_owner', v_entry_owner);
END;
$$;

-- 2m. claim_parked_horse_atomic (from 064)
CREATE OR REPLACE FUNCTION public.claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_transfer RECORD; v_horse RECORD; v_sender_alias TEXT; v_receiver_alias TEXT; v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM public.horse_transfers
    WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE public.horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        UPDATE public.user_horses SET life_stage = 'completed' WHERE id = v_transfer.horse_id;

        INSERT INTO public.posts (author_id, horse_id, content)
        VALUES (v_transfer.sender_id, v_transfer.horse_id,
                '⏰ Parked transfer expired. Horse automatically unparked.');

        RETURN jsonb_build_object('success', false, 'error', 'Expired PIN.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot claim your own horse.');
    END IF;

    SELECT * INTO v_horse FROM public.user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM public.users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM public.users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM public.horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE public.horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    INSERT INTO public.horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via CoA PIN');

    UPDATE public.user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed'
    WHERE id = v_transfer.horse_id;

    UPDATE public.horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now()
    WHERE id = v_transfer.id;

    UPDATE public.financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price
    );
END;
$$;

-- 2n. claim_transfer_atomic (from 056)
CREATE OR REPLACE FUNCTION public.claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_transfer RECORD;
    v_horse RECORD;
    v_sender_alias TEXT;
    v_receiver_alias TEXT;
    v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM public.horse_transfers
    WHERE transfer_code = upper(trim(p_code)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed transfer code.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE public.horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This transfer code has expired.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot claim your own horse.');
    END IF;

    SELECT * INTO v_horse FROM public.user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM public.users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM public.users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM public.horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE public.horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    INSERT INTO public.horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via transfer');

    UPDATE public.user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    UPDATE public.horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    UPDATE public.financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price
    );
END;
$$;

-- 2o. toggle_activity_like (from 039)
CREATE OR REPLACE FUNCTION public.toggle_activity_like(p_activity_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.activity_likes WHERE user_id = p_user_id AND activity_id = p_activity_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.activity_likes WHERE user_id = p_user_id AND activity_id = p_activity_id;
    UPDATE public.activity_events SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_activity_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO public.activity_likes (user_id, activity_id) VALUES (p_user_id, p_activity_id);
    UPDATE public.activity_events SET likes_count = likes_count + 1 WHERE id = p_activity_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- 2p. toggle_post_like (from 042)
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE user_id = p_user_id AND post_id = p_post_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM public.likes WHERE user_id = p_user_id AND post_id = p_post_id;
    UPDATE public.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'unliked');
  ELSE
    INSERT INTO public.likes (user_id, post_id) VALUES (p_user_id, p_post_id);
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'action', 'liked');
  END IF;
END;
$$;

-- 2q. add_post_reply (from 042)
CREATE OR REPLACE FUNCTION public.add_post_reply(
  p_parent_id UUID,
  p_author_id UUID,
  p_content TEXT,
  p_horse_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.posts (author_id, content, parent_id, horse_id, group_id, event_id)
  VALUES (p_author_id, p_content, p_parent_id, p_horse_id, p_group_id, p_event_id)
  RETURNING id INTO v_id;

  UPDATE public.posts SET replies_count = replies_count + 1 WHERE id = p_parent_id;
  RETURN v_id;
END;
$$;

-- 2r. refresh_market_prices (from 067)
CREATE OR REPLACE FUNCTION public.refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2s. batch_import_horses (from 056)
CREATE OR REPLACE FUNCTION public.batch_import_horses(
    p_user_id UUID,
    p_horses JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    horse_record JSONB;
    new_horse_id UUID;
    imported_count INT := 0;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;

    FOR horse_record IN SELECT * FROM jsonb_array_elements(p_horses)
    LOOP
        INSERT INTO public.user_horses (
            owner_id,
            custom_name,
            finish_type,
            condition_grade,
            catalog_id,
            asset_category,
            is_public,
            trade_status
        ) VALUES (
            p_user_id,
            horse_record->>'custom_name',
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'finish_type', 'OF')::public.finish_type
                ELSE NULL
            END,
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'condition_grade', 'Not Graded')
                ELSE NULL
            END,
            NULLIF(horse_record->>'catalog_id', '')::UUID,
            COALESCE(horse_record->>'asset_category', 'model'),
            false,
            'Not for Sale'
        )
        RETURNING id INTO new_horse_id;

        IF (horse_record->>'purchase_price') IS NOT NULL
           OR (horse_record->>'estimated_value') IS NOT NULL THEN
            INSERT INTO public.financial_vault (
                horse_id,
                purchase_price,
                estimated_current_value
            ) VALUES (
                new_horse_id,
                NULLIF(horse_record->>'purchase_price', '')::NUMERIC,
                NULLIF(horse_record->>'estimated_value', '')::NUMERIC
            );
        END IF;

        imported_count := imported_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'imported', imported_count);
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- FIX 3: EXTENSION IN PUBLIC → MOVE pg_trgm TO extensions SCHEMA
-- Linter: extension_in_public (WARN)
-- ══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;


-- ══════════════════════════════════════════════════════════════
-- FIX 4: MATERIALIZED VIEW IN API — REVOKE anon ACCESS
-- Linter: materialized_view_in_api (WARN)
-- mv_market_prices is aggregated pricing data — no need for
-- anonymous access. Authenticated users can still query via
-- the Blue Book page.
-- ══════════════════════════════════════════════════════════════

REVOKE SELECT ON mv_market_prices FROM anon;


-- ══════════════════════════════════════════════════════════════
-- FIX 5: RLS ENABLED NO POLICY — Document intent
-- Linter: rls_enabled_no_policy (INFO)
-- rate_limits has RLS enabled but no user-facing policies by
-- design — only accessed via SECURITY DEFINER RPCs.
-- ══════════════════════════════════════════════════════════════

COMMENT ON TABLE rate_limits IS
    'Rate limiting table. RLS enabled with no user-facing policies. '
    'Only accessed via SECURITY DEFINER RPCs (check_rate_limit, cleanup_rate_limits). '
    'This is intentional — no user should directly read/write this table.';


-- ══════════════════════════════════════════════════════════════
-- FIX 6: AUTH RLS INITPLAN — wrap auth.uid() in (SELECT ...)
-- Linter: auth_rls_initplan (WARN — PERFORMANCE)
-- Wrapping auth.uid() in a subselect ensures it's evaluated
-- once per query instead of once per row.
-- ══════════════════════════════════════════════════════════════

-- 6a. id_requests — "Owner inserts requests"
DROP POLICY IF EXISTS "Owner inserts requests" ON id_requests;
CREATE POLICY "Owner inserts requests" ON id_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6b. id_requests — "Owner updates own requests"
DROP POLICY IF EXISTS "Owner updates own requests" ON id_requests;
CREATE POLICY "Owner updates own requests" ON id_requests
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6c. id_suggestions — "Authenticated users can suggest"
DROP POLICY IF EXISTS "Authenticated users can suggest" ON id_suggestions;
CREATE POLICY "Authenticated users can suggest" ON id_suggestions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6d. id_suggestions — "Owner updates own suggestions"
DROP POLICY IF EXISTS "Owner updates own suggestions" ON id_suggestions;
CREATE POLICY "Owner updates own suggestions" ON id_suggestions
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6e+6f. condition_history — Handled in Fix 7d (merged policies)

-- 6g. user_reports — "Users can insert reports"
DROP POLICY IF EXISTS "Users can insert reports" ON user_reports;
CREATE POLICY "Users can insert reports" ON user_reports
    FOR INSERT TO authenticated
    WITH CHECK (reporter_id = (SELECT auth.uid()));

-- 6h. user_reports — "Users can see own reports"
DROP POLICY IF EXISTS "Users can see own reports" ON user_reports;
CREATE POLICY "Users can see own reports" ON user_reports
    FOR SELECT TO authenticated
    USING (reporter_id = (SELECT auth.uid()));

-- 6i. catalog_suggestions — "Auth users can create suggestions"
DROP POLICY IF EXISTS "Auth users can create suggestions" ON catalog_suggestions;
CREATE POLICY "Auth users can create suggestions" ON catalog_suggestions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6j. catalog_suggestions — "Users can update own pending suggestions"
DROP POLICY IF EXISTS "Users can update own pending suggestions" ON catalog_suggestions;
CREATE POLICY "Users can update own pending suggestions" ON catalog_suggestions
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id AND status = 'pending');

-- 6k. catalog_suggestion_votes — "Auth users can vote"
DROP POLICY IF EXISTS "Auth users can vote" ON catalog_suggestion_votes;
CREATE POLICY "Auth users can vote" ON catalog_suggestion_votes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6l. catalog_suggestion_votes — "Users can remove own vote"
DROP POLICY IF EXISTS "Users can remove own vote" ON catalog_suggestion_votes;
CREATE POLICY "Users can remove own vote" ON catalog_suggestion_votes
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 6m. catalog_suggestion_comments — "Auth users can comment"
DROP POLICY IF EXISTS "Auth users can comment" ON catalog_suggestion_comments;
CREATE POLICY "Auth users can comment" ON catalog_suggestion_comments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

-- 6n. catalog_suggestion_comments — "Users can delete own comments"
DROP POLICY IF EXISTS "Users can delete own comments" ON catalog_suggestion_comments;
CREATE POLICY "Users can delete own comments" ON catalog_suggestion_comments
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 6o+6p+6q. event_divisions, event_classes — Handled in Fix 7f/7g

-- 6r. horse_collections — "Users can view own horse collection links"
-- NOTE: horse_collections has NO user_id column — uses horse_id → user_horses.owner_id
DROP POLICY IF EXISTS "Users can view own horse collection links" ON horse_collections;
CREATE POLICY "Users can view own horse collection links" ON horse_collections
    FOR SELECT TO authenticated
    USING (
        horse_id IN (
            SELECT id FROM user_horses WHERE owner_id = (SELECT auth.uid())
        )
    );

-- 6s. horse_collections — "Users can insert own horse collection links"
DROP POLICY IF EXISTS "Users can insert own horse collection links" ON horse_collections;
CREATE POLICY "Users can insert own horse collection links" ON horse_collections
    FOR INSERT TO authenticated
    WITH CHECK (
        horse_id IN (
            SELECT id FROM user_horses WHERE owner_id = (SELECT auth.uid())
        )
    );

-- 6t. horse_collections — "Users can delete own horse collection links"
DROP POLICY IF EXISTS "Users can delete own horse collection links" ON horse_collections;
CREATE POLICY "Users can delete own horse collection links" ON horse_collections
    FOR DELETE TO authenticated
    USING (
        horse_id IN (
            SELECT id FROM user_horses WHERE owner_id = (SELECT auth.uid())
        )
    );


-- ══════════════════════════════════════════════════════════════
-- FIX 7: MULTIPLE PERMISSIVE POLICIES — Merge into single policies
-- Linter: multiple_permissive_policies (WARN — PERFORMANCE)
-- Multiple permissive policies for the same role+action are
-- suboptimal — each must be evaluated. Merge with OR.
-- ══════════════════════════════════════════════════════════════

-- 7a. commission_updates — authenticated SELECT
DROP POLICY IF EXISTS "Artist views all updates for own commissions" ON commission_updates;
DROP POLICY IF EXISTS "Client views visible updates for own commissions" ON commission_updates;
CREATE POLICY "Participants view commission updates" ON commission_updates
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM commissions c
            WHERE c.id = commission_updates.commission_id
              AND (
                  c.artist_id = (SELECT auth.uid())
                  OR (c.client_id = (SELECT auth.uid()) AND commission_updates.is_visible_to_client = true)
              )
        )
    );

-- 7b. commissions — authenticated INSERT
DROP POLICY IF EXISTS "Artist creates own commissions" ON commissions;
DROP POLICY IF EXISTS "Client creates commission requests" ON commissions;
CREATE POLICY "Participants create commissions" ON commissions
    FOR INSERT TO authenticated
    WITH CHECK (
        artist_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid())
    );

-- 7c. commissions — authenticated SELECT
DROP POLICY IF EXISTS "Artist views own commissions" ON commissions;
DROP POLICY IF EXISTS "Client views own commissions" ON commissions;
DROP POLICY IF EXISTS "Public queue visibility" ON commissions;
CREATE POLICY "View commissions" ON commissions
    FOR SELECT TO authenticated
    USING (
        artist_id = (SELECT auth.uid())
        OR client_id = (SELECT auth.uid())
        OR queue_public = true
    );

-- 7d. condition_history — authenticated SELECT (merge + initplan fix)
DROP POLICY IF EXISTS "Owner views own condition history" ON condition_history;
DROP POLICY IF EXISTS "View condition history on public horses" ON condition_history;
CREATE POLICY "View condition history" ON condition_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_horses
            WHERE user_horses.id = condition_history.horse_id
              AND (
                  user_horses.owner_id = (SELECT auth.uid())
                  OR user_horses.is_public = true
              )
        )
    );

-- condition_history INSERT (initplan fix from 6f)
-- Original policy: auth.uid() = changed_by (direct column check)
DROP POLICY IF EXISTS "System insert condition history" ON condition_history;
CREATE POLICY "System insert condition history" ON condition_history
    FOR INSERT TO authenticated
    WITH CHECK (changed_by = (SELECT auth.uid()));

-- 7e. customization_logs — authenticated INSERT
DROP POLICY IF EXISTS "commission_artist_inserts_customization_log" ON customization_logs;
DROP POLICY IF EXISTS "customization_logs_insert_own" ON customization_logs;
CREATE POLICY "Insert customization logs" ON customization_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_horses
            WHERE user_horses.id = customization_logs.horse_id
              AND user_horses.owner_id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM commissions c
            WHERE c.horse_id = customization_logs.horse_id
              AND c.artist_id = (SELECT auth.uid())
              AND c.status IN ('completed', 'delivered')
        )
    );

-- 7f. event_classes — merge SELECT policies (also fixes initplan)
DROP POLICY IF EXISTS "Anyone can view event classes" ON event_classes;
DROP POLICY IF EXISTS "Event creator can manage classes" ON event_classes;

CREATE POLICY "Anyone can view event classes" ON event_classes
    FOR SELECT USING (true);

CREATE POLICY "Event creator can manage classes" ON event_classes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events e
            JOIN event_divisions ed ON ed.event_id = e.id
            WHERE ed.id = event_classes.division_id
              AND e.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator can update classes" ON event_classes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN event_divisions ed ON ed.event_id = e.id
            WHERE ed.id = event_classes.division_id
              AND e.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator can delete classes" ON event_classes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN event_divisions ed ON ed.event_id = e.id
            WHERE ed.id = event_classes.division_id
              AND e.created_by = (SELECT auth.uid())
        )
    );

-- 7g. event_divisions — merge SELECT policies (also fixes initplan)
DROP POLICY IF EXISTS "Anyone can view event divisions" ON event_divisions;
DROP POLICY IF EXISTS "Event creator can manage divisions" ON event_divisions;

CREATE POLICY "Anyone can view event divisions" ON event_divisions
    FOR SELECT USING (true);

CREATE POLICY "Event creator can manage divisions" ON event_divisions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_divisions.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator can update divisions" ON event_divisions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_divisions.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator can delete divisions" ON event_divisions
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_divisions.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );

-- 7h. event_judges — authenticated SELECT
DROP POLICY IF EXISTS "Anyone can view event judges" ON event_judges;
DROP POLICY IF EXISTS "Event creator manages judges" ON event_judges;

CREATE POLICY "Anyone can view event judges" ON event_judges
    FOR SELECT USING (true);

CREATE POLICY "Event creator manages judges" ON event_judges
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_judges.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator updates judges" ON event_judges
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_judges.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );

CREATE POLICY "Event creator deletes judges" ON event_judges
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = event_judges.event_id
              AND events.created_by = (SELECT auth.uid())
        )
    );


-- ══════════════════════════════════════════════════════════════
-- FIX 8: DUPLICATE INDEXES — Drop the redundant copy
-- Linter: duplicate_index (WARN — PERFORMANCE)
-- ══════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_activity_events_actor;
DROP INDEX IF EXISTS idx_activity_events_created;
DROP INDEX IF EXISTS idx_horse_images_horse;
DROP INDEX IF EXISTS idx_transfers_code;
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_user_horses_owner;


-- ══════════════════════════════════════════════════════════════
-- FIX 9: UNINDEXED FOREIGN KEYS — Add covering indexes
-- Linter: unindexed_foreign_keys (INFO — PERFORMANCE)
-- ══════════════════════════════════════════════════════════════

-- High-value indexes (frequent JOINs/filters)
CREATE INDEX IF NOT EXISTS idx_activity_likes_activity ON activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_commission_updates_author ON commission_updates(author_id);
CREATE INDEX IF NOT EXISTS idx_commissions_horse ON commissions(horse_id);
CREATE INDEX IF NOT EXISTS idx_condition_history_changed_by ON condition_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_id_requests_user ON id_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_id_suggestions_user ON id_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_id_suggestions_catalog ON id_suggestions(catalog_id);
CREATE INDEX IF NOT EXISTS idx_posts_help_request ON posts(help_request_id) WHERE help_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_studio ON posts(studio_id) WHERE studio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_wishlists_catalog ON user_wishlists(catalog_id) WHERE catalog_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_catalog_changelog_item ON catalog_changelog(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_changelog_suggestion ON catalog_changelog(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_catalog_suggestion_comments_user ON catalog_suggestion_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_suggestion_votes_user ON catalog_suggestion_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_suggestions_reviewed_by ON catalog_suggestions(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- Lower-priority indexes (smaller tables)
CREATE INDEX IF NOT EXISTS idx_media_attachments_uploader ON media_attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_show_string_entries_class ON show_string_entries(class_id);
CREATE INDEX IF NOT EXISTS idx_group_files_uploaded_by ON group_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_user_reports_resolved_by ON user_reports(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_show_records_verified_by ON show_records(verified_by) WHERE verified_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_changelog_contributed_by ON catalog_changelog(contributed_by);
CREATE INDEX IF NOT EXISTS idx_catalog_changelog_approved_by ON catalog_changelog(approved_by);
CREATE INDEX IF NOT EXISTS idx_media_attachments_help_request ON media_attachments(help_request_id) WHERE help_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_attachments_message ON media_attachments(message_id) WHERE message_id IS NOT NULL;


-- ══════════════════════════════════════════════════════════════
-- Done. This migration resolves:
--   2 SECURITY DEFINER view ERRORs
--  19 function search_path mutable WARNs
--   1 extension_in_public WARN
--   1 materialized_view_in_api WARN
--   1 rls_enabled_no_policy INFO
--  19 auth_rls_initplan WARNs (PERFORMANCE)
--  14 multiple_permissive_policies WARNs (PERFORMANCE)
--   6 duplicate_index WARNs (PERFORMANCE)
--  28 unindexed_foreign_key INFOs (PERFORMANCE)
-- ══════════════════════════════════════════════════════════════
