-- ══════════════════════════════════════════════════════════════
-- Migration 124: Catalog reference data readable by anon
-- ══════════════════════════════════════════════════════════════
-- Live bug (Batch E1): /catalog is a public path in src/proxy.ts and the
-- logged-out Header links to it, but catalog_items only had a
-- `TO authenticated` SELECT policy (migration 048), so anonymous visitors
-- got 0 rows and 404'd on /catalog/[id]. catalog_items is immutable public
-- reference data (maker / scale / title / attributes) — no user data — so
-- it is safe to expose to anon, matching the anon-read precedent in
-- 112_photo_short_slugs.sql and 118_shows_domain_rls.sql.
--
-- Additive + idempotent: we DROP the old authenticated-only SELECT policy
-- and recreate ONE merged policy for `authenticated, anon` (rather than a
-- second policy) to avoid the multiple_permissive_policies linter warning
-- that 092 spent effort clearing. Writes stay admin/service-role only —
-- no INSERT/UPDATE/DELETE policy exists, and none is added here.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "catalog_items_select" ON catalog_items;

CREATE POLICY "catalog_items_select" ON catalog_items FOR SELECT
TO authenticated, anon USING (true);

-- ══════════════════════════════════════════════════════════════
-- NOTE (Batch E1, deferred decision — NOT in this migration):
-- The Blue Book price teaser for the public reference pages (Batch I) needs
-- anon read of aggregate price data. mv_market_prices had its anon SELECT
-- REVOKED in 092_supabase_linter_fixes.sql (materialized_view_in_api WARN).
-- The recommended re-enable path is a SECURITY DEFINER, aggregate-only RPC
-- (e.g. get_catalog_price_teaser(catalog_id)) that exposes only the teaser
-- fields for a single item — keeping the MV itself out of the anon API
-- (no bulk crawl) and honouring the "teaser public, full history = members"
-- intent. That RPC is intentionally left for the migration that ships its
-- consumer (Batch I), pending owner sign-off on the approach, so this
-- live-bug fix is not blocked on that judgment call.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 124 Complete
-- catalog_items SELECT now covers authenticated + anon (single policy).
-- ══════════════════════════════════════════════════════════════
