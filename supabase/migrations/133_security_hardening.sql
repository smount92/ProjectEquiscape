-- ══════════════════════════════════════════════════════════════
-- Migration 133: Security hardening (audit 2026-07-12 — SEC-1/2/3)
-- ══════════════════════════════════════════════════════════════
-- Additive, idempotent. Three independent sections:
--   A. users PII — stop leaking email/full_name to every logged-in user
--   B. DEFINER RPCs — bind caller identity to auth.uid() (no more spoofing)
--   C. demand-nudge — validate the wanter + rate-limit (gates WANTED_NUDGE)
--
-- ⚠ DEPLOY ORDER: ship the matching app changes FIRST, THEN apply this migration.
--   The app changes route every affected RPC through the USER client so
--   auth.uid() is populated inside the DEFINER function — notably the
--   vote_for_entry call-site fix in src/app/actions/shows.ts (it previously
--   called the RPC via the service-role client, where auth.uid() is NULL). If
--   this migration lands while the OLD code is live, show voting breaks
--   (Unauthorized). make_offer/respond already use the user client on main.
-- NOTE: Section A's grants to `anon` are inert today (RLS blocks anon on users).
--   If a future migration ever adds an anon-visible users SELECT policy, revisit
--   this so email/full_name (and role/account_status/…) don't leak to anon.
-- After apply: npm run gen-types (Section A changes column privileges; the
-- generated *types* are unchanged, but re-running keeps the workflow honest).
-- ══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- SECTION A — SEC-1: column-level privileges on public.users
-- ─────────────────────────────────────────────────────────────
-- The RLS policy is `TO authenticated USING (true)` — row-level only — so any
-- logged-in user could `select email, full_name` and dump every user's real
-- name + email. RLS can't do column security; grants can. Supabase hands out a
-- TABLE-level SELECT by default (covers all columns), which makes a bare column
-- REVOKE a no-op — so we REVOKE the table grant and re-GRANT every column
-- EXCEPT email + full_name. Row visibility is unchanged (RLS still governs it:
-- anon sees none, authenticated sees all rows — just not these two columns).
-- The insurance-report code that legitimately needs the owner's own name/email
-- is moved to the service-role client (bypasses this grant) in the same PR.
REVOKE SELECT ON public.users FROM anon, authenticated;

GRANT SELECT (
    id,
    alias_name,
    avatar_url,
    bio,
    role,
    account_status,
    approved_suggestions_count,
    currency_symbol,
    default_horse_public,
    deleted_at,
    exhibitor_number,
    is_test_account,
    is_trusted_curator,
    is_verified,
    notification_prefs,
    pref_simple_mode,
    show_badges,
    show_photos_on_reference,
    watermark_photos,
    watermark_text,
    created_at
) ON public.users TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- SECTION B — SEC-2: bind SECURITY DEFINER RPCs to auth.uid()
-- ─────────────────────────────────────────────────────────────
-- These DEFINER functions took a caller-supplied identity param and never
-- checked it against auth.uid(), and (being freshly created) carried Postgres'
-- default EXECUTE-to-PUBLIC grant — so they were directly callable by anyone,
-- bypassing the whole action layer: force-accept your own offer with no seller
-- consent, create offers as a victim, forge posts/likes/votes as any user.
-- Fix: RAISE if the caller isn't the identity they claim, and REVOKE PUBLIC.
-- Bodies are otherwise byte-for-byte the current definitions (make/respond from
-- 099; vote_for_entry/toggle_post_like from 092; add_post_reply from 122).

