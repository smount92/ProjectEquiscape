-- ============================================================
-- 180: Deal-flow integrity — the DB half of the cyber audit
--
-- Five defects, all in the marketplace state machine, all of them
-- reachable from a plain authenticated session because the tables the
-- app writes are directly writable by their parties through PostgREST:
--
--  1. C4  A "completed sale" — the row that unlocks a verified review —
--         could be minted by ONE party. markTransactionComplete flipped
--         conversations.transaction_status and then checked that same
--         flag as its proof. Worse, the conversations UPDATE policy (173)
--         lets either party write that row directly, so the flag was
--         never evidence of anything. Completion becomes a MUTUAL
--         statement: two stamps, trigger-enforced.
--
--  2. C4b The transactions table has RLS (044) but no write guard, and
--         txn_update has no WITH CHECK. Any party could PATCH their own
--         transaction to status='completed' — including an offer_made
--         row created by making an offer on a stranger's horse — and
--         reviews_insert (044) would then accept a review on a deal that
--         never happened. This is the same forgery as C4 without going
--         through the action at all. A guard trigger now confines
--         hand-written transitions to the ones the app actually makes.
--
--  3. C3  Double sell. Neither accept RPC looked at the horse, so an
--         offer accepted through the counter path and one accepted
--         through the original path could both land in pending_payment
--         for the same model. Both RPCs now lock the horse row, refuse
--         when a sale is already under way, and stamp the lock
--         themselves so the refusal is race-proof rather than advisory.
--
--  4. C6  A completed Safe-Trade sale left the horse flagged
--         'Pending Sale' forever in its NEW owner's stable: accept set
--         it, cancel cleared it, and the success path cleared nothing.
--
--  5. C8  The 7-day offer expiry swept rows in silence. Neither the
--         buyer whose money was notionally committed nor the seller was
--         ever told the offer had lapsed.
--
-- Re-runnable: every statement is IF NOT EXISTS / CREATE OR REPLACE.
-- Apply AFTER 179 (which restores respond_to_offer_atomic's caller
-- check). This file re-states that check in its own rewrite of the
-- function, so pasting them out of order still ends up guarded.
--
-- After applying: run `npm run gen-types`. Until then the app reads the
-- two new columns through the untyped deal client and fails CLOSED —
-- markTransactionComplete refuses rather than completing unilaterally.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. COMPLETION IS SOMETHING BOTH SIDES SAY
-- ══════════════════════════════════════════════════════════════

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS completion_confirmed_by_buyer_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_confirmed_by_seller_at TIMESTAMPTZ;

COMMENT ON COLUMN conversations.completion_confirmed_by_buyer_at IS
  'When conversations.buyer_id said this deal completed. Write-once, and only by that member (trg_conversations_guard). transaction_status may only reach ''completed'' when this and the seller stamp are both set.';
COMMENT ON COLUMN conversations.completion_confirmed_by_seller_at IS
  'When conversations.seller_id said this deal completed. Write-once, and only by that member (trg_conversations_guard).';

-- Threads already closed under the old one-click rule keep their state:
-- backfilling both stamps means an existing completed conversation stays
-- consistent with the new invariant instead of reading as half-confirmed.
-- Runs in the SQL editor with no auth.uid(), so the guard below lets it
-- through on its service-context branch.
UPDATE conversations
SET completion_confirmed_by_buyer_at =
      COALESCE(completion_confirmed_by_buyer_at, updated_at, created_at),
    completion_confirmed_by_seller_at =
      COALESCE(completion_confirmed_by_seller_at, updated_at, created_at)
WHERE transaction_status = 'completed'
  AND (completion_confirmed_by_buyer_at IS NULL
       OR completion_confirmed_by_seller_at IS NULL);


