-- ══════════════════════════════════════════════════════════════
-- Migration 136: anon-safe alias resolution (FUNNEL-4 — shows)
-- ══════════════════════════════════════════════════════════════
-- Public v2 show pages (/shows/[id]) render for anon but showed "@unknown" for
-- the host, entrants, and champions, because getAliases() reads the users table
-- (SELECT TO authenticated, migration 022/109) with the cookie client — empty
-- for logged-out visitors. This DEFINER RPC returns ONLY the public alias_name
-- for a set of ids, granted to anon. alias_name is a public display name (never
-- email/full_name). Additive + idempotent. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_public_aliases(p_ids UUID[])
RETURNS TABLE (id UUID, alias_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT u.id, u.alias_name
  FROM public.users u
  WHERE u.id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION get_public_aliases(UUID[]) TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 136 Complete — get_public_aliases(). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
