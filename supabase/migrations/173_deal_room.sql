-- ══════════════════════════════════════════════════════════════
-- Migration 173: The Deal Room
--
-- ADDITIVE ONLY. Every existing conversations / messages row stays
-- valid and readable; no column is dropped, no row is deleted, and
-- the backfills below are idempotent and re-runnable. Application
-- code feature-detects everything here (src/lib/deals/columnSupport.ts)
-- and degrades to today's plain-chat behaviour until this is applied.
--
-- The owner's instruction was to rebuild the conversation model rather
-- than patch it, and in the same breath: "don't LOSE records —
-- everything in DMs right now has been conversational." So this
-- migration adds the deal machinery ALONGSIDE the chat, backfills the
-- old shape into the new one without rewriting a single message, and
-- leaves buyer_id / seller_id populated through the transition.
--
-- What it fixes, each a defect the commerce-and-comms audit found:
--
--   1. messages has no type. A photo message is stored with the literal
--      text "📷 Sent a photo"; an accepted $300 offer leaves the
--      transcript reading "hi" / "hi".        → kind + payload
--
--   2. buyer_id means "whoever clicked first" (the INSERT policy is
--      WITH CHECK (auth.uid() = buyer_id)), so the thread header labels
--      a seller who opened the thread as the Buyer. Three independent
--      unread implementations exist, two of them dead. Mute and archive
--      are impossible.                        → conversation_participants
--
--   3. Both UPDATE policies lack WITH CHECK. Either participant can
--      UPDATE messages SET content = ... on the OTHER person's messages,
--      or re-point a whole conversation at a different horse. For a
--      thread we intend to hand a payment processor as evidence, that
--      has to close.                          → WITH CHECK + guard triggers
--
--   4. Blocking is checked when a conversation is CREATED and nowhere
--      else, so on every existing thread — the only case where blocking
--      matters — a blocked person keeps messaging. And blocks_select_own
--      restricts SELECT to blocker_id = auth.uid(), which makes "did
--      they block me?" literally unanswerable.
--                                             → are_blocked() + send guard
--
--   5. There are NO triggers on conversations or messages. updated_at is
--      bumped by hand in one write path and forgotten in the others; the
--      inbox orders by a column with no index and computes previews by
--      loading every message the user has ever received.
--                                             → last_message_* + triggers
--
--   6. Time payments — the hobby's commonest arrangement and the
--      headline feature of the whole plan — are tracked nowhere.
--                                             → payment_installments
--
-- Reference: docs/COMMERCE_AND_COMMS_PLAN.md §3.3
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- 1. MESSAGES — a typed row instead of a bare string
-- ══════════════════════════════════════════════════════════════
-- Existing rows are conversation, so 'chat' is the default and the
-- backfill is a no-op by construction. Nothing is rewritten.

ALTER TABLE messages
  -- chat | photo | offer | counter_offer | offer_response |
  -- terms_proposed | terms_agreed | plan_created | payment_sent |
  -- payment_confirmed | handover | dispute | completed | system
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'chat',
  -- The structured body for non-chat kinds. Mirrors the shape in
  -- src/lib/deals/transcript.ts, which coerces defensively so a newer
  -- payload never breaks an older reader.
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN messages.kind IS
  'What this entry is. ''chat'' and ''photo'' are typed by a person; every other kind is a state change written by the server and is immutable (see trg_messages_guard).';
COMMENT ON COLUMN messages.payload IS
  'Structured body for event kinds — amounts, dates, sequence numbers. Never used by chat rows.';

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE messages ADD CONSTRAINT messages_kind_check
  CHECK (kind IN (
    'chat', 'photo',
    'offer', 'counter_offer', 'offer_response',
    'terms_proposed', 'terms_agreed', 'plan_created',
    'payment_sent', 'payment_confirmed',
    'handover', 'dispute', 'completed', 'system'
  ));

-- A server-side length ceiling. The composer's maxLength={2000} is
-- browser-only today and sendMessage accepts arbitrary length; the
-- action now caps at 2000, and this is the backstop that no legitimate
-- row can be near. Guarded because a pre-existing over-length row would
-- make the ALTER fail and take the whole paste down with it.
DO $$
DECLARE
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(char_length(content)), 0) INTO v_max FROM messages;
  IF v_max <= 8000 THEN
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_length;
    ALTER TABLE messages ADD CONSTRAINT messages_content_length
      CHECK (char_length(content) <= 8000);
  ELSE
    RAISE NOTICE 'messages.content has a row of % chars — length constraint skipped.', v_max;
  END IF;