-- B1. make_offer_atomic — caller must be the buyer. (was: search_path=public)
CREATE OR REPLACE FUNCTION make_offer_atomic(
    p_horse_id UUID,
    p_buyer_id UUID,
    p_seller_id UUID,
    p_offered_price NUMERIC,
    p_conversation_id UUID,
    p_message TEXT DEFAULT NULL,
    p_is_bundle BOOLEAN DEFAULT FALSE
) RETURNS JSON AS $$
DECLARE
    v_horse RECORD;
    v_existing_txn RECORD;
    v_new_txn RECORD;
    v_metadata JSON;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_buyer_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_horse
    FROM public.user_horses
    WHERE id = p_horse_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_horse IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Horse not found');
    END IF;

    IF v_horse.owner_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Seller does not own this horse');
    END IF;

    IF v_horse.trade_status NOT IN ('For Sale', 'Open to Offers') THEN
        RETURN json_build_object('success', false, 'error', 'Horse is not available for offers');
    END IF;

    SELECT * INTO v_existing_txn
    FROM public.transactions
    WHERE horse_id = p_horse_id
      AND party_b_id = p_buyer_id
      AND status NOT IN ('completed', 'cancelled', 'retracted')
    FOR UPDATE;

    IF v_existing_txn IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'You already have an active offer on this horse');
    END IF;

    IF p_is_bundle THEN
        v_metadata := '{"is_bundle_sale": true}'::JSON;
    ELSE
        v_metadata := NULL;
    END IF;

    INSERT INTO public.transactions (
        type, status, party_a_id, party_b_id, horse_id,
        conversation_id, offer_amount, offer_message, metadata
    )
    VALUES (
        'marketplace_sale', 'offer_made', p_seller_id, p_buyer_id, p_horse_id,
        p_conversation_id, p_offered_price, p_message, v_metadata
    )
    RETURNING * INTO v_new_txn;

    RETURN json_build_object('success', true, 'transaction_id', v_new_txn.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- B2. respond_to_offer_atomic — caller must be the seller. (was: search_path=public)
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_seller_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_txn
    FROM public.transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_txn IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_txn.party_a_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_txn.status != 'offer_made' THEN
        RETURN json_build_object('success', false, 'error', 'Transaction is no longer in offer_made state');
    END IF;

    IF p_action = 'accept' THEN
        UPDATE public.transactions SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;
    ELSIF p_action = 'decline' THEN
        UPDATE public.transactions SET status = 'cancelled', updated_at = NOW()
        WHERE id = p_transaction_id;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- B3. vote_for_entry — caller must be the voter.
CREATE OR REPLACE FUNCTION public.vote_for_entry(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
  v_entry RECORD;
  v_new_votes INTEGER;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

-- B4. toggle_post_like — caller must be the liker.
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

-- B5. add_post_reply — caller must be the author. (body from 122, incl. bumped_at)
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
  IF (SELECT auth.uid()) IS DISTINCT FROM p_author_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.posts (author_id, content, parent_id, horse_id, group_id, event_id)
  VALUES (p_author_id, p_content, p_parent_id, p_horse_id, p_group_id, p_event_id)
  RETURNING id INTO v_id;

  UPDATE public.posts
  SET replies_count = replies_count + 1,
      bumped_at = now()
  WHERE id = p_parent_id;
  RETURN v_id;
END;
$$;

-- Lock execution to signed-in users only (strip the default PUBLIC grant that
-- made these anon-callable).
REVOKE EXECUTE ON FUNCTION make_offer_atomic(UUID, UUID, UUID, NUMERIC, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.vote_for_entry(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION make_offer_atomic(UUID, UUID, UUID, NUMERIC, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_for_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- SECTION C — SEC-3: harden the demand nudge (migration 130 RPC)
-- ─────────────────────────────────────────────────────────────
-- notify_catalog_owners_of_demand didn't check the wanter against auth.uid()
-- and only 30-day-deduped, so a script iterating catalog ids could nudge every
-- owner of every model. Add the identity check + a per-user hourly cap (reuses
-- check_rate_limit from 032/092). Must land before NEXT_PUBLIC_WANTED_NUDGE=1.
-- Body otherwise identical to 130.
CREATE OR REPLACE FUNCTION notify_catalog_owners_of_demand(
  p_catalog_id UUID,
  p_wanter_id UUID
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count INT := 0;
  v_title TEXT;
  v_maker_slug TEXT;
  v_slug TEXT;
  v_link TEXT;
  r RECORD;
BEGIN
  -- Only the authenticated wanter may nudge on their own behalf.
  IF (SELECT auth.uid()) IS DISTINCT FROM p_wanter_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT title, maker_slug, slug
  INTO v_title, v_maker_slug, v_slug
  FROM public.catalog_items
  WHERE id = p_catalog_id;

  IF v_title IS NULL THEN
    RETURN 0;
  END IF;

  -- Cap fan-out: at most 20 (valid) models nudged per user per hour — a real
  -- collector never trips this; a scraper does immediately. Checked AFTER the
  -- catalog-exists guard so bogus ids can't burn a legitimate user's quota.
  IF NOT public.check_rate_limit(p_wanter_id::text, 'demand_nudge', 20, interval '1 hour') THEN
    RETURN 0;
  END IF;

  v_link := '/reference/' || coalesce(v_maker_slug, 'x') || '/' || coalesce(v_slug, p_catalog_id::text);

  FOR r IN
    SELECT DISTINCT uh.owner_id
    FROM public.user_horses uh
    JOIN public.users u ON u.id = uh.owner_id
    WHERE uh.catalog_id = p_catalog_id
      AND uh.deleted_at IS NULL
      AND uh.owner_id <> p_wanter_id
      AND coalesce((u.notification_prefs ->> 'demand_alerts')::boolean, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uh.owner_id
          AND n.type = 'demand_alert'
          AND n.link_url = v_link
          AND n.created_at > now() - interval '30 days'
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, content, link_url)
    VALUES (
      r.owner_id,
      'demand_alert',
      'Someone is looking for a ' || v_title || ' like yours.',
      v_link
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION notify_catalog_owners_of_demand(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION notify_catalog_owners_of_demand(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 133 Complete. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
