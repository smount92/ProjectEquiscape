-- ══════════════════════════════════════════════════════════════
-- Migration 181: Two missing indexes for real hot-path queries
--
-- ADDITIVE ONLY. Two CREATE INDEX statements. Nothing is dropped,
-- rewritten, or renamed; no table, column, function, policy or grant
-- changes. Application code needs NO feature detection for an index —
-- every query below already runs today and simply gets a cheaper plan
-- once this is pasted.
--
-- After applying: no `npm run gen-types` needed (no schema surface
-- changes).
--
-- LOCKING NOTE: plain CREATE INDEX takes a SHARE lock, which blocks
-- writes to the table while it builds. Both indexes here are small
-- partials over tables in the low thousands of rows, so the build is
-- sub-second. If the herd or the feed has grown enough that even that
-- is unwelcome, run each statement on its own with CONCURRENTLY
-- instead — but CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block, so it must be issued as a single standalone
-- statement, not as part of this script.
-- ══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════
-- (a) The pinned-announcement probe on every feed first page
-- ══════════════════════════════════════════════════════════════
-- src/app/actions/posts.ts (getFeedStream) runs, for every cursor-less
-- feed load:
--
--   SELECT ... FROM posts
--    WHERE parent_id IS NULL AND is_pinned = true
--    ORDER BY created_at DESC
--    LIMIT 3;
--
-- There is no index on is_pinned anywhere in migrations 001–180.
-- Verified against every posts index that exists:
--   idx_posts_author  (author_id, created_at DESC)               — 042
--   idx_posts_horse / _group / _event / _show / _parent          — 042
--   idx_posts_feed    (created_at DESC) WHERE every context NULL — 042
--   idx_posts_channel / _help_request / _studio                  — 058/092
--   posts_toplevel_created_idx (created_at DESC)
--                              WHERE parent_id IS NULL           — 166
--   posts_show_results_once_idx (show_id) WHERE kind=...         — 166
--
-- The planner's best option today is posts_toplevel_created_idx: it
-- walks top-level posts newest-first and heap-checks is_pinned on each.
-- Because pinned posts are RARE (usually zero — they are admin-set via
-- setFeedPostPinned), the LIMIT 3 is never satisfied and the scan walks
-- EVERY top-level post on the site, on every feed load, forever.
--
-- This partial index contains only the pinned rows, so the probe costs
-- O(pinned) instead of O(top-level posts), and answers "there are none"
-- immediately.
CREATE INDEX IF NOT EXISTS idx_posts_pinned_feed
  ON posts (created_at DESC)
  WHERE is_pinned = true AND parent_id IS NULL;


-- ══════════════════════════════════════════════════════════════
-- (b) The Show Ring public browse: ordering, paging, and the count
-- ══════════════════════════════════════════════════════════════
-- src/app/actions/showring.ts runs, on every /community load:
--
--   -- queryShowRing (page + exact count)
--   SELECT ... FROM user_horses
--    WHERE visibility = 'public' AND deleted_at IS NULL
--    ORDER BY created_at DESC, id
--    LIMIT ... OFFSET ...;
--
--   -- fetchShowRingFacets (bounded distinct scan)
--   SELECT finish_type, catalog_id FROM user_horses
--    WHERE visibility = 'public' AND deleted_at IS NULL
--    LIMIT 2000;
--
-- Verified against every user_horses index that exists — none covers
-- this predicate:
--   idx_user_horses_owner / _owner_id            (owner_id)  — 001/021
--   idx_user_horses_mold / _resin / _release
--     / _collection / _sculptor / _catalog       (other cols)— 001–048
--   idx_user_horses_is_public (is_public) WHERE is_public    — 021
--       ^ the LEGACY BOOLEAN column. Migration 150 moved the read path
--         to `visibility`, so this index does not serve the predicate
--         above, and it carries no created_at for the ORDER BY.
--   idx_user_horses_market_live (created_at DESC)
--     WHERE visibility='public' AND deleted_at IS NULL
--       AND trade_status IN ('For Sale','Open to Offers')      — 169
--       ^ the right shape, but restricted to FOR-SALE rows. The general
--         ring browse is a superset of it and cannot use it.
--
-- So the ring browse, its exact count, and the facet scan all go to a
-- sequential scan + sort, and get slower with every horse added.
--
-- The column order matches the query: created_at DESC leads (that IS
-- the sort), and the predicate is the partial's WHERE. Sorting stays
-- index-ordered instead of a filesort.
CREATE INDEX IF NOT EXISTS idx_user_horses_public_browse
  ON user_horses (created_at DESC)
  WHERE visibility = 'public' AND deleted_at IS NULL;


-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 181 Complete — two partial indexes, nothing else.
--
-- Verify (both should report an Index Scan, not a Seq Scan):
--   EXPLAIN SELECT id FROM posts
--     WHERE parent_id IS NULL AND is_pinned = true
--     ORDER BY created_at DESC LIMIT 3;
--
--   EXPLAIN SELECT id FROM user_horses
--     WHERE visibility = 'public' AND deleted_at IS NULL
--     ORDER BY created_at DESC LIMIT 24;
--
-- Sanity: the two indexes exist and are marked valid —
--   SELECT indexname FROM pg_indexes
--    WHERE indexname IN ('idx_posts_pinned_feed',
--                        'idx_user_horses_public_browse');
-- ══════════════════════════════════════════════════════════════