END $$;

-- Every unread query filters on exactly this and there has never been
-- an index for it.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (conversation_id, sender_id)
  WHERE is_read = false;

-- The thread renders newest-last within one conversation; the inbox
-- preview wants the newest row per conversation.
CREATE INDEX IF NOT EXISTS idx_messages_convo_created_desc
  ON messages (conversation_id, created_at DESC);

-- Deal events only — the evidence pack and the deal strip read these
-- without wading through the chat.
CREATE INDEX IF NOT EXISTS idx_messages_events
  ON messages (conversation_id, created_at)
  WHERE kind <> 'chat' AND kind <> 'photo';


-- ══════════════════════════════════════════════════════════════
-- 2. CONVERSATION_PARTICIPANTS — one table, four fixes
-- ══════════════════════════════════════════════════════════════
-- Unread counts become "messages after my last_read_at" instead of
-- three JS reducers. The buyer/seller misnaming goes away, because role
-- is derived from the TRANSACTION rather than from who clicked first —
-- and a thread with no transaction honestly reports no roles at all.
-- Mute and archive become possible. And a moderator can be added to a
-- disputed thread later without another migration.

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What this person IS in this deal. 'member' is the honest answer for
  -- a plain DM: two collectors talking are neither buyer nor seller.
  role            TEXT NOT NULL DEFAULT 'member',
  -- Which side of the agreement vocabulary they sit on.
  -- a = has the thing / receives money (seller, artist)
  -- b = wants the thing / sends money (buyer, commissioner)
  -- NULL for a moderator, who is party to neither side.
  party           CHAR(1),
  last_read_at    TIMESTAMPTZ,
  muted           BOOLEAN NOT NULL DEFAULT false,
  archived        BOOLEAN NOT NULL DEFAULT false,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_role_check;
ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_role_check
  CHECK (role IN ('member', 'buyer', 'seller', 'artist', 'client', 'trader', 'moderator'));

ALTER TABLE conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_party_check;
ALTER TABLE conversation_participants ADD CONSTRAINT conversation_participants_party_check
  CHECK (party IS NULL OR party IN ('a', 'b'));

COMMENT ON TABLE conversation_participants IS
  'Membership of a thread. Replaces the conversations.buyer_id/seller_id pair as the source of truth for roles, unread state, mute and archive. buyer_id/seller_id stay populated through the transition.';
COMMENT ON COLUMN conversation_participants.last_read_at IS
  'Everything in this thread created at or before this instant has been seen. The single source of unread truth — the three JS implementations and the per-message is_read boolean are superseded.';

-- The inbox: my threads, unarchived, newest first.
CREATE INDEX IF NOT EXISTS idx_convo_participants_user
  ON conversation_participants (user_id, archived);
CREATE INDEX IF NOT EXISTS idx_convo_participants_convo
  ON conversation_participants (conversation_id);

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

-- Membership is readable by anyone already in the thread. The
-- conversations policies are NOT changed to reference this table, which
-- keeps the two sets non-recursive.
DROP POLICY IF EXISTS "conversation_participants_select" ON conversation_participants;
CREATE POLICY "conversation_participants_select"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

-- You may enrol yourself in a thread you are already a party to. Adding
-- anyone ELSE (a moderator on a disputed thread) goes through the admin
-- client, deliberately: it is a cross-user write.
DROP POLICY IF EXISTS "conversation_participants_insert" ON conversation_participants;
CREATE POLICY "conversation_participants_insert"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

-- You may only ever update your OWN row — your read mark, your mute,
-- your archive. WITH CHECK restated so the row cannot be handed to
-- someone else on the way out.
DROP POLICY IF EXISTS "conversation_participants_update" ON conversation_participants;
CREATE POLICY "conversation_participants_update"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Neither party may change the other's role or side once set. (Your own
-- row is yours for read/mute/archive; the deal identity is not.)
CREATE OR REPLACE FUNCTION public.conversation_participants_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A participant row cannot be moved to another thread or person.';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.party IS DISTINCT FROM OLD.party THEN
    RAISE EXCEPTION 'Your role in this deal is set by the deal, not by you.';
  END IF;
  -- A read mark only ever moves forward. Rewinding it to fake an unread
  -- badge is harmless; rewinding it in the evidence pack is not.
  IF OLD.last_read_at IS NOT NULL
     AND NEW.last_read_at IS NOT NULL
     AND NEW.last_read_at < OLD.last_read_at THEN
    NEW.last_read_at := OLD.last_read_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversation_participants_guard ON conversation_participants;
