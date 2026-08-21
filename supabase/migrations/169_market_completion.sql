-- ══════════════════════════════════════════════════════════════
-- Migration 169: MARKET COMPLETION
--
-- Four fixes, all of the same shape: a public surface that cannot
-- read something it is supposed to show, because the read path was
-- never built or was built against a value that does not exist.
--
--   1. get_market_listings() / get_market_listings_total()
--      The anon read path for the /market browse. Replaces the
--      service-role stopgap documented in src/app/market/listings.ts:
--      logged-out browsing currently goes through the admin client
--      with the anon RLS arm replicated by hand, because a listing
--      card needs the seller's alias (users is authenticated-only,
--      022) and the horse's show record (show_records is
--      authenticated-only, 022/027). This is the endorsed follow-up
--      — one anon-granted SECURITY DEFINER RPC in the style of 132's
--      get_catalog_listings, returning EXACTLY the public-safe
--      columns the page already renders.
--
--   2. mv_trusted_sellers, which has never had a single row.
--      Diagnosis below.
--
--   3. get_public_favorite_count()
--      horse_favorites is authenticated-only (010), so the anon
--      passport cannot render its "♥ N favorites" chip. One
--      visibility-guarded aggregate, anon-granted.
--
--   4. discover_users_view + suspended accounts
--      users.is_suspended (148) was never added to the column-level
--      SELECT grants, so no client can filter on it. Fixed in the
--      view the Members directory already reads.
--
-- ── The mv_trusted_sellers bug (audit finding M4) ──
-- 101_trusted_sellers.sql joins:
--       INNER JOIN horse_transfers ht
--         ON ht.sender_id = u.id AND ht.status = 'completed'
-- but horse_transfers.status is constrained (018_hoofprint.sql:180) to
--       CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled'))
-- and every claim path in the codebase writes 'claimed'
-- (035/036/038/050/056/064/092 all: SET status = 'claimed').
-- 'completed' is therefore a value the column can never hold: the
-- INNER JOIN eliminates every user, the view is permanently empty,
-- the daily /api/cron/refresh-market job refreshes nothing, and
-- TrustedBadge — wired into the market card, the profile and the
-- passport — has never rendered for anybody. The whole
-- "Community Trusted" trust signal has been dead since 101 shipped.
--
-- Fixed below by rebuilding the view against 'claimed'. Two smaller
-- corrections come along for the ride:
--   * the old shape INNER JOINed transfers and LEFT JOINed reviews in
--     one GROUP BY, producing an N×M cartesian the COUNT(DISTINCT)s
--     had to defend against. The two aggregates are now independent
--     LATERALs — same thresholds, no cross-multiplication, and
--     `review_count` is now a plain COUNT rather than COUNT(DISTINCT)
--     over duplicated rows.
--   * a transfer whose claimant is the sender no longer counts toward
--     "distinct buyers" (self-dealing can't manufacture the badge).
-- Thresholds are UNCHANGED (60-day account, 5 distinct buyers, 3+
-- reviews averaging 4.8) — this migration fixes the plumbing, not
-- the product rule.
--
-- Everything here is additive and re-runnable. The app feature-detects
-- both functions: until this file is pasted the market falls back to
-- its current path and nothing regresses.
-- After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. mv_trusted_sellers — rebuilt so it can populate
-- ══════════════════════════════════════════════════════════════
-- A materialized view's column list changes shape, so DROP/CREATE
-- rather than CREATE OR REPLACE (which Postgres does not offer for
-- matviews anyway). The unique index and the grants go with the drop
-- and are recreated below; is_trusted_seller() and
-- refresh_mv_trusted_sellers() (both plpgsql, late-bound) survive
-- untouched.

DROP MATERIALIZED VIEW IF EXISTS mv_trusted_sellers;

CREATE MATERIALIZED VIEW mv_trusted_sellers AS
SELECT
    u.id            AS user_id,
    u.alias_name,
    u.created_at    AS account_created,
    t.distinct_buyers,
    rv.avg_rating,
    rv.review_count
FROM users u
-- Completed hand-offs where this user was the SENDER. 'claimed' is
-- the terminal success state of a transfer (018 CHECK constraint);
-- 'completed' — what 101 asked for — is not a legal value.
CROSS JOIN LATERAL (
    SELECT COUNT(DISTINCT ht.claimed_by) AS distinct_buyers
    FROM horse_transfers ht
    WHERE ht.sender_id = u.id
      AND ht.status = 'claimed'
      AND ht.claimed_by IS NOT NULL
      AND ht.claimed_by <> u.id
) t
-- Reviews of this user as the trade counterparty.
CROSS JOIN LATERAL (
    SELECT COALESCE(AVG(r.stars), 0) AS avg_rating,
           COUNT(*)                  AS review_count
    FROM reviews r
    WHERE r.target_id = u.id
) rv
WHERE u.created_at < NOW() - INTERVAL '60 days'
  AND u.is_test_account IS NOT TRUE
  AND t.distinct_buyers >= 5
  AND rv.review_count   >= 3
  AND rv.avg_rating     >= 4.8
WITH DATA;

COMMENT ON MATERIALIZED VIEW mv_trusted_sellers IS
  'Algorithmic "Community Trusted" badge: 60+ day account, 5+ distinct transfer recipients, 3+ reviews averaging 4.8. Refreshed daily by /api/cron/refresh-market via refresh_mv_trusted_sellers(). Rebuilt in 169 — the 101 definition joined horse_transfers.status = ''completed'', a value the CHECK constraint forbids, so it was permanently empty.';

-- Required for REFRESH ... CONCURRENTLY (dropped with the view above).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trusted_sellers_user_id
    ON mv_trusted_sellers (user_id);

-- Grants from 101, restored verbatim.
GRANT SELECT ON mv_trusted_sellers TO authenticated, anon;

-- Helps the LATERAL above and the market RPC's trusted-seller probe.
CREATE INDEX IF NOT EXISTS idx_transfers_sender_claimed
    ON horse_transfers (sender_id, claimed_by)
    WHERE status = 'claimed';

-- NOTE — no refresh call here on purpose. CREATE ... WITH DATA above
-- already populates the view, and refresh_mv_trusted_sellers() runs
-- REFRESH ... CONCURRENTLY, which Postgres refuses inside a
-- transaction block — pasting this file into the SQL editor (one
-- implicit transaction) would abort the whole migration on the last
-- statement. The daily /api/cron/refresh-market job keeps it current
-- from here; to refresh by hand, run this on its own afterwards:
--     SELECT refresh_mv_trusted_sellers();

-- ══════════════════════════════════════════════════════════════
-- 2. get_market_listings — the anon browse
-- ══════════════════════════════════════════════════════════════
-- Mirrors src/lib/market/listingFilters.ts one-for-one: q, finish,
-- price band (min inclusive / max exclusive, matching findPriceBand),
-- has_records, trade, sort, limit, offset.
--
-- Invariants this function is responsible for, because a DEFINER
-- function answers with the OWNER's privileges and RLS never runs:
--   * visibility = 'public' ONLY. RLS also grants anon 'unlisted'
--     (150), but an unlisted horse is link-reachable BY DESIGN and
--     must never be enumerated in a browse — same rule 146 applies
--     to records.
--   * deleted_at IS NULL — tombstoned horses are gone.
--   * trade_status IN ('For Sale', 'Open to Offers') — the live
--     listing definition (LISTING_TRADE_STATUSES).
--   * Public-safe columns only. alias_name, never full_name, never
--     email, never owner vault fields. owner_id is returned because
--     the card already has it client-side (it is in every public
--     passport) and the caller needs it to key trust state.
--   * p_limit is CLAMPED to 50 and p_offset to 12 000, so a crafted
--     call can neither dump the table nor ask for a deep-offset scan.
--
-- The block list is deliberately NOT applied here: an anon viewer has
-- no block list, and an AUTHENTICATED viewer keeps reading through
-- their own RLS-scoped client precisely so theirs applies. This
-- function is the logged-out path.
--
-- Show records come back as a JSONB array of three public-safe fields
-- rather than pre-computed counts so summarizeShowRecords() in
-- src/lib/market/recordSummary.ts stays the ONE definition of what
-- counts as a championship / a verified tier — SQL re-implementing
-- that regex would drift from the card the moment either changed.

DO $$
DECLARE
  fn RECORD;
BEGIN
  -- Drop any earlier signature so a re-paste after a parameter change
  -- cannot leave two overloads behind (PostgREST would 300 on that).
  FOR fn IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('get_market_listings', 'get_market_listings_total')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || fn.sig;
  END LOOP;
END $$;

CREATE FUNCTION get_market_listings(
  p_q           TEXT    DEFAULT NULL,
  p_finish      TEXT    DEFAULT NULL,
  p_min_price   NUMERIC DEFAULT NULL,
  p_max_price   NUMERIC DEFAULT NULL,
  p_has_records BOOLEAN DEFAULT FALSE,
  p_trade       TEXT    DEFAULT NULL,
  p_sort        TEXT    DEFAULT 'newest',
  p_limit       INT     DEFAULT 24,
  p_offset      INT     DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  owner_id          UUID,
  custom_name       TEXT,
  finish_type       TEXT,
  condition_grade   TEXT,
  created_at        TIMESTAMPTZ,
  trade_status      TEXT,
  listing_price     NUMERIC,
  marketplace_notes TEXT,
  catalog_id        UUID,
  catalog_title     TEXT,
  catalog_maker     TEXT,
  catalog_scale     TEXT,
  owner_alias       TEXT,
  thumbnail_url     TEXT,
  is_trusted_seller BOOLEAN,
  records           JSONB,
  total_count       BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
WITH p AS (
  SELECT
    -- ILIKE metacharacters in user text are escaped, not honoured: a
    -- search for "50%" must not become a wildcard.
    NULLIF(
      replace(replace(replace(btrim(COALESCE(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_'),
      ''
    )                                                    AS q,
    NULLIF(btrim(COALESCE(p_finish, '')), '')            AS finish,
    NULLIF(btrim(COALESCE(p_trade,  '')), '')            AS trade,
    COALESCE(p_has_records, FALSE)                       AS has_records,
    COALESCE(NULLIF(btrim(COALESCE(p_sort, '')), ''), 'newest') AS sort,
    LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50)        AS lim,
    LEAST(GREATEST(COALESCE(p_offset, 0), 0), 12000)     AS off
),
matched AS (
  SELECT
    uh.id,
    uh.owner_id,
    uh.custom_name,
    uh.finish_type::TEXT AS finish_type,
    uh.condition_grade,
    uh.created_at,
    uh.trade_status,
    uh.listing_price,
    uh.marketplace_notes,
    uh.catalog_id,
    ci.title AS catalog_title,
    ci.maker AS catalog_maker,
    ci.scale AS catalog_scale,
    u.alias_name AS owner_alias,
    COUNT(*) OVER () AS total_count,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN p.sort = 'price_asc'  THEN uh.listing_price END ASC  NULLS LAST,
        CASE WHEN p.sort = 'price_desc' THEN uh.listing_price END DESC NULLS LAST,
        CASE WHEN p.sort NOT IN ('price_asc', 'price_desc') THEN uh.created_at END DESC NULLS LAST,
        uh.id
    ) AS rn
  FROM user_horses uh
  JOIN users u ON u.id = uh.owner_id
  LEFT JOIN catalog_items ci ON ci.id = uh.catalog_id
  CROSS JOIN p
  WHERE uh.visibility = 'public'
    AND uh.deleted_at IS NULL
    AND uh.trade_status IN ('For Sale', 'Open to Offers')
    AND (p.trade  IS NULL OR uh.trade_status      = p.trade)
    AND (p.finish IS NULL OR uh.finish_type::TEXT = p.finish)
    -- Band semantics from findPriceBand: min inclusive, max exclusive,
    -- and a listing with no asking price drops out of every band
    -- rather than being bucketed at zero.
    AND (p_min_price IS NULL OR uh.listing_price >= p_min_price)
    AND (p_max_price IS NULL OR uh.listing_price <  p_max_price)
    AND (
      NOT p.has_records
      OR EXISTS (SELECT 1 FROM show_records sr WHERE sr.horse_id = uh.id)
    )
    AND (
      p.q IS NULL
      OR uh.custom_name ILIKE '%' || p.q || '%' ESCAPE '\'
      OR uh.sculptor    ILIKE '%' || p.q || '%' ESCAPE '\'
      OR ci.title       ILIKE '%' || p.q || '%' ESCAPE '\'
      OR ci.maker       ILIKE '%' || p.q || '%' ESCAPE '\'
    )
)
SELECT
  m.id,
  m.owner_id,
  m.custom_name,
  m.finish_type,
  m.condition_grade,
  m.created_at,
  m.trade_status,
  m.listing_price,
  m.marketplace_notes,
  m.catalog_id,
  m.catalog_title,
  m.catalog_maker,
  m.catalog_scale,
  m.owner_alias,
  -- Collector-designated main shot, else the first photo — the same
  -- preference 131/137/147 encode and pickThumbnail() mirrors.
  COALESCE(
    (SELECT hi.image_url FROM horse_images hi
      WHERE hi.horse_id = m.id AND hi.angle_profile = 'Primary_Thumbnail'
      ORDER BY hi.sort_order, hi.id LIMIT 1),
    (SELECT hi.image_url FROM horse_images hi
      WHERE hi.horse_id = m.id
      ORDER BY hi.sort_order, hi.id LIMIT 1)
  ) AS thumbnail_url,
  EXISTS (SELECT 1 FROM mv_trusted_sellers ts WHERE ts.user_id = m.owner_id) AS is_trusted_seller,
  -- Three columns per record, best-dated first. Deliberately NOT
  -- truncated: the card's line is a COUNT ("6 placings · 2
  -- championships"), and a capped array would quietly understate a
  -- campaigner's career. Same volume the authed path already reads in
  -- fetchRecordSummaries, and no more fields than 146 publishes.
  (
    SELECT jsonb_agg(
             jsonb_build_object(
               'placing',           sr.placing,
               'ribbon_color',      sr.ribbon_color,
               'verification_tier', sr.verification_tier)
             ORDER BY sr.show_date DESC NULLS LAST)
    FROM show_records sr
    WHERE sr.horse_id = m.id
  ) AS records,
  m.total_count
FROM matched m, p
WHERE m.rn > p.off AND m.rn <= p.off + p.lim
ORDER BY m.rn;
$$;

COMMENT ON FUNCTION get_market_listings(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, INT, INT) IS
  'Anon-safe page of live marketplace listings (public + not deleted + For Sale/Open to Offers) with seller alias, catalog identity, thumbnail, trusted-seller flag, a JSONB show-record aggregate and a window total_count. Public-safe columns only; unlisted horses are never enumerated.';

REVOKE ALL ON FUNCTION get_market_listings(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_market_listings(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, INT, INT)
  TO anon, authenticated;

-- The masthead's headline number: live listings ignoring every filter.
-- Separate from the window count so a filtered page can still say
-- "N horses for sale" without a second full scan of the filtered CTE.
CREATE FUNCTION get_market_listings_total()
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::BIGINT
  FROM user_horses uh
  JOIN users u ON u.id = uh.owner_id
  WHERE uh.visibility = 'public'
    AND uh.deleted_at IS NULL
    AND uh.trade_status IN ('For Sale', 'Open to Offers');
$$;

COMMENT ON FUNCTION get_market_listings_total() IS
  'Count of live public marketplace listings, ignoring filters — the /market masthead headline. Same predicate as get_market_listings.';

REVOKE ALL ON FUNCTION get_market_listings_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_market_listings_total() TO anon, authenticated;

-- Keeps the browse off a seq scan as listings grow. Partial on the
-- exact live-listing predicate; ordered for the default "newest" sort.
CREATE INDEX IF NOT EXISTS idx_user_horses_market_live
  ON user_horses (created_at DESC)
  WHERE visibility = 'public'
    AND deleted_at IS NULL
    AND trade_status IN ('For Sale', 'Open to Offers');

-- ══════════════════════════════════════════════════════════════
-- 3. get_public_favorite_count — the anon passport's ♥ chip
-- ══════════════════════════════════════════════════════════════
-- horse_favorites has been authenticated-only since 010 ("Anyone can
-- view favorites" is FOR SELECT TO authenticated), so the logged-out
-- passport — the page a prospective buyer actually lands on — could
-- not render the "♥ N favorites" social-proof chip at all. Same
-- shape as every other anon read on this platform: one horse id in,
-- one aggregate out, guarded server-side.
--
-- visibility = 'public' ONLY, matching 141/146: a private or unlisted
-- horse returns 0, which is indistinguishable from a public horse
-- nobody has favorited, so the function cannot be used to probe for
-- the existence of a hidden horse. No user ids ever leave — a COUNT
-- says how many, never who.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'get_public_favorite_count'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || fn.sig;
  END LOOP;
END $$;

CREATE FUNCTION get_public_favorite_count(p_horse_id UUID)
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER
  FROM horse_favorites hf
  JOIN user_horses uh ON uh.id = hf.horse_id
  WHERE hf.horse_id = p_horse_id
    AND uh.visibility = 'public'
    AND uh.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION get_public_favorite_count(UUID) IS
  'How many collectors have favorited a PUBLIC horse — the anon passport''s ♥ chip. Returns 0 for private, unlisted, deleted or nonexistent horses alike, so it cannot probe for hidden horses. Aggregate only: never reveals who.';

REVOKE ALL ON FUNCTION get_public_favorite_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_favorite_count(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 4. discover_users_view — suspended accounts leave the directory
-- ══════════════════════════════════════════════════════════════
-- users.is_suspended arrived in 148, but the column-level
-- GRANT SELECT lists on public.users (133, extended in 142) were
-- never widened to include it. A client therefore cannot select it
-- and cannot filter on it either — PostgREST needs the grant for a
-- WHERE clause just as much as for a projection — so the Members
-- directory has no way to hide a suspended account from /discover
-- no matter how it writes the query. A suspended troll stays listed
-- in the front-door member browse.
--
-- The right place to fix it is the source, not the caller: the view
-- already exists precisely so the directory doesn't touch `users`
-- directly, and it already drops inactive and test accounts. One
-- more predicate joins them. IS NOT TRUE rather than = false so a
-- NULL (pre-148 rows, or a future nullable redefinition) still reads
-- as "not suspended".
--
-- Column list UNCHANGED — the directory depends on every column
-- including public_horse_count, and CREATE OR REPLACE VIEW would
-- reject a change anyway. security_invoker and the existing grants
-- (anon, authenticated — 092) survive a replace untouched.
--
-- Guarded: if 148 has not been applied there is no is_suspended
-- column to filter on, and the view is left exactly as it is.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'is_suspended'
  ) THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW discover_users_view
      WITH (security_invoker = true) AS
      SELECT
          u.id,
          u.alias_name,
          u.created_at,
          u.avatar_url,
          u.bio,
          count_user_horses_public(u.id) as public_horse_count,
          COALESCE((SELECT avg(stars) FROM reviews r WHERE r.target_id = u.id), 0) as avg_rating,
          (SELECT count(*) FROM reviews r WHERE r.target_id = u.id) as rating_count,
          EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id = u.id) as has_studio,
          count_user_horses_total(u.id) as total_horse_count
      FROM users u
      WHERE u.account_status = 'active'
        AND u.is_test_account = false
        AND u.is_suspended IS NOT TRUE
    $view$;
  ELSE
    RAISE NOTICE 'users.is_suspended not present (migration 148 not applied) — discover_users_view left unchanged.';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 169 Complete.
--   * mv_trusted_sellers can populate for the first time
--     ('completed' → 'claimed'); TrustedBadge goes live.
--   * get_market_listings() / get_market_listings_total() give
--     /market a real anonymous read path — the service-role stopgap
--     in src/app/market/listings.ts becomes the fallback, not the
--     primary.
--   * get_public_favorite_count() lets the logged-out passport show
--     its ♥ chip (horse_favorites is authenticated-only, 010).
--   * discover_users_view now excludes suspended accounts, which no
--     client could do for itself (users.is_suspended was never added
--     to the column-level SELECT grants).
-- Verify:
--   SELECT count(*) FROM mv_trusted_sellers;              -- may still be 0 if nobody qualifies yet
--   SELECT user_id, distinct_buyers, review_count, avg_rating FROM mv_trusted_sellers;
--   SELECT id, custom_name, owner_alias, total_count FROM get_market_listings();
--   SELECT get_market_listings_total();
--   SELECT get_public_favorite_count('<a public horse id>');
--   SELECT count(*) FROM discover_users_view;             -- suspended accounts gone
-- Then: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