-- ── The guard: 173's body, plus the completion rules ──────────
CREATE OR REPLACE FUNCTION public.conversations_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Service context (SQL editor, service role, crons): no user
  -- session, so the per-user rules below do not apply — this is how
  -- the migration backfill itself runs. RLS keeps clients out.
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
  -- The parties and the subject are what the thread IS. Re-pointing a
  -- thread at a different horse would rewrite the evidence.
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.horse_id IS DISTINCT FROM OLD.horse_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'The parties and subject of a conversation cannot be changed.';
  END IF;

  -- Once BOTH sides have confirmed the terms, the boxes are settled.
  -- Mirrors trg_commissions_freeze_agreement (migration 170) — the same
  -- rule, because it is the same promise.
  IF OLD.deal_terms IS NOT NULL
     AND OLD.deal_terms -> 'agreedByAAt' IS NOT NULL
     AND OLD.deal_terms -> 'agreedByAAt' <> 'null'::jsonb
     AND OLD.deal_terms -> 'agreedByBAt' IS NOT NULL
     AND OLD.deal_terms -> 'agreedByBAt' <> 'null'::jsonb THEN
    IF NEW.deal_terms -> 'boxes' IS DISTINCT FROM OLD.deal_terms -> 'boxes' THEN
      RAISE EXCEPTION 'These terms are agreed by both sides and can no longer be edited.';
    END IF;
  END IF;

  -- A dispute is a preservation order, not a toggle. Standing it down
  -- goes through the server action, which writes an entry saying so.
  IF OLD.disputed_at IS NOT NULL AND NEW.disputed_at IS DISTINCT FROM OLD.disputed_at
     AND NEW.disputed_at IS NOT NULL THEN
    RAISE EXCEPTION 'The dispute timestamp cannot be rewritten.';
  END IF;

  -- ── NEW (180): completion takes both sides ──
  -- Only for writes arriving from a client session. A SECURITY DEFINER
  -- function still reports the calling member in auth.uid(), so
  -- current_user is what tells the two apart — messages_touch_conversation
  -- (173) updates this row as the function owner on every message sent.
  IF current_user IN ('anon', 'authenticated') THEN

    -- Your own confirmation, once, and never anyone else's.
    IF NEW.completion_confirmed_by_buyer_at IS DISTINCT FROM OLD.completion_confirmed_by_buyer_at THEN
      IF OLD.completion_confirmed_by_buyer_at IS NOT NULL THEN
        RAISE EXCEPTION 'A completion confirmation is part of the record and cannot be rewritten.';
      END IF;
      IF (SELECT auth.uid()) IS DISTINCT FROM NEW.buyer_id THEN
        RAISE EXCEPTION 'You can only confirm a deal complete as yourself.';
      END IF;
    END IF;

    IF NEW.completion_confirmed_by_seller_at IS DISTINCT FROM OLD.completion_confirmed_by_seller_at THEN
      IF OLD.completion_confirmed_by_seller_at IS NOT NULL THEN
        RAISE EXCEPTION 'A completion confirmation is part of the record and cannot be rewritten.';
      END IF;
      IF (SELECT auth.uid()) IS DISTINCT FROM NEW.seller_id THEN
        RAISE EXCEPTION 'You can only confirm a deal complete as yourself.';
      END IF;
    END IF;

    -- The flag the review guard reads. It moves to 'completed' only when
    -- both stamps exist, and it never moves back.
    IF NEW.transaction_status IS DISTINCT FROM OLD.transaction_status THEN
      IF OLD.transaction_status = 'completed' THEN
        RAISE EXCEPTION 'A completed deal cannot be reopened.';
      END IF;
      IF NEW.transaction_status = 'completed'
         AND (NEW.completion_confirmed_by_buyer_at IS NULL
              OR NEW.completion_confirmed_by_seller_at IS NULL) THEN
        RAISE EXCEPTION 'Both sides have to confirm before a deal is complete.';
      END IF;
    END IF;

  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_guard ON conversations;
CREATE TRIGGER trg_conversations_guard
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_guard();


