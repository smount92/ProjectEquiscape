-- ══════════════════════════════════════════════════════════════
-- Migration 175: Object metrics — count the OBJECTS, not the people
--
-- ADDITIVE ONLY. Three new tables, four new functions, one existing
-- function (cleanup_system_garbage) replaced with the identical body
-- plus one purge statement. Nothing existing is dropped or rewritten.
-- Application code feature-detects all of it (src/lib/metrics/db.ts)
-- and shows "—" until this is pasted; the beacon route answers 204 and
-- writes nothing.
--
-- THE PRIVACY STANCE THIS SCHEMA ENFORCES, which the owner ratified:
-- there must be no queryable trail of what any particular member looked
-- at. Not "we promise not to query it" — no such table exists.
--
--   object_view_daily   PERMANENT. (entity_type, entity_id, day) →
--                       views, unique_viewers. Aggregate from birth.
--                       There is no viewer column and never will be.
--   site_activity_daily PERMANENT. One row per UTC day: member DAU,
--                       anon DAU, total views. The community pulse.
--   object_view_scratch EPHEMERAL. The ONLY per-viewer structure, and
--                       it holds a salted hash rather than a person.
--                       cleanup_system_garbage deletes every row from
--                       a previous UTC day on the 06:00 UTC cron, so
--                       its maximum lifetime is roughly 30 hours.
--                       Nothing else reads it, ever — RLS grants no
--                       SELECT to any role.
--
-- After the purge runs, the counts remain and the ability to ask "who
-- viewed this" is GONE, because the input that would answer it has
-- been deleted. That is the whole design.
--
-- Why unique_viewers needs the scratch at all: to say "14 different
-- people saw this horse today" you must remember, for the length of
-- that day, that you already counted someone. The hash is salted with
-- a secret AND the UTC date (see src/lib/metrics/hash.ts), so the same
-- person hashes differently tomorrow and two surviving rows could not
-- be stitched into a trail even if the purge were skipped.
--
-- KNOWN, ACCEPTED LIMITATION: a true weekly-unique (WAU) figure is not
-- computable under this design, because that would require keeping
-- viewer tokens for seven days. The admin console therefore reports a
-- DAU series and a 7-day member-day SUM, labelled as such rather than
-- passed off as WAU. Keeping the tokens is the thing we refuse to do.
--
-- Set METRICS_VIEWER_SALT in the deployment env before pasting. Without
-- it the counts are still correct, but the daily salt falls back to a
-- build constant — see the honest note in src/lib/metrics/hash.ts.
-- ══════════════════════════════════════════════════════════════

-- ── 1. The permanent record: one row per object per UTC day ──

CREATE TABLE IF NOT EXISTS object_view_daily (
  entity_type     TEXT NOT NULL
    CHECK (entity_type IN ('horse', 'listing', 'show', 'barn', 'studio', 'reference', 'profile')),
  entity_id       TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 64),
  day             DATE NOT NULL,
  views           INTEGER NOT NULL DEFAULT 0,
  unique_viewers  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_type, entity_id, day)
);

COMMENT ON TABLE object_view_daily IS
  'How much attention each object got, per UTC day. Aggregate from the moment it is written — there is no viewer column, so "what did member X look at" is not a question this table can answer. Kept indefinitely: a row is three keys and two integers, and a horse''s view history is the seller''s record, not a person''s. Pruning stance if it ever matters: rows older than two years could be collapsed into a monthly rollup with no privacy consequence either way.';
COMMENT ON COLUMN object_view_daily.entity_id IS
  'TEXT so one table serves uuid-keyed horses/shows/barns/profiles and any future non-uuid key. Opaque here; the allow-list lives in the CHECK above and in src/lib/metrics/entities.ts.';
COMMENT ON COLUMN object_view_daily.unique_viewers IS
  'Distinct viewers that UTC day, computed through object_view_scratch and best-effort for anonymous visitors (one household behind one NAT reads as one viewer). Never sum this across days and call it WAU — see the migration header.';

CREATE INDEX IF NOT EXISTS idx_object_view_daily_day
  ON object_view_daily (day DESC, entity_type);

ALTER TABLE object_view_daily ENABLE ROW LEVEL SECURITY;

-- No policy is defined, deliberately. Members reach their own horses'
-- numbers through get_horse_view_stats() and the admin reads through
-- the service role, which bypasses RLS. Direct SELECT by anon or
-- authenticated returns zero rows; direct INSERT is impossible, which
-- is what keeps the counters honest.
REVOKE ALL ON TABLE object_view_daily FROM anon, authenticated;

-- ── 2. The community pulse: one row per UTC day ──

