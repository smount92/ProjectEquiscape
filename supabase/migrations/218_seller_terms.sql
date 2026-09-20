-- 218: Seller terms — country, where you ship, where you don't, trades,
-- and a public "looking for" line (2026-09-20).
--
-- Asked for by the first professional artist on the site: on Model Horse
-- Central a country flag on every listing told her at a glance whether a
-- horse was worth pursuing, and she wanted the seller's shipping and
-- trade terms on the listing instead of a hunt through their profile.
--
-- Five columns on users, all optional (country is opt-in and blank by
-- default; only the country, never a city). The Want List stays private
-- by the owner's ruling — looking_for is the one-line public stand-in a
-- seller chooses to publish.
--
-- users is SELECT TO authenticated only (022), and the marketplace and
-- passports serve logged-out buyers, so the read path is one anon-safe
-- SECURITY DEFINER RPC returning exactly these public-safe columns for a
-- bounded list of members (by id, or by alias for the public passport,
-- whose RPC carries the alias). Before this is pasted the app reads the
-- panel as empty and saves without the five columns.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country CHAR(2)
    CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS ships_to TEXT
    CHECK (ships_to IS NULL OR char_length(ships_to) <= 200),
  ADD COLUMN IF NOT EXISTS ships_not_to TEXT
    CHECK (ships_not_to IS NULL OR char_length(ships_not_to) <= 200),
  ADD COLUMN IF NOT EXISTS open_to_trades BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS looking_for TEXT
    CHECK (looking_for IS NULL OR char_length(looking_for) <= 300);

COMMENT ON COLUMN public.users.country IS
  'ISO 3166-1 alpha-2, opt-in. Shown as a flag + name on listings, passports and the profile. Country only, never a city.';
COMMENT ON COLUMN public.users.ships_to IS
  'Free text the seller writes: "EU and UK", "Worldwide", "US only".';
COMMENT ON COLUMN public.users.ships_not_to IS
  'Free text: the places the seller will not ship to.';
COMMENT ON COLUMN public.users.open_to_trades IS
  'Whether the seller entertains trades at all. The Want List itself stays private.';
COMMENT ON COLUMN public.users.looking_for IS
  'One public line of what the seller would trade for. The private Want List is not exposed.';

-- ── The anon-safe read ──────────────────────────────────────────────
-- Exactly the five columns plus the id, for up to 100 members at a time,
-- by id or by alias. Deleted accounts return nothing. Guarded to PUBLIC
-- data only: nothing here is not already the member's own choice to show.

CREATE OR REPLACE FUNCTION public.get_public_seller_terms(
  p_user_ids UUID[]  DEFAULT NULL,
  p_aliases  TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
  user_id        UUID,
  country        TEXT,
  ships_to       TEXT,
  ships_not_to   TEXT,
  open_to_trades BOOLEAN,
  looking_for    TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    u.id,
    u.country::TEXT,
    u.ships_to,
    u.ships_not_to,
    COALESCE(u.open_to_trades, false),
    u.looking_for
  FROM public.users u
  WHERE COALESCE(u.account_status, 'active') <> 'deleted'
    AND (
         (p_user_ids IS NOT NULL AND u.id = ANY (p_user_ids[1:100]))
      OR (p_aliases  IS NOT NULL AND u.alias_name = ANY (p_aliases[1:100]))
    )
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_public_seller_terms(UUID[], TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_seller_terms(UUID[], TEXT[]) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_seller_terms(UUID[], TEXT[]) IS
  'Seller terms (218) for up to 100 members by id or alias: country, ships_to, ships_not_to, open_to_trades, looking_for. Public-safe by construction; anon may call it.';