CREATE TRIGGER trg_conversation_participants_guard
  BEFORE UPDATE ON conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.conversation_participants_guard();


-- ══════════════════════════════════════════════════════════════
-- 3. CONVERSATIONS — the deal lives on the thread
-- ══════════════════════════════════════════════════════════════

ALTER TABLE conversations
  -- The inbox orders by this. Maintained by trigger, because every
  -- previous attempt to maintain it in application code drifted the
  -- moment a second write path appeared.
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS last_message_kind TEXT,
  ADD COLUMN IF NOT EXISTS last_message_sender UUID,
  -- The contract boxes. An ordered list both parties confirm; see
  -- src/lib/deals/terms.ts. NULL until somebody writes the first box,
  -- which is what makes a plain DM a plain DM.
  ADD COLUMN IF NOT EXISTS deal_terms JSONB,
  -- sale | commission | trade. NULL = this is a conversation, not a deal.
  ADD COLUMN IF NOT EXISTS deal_kind TEXT,
  ADD COLUMN IF NOT EXISTS commission_id UUID REFERENCES commissions(id) ON DELETE SET NULL,
  -- We are the record, not the referee: a dispute freezes and preserves.
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS disputed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN conversations.deal_terms IS
  'The agreed boxes, as jsonb: { boxes[], agreedByAAt, agreedByBAt, revision }. Frozen once both sides confirm (see trg_conversations_guard). This is the dispute record.';
COMMENT ON COLUMN conversations.deal_kind IS
  'sale | commission | trade. NULL means this thread is a plain conversation and carries no deal machinery.';
COMMENT ON COLUMN conversations.disputed_at IS
  'Set when either party says the deal went wrong. Model Horse Hub does not arbitrate; this freezes the terms and marks the record for export.';

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_deal_kind_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_deal_kind_check
  CHECK (deal_kind IS NULL OR deal_kind IN ('sale', 'commission', 'trade'));

-- The inbox orders by last_message_at and there is no index today.
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations (last_message_at DESC NULLS LAST);


-- ══════════════════════════════════════════════════════════════
-- 4. PAYMENT_INSTALLMENTS — the time-payment ledger
-- ══════════════════════════════════════════════════════════════
-- Six monthly payments arranged in a DM, tracked in nobody's
-- spreadsheet, with a $400 resin off the market for half a year on a
-- handshake. This table is the whole feature: two independent
-- self-attestations per row, each with its own date.
--
-- NOTHING HERE MOVES MONEY. Model Horse Hub is not a payment processor
-- and holds no funds. marked_sent_at is the payer saying they sent it;
-- confirmed_at is the payee saying it arrived. Phase 3 (if it ever
-- happens) adds a nullable stripe_payment_intent_id and changes nothing
-- else about this shape.

CREATE TABLE IF NOT EXISTS payment_installments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL,
  seq             SMALLINT NOT NULL CHECK (seq >= 1),
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  due_date        DATE,
  marked_sent_at  TIMESTAMPTZ,
  marked_sent_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, seq)
);

COMMENT ON TABLE payment_installments IS
  'A payment plan both parties can see and tick off. Model Horse Hub never holds funds — marked_sent_at and confirmed_at are the two parties'' own dated statements, and neither is a settlement.';
COMMENT ON COLUMN payment_installments.confirmed_at IS
  'The receiving party''s dated confirmation. Immutable once set (see trg_payment_installments_guard) — the ledger is only worth anything as evidence if a receipt cannot be un-issued.';