-- ══════════════════════════════════════════════════════════════
-- 2. THE TRANSACTIONS TABLE GETS THE GUARD IT NEVER HAD
-- ══════════════════════════════════════════════════════════════
-- txn_update (044) is `USING (caller is a party)` with no WITH CHECK and
-- no column list, so a party could hand-write ANY column of their own
-- transaction: flip an offer_made row straight to 'completed' and
-- reviews_insert accepts a "verified" review; rewrite offer_amount;
-- re-point the row at a different horse.
--
-- The whitelist below is exactly the set of moves the application makes
-- with a user session. Everything else — accepting an offer, countering,
-- declining — already goes through a row-locked SECURITY DEFINER RPC,
-- which runs as the function owner and is therefore not a client write.

CREATE OR REPLACE FUNCTION public.transactions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Service context: crons, the service-role client (which is how the
  -- claim flow closes a funds_verified sale) and the SQL editor.
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
  -- A SECURITY DEFINER RPC still sees the calling member in auth.uid();
  -- current_user is the discriminator for "this is a direct client write".
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;

  -- What the transaction IS. A provenance record that can be re-pointed
  -- is not a record.
  IF NEW.party_a_id      IS DISTINCT FROM OLD.party_a_id
     OR NEW.party_b_id   IS DISTINCT FROM OLD.party_b_id
     OR NEW.type         IS DISTINCT FROM OLD.type
     OR NEW.horse_id     IS DISTINCT FROM OLD.horse_id
     OR NEW.commission_id IS DISTINCT FROM OLD.commission_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'The parties and subject of a transaction cannot be changed.';
  END IF;

  -- The number on the table moves by offering and countering, both of
  -- which are row-locked RPCs that record who moved it.
  IF NEW.offer_amount IS DISTINCT FROM OLD.offer_amount THEN
    RAISE EXCEPTION 'An offer amount can only be changed by making a counter-offer.';
  END IF;

  -- Self-attestations are write-once. The whole evidential value of
  -- paid_at / verified_at is that neither side can un-say them.
  IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'A recorded payment date cannot be changed.';
  END IF;
  IF OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'A recorded verification date cannot be changed.';
  END IF;
  IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'A recorded acceptance date cannot be changed.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'A % transaction is finished and cannot be reopened.', OLD.status;
    END IF;

    IF NEW.status = 'cancelled' THEN
      -- Withdrawing, retracting, cancelling: always a party's own move.
      NULL;
    ELSIF NEW.status = 'funds_verified' AND OLD.status = 'pending_payment' THEN
      -- The seller says the money arrived and releases the horse.
      NULL;
    ELSIF NEW.status = 'completed' AND OLD.status = 'funds_verified' THEN
      -- The Safe-Trade claim closed the loop.
      NULL;
    ELSIF NEW.status = 'completed' AND OLD.status = 'pending' THEN
      -- The legacy conversation flow — and only when BOTH parties have
      -- said so on the thread. This is the C4 forgery, closed at the row.
      IF NEW.conversation_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = NEW.conversation_id
          AND c.completion_confirmed_by_buyer_at IS NOT NULL
          AND c.completion_confirmed_by_seller_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Both sides have to confirm before a deal is complete.';
      END IF;
    ELSE
      RAISE EXCEPTION
        'A transaction cannot be moved from "%" to "%" by hand — use the offer actions.',
        OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_guard ON transactions;
CREATE TRIGGER trg_transactions_guard
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_guard();


-- ══════════════════════════════════════════════════════════════
-- 3. ONE HORSE, ONE SALE
-- ══════════════════════════════════════════════════════════════
-- Both accept paths gated on `status = 'offer_made'` and nothing else.
-- Buyer1 accepts a counter (horse → Pending Sale, txn2 untouched); the
-- seller then accepts Buyer2's original offer; two buyers are now in
-- pending_payment for one physical model, and only one of them will get
-- it. The app-layer helper (src/lib/commerce/horseLock.ts) gives the
-- seller a sentence; this makes the race itself impossible, because the
-- check and the lock happen inside the same row-locked statement.

