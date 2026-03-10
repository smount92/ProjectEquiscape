-- ============================================================
-- Migration 038: V4 Patches (Avatars, RLS, Deletion, Discover View)
-- ============================================================

-- 1. Create the missing avatars bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', false) 
ON CONFLICT (id) DO NOTHING;

-- Avatars RLS: Users can upload their own, anyone can read
CREATE POLICY "Avatar insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar read" ON storage.objects FOR SELECT TO authenticated, anon USING (bucket_id = 'avatars');

-- 2. Fix Storage RLS to allow Help ID and WIP photos
DROP POLICY IF EXISTS "Horse image insert (owner)" ON storage.objects;
CREATE POLICY "Horse image insert (owner)" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (
        -- Standard horse photos
        ((storage.foldername(name))[1] = 'horses' AND EXISTS (SELECT 1 FROM public.user_horses WHERE id = ((storage.foldername(name))[2])::uuid AND owner_id = (SELECT auth.uid())))
        OR 
        -- Help ID photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'help-id')
        OR
        -- Art Studio WIP photos
        ((storage.foldername(name))[1] = (SELECT auth.uid())::text AND (storage.foldername(name))[2] = 'commissions')
    )
);

-- 3. Fix Account Deletion Unique Constraint Crash
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (SELECT auth.uid()) != target_uid THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    -- Use substr of UUID to prevent 23505 Duplicate Key crashes
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted] ' || substr(target_uid::text, 1, 8),
        bio = NULL, avatar_url = NULL, notification_prefs = NULL
    WHERE id = target_uid;
    
    UPDATE public.user_horses SET is_public = false, trade_status = 'Not for Sale', life_stage = 'orphaned' WHERE owner_id = target_uid;
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;
    UPDATE horse_transfers SET status = 'cancelled' WHERE sender_id = target_uid AND status = 'pending';
    UPDATE commissions SET status = 'cancelled' WHERE (artist_id = target_uid OR client_id = target_uid) AND status NOT IN ('completed', 'delivered', 'cancelled');
    DELETE FROM group_memberships WHERE user_id = target_uid;
END;
$$;

-- 4. Fix Parked Horse Claim Stickiness
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
    
    -- CRITICAL FIX: Set life_stage back to 'completed' instead of leaving it 'parked'
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed' WHERE id = v_transfer.horse_id;
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;
    
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred', 'Sold off-platform to @' || v_receiver_alias, 'Sold via CoA.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired', 'Claimed from @' || v_sender_alias, 'Acquired via CoA PIN.', true);

    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL WHERE horse_id = v_transfer.horse_id;
    RETURN jsonb_build_object('success', true, 'horse_id', v_transfer.horse_id, 'horse_name', v_horse.custom_name, 'sender_id', v_transfer.sender_id, 'sender_alias', v_sender_alias, 'receiver_alias', v_receiver_alias);
END;
$$;

-- 5. Discover Page Memory Leak View (O(N) Javascript Fix)
CREATE OR REPLACE VIEW discover_users_view AS
SELECT 
    u.id, 
    u.alias_name, 
    u.created_at, 
    u.avatar_url,
    (SELECT count(*) FROM user_horses h WHERE h.owner_id = u.id AND h.is_public = true) as public_horse_count,
    COALESCE((SELECT avg(stars) FROM user_ratings r WHERE r.reviewed_id = u.id), 0) as avg_rating,
    (SELECT count(*) FROM user_ratings r WHERE r.reviewed_id = u.id) as rating_count
FROM users u
WHERE u.account_status = 'active';