CREATE TABLE IF NOT EXISTS site_activity_daily (
  day         DATE PRIMARY KEY,
  member_dau  INTEGER NOT NULL DEFAULT 0,
  anon_dau    INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE site_activity_daily IS
  'Daily active viewers, counted at beacon time rather than at login — someone who reads the Show Ring all evening without clicking anything is active, and a login count would miss them. Aggregate only.';
COMMENT ON COLUMN site_activity_daily.member_dau IS
  'Distinct signed-in members who loaded a tracked page that UTC day. Exact, because members dedupe on user id.';
COMMENT ON COLUMN site_activity_daily.anon_dau IS
  'Distinct anonymous visitors, deduped best-effort on IP + user agent. Undercounts shared networks, overcounts phones that change IP. Directionally useful, not a headcount.';

ALTER TABLE site_activity_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE site_activity_daily FROM anon, authenticated;

-- ── 3. The scratch: hashed, salted, and purged nightly ──

CREATE TABLE IF NOT EXISTS object_view_scratch (
  viewer_hash  TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  day          DATE NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (viewer_hash, entity_type, entity_id, day)
);

COMMENT ON TABLE object_view_scratch IS
  'Working memory for the unique_viewers count, and the only per-viewer structure in the schema. viewer_hash is sha256(daily_salt || key) where key is the user id or IP+UA and daily_salt derives from METRICS_VIEWER_SALT and the UTC date — so it identifies nobody without that secret, and identifies a DIFFERENT string tomorrow. cleanup_system_garbage deletes every row from a past day, making the maximum lifetime one cron interval. No role holds SELECT on this table; the RPC that writes it is the only reader.';
COMMENT ON COLUMN object_view_scratch.entity_type IS
  'The allow-listed entity types, plus the reserved sentinel ''_site'' used for the site-wide DAU dedupe. No CHECK here on purpose: the permanent table carries the constraint, and this one is emptied nightly.';
COMMENT ON COLUMN object_view_scratch.hits IS
  'Views by this viewer of this object today. Past the cap in record_object_view (10) the rollup stops incrementing while this keeps climbing, so no single reader can inflate a number a seller will see.';

CREATE INDEX IF NOT EXISTS idx_object_view_scratch_day
  ON object_view_scratch (day);

ALTER TABLE object_view_scratch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE object_view_scratch FROM anon, authenticated;

-- ── 4. The write path: one atomic RPC, called by the beacon route ──

CREATE OR REPLACE FUNCTION public.record_object_view(
    p_entity_types TEXT[],
    p_entity_id    TEXT,
    p_viewer_hash  TEXT,
    p_is_member    BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Everything is a UTC calendar day, everywhere, so that a rollup
    -- means the same thing to the seller, the admin and the tests.
    v_day       DATE := (now() AT TIME ZONE 'utc')::date;
    v_cap       CONSTANT INTEGER := 10;
    v_types     TEXT[];
    v_type      TEXT;
    v_hits      INTEGER;
    v_first     BOOLEAN;
    v_counted   BOOLEAN := FALSE;
BEGIN
    -- Validate, do not raise. This function is on a fire-and-forget
    -- path: junk in must mean "nothing happened", never a 500 that a
    -- caller might retry.
    IF p_viewer_hash IS NULL OR length(p_viewer_hash) NOT BETWEEN 16 AND 64 THEN
        RETURN FALSE;
    END IF;
    IF p_entity_id IS NULL OR length(p_entity_id) NOT BETWEEN 1 AND 64 THEN
        RETURN FALSE;
    END IF;

    -- The allow-list, enforced a second time. The route handler checks
    -- it too; this is the copy that holds if anything ever calls the
    -- RPC directly. At most two types per call (a for-sale horse
    -- reached from the market counts as both 'horse' and 'listing').
    SELECT array_agg(DISTINCT s.t)
      INTO v_types
      FROM unnest(COALESCE(p_entity_types, ARRAY[]::TEXT[])) AS s(t)
     WHERE s.t IN ('horse', 'listing', 'show', 'barn', 'studio', 'reference', 'profile');

    IF v_types IS NULL OR array_length(v_types, 1) IS NULL OR array_length(v_types, 1) > 2 THEN
        RETURN FALSE;
    END IF;

    FOREACH v_type IN ARRAY v_types LOOP
        -- The scratch row decides "first view today?" atomically. An
        -- INSERT that survives is the first; a conflict is a repeat.
        INSERT INTO object_view_scratch (viewer_hash, entity_type, entity_id, day, hits)
        VALUES (p_viewer_hash, v_type, p_entity_id, v_day, 1)
        ON CONFLICT (viewer_hash, entity_type, entity_id, day) DO UPDATE
            SET hits = object_view_scratch.hits + 1
        RETURNING hits INTO v_hits;

        v_first := (v_hits = 1);

        -- Past the cap the reader is refreshing, not looking. Their
        -- scratch row keeps counting so the cap stays enforced; the
        -- permanent rollup stops moving.
        CONTINUE WHEN v_hits > v_cap;

        INSERT INTO object_view_daily (entity_type, entity_id, day, views, unique_viewers)
        VALUES (v_type, p_entity_id, v_day, 1, CASE WHEN v_first THEN 1 ELSE 0 END)
        ON CONFLICT (entity_type, entity_id, day) DO UPDATE
            SET views          = object_view_daily.views + 1,
                unique_viewers = object_view_daily.unique_viewers
                                 + CASE WHEN v_first THEN 1 ELSE 0 END;

        v_counted := TRUE;
    END LOOP;

    IF NOT v_counted THEN
        RETURN FALSE;
    END IF;

    -- Site-wide activity, deduped through the same scratch table under
    -- a reserved sentinel key so there is exactly one mechanism to
    -- purge. Counted once per call, not once per entity type.
    INSERT INTO object_view_scratch (viewer_hash, entity_type, entity_id, day, hits)
    VALUES (p_viewer_hash, '_site', '_site', v_day, 1)
    ON CONFLICT (viewer_hash, entity_type, entity_id, day) DO UPDATE
        SET hits = object_view_scratch.hits + 1
    RETURNING hits INTO v_hits;

    v_first := (v_hits = 1);

    INSERT INTO site_activity_daily (day, member_dau, anon_dau, views)
    VALUES (
        v_day,
        CASE WHEN v_first AND p_is_member THEN 1 ELSE 0 END,
        CASE WHEN v_first AND NOT p_is_member THEN 1 ELSE 0 END,
        1
    )
    ON CONFLICT (day) DO UPDATE
        SET member_dau = site_activity_daily.member_dau
                         + CASE WHEN v_first AND p_is_member THEN 1 ELSE 0 END,
            anon_dau   = site_activity_daily.anon_dau
                         + CASE WHEN v_first AND NOT p_is_member THEN 1 ELSE 0 END,
            views      = site_activity_daily.views + 1;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.record_object_view(TEXT[], TEXT, TEXT, BOOLEAN) IS
  'The only way a view counter ever moves. SECURITY DEFINER because no role holds INSERT on the rollup tables — a public INSERT policy would let anyone type any number into a seller''s view count. Takes a pre-hashed viewer token, never an id or an IP: the salting happens in the route handler (src/lib/metrics/hash.ts) so the database never sees who. Validates the entity allow-list itself, caps one viewer at 10 counted views of one object per UTC day, and returns a boolean rather than raising, because the caller is a fire-and-forget beacon.';

REVOKE ALL ON FUNCTION public.record_object_view(TEXT[], TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_object_view(TEXT[], TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- ── 5. The seller's read: their own horse, and only their own ──

CREATE OR REPLACE FUNCTION public.get_horse_view_stats(p_horse_id UUID)
RETURNS TABLE (week_views INTEGER, week_viewers INTEGER, all_time_views INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day DATE := (now() AT TIME ZONE 'utc')::date;
BEGIN
    -- Not the owner → no rows, not an error. A 403 here would itself be
    -- a signal ("this horse exists and isn't yours"), and the caller
    -- renders nothing for an empty result anyway.
    IF NOT EXISTS (
        SELECT 1 FROM user_horses h
        WHERE h.id = p_horse_id AND h.owner_id = (SELECT auth.uid())
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(SUM(d.views) FILTER (WHERE d.day >= v_day - 6), 0)::INTEGER,
        COALESCE(SUM(d.unique_viewers) FILTER (WHERE d.day >= v_day - 6), 0)::INTEGER,
        COALESCE(SUM(d.views), 0)::INTEGER
    FROM object_view_daily d
    WHERE d.entity_id = p_horse_id::text
      AND d.entity_type IN ('horse', 'listing');
END;
$$;

COMMENT ON FUNCTION public.get_horse_view_stats(UUID) IS
  'The "👁 N views this week" line on the owner''s own stable page. SECURITY DEFINER because object_view_daily grants SELECT to nobody — this function IS the read policy, and it checks ownership before it counts. Sums the horse and listing rollups together so a for-sale horse''s attention is not split across two numbers. Returns no rows for a horse the caller does not own.';

REVOKE ALL ON FUNCTION public.get_horse_view_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_horse_view_stats(UUID) TO authenticated;

-- ── 6. The admin's reads: aggregate windows, service role only ──

CREATE OR REPLACE FUNCTION public.metrics_entity_totals(p_days INTEGER DEFAULT 7)
RETURNS TABLE (etype TEXT, total_views BIGINT, total_uniques BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.entity_type,
         SUM(d.views)::BIGINT,
         SUM(d.unique_viewers)::BIGINT
  FROM object_view_daily d
  WHERE d.day >= (now() AT TIME ZONE 'utc')::date - (GREATEST(COALESCE(p_days, 7), 1) - 1)
  GROUP BY d.entity_type
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.metrics_entity_totals(INTEGER) IS
  'Seven-day totals per entity type for the admin Insights tab. Aggregate over aggregates — there is nothing personal left to leak by this depth. Granted to service_role only.';

REVOKE ALL ON FUNCTION public.metrics_entity_totals(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metrics_entity_totals(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.metrics_top_objects(
    p_days     INTEGER DEFAULT 7,
    p_per_type INTEGER DEFAULT 5
)
RETURNS TABLE (etype TEXT, eid TEXT, total_views BIGINT, total_uniques BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH windowed AS (
    SELECT d.entity_type AS t,
           d.entity_id   AS i,
           SUM(d.views)::BIGINT          AS v,
           SUM(d.unique_viewers)::BIGINT AS u
    FROM object_view_daily d
    WHERE d.day >= (now() AT TIME ZONE 'utc')::date - (GREATEST(COALESCE(p_days, 7), 1) - 1)
    GROUP BY d.entity_type, d.entity_id
  ), ranked AS (
    SELECT w.t, w.i, w.v, w.u,
           row_number() OVER (PARTITION BY w.t ORDER BY w.v DESC, w.i) AS rn
    FROM windowed w
  )
  SELECT r.t, r.i, r.v, r.u
  FROM ranked r
  WHERE r.rn <= GREATEST(LEAST(COALESCE(p_per_type, 5), 25), 1)
  ORDER BY r.t, r.v DESC;
$$;

COMMENT ON FUNCTION public.metrics_top_objects(INTEGER, INTEGER) IS
  'Most-viewed objects of the window, top N per entity type, for the admin Insights tab. Returns ids only — the console resolves names in one batched read per type, so this function stays a pure count. Granted to service_role only; these leaderboards are deliberately never public, because a visible view count turns a hobby into a scoreboard.';

REVOKE ALL ON FUNCTION public.metrics_top_objects(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.metrics_top_objects(INTEGER, INTEGER) TO service_role;

-- ── 7. The purge, folded into the existing nightly GC ──
--
-- Identical to the definition installed by 092, plus block 3. The cron
-- that calls it (/api/cron/refresh-market, 06:00 UTC daily — see
-- vercel.json) needs no change: the extra key rides out in the same
-- JSONB the route already returns as `gc`.

CREATE OR REPLACE FUNCTION public.cleanup_system_garbage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    deleted_notifications INT;
    cancelled_offers INT;
    purged_view_scratch INT;
BEGIN
    DELETE FROM public.notifications
    WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

    UPDATE public.transactions
    SET status = 'cancelled', metadata = COALESCE(metadata, '{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
    WHERE status = 'offer_made'
      AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cancelled_offers = ROW_COUNT;

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

-- ══════════════════════════════════════════════════════════════
-- Migration 175 complete.
--
-- object_view_daily     permanent aggregate, no viewer column
-- site_activity_daily   permanent aggregate, one row per UTC day
-- object_view_scratch   hashed + daily-salted, purged by the 06:00 cron
-- record_object_view    the only writer; anon + authenticated EXECUTE
-- get_horse_view_stats  owner-checked seller read; authenticated EXECUTE
-- metrics_entity_totals \ admin windows; service_role EXECUTE only
-- metrics_top_objects   /
-- cleanup_system_garbage  same body, one purge added
--
-- No table dropped, no row rewritten. Re-runnable: every statement is
-- IF NOT EXISTS or CREATE OR REPLACE.
--
-- After applying: run `npm run gen-types`. Until then the app calls
-- these through the untyped client in src/lib/metrics/db.ts and
-- degrades to "—" on 42P01 / 42883 / PGRST202.
--
-- Verify:
--   1. Load a public passport signed out, then reload it. Expect
--        SELECT views, unique_viewers FROM object_view_daily
--         WHERE entity_type='horse' AND entity_id='<horse>'
--           AND day = (now() AT TIME ZONE 'utc')::date;
--      → views 2, unique_viewers 1.
--   2. Reload it fifteen times. views stops at 10; hits keeps climbing:
--        SELECT hits FROM object_view_scratch WHERE entity_id='<horse>';
--   3. Confirm nobody can read the scratch or write a counter:
--        SET LOCAL role authenticated;
--        SELECT count(*) FROM object_view_scratch;   -- 0 rows, RLS
--        INSERT INTO object_view_daily VALUES (...); -- permission denied
--   4. Run the purge and confirm yesterday is gone but the counts stay:
--        SELECT public.cleanup_system_garbage();
--        → purged_view_scratch > 0, object_view_daily unchanged.
-- ══════════════════════════════════════════════════════════════
