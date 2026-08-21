-- ============================================================
-- Migration 170: Art Studio rebuild
--
-- ADDITIVE ONLY. Every existing artist_profiles / commissions /
-- commission_updates row stays valid and readable; no column is
-- dropped, no data is rewritten. Application code feature-detects
-- these columns and degrades to v1 behaviour until this is applied.
--
-- Design rationale: docs/studio/COMMISSION_RESEARCH.md
--
-- Fixes three silent-failure bugs found in the audit (research doc
-- section 4.1), all of them RLS gaps that let writes return success
-- while affecting zero rows:
--   1. the commissioner could never update their own commission,
--      so approving the work was a no-op;
--   2. the artist could never stamp finishing_artist on a horse
--      they do not own, so the verified-artist badge never landed;
--   3. customization_logs could never be joined back to the artist,
--      so provenance pointed nowhere.
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. ARTIST PROFILES — structured terms, services, waitlist
-- ══════════════════════════════════════════════════════════════
-- v1 had terms_text (a prose blob) and one price_range for the whole
-- studio. Neither can be compared across artists, surfaced at the
-- moment of decision, or frozen onto an agreement. terms_text is
-- KEPT and shown as a free-text addendum.

ALTER TABLE artist_profiles
  -- Structured terms. Defaults follow the norms in the research doc:
  -- 50% deposit, 2 revisions, 50% kill fee, no rush orders.
  ADD COLUMN IF NOT EXISTS deposit_percent SMALLINT
    CHECK (deposit_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS deposit_refundable_before_start BOOLEAN,
  ADD COLUMN IF NOT EXISTS revisions_included SMALLINT
    CHECK (revisions_included BETWEEN 0 AND 20),
  ADD COLUMN IF NOT EXISTS extra_revision_fee NUMERIC(10,2)
    CHECK (extra_revision_fee IS NULL OR extra_revision_fee >= 0),
  ADD COLUMN IF NOT EXISTS kill_fee_percent SMALLINT
    CHECK (kill_fee_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS accepts_rush BOOLEAN,
  ADD COLUMN IF NOT EXISTS client_ships_model BOOLEAN,
  ADD COLUMN IF NOT EXISTS shipping_note TEXT,
  ADD COLUMN IF NOT EXISTS terms_updated_at TIMESTAMPTZ,
  -- Services: [{id, type, scale, priceMin, priceMax, note, open}].
  -- Per-scale pricing, because "Stablemate $150-350, Traditional
  -- $500-1200, prep separate" is how this hobby actually quotes.
  ADD COLUMN IF NOT EXISTS services JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Slots are for capacity and transparency, NOT reservation: a full
  -- bench flips an open studio to waitlist rather than refusing
  -- requests, so the artist keeps the demand signal.
  ADD COLUMN IF NOT EXISTS waitlist_open BOOLEAN NOT NULL DEFAULT true,
  -- Announcement strip on the studio page ("slots open Sept 1").
  ADD COLUMN IF NOT EXISTS status_note TEXT;

COMMENT ON COLUMN artist_profiles.services IS
  'Array of {id,type,scale,priceMin,priceMax,note,open}. Per-scale price ranges; the studio-wide range is derived from these, never stored separately.';
COMMENT ON COLUMN artist_profiles.kill_fee_percent IS
  'Share of the agreed price owed if the commissioner cancels mid-work. Display only — no money is processed on this platform.';

-- Backfill the structured terms from what v1 already knew, so an
-- existing studio does not read as "no terms" the moment this lands.
UPDATE artist_profiles SET
  deposit_percent = COALESCE(deposit_percent, 50),
  deposit_refundable_before_start = COALESCE(deposit_refundable_before_start, true),
  revisions_included = COALESCE(revisions_included, 2),
  kill_fee_percent = COALESCE(kill_fee_percent, 50),
  accepts_rush = COALESCE(accepts_rush, false),
  client_ships_model = COALESCE(client_ships_model, true)
WHERE deposit_percent IS NULL
   OR deposit_refundable_before_start IS NULL
   OR revisions_included IS NULL
   OR kill_fee_percent IS NULL
   OR accepts_rush IS NULL
   OR client_ships_model IS NULL;

-- Seed one service per studio from the old flat price range + the
-- first specialty, so nobody's page goes blank. Only for studios that
-- have no services yet and did publish a range.
UPDATE artist_profiles SET services = jsonb_build_array(
  jsonb_build_object(
    'id', 'seed-1',
    'type', COALESCE(specialties[1], 'Finishwork (repaint)'),
    'scale', COALESCE(scales_offered[1], 'Any scale'),
    'priceMin', price_range_min,
    'priceMax', price_range_max,
    'note', NULL,
    'open', true
  )
)
WHERE services = '[]'::jsonb
  AND (price_range_min IS NOT NULL OR price_range_max IS NOT NULL);

-- The directory sorts open studios first and filters by service type.
CREATE INDEX IF NOT EXISTS idx_artist_profiles_visible_status
  ON artist_profiles (status, updated_at DESC)
  WHERE portfolio_visible = true;
CREATE INDEX IF NOT EXISTS idx_artist_profiles_services
  ON artist_profiles USING gin (services);


-- ══════════════════════════════════════════════════════════════
-- 2. COMMISSIONS — the quote stage, the frozen agreement,
--    counted revisions, and honest logistics
-- ══════════════════════════════════════════════════════════════

ALTER TABLE commissions
  -- What the COMMISSIONER said they could spend. v1 wrote this into
  -- price_quoted, which meant the client set the artist's price.
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(10,2)
    CHECK (budget_amount IS NULL OR budget_amount >= 0),
  -- What the ARTIST quoted, and what was ultimately agreed. agreed_price
  -- is frozen at acceptance and never moves again (trigger below).
  ADD COLUMN IF NOT EXISTS agreed_price NUMERIC(10,2)
    CHECK (agreed_price IS NULL OR agreed_price >= 0),
  ADD COLUMN IF NOT EXISTS quote_note TEXT,
  -- The artist's terms AS THEY STOOD when the commissioner accepted.
  -- The artist may change their studio terms later; this agreement
  -- keeps the ones that were agreed. This is the dispute record.
  ADD COLUMN IF NOT EXISTS terms_snapshot JSONB,
  -- Which listed service this is, so price and scope line up.
  ADD COLUMN IF NOT EXISTS service_scale TEXT,
  -- Counted revisions. v1 had a `revision` status that nothing tallied,
  -- which is the commonest source of commission disputes.
  ADD COLUMN IF NOT EXISTS revisions_used SMALLINT NOT NULL DEFAULT 0
    CHECK (revisions_used >= 0),
  ADD COLUMN IF NOT EXISTS revisions_included SMALLINT
    CHECK (revisions_included IS NULL OR revisions_included >= 0),
  -- Logistics as a FLAG, not a status. v1 used one `shipping` status
  -- for both "client ships model to artist" and "artist ships finished
  -- horse back" — opposite directions, same state, unreadable queue.
  ADD COLUMN IF NOT EXISTS model_received BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS model_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_note TEXT,
  -- Waitlist intake: a full bench queues requests instead of refusing.
  ADD COLUMN IF NOT EXISTS is_waitlist BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_position INTEGER,
  -- Timestamped state history. Every transition gets its own stamp so
  -- the record reads as a ledger rather than a mutable row.
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  -- Declining and cancelling are normal, expected moves. Recording the
  -- reason is the etiquette every commission ToS assumes.
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS close_reason TEXT,
  -- Off-platform payment bookkeeping. NO MONEY IS PROCESSED HERE —
  -- these are the artist's own notes about what they were paid.
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_note TEXT,
  -- Whether the commissioner has filed the cost into the horse's vault.
  ADD COLUMN IF NOT EXISTS vault_recorded_at TIMESTAMPTZ;

COMMENT ON COLUMN commissions.terms_snapshot IS
  'The artist''s terms frozen at acceptance. Immutable once accepted_at is set (see trg_commissions_freeze_agreement).';
COMMENT ON COLUMN commissions.agreed_price IS
  'Display record of the agreed price. Payments are OFF-PLATFORM; nothing here settles money.';
COMMENT ON COLUMN commissions.model_received IS
  'The commissioner''s model has physically reached the artist. A flag, not a pipeline stage.';

-- Add the two new statuses. Every v1 value is preserved so existing
-- rows stay valid; the application normalises legacy values on read
-- (review -> awaiting_approval, revision -> in_progress, shipping ->
-- completed) and never writes them again.
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN (
    -- current pipeline
    'requested', 'quoted', 'accepted', 'in_progress',
    'awaiting_approval', 'completed', 'delivered',
    'declined', 'cancelled',
    -- legacy, read-only
    'review', 'revision', 'shipping'
  ));

CREATE INDEX IF NOT EXISTS idx_commissions_artist_board
  ON commissions (artist_id, status, last_update_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_income
  ON commissions (artist_id, completed_at DESC)
  WHERE status IN ('completed', 'delivered');


-- ══════════════════════════════════════════════════════════════
-- 3. COMMISSIONS RLS — let the commissioner act
-- ══════════════════════════════════════════════════════════════
-- AUDIT FIX 1. The only UPDATE policy was "Artist manages commissions"
-- (auth.uid() = artist_id). The commissioner's approval path passed the
-- application check and was then rejected by RLS: zero rows, no error,
-- action returned success. The commissioner's one meaningful action in
-- the entire flow was a no-op.
--
-- The state machine lives in the server action; this policy grants the
-- row, and the trigger below protects the fields that must not move.

DROP POLICY IF EXISTS "Client responds to commissions" ON commissions;
CREATE POLICY "Client responds to commissions" ON commissions
  FOR UPDATE TO authenticated
  USING (client_id = (SELECT auth.uid()))
  WITH CHECK (client_id = (SELECT auth.uid()));

-- The public queue policy listed only ('accepted','in_progress') while
-- the studio page queried for 'review' too, so anything awaiting
-- approval silently vanished from the queue. Restate it over the new
-- status set (legacy values included so old rows keep rendering).
DROP POLICY IF EXISTS "View commissions" ON commissions;
CREATE POLICY "View commissions" ON commissions
  FOR SELECT TO authenticated
  USING (
    artist_id = (SELECT auth.uid())
    OR client_id = (SELECT auth.uid())
    OR (is_public_in_queue = true AND status IN (
         'accepted', 'in_progress', 'awaiting_approval',
         'review', 'shipping', 'revision'
       ))
  );

-- ── The agreement is immutable once struck ────────────────────
-- Neither side may rewrite the price or the terms they agreed to, and
-- neither may change who the parties are. This is what makes the
-- record worth pointing at in a disagreement — and it means the broad
-- row-level UPDATE grants above cannot be abused to forge history.
CREATE OR REPLACE FUNCTION public.commissions_freeze_agreement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Parties never change.
  IF NEW.artist_id IS DISTINCT FROM OLD.artist_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'The parties to a commission cannot be changed.';
  END IF;

  -- Once accepted, the agreed price and the frozen terms are settled.
  IF OLD.accepted_at IS NOT NULL THEN
    IF NEW.agreed_price IS DISTINCT FROM OLD.agreed_price THEN
      RAISE EXCEPTION 'The agreed price is fixed once the commission is accepted.';
    END IF;
    IF NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot THEN
      RAISE EXCEPTION 'The agreed terms are fixed once the commission is accepted.';
    END IF;
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      RAISE EXCEPTION 'The acceptance timestamp cannot be rewritten.';
    END IF;
  END IF;

  -- Revisions only ever count up.
  IF NEW.revisions_used < OLD.revisions_used THEN
    RAISE EXCEPTION 'Revision count cannot be reduced.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commissions_freeze_agreement ON commissions;
CREATE TRIGGER trg_commissions_freeze_agreement
  BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION public.commissions_freeze_agreement();


-- ══════════════════════════════════════════════════════════════
-- 4. CUSTOMIZATION LOGS — provenance that points somewhere
-- ══════════════════════════════════════════════════════════════
-- AUDIT FIX 3. The table carried only a free-text artist_alias, so a
-- horse's customization record could never be joined back to the
-- artist who did the work. It fed the hoofprint view and nothing else.

ALTER TABLE customization_logs
  ADD COLUMN IF NOT EXISTS commission_id UUID
    REFERENCES commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS artist_user_id UUID
    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN customization_logs.artist_user_id IS
  'The platform account that did the work, when known. artist_alias remains the free-text credit for off-platform artists.';

CREATE INDEX IF NOT EXISTS idx_customization_logs_artist
  ON customization_logs (artist_user_id, date_completed DESC)
  WHERE artist_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customization_logs_commission
  ON customization_logs (commission_id)
  WHERE commission_id IS NOT NULL;

-- One log per commission — the delivery hook is best-effort and may be
-- retried, and a horse should not collect duplicate provenance rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customization_logs_commission_unique
  ON customization_logs (commission_id)
  WHERE commission_id IS NOT NULL;

-- The artist can read back their own work record even if the horse
-- later goes private. They did the work and already know it exists;
-- the existing owner/public SELECT legs are untouched.
DROP POLICY IF EXISTS "Artist views own customization logs" ON customization_logs;
CREATE POLICY "Artist views own customization logs"
  ON customization_logs FOR SELECT TO authenticated
  USING (artist_user_id = (SELECT auth.uid()));


-- ══════════════════════════════════════════════════════════════
-- 5. FINANCIAL VAULT — what the artistry cost
-- ══════════════════════════════════════════════════════════════
-- The owner asked for this specifically. purchase_price means "what I
-- paid to acquire this horse"; it is the wrong column for "what I paid
-- to have it painted". Conflating them would corrupt the Blue Book
-- comparisons and the insurance report. So: a separate line.
--
-- No RLS change needed. financial_vault is already owner-of-the-horse
-- only, and in this flow the commissioner IS the owner.

ALTER TABLE financial_vault
  ADD COLUMN IF NOT EXISTS commission_cost NUMERIC(10,2)
    CHECK (commission_cost IS NULL OR commission_cost >= 0),
  ADD COLUMN IF NOT EXISTS commission_notes TEXT;

COMMENT ON COLUMN financial_vault.commission_cost IS
  'Total spent on commissioned work for this horse (prep, finishwork, tack). Separate from purchase_price so "what I paid for it" and "what I have invested in it" stay distinct.';


-- ══════════════════════════════════════════════════════════════
-- 6. THE VERIFIED ARTIST STAMP
-- ══════════════════════════════════════════════════════════════
-- AUDIT FIX 2. On delivery, v1 wrote finishing_artist and
-- finishing_artist_verified onto user_horses — a row the artist does
-- not own and has no RLS grant to update. Wrapped in try/catch and
-- logged. The single most valuable trust signal in the product has
-- been writing to /dev/null since migration 062.
--
-- Rather than widening the user_horses UPDATE policy (which would let
-- an artist touch any column on someone else's horse), this is a
-- narrow SECURITY DEFINER RPC: it sets exactly two columns, only for
-- a horse linked to a commission the caller completed as the artist.

CREATE OR REPLACE FUNCTION public.stamp_finishing_artist(p_commission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_horse_id UUID;
  v_alias    TEXT;
BEGIN
  -- The caller must be the artist on a finished commission that is
  -- actually linked to a horse. Anything else is a silent no-op.
  SELECT c.horse_id INTO v_horse_id
  FROM commissions c
  WHERE c.id = p_commission_id
    AND c.artist_id = (SELECT auth.uid())
    AND c.horse_id IS NOT NULL
    AND c.status IN ('completed', 'delivered');

  IF v_horse_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT u.alias_name INTO v_alias FROM users u WHERE u.id = (SELECT auth.uid());
  IF v_alias IS NULL THEN
    RETURN false;
  END IF;

  -- Exactly two columns. Nothing else on the horse is reachable here.
  UPDATE user_horses
  SET finishing_artist = v_alias,
      finishing_artist_verified = true
  WHERE id = v_horse_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_finishing_artist(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stamp_finishing_artist(UUID) TO authenticated;

COMMENT ON FUNCTION public.stamp_finishing_artist(UUID) IS
  'Credits the artist on the horse attached to a completed commission. SECURITY DEFINER because the artist does not own the horse row; scoped to exactly finishing_artist + finishing_artist_verified.';


-- ══════════════════════════════════════════════════════════════
-- 7. THE RECEIPTS WALL
-- ══════════════════════════════════════════════════════════════
-- The killer feature no other commission platform can build: an
-- artist's finished horses, WITH the ribbons those horses went on to
-- win. We own the show database; nobody else does.
--
-- A view rather than app-side joins, so the artist page is one query
-- and the counts cannot drift from the horse's own passport.
-- SECURITY INVOKER: the caller's RLS on user_horses decides what they
-- may see, so a private horse never leaks through the artist page.

CREATE OR REPLACE VIEW v_artist_finished_horses
WITH (security_invoker = true) AS
SELECT
  uh.id                          AS horse_id,
  uh.owner_id,
  uh.custom_name                 AS horse_name,
  uh.finishing_artist,
  uh.finishing_artist_verified,
  uh.is_public,
  uh.catalog_id,
  uh.created_at                  AS horse_created_at,
  cl.id                          AS log_id,
  cl.artist_user_id,
  cl.commission_id,
  cl.work_type,
  cl.date_completed,
  cl.image_urls,
  COALESCE(sr.show_count, 0)     AS show_count,
  COALESCE(sr.nan_qualifying, 0) AS nan_qualifying_count,
  sr.best_placing,
  sr.latest_show_date,
  COALESCE(ht.titles, ARRAY[]::TEXT[]) AS titles
FROM customization_logs cl
JOIN user_horses uh ON uh.id = cl.horse_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                   AS show_count,
    COUNT(*) FILTER (WHERE r.is_nan_qualifying)                AS nan_qualifying,
    MIN(NULLIF(regexp_replace(r."placing", '\D', '', 'g'), '')::INT) AS best_placing,
    MAX(r.show_date)                                           AS latest_show_date
  FROM show_records r
  WHERE r.horse_id = uh.id
) sr ON true
LEFT JOIN LATERAL (
  SELECT array_agg(t.title_code ORDER BY t.title_code) AS titles
  FROM horse_titles t
  WHERE t.horse_id = uh.id
) ht ON true
WHERE cl.artist_user_id IS NOT NULL;

COMMENT ON VIEW v_artist_finished_horses IS
  'An artist''s finished work with the competitive record each horse went on to earn. security_invoker: the viewer''s own RLS on user_horses gates visibility.';

GRANT SELECT ON v_artist_finished_horses TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 8. PUBLIC STUDIO PAGES
-- ══════════════════════════════════════════════════════════════
-- An artist's portfolio is the one URL they paste into a Facebook
-- group. In v1 both /studio and /studio/[slug] redirected to /login,
-- and artist_profiles' SELECT policy was TO authenticated, so it was
-- unreachable to a logged-out visitor at the database level.
--
-- Only studios that opted into portfolio_visible become anon-readable.

DROP POLICY IF EXISTS "Anyone can view artist profiles" ON artist_profiles;
CREATE POLICY "Anyone can view artist profiles"
  ON artist_profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Public views visible studios" ON artist_profiles;
CREATE POLICY "Public views visible studios"
  ON artist_profiles FOR SELECT TO anon
  USING (portfolio_visible = true);


-- ══════════════════════════════════════════════════════════════
-- 9. SLOT COUNTS FOR LOGGED-OUT VISITORS
-- ══════════════════════════════════════════════════════════════
-- Now that studio pages are public, "3 of 5 slots filled" has to be
-- true for a visitor with no account. It cannot be counted from
-- `commissions` directly: the public-queue SELECT leg is TO
-- authenticated, and widening it would expose descriptions and prices
-- to anyone. So: an RPC that returns nothing but the number.
--
-- Bulk-shaped because the directory needs a count for every studio on
-- the page and N round-trips is not a plan.

CREATE OR REPLACE FUNCTION public.studio_slot_usage(p_artist_ids UUID[])
RETURNS TABLE (artist_id UUID, slots_used BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.artist_id, COUNT(*)::BIGINT
  FROM commissions c
  WHERE c.artist_id = ANY(p_artist_ids)
    AND c.status IN (
      'accepted', 'in_progress', 'awaiting_approval',
      -- legacy statuses still occupy a slot
      'review', 'revision', 'shipping'
    )
  GROUP BY c.artist_id;
$$;

REVOKE ALL ON FUNCTION public.studio_slot_usage(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_slot_usage(UUID[]) TO authenticated, anon;

COMMENT ON FUNCTION public.studio_slot_usage(UUID[]) IS
  'How full each artist''s bench is. SECURITY DEFINER so logged-out visitors get an accurate slot count without any commission row becoming readable.';


-- ============================================================
-- Migration 170 complete.
--
-- artist_profiles  + structured terms, services jsonb, waitlist,
--                    status note; anon SELECT for visible studios
-- commissions      + quote stage, frozen agreement, counted
--                    revisions, logistics flags, state timestamps,
--                    off-platform payment notes; client UPDATE
--                    policy; immutability trigger
-- customization_logs + commission_id, artist_user_id, created_at;
--                    artist SELECT policy; one log per commission
-- financial_vault  + commission_cost, commission_notes
-- new: stamp_finishing_artist() RPC, v_artist_finished_horses view
--
-- No column dropped. No row rewritten except the terms backfill and
-- the one-service seed, both idempotent and guarded.
-- ============================================================