-- ── 3a. respond_to_offer_atomic (179's body + the horse check) ──
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    -- 133's guard, dropped by 172, restored by 179: the caller must BE
    -- the seller, not merely name them. Re-stated here so this file is
    -- safe to paste even if 179 has not been.
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
        IF v_txn.horse_id IS NOT NULL THEN
            -- Serialise every accept on this horse against every other.
            PERFORM 1 FROM user_horses WHERE id = v_txn.horse_id FOR UPDATE;

            IF EXISTS (
                SELECT 1 FROM transactions t2
                WHERE t2.horse_id = v_txn.horse_id
                  AND t2.id <> v_txn.id
                  AND t2.status IN ('pending_payment', 'funds_verified', 'completed')
            ) THEN
                RETURN json_build_object('success', false, 'error',
                    'Another sale on this horse is already under way.');
            END IF;

            IF EXISTS (
                SELECT 1 FROM user_horses h
                WHERE h.id = v_txn.horse_id AND h.trade_status = 'Pending Sale'
            ) THEN
                RETURN json_build_object('success', false, 'error',
                    'This horse is already marked Pending Sale.');
            END IF;
        END IF;

        UPDATE transactions SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;

        -- Take the lock here rather than trusting the caller to: the
        -- app's own write is best-effort and only logs on failure.
        IF v_txn.horse_id IS NOT NULL THEN
            UPDATE user_horses SET trade_status = 'Pending Sale'
            WHERE id = v_txn.horse_id
              AND trade_status IN ('For Sale', 'Open to Offers');
        END IF;
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


-- ── 3b. deal_offer_move_atomic (173's body + the horse check) ──
CREATE OR REPLACE FUNCTION public.deal_offer_move_atomic(
    p_transaction_id UUID,
    p_actor_id UUID,
    p_move TEXT,
    p_amount NUMERIC DEFAULT NULL,
    p_message TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_txn   RECORD;
    v_side  TEXT;
    v_from  TEXT;
    v_meta  JSONB;
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM p_actor_id THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;

    SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF p_actor_id = v_txn.party_a_id THEN v_side := 'a';
    ELSIF p_actor_id = v_txn.party_b_id THEN v_side := 'b';
    ELSE RETURN json_build_object('success', false, 'error', 'Not a party to this deal');
    END IF;

    IF v_txn.status <> 'offer_made' THEN
        RETURN json_build_object('success', false, 'error',
            format('There is no offer on the table — the deal is "%s".', v_txn.status));
    END IF;

    v_meta := COALESCE(v_txn.metadata, '{}'::jsonb);
    -- No recorded counter means the original buyer's offer is standing.
    v_from := COALESCE(v_meta ->> 'offer_from', 'b');

    IF p_move = 'counter' THEN
        IF p_amount IS NULL OR p_amount <= 0 THEN
            RETURN json_build_object('success', false, 'error', 'A counter needs an amount.');
        END IF;
        IF v_from = v_side THEN
            RETURN json_build_object('success', false, 'error',
                'Your offer is already the one on the table.');
        END IF;

        UPDATE transactions
        SET offer_amount  = p_amount,
            offer_message = p_message,
            metadata      = v_meta
                            || jsonb_build_object(
                                 'offer_from', v_side,
                                 'previous_amount', v_txn.offer_amount,
                                 'counter_count',
                                   COALESCE((v_meta ->> 'counter_count')::INT, 0) + 1)
        WHERE id = p_transaction_id;

        RETURN json_build_object('success', true, 'amount', p_amount, 'offer_from', v_side);

    ELSIF p_move = 'accept' THEN
        IF v_from = v_side THEN
            RETURN json_build_object('success', false, 'error',
                'You cannot accept your own offer.');
        END IF;

        -- ── 180: the horse has to still be free (audit C3) ──
        IF v_txn.horse_id IS NOT NULL THEN
            PERFORM 1 FROM user_horses WHERE id = v_txn.horse_id FOR UPDATE;

            IF EXISTS (
                SELECT 1 FROM transactions t2
                WHERE t2.horse_id = v_txn.horse_id
                  AND t2.id <> v_txn.id
                  AND t2.status IN ('pending_payment', 'funds_verified', 'completed')
            ) THEN
                RETURN json_build_object('success', false, 'error',
                    'Another sale on this horse is already under way.');
            END IF;

            IF EXISTS (
                SELECT 1 FROM user_horses h
                WHERE h.id = v_txn.horse_id AND h.trade_status = 'Pending Sale'
            ) THEN
                RETURN json_build_object('success', false, 'error',
                    'This horse is already marked Pending Sale.');
            END IF;
        END IF;

        UPDATE transactions
        SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;

        IF v_txn.horse_id IS NOT NULL THEN
            UPDATE user_horses SET trade_status = 'Pending Sale'
            WHERE id = v_txn.horse_id
              AND trade_status IN ('For Sale', 'Open to Offers');
        END IF;

        RETURN json_build_object('success', true, 'amount', v_txn.offer_amount);

    ELSIF p_move = 'decline' THEN
        IF v_from = v_side THEN
            RETURN json_build_object('success', false, 'error',
                'Retract your own offer rather than declining it.');
        END IF;
        UPDATE transactions SET status = 'cancelled' WHERE id = p_transaction_id;
        RETURN json_build_object('success', true);

    END IF;

    RETURN json_build_object('success', false, 'error', 'Unknown move.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deal_offer_move_atomic(UUID, UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_offer_move_atomic(UUID, UUID, TEXT, NUMERIC, TEXT) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 4. 'PENDING SALE' IS CLEARED WHEN THE SALE ACTUALLY COMPLETES
-- ══════════════════════════════════════════════════════════════
-- 092's body, plus two resets. Both are conditioned on the horse
-- actually being locked by a sale, so an ordinary CoA transfer of a
-- 'Not for Sale' horse is untouched — and no horse is ever moved INTO a
-- listed state by this function.

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

        -- The sale fell through and the horse stays with its seller, so
        -- the lock goes back to where cancelTransaction puts it. Only
        -- when it IS locked — a plain transfer keeps its own status.
        UPDATE public.user_horses SET trade_status = 'Open to Offers'
        WHERE id = v_transfer.horse_id AND trade_status = 'Pending Sale';

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

    -- audit C6: the sale is DONE, so the sale lock comes off. It used to
    -- survive the handover, and the buyer's new horse sat in their stable
    -- reading "Pending sale" until they noticed and fixed it by hand.
    UPDATE public.user_horses
    SET owner_id = p_claimant_id,
        collection_id = NULL,
        life_stage = 'completed',
        trade_status = CASE WHEN trade_status = 'Pending Sale'
                            THEN 'Not for Sale' ELSE trade_status END
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

-- The code path is the same for a horse claimed with the transfer CODE
-- rather than the PIN (parkHorse writes both), so it gets the same reset.
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

    UPDATE public.user_horses
    SET owner_id = p_claimant_id,
        collection_id = NULL,
        trade_status = CASE WHEN trade_status = 'Pending Sale'
                            THEN 'Not for Sale' ELSE trade_status END
    WHERE id = v_transfer.horse_id;

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


-- ══════════════════════════════════════════════════════════════
-- 5. AN OFFER THAT LAPSES SAYS SO
-- ══════════════════════════════════════════════════════════════
-- 175's body, with the sweep rewritten to walk its own RETURNING set so
-- both parties learn the offer died. Until now the row went to
-- 'cancelled' in silence at 06:00 UTC and both sides went on believing
-- there was a live offer between them (audit C8, the most impactful of
-- the six notification gaps).
--
-- Notifications are inserted directly, the same way
-- notify_catalog_owners_of_demand (133) does it. Type 'offer' has no
-- notification_prefs key, which the app's own gate treats as always-on,
-- so there is no preference to consult here.

CREATE OR REPLACE FUNCTION public.cleanup_system_garbage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    deleted_notifications INT;
    cancelled_offers INT := 0;
    purged_view_scratch INT;
    r RECORD;
    v_horse_name TEXT;
BEGIN
    DELETE FROM public.notifications
    WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

    FOR r IN
        WITH swept AS (
            UPDATE public.transactions
            SET status = 'cancelled',
                metadata = COALESCE(metadata, '{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
            WHERE status = 'offer_made'
              AND created_at < NOW() - INTERVAL '7 days'
            RETURNING id, party_a_id, party_b_id, horse_id, conversation_id, offer_amount
        )
        SELECT * FROM swept
    LOOP
        cancelled_offers := cancelled_offers + 1;

        SELECT custom_name INTO v_horse_name
        FROM public.user_horses WHERE id = r.horse_id;
        v_horse_name := COALESCE(v_horse_name, 'the horse');

        IF r.party_b_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, content, conversation_id, link_url)
            VALUES (
                r.party_b_id,
                'offer',
                'Your offer on ' || v_horse_name || ' expired after 7 days without an answer.',
                r.conversation_id,
                CASE WHEN r.conversation_id IS NOT NULL
                     THEN '/inbox/' || r.conversation_id::text ELSE NULL END
            );
        END IF;

        IF r.party_a_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, content, conversation_id, link_url)
            VALUES (
                r.party_a_id,
                'offer',
                'The offer on ' || v_horse_name || ' expired after 7 days — it is no longer on the table.',
                r.conversation_id,
                CASE WHEN r.conversation_id IS NOT NULL
                     THEN '/inbox/' || r.conversation_id::text ELSE NULL END
            );
        END IF;
    END LOOP;

    -- 3. Viewer-dedupe scratch (migration 175). This is the statement
    --    that makes the privacy claim true rather than aspirational:
    --    every hashed token from a previous UTC day is deleted, and
    --    what remains is a count with no viewer attached. Deliberately
    --    unconditional — there is no "keep for analysis" branch.
    DELETE FROM public.object_view_scratch
    WHERE day < (NOW() AT TIME ZONE 'utc')::date;
    GET DIAGNOSTICS purged_view_scratch = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_notifications', deleted_notifications,
        'cancelled_offers', cancelled_offers,
        'purged_view_scratch', purged_view_scratch,
        'ran_at', now()
    );
END;
$$;

-- Defence in depth, per the DEFINER audit note N6: this is maintenance,
-- not a member-callable RPC, and it has carried Postgres' default
-- EXECUTE TO PUBLIC since 092.
REVOKE EXECUTE ON FUNCTION public.cleanup_system_garbage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_system_garbage() TO service_role;


-- ══════════════════════════════════════════════════════════════
-- Migration 180 complete.
--
-- conversations       + completion_confirmed_by_buyer_at / _seller_at
-- conversations_guard + write-once own-stamp rule, mutual-completion rule
-- transactions_guard  NEW — client writes confined to the app's moves
-- respond_to_offer_atomic / deal_offer_move_atomic
--                     accept locks the horse row, refuses a horse that is
--                     already selling, and takes the Pending Sale lock
-- claim_parked_horse_atomic / claim_transfer_atomic
--                     clear the Pending Sale lock on handover
-- cleanup_system_garbage  tells both parties an offer lapsed; no longer
--                     callable by anon/authenticated
--
-- Verify:
--   1. As member A on a thread with B, click "Mark as Complete". Expect
--        SELECT transaction_status, completion_confirmed_by_buyer_at,
--               completion_confirmed_by_seller_at FROM conversations
--         WHERE id = '<thread>';
--      → status still 'open', exactly ONE stamp set, and B has a bell.
--      Click again as A: nothing changes. As B: status 'completed',
--      both stamps set, and a marketplace_sale row now exists.
--   2. As a party, from the browser console against the REST API:
--        PATCH /rest/v1/transactions?id=eq.<an offer_made row of yours>
--        {"status":"completed"}
--      → 'A transaction cannot be moved from "offer_made" to "completed"
--        by hand'. Before 180 this succeeded and unlocked a review.
--   3. Two offers on one horse. Accept one; accepting the other (either
--      path) → 'Another sale on this horse is already under way.'
--   4. Complete a Safe-Trade sale through the PIN claim. The horse in the
--      buyer's stable is 'Not for Sale', not 'Pending Sale'.
--   5. SELECT public.cleanup_system_garbage(); as service_role with an
--      offer older than 7 days → both parties hold a new notification.
-- ============================================================