CREATE INDEX IF NOT EXISTS idx_payment_installments_convo
  ON payment_installments (conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_payment_installments_due
  ON payment_installments (due_date)
  WHERE confirmed_at IS NULL;

ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_installments_select" ON payment_installments;
CREATE POLICY "payment_installments_select"
  ON payment_installments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = payment_installments.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "payment_installments_insert" ON payment_installments;
CREATE POLICY "payment_installments_insert"
  ON payment_installments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = payment_installments.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "payment_installments_update" ON payment_installments;
CREATE POLICY "payment_installments_update"
  ON payment_installments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = payment_installments.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = payment_installments.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

-- A plan can be torn up and rewritten while it is still being agreed;
-- once a row has been confirmed as received it stops being editable
-- (guard trigger) and stops being deletable (this policy).
DROP POLICY IF EXISTS "payment_installments_delete" ON payment_installments;
CREATE POLICY "payment_installments_delete"
  ON payment_installments FOR DELETE TO authenticated
  USING (
    confirmed_at IS NULL
    AND marked_sent_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = payment_installments.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

-- The row-level grants above say WHO may write. This says WHAT may
-- move — RLS cannot restrict columns, and without this either party
-- could rewrite the other's confirmation date.
CREATE OR REPLACE FUNCTION public.payment_installments_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.seq IS DISTINCT FROM OLD.seq THEN
    RAISE EXCEPTION 'A payment row cannot be moved to another deal or renumbered.';
  END IF;

  -- A confirmed receipt is final. Disagreement afterwards is a dispute,
  -- which preserves the record rather than editing it.
  IF OLD.confirmed_at IS NOT NULL THEN
    IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
       OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.marked_sent_at IS DISTINCT FROM OLD.marked_sent_at THEN
      RAISE EXCEPTION 'A confirmed payment is part of the record and cannot be changed.';
    END IF;
  END IF;

  -- Nobody signs on anyone else's behalf.
  IF NEW.marked_sent_at IS DISTINCT FROM OLD.marked_sent_at
     AND NEW.marked_sent_at IS NOT NULL
     AND NEW.marked_sent_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'You can only mark a payment as sent under your own name.';
  END IF;
  IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
     AND NEW.confirmed_at IS NOT NULL
     AND NEW.confirmed_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'You can only confirm a payment under your own name.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_installments_guard ON payment_installments;
CREATE TRIGGER trg_payment_installments_guard
  BEFORE UPDATE ON payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.payment_installments_guard();


-- ══════════════════════════════════════════════════════════════
-- 5. THE UPDATE POLICIES GET THEIR MISSING WITH CHECK
-- ══════════════════════════════════════════════════════════════
-- 022_performance_hardening.sql:305-358 is authoritative today, and
-- both of its UPDATE policies stop at USING. The messages one is named
-- "mark messages as read" and permits rewriting anything, including
-- another person's content and sender_id. This closes both.
--
-- A policy alone cannot restrict COLUMNS, so each is paired with a
-- guard trigger below. The policy says who may touch the row; the
-- trigger says what may move.

DROP POLICY IF EXISTS "Users can mark messages as read in own conversations" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update"
  ON conversations FOR UPDATE TO authenticated
  USING (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
  )
  WITH CHECK (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
  );

-- ── What may move on a message ───────────────────────────────
CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  -- Identity is fixed. A message cannot change hands or threads.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A message cannot be re-attributed or moved.';
  END IF;

  -- Deal events are the record. Nobody edits them, including their author.
  IF OLD.kind NOT IN ('chat', 'photo') THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.payload IS DISTINCT FROM OLD.payload
       OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      RAISE EXCEPTION 'This entry is part of the deal record and cannot be edited.';
    END IF;
  ELSE
    -- Chat: only the author may change their own words, and doing so
    -- stamps edited_at so the transcript stays honest.
    IF NEW.content IS DISTINCT FROM OLD.content OR NEW.kind IS DISTINCT FROM OLD.kind THEN
      IF v_uid IS DISTINCT FROM OLD.sender_id THEN
        RAISE EXCEPTION 'You cannot edit someone else''s message.';
      END IF;
      IF NEW.kind NOT IN ('chat', 'photo') THEN
        RAISE EXCEPTION 'A chat message cannot be turned into a deal entry.';
      END IF;
      NEW.edited_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_guard ON messages;
CREATE TRIGGER trg_messages_guard
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_guard();

-- ── What may move on a conversation ──────────────────────────
CREATE OR REPLACE FUNCTION public.conversations_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
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

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_guard ON conversations;
CREATE TRIGGER trg_conversations_guard
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.conversations_guard();


-- ══════════════════════════════════════════════════════════════
-- 6. LAST-MESSAGE MAINTENANCE — the trigger the table never had
-- ══════════════════════════════════════════════════════════════
-- The inbox currently loads EVERY message the user has ever received
-- and reduces in JS to find previews. With this, the preview is a
-- column, and the write path cannot forget to keep it fresh.

CREATE OR REPLACE FUNCTION public.messages_touch_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview TEXT;
BEGIN
  -- Events carry their sentence in `content` too (the server writes a
  -- human-readable line alongside the payload), so one rule covers both.
  v_preview := left(regexp_replace(COALESCE(NEW.content, ''), '\s+', ' ', 'g'), 140);

  UPDATE conversations
  SET last_message_at     = NEW.created_at,
      last_message_preview = v_preview,
      last_message_kind    = NEW.kind,
      last_message_sender  = NEW.sender_id,
      updated_at           = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.messages_touch_conversation() IS
  'SECURITY DEFINER because a participant writing a message must be able to bump the conversation row even where the UPDATE policy would otherwise re-evaluate; the function touches only the four denormalised preview columns.';

DROP TRIGGER IF EXISTS trg_messages_touch_conversation ON messages;
CREATE TRIGGER trg_messages_touch_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_touch_conversation();


-- ══════════════════════════════════════════════════════════════
-- 7. BLOCKING THAT ACTUALLY BLOCKS
-- ══════════════════════════════════════════════════════════════
-- BlockButton promises "They won't be able to message you." That has
-- been false for every existing thread, which is the only case where
-- blocking matters: the check runs in createOrFindConversation and
-- nowhere else. Worse, blocks_select_own restricts SELECT to
-- blocker_id = auth.uid(), so the bidirectional .or() in messaging.ts
-- can only ever match its first arm — you cannot detect that someone
-- blocked you.
--
-- Both halves are fixed here: a DEFINER function that can answer the
-- question in both directions, and a send-time guard that enforces it.

CREATE OR REPLACE FUNCTION public.are_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
       OR (blocker_id = p_user_b AND blocked_id = p_user_a)
  );
$$;

REVOKE ALL ON FUNCTION public.are_blocked(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_blocked(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.are_blocked(UUID, UUID) IS
  'Has either of these two blocked the other? SECURITY DEFINER because blocks_select_own hides the row where SOMEONE ELSE blocked you, which makes the question unanswerable under RLS. Returns a boolean only — it never reveals which direction.';

CREATE OR REPLACE FUNCTION public.messages_block_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other UUID;
BEGIN
  -- Server-written system entries (no sender) are never blocked.
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN c.buyer_id = NEW.sender_id THEN c.seller_id ELSE c.buyer_id END
  INTO v_other
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_other IS NOT NULL AND public.are_blocked(NEW.sender_id, v_other) THEN
    RAISE EXCEPTION 'You can no longer message this person.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.messages_block_guard() IS
  'Enforces blocking on SEND, not just on thread creation. SECURITY DEFINER so it can see blocks in both directions.';

DROP TRIGGER IF EXISTS trg_messages_block_guard ON messages;
CREATE TRIGGER trg_messages_block_guard
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_block_guard();


-- ══════════════════════════════════════════════════════════════
-- 8. ATTACHMENT PRIVACY
-- ══════════════════════════════════════════════════════════════
-- media_select is USING (true) — every authenticated member can list the
-- storage_path and caption of every private DM attachment on the
-- platform. The bytes are protected; the metadata never was. Narrow the
-- message-attached arc to thread participants and leave every other arc
-- (posts, horses, shows) exactly as it was.

DROP POLICY IF EXISTS "media_select" ON media_attachments;
CREATE POLICY "media_select"
  ON media_attachments FOR SELECT TO authenticated
  USING (
    message_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = media_attachments.message_id
        AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 9. REALTIME — the line that was commented out
-- ══════════════════════════════════════════════════════════════
-- 039_modern_social.sql:124-126 has the ALTER PUBLICATION commented out
-- with a note saying to run it by hand, so a fresh database yields a
-- chat whose subscription never fires. Put it in a real migration,
-- guarded so a re-paste is not an error.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime not found — realtime not enabled on this database.';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 10. THE BACKFILL — lossless, idempotent, re-runnable
-- ══════════════════════════════════════════════════════════════
-- Nothing below rewrites a message. Every statement either derives a
-- new row from existing data or fills a new column that was NULL.

-- ── 10a. Participants ────────────────────────────────────────
-- Roles come from the TRANSACTION where one exists (party_a = seller,
-- party_b = buyer — migration 099), which is the whole point: the
-- buyer_id column means "whoever clicked first" and inverts the labels
-- on any thread the seller opened.
--
-- Where NO transaction exists the thread is a plain conversation, so
-- both people are enrolled as 'member' with no role claimed at all.
-- That is the honest answer and it is why the inverted-label bug
-- disappears rather than being papered over: a thread with no deal in
-- it stops asserting that anyone is a buyer.

INSERT INTO conversation_participants (conversation_id, user_id, role, party, joined_at, last_read_at)
SELECT
  c.id,
  c.seller_id,
  CASE WHEN t.id IS NOT NULL AND t.party_a_id = c.seller_id THEN 'seller'
       WHEN t.id IS NOT NULL AND t.party_b_id = c.seller_id THEN 'buyer'
       ELSE 'member' END,
  CASE WHEN t.id IS NOT NULL AND t.party_a_id = c.seller_id THEN 'a'
       WHEN t.id IS NOT NULL AND t.party_b_id = c.seller_id THEN 'b'
       ELSE 'a' END,
  c.created_at,
  (SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = c.id AND m.sender_id <> c.seller_id AND m.is_read = true)
FROM conversations c
LEFT JOIN LATERAL (
  SELECT tx.id, tx.party_a_id, tx.party_b_id
  FROM transactions tx
  WHERE (tx.conversation_id = c.id
         OR tx.metadata ->> 'conversation_id' = c.id::text)
  ORDER BY tx.created_at DESC
  LIMIT 1
) t ON true
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO conversation_participants (conversation_id, user_id, role, party, joined_at, last_read_at)
SELECT
  c.id,
  c.buyer_id,
  CASE WHEN t.id IS NOT NULL AND t.party_a_id = c.buyer_id THEN 'seller'
       WHEN t.id IS NOT NULL AND t.party_b_id = c.buyer_id THEN 'buyer'
       ELSE 'member' END,
  CASE WHEN t.id IS NOT NULL AND t.party_a_id = c.buyer_id THEN 'a'
       WHEN t.id IS NOT NULL AND t.party_b_id = c.buyer_id THEN 'b'
       ELSE 'b' END,
  c.created_at,
  (SELECT MAX(m.created_at) FROM messages m
    WHERE m.conversation_id = c.id AND m.sender_id <> c.buyer_id AND m.is_read = true)
FROM conversations c
LEFT JOIN LATERAL (
  SELECT tx.id, tx.party_a_id, tx.party_b_id
  FROM transactions tx
  WHERE (tx.conversation_id = c.id
         OR tx.metadata ->> 'conversation_id' = c.id::text)
  ORDER BY tx.created_at DESC
  LIMIT 1
) t ON true
WHERE c.buyer_id <> c.seller_id
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- ── 10b. Photo messages become the kind they always were ─────
-- 009-era code stored a photo with the literal content "📷 Sent a photo".
-- Retype those rows WITHOUT touching their text, so nothing is lost and
-- the renderer stops needing to sniff a string.
UPDATE messages m
SET kind = 'photo'
WHERE m.kind = 'chat'
  AND EXISTS (SELECT 1 FROM media_attachments a WHERE a.message_id = m.id);

-- ── 10c. Last-message columns ────────────────────────────────
UPDATE conversations c
SET last_message_at      = lm.created_at,
    last_message_preview = left(regexp_replace(COALESCE(lm.content, ''), '\s+', ' ', 'g'), 140),
    last_message_kind    = lm.kind,
    last_message_sender  = lm.sender_id
FROM (
  SELECT DISTINCT ON (conversation_id)
         conversation_id, content, kind, sender_id, created_at
  FROM messages
  ORDER BY conversation_id, created_at DESC
) lm
WHERE lm.conversation_id = c.id
  AND c.last_message_at IS DISTINCT FROM lm.created_at;

-- A thread with no messages at all still needs to sort somewhere.
UPDATE conversations
SET last_message_at = created_at
WHERE last_message_at IS NULL;

-- ── 10d. Deal kind, where the thread already carries a deal ──
UPDATE conversations c
SET deal_kind = 'sale'
WHERE c.deal_kind IS NULL
  AND c.horse_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE (t.conversation_id = c.id OR t.metadata ->> 'conversation_id' = c.id::text)
      AND t.type = 'marketplace_sale'
  );


-- ══════════════════════════════════════════════════════════════
-- 11. COUNTER-OFFERS — the move the state machine never had
-- ══════════════════════════════════════════════════════════════
-- Today a seller can only accept or decline: "$300?" "no." End of
-- conversation, end of sale. Every other marketplace in this hobby's
-- adjacent world (eBay, Reverb) counters, and the absence is a real
-- loss of completed deals.
--
-- This is deliberately a SEPARATE function rather than a change to
-- respond_to_offer_atomic, which was only just repaired in 172 (its
-- decline path wrote a column that does not exist, so every decline
-- since 099 errored at the seller). That path stays byte-identical.
--
-- A counter does not create a second transaction — it moves the price
-- on the one that exists and records WHOSE offer is now standing, in
-- metadata.offer_from ('a' = seller's counter, 'b' = buyer's offer).
-- The side whose offer is standing cannot accept their own.

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
        UPDATE transactions
        SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;
        RETURN json_build_object('success', true, 'amount', v_txn.offer_amount);

    ELSIF p_move = 'decline' THEN
        IF v_from = v_side THEN
            RETURN json_build_object('success', false, 'error',
                'Retract your own offer rather than declining it.');
        END IF;
        UPDATE transactions SET status = 'cancelled' WHERE id = p_transaction_id;
        RETURN json_build_object('success', true);

    END IF;

    RETURN json_build_object('success', false, 'error', 'Invalid move');
END;
$$;

REVOKE ALL ON FUNCTION public.deal_offer_move_atomic(UUID, UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deal_offer_move_atomic(UUID, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

COMMENT ON FUNCTION public.deal_offer_move_atomic(UUID, UUID, TEXT, NUMERIC, TEXT) IS
  'Counter-offers, row-locked. Either party may counter while status is offer_made; metadata.offer_from records whose offer is standing so nobody can accept their own. respond_to_offer_atomic (the seller''s plain accept/decline) is untouched.';


-- ══════════════════════════════════════════════════════════════
-- Migration 173 complete.
--
-- messages                  + kind, payload, edited_at, deleted_at,
--                             kind CHECK, length CHECK, 3 indexes,
--                             a guard trigger, a block guard, and a
--                             last-message trigger
-- conversation_participants   NEW — role, party, last_read_at, muted,
--                             archived; RLS + guard trigger; backfilled
--                             from the transaction, not from who
--                             clicked first
-- conversations             + last_message_* (4), deal_terms, deal_kind,
--                             commission_id, dispute columns, an index
--                             on last_message_at, a guard trigger that
--                             freezes agreed terms
-- payment_installments        NEW — the time-payment ledger; RLS + a
--                             guard trigger that makes a confirmed
--                             receipt final
-- are_blocked()               NEW — answers "have these two blocked each
--                             other" in BOTH directions
-- media_select                narrowed from USING (true) to thread
--                             participants for DM attachments
-- realtime                    messages + notifications actually added to
--                             the publication
-- deal_offer_move_atomic()    NEW — counter-offers. respond_to_offer_atomic
--                             is deliberately untouched.
--
-- NOT changed, deliberately: the transactions status CHECK. A dispute
-- lives on the CONVERSATION (disputed_at), so the Safe-Trade state
-- graph in src/lib/commerce/stateMachine.ts — and the 172-era repairs
-- inside it — stay exactly as they are.
--
-- No column dropped. No message rewritten. buyer_id / seller_id stay
-- populated and every existing policy that reads them still works, so a
-- rollback is: stop reading the new columns.
--
-- Verify:
--   SELECT count(*) FROM conversation_participants;          -- ≈ 2 × conversations
--   SELECT kind, count(*) FROM messages GROUP BY kind;       -- chat + photo only
--   SELECT count(*) FROM conversations WHERE last_message_at IS NULL;  -- 0
--   SELECT public.are_blocked('<uuid>', '<uuid>');
--   -- and confirm the guard bites:
--   UPDATE messages SET content = 'x' WHERE id = '<someone else''s message>';
--   -- expect: ERROR  You cannot edit someone else's message.
--
-- Then: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
