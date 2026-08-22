-- ============================================================
-- 179: Restore two authorization guards that were lost
--
-- Both are SECURITY DEFINER functions, so RLS on the tables they
-- write does NOT protect them — the function body is the only guard,
-- and in both cases the guard is missing.
--
-- 1. respond_to_offer_atomic — REGRESSION. Migration 133 added a
--    caller-identity check (auth.uid() must equal p_seller_id).
--    Migration 172 rewrote this function to fix the phantom
--    updated_at write on decline, copied the pre-133 body, and
--    silently dropped that check. Since 172 shipped, the only test
--    is `v_txn.party_a_id != p_seller_id` — i.e. it trusts the
--    caller-SUPPLIED seller id. A logged-in buyer can call the RPC
--    directly with the real seller's public owner_id and force-accept
--    their own offer with no seller consent. The legitimate caller
--    (transactions.ts respondToOffer) passes p_seller_id = auth.uid(),
--    so restoring the check is transparent to real accepts/declines.
--    This re-applies 133's guard on top of 172's phantom-column fix.
--
-- 2. toggle_activity_like — never hardened. Migration 133 revoked the
--    sibling toggle_post_like from PUBLIC/anon and added an auth.uid()
--    check, but left toggle_activity_like (final def in 092) with
--    neither. It still has PostgreSQL's default EXECUTE TO PUBLIC, so
--    anon can call it, and it likes/unlikes using the caller-supplied
--    p_user_id — letting anyone forge a like as any member or delete a
--    member's real like, and tamper activity_events.likes_count. This
--    applies the same treatment 133 gave toggle_post_like.
-- ============================================================

-- ── 1. respond_to_offer_atomic: restore the seller-identity guard ──
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    -- 133's guard, dropped by 172: the caller must BE the seller, not
    -- merely name them. auth.uid() is the authenticated caller; a
    -- forged direct RPC call supplying someone else's id fails here.
    IF (SELECT auth.uid()) IS DISTINCT FROM p_seller_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_txn FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_txn.party_a_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_txn.status != 'offer_made' THEN
        RETURN json_build_object('success', false, 'error', 'Transaction is no longer in offer_made state');
    END IF;

    IF p_action = 'accept' THEN
        UPDATE transactions SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;
    ELSIF p_action = 'decline' THEN
        -- 172's fix retained: transactions has no updated_at column.
        UPDATE transactions SET status = 'cancelled'
        WHERE id = p_transaction_id;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) TO authenticated;

-- ── 2. toggle_activity_like: add the caller check + lock down grants ──
CREATE OR REPLACE FUNCTION public.toggle_activity_like(p_activity_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- The caller may only like/unlike as themselves. Without this a
  -- SECURITY DEFINER function trusts the supplied p_user_id outright.
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.toggle_activity_like(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_activity_like(UUID, UUID) TO authenticated;
