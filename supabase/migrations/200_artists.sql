-- ============================================================
-- 200: artists — the entity behind the maker string
--
-- Artist pages render from catalog rows where maker = a name, which
-- means an artist has nowhere to hang anything that isn't a work:
-- no bio, no studio name, no disciplines, no corrected active years.
-- This table is that home, and it is deliberately the FOUNDATION for
-- two planned features: artist Registry Notes now, and verified
-- artist accounts later (Verify This Resin needs member↔artist
-- linkage; verified_user_id is that hook, unused until then).
--
-- The stat block splits two ways by design:
--   computed  — work counts, sculpted-for list, documented year range:
--               derived live from the catalog, never stored here.
--   curated   — everything in this table: facts the catalog cannot
--               derive, maintained by admins/curators (v1 writes are
--               service-role only; community suggestion flow arrives
--               with artist accounts).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.artists (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Matches catalog_items.maker exactly — the join key to the works.
    name             TEXT NOT NULL UNIQUE,
    slug             TEXT UNIQUE,
    studio_name      TEXT,
    -- What they do, in hobby terms: sculpts, paints, customs, china…
    disciplines      TEXT[] NOT NULL DEFAULT '{}',
    active_from      SMALLINT CHECK (active_from BETWEEN 1900 AND 2100),
    active_to        SMALLINT CHECK (active_to   BETWEEN 1900 AND 2100),
    website          TEXT,
    -- The annotated registry, artist edition: prose in our own words.
    registry_notes   TEXT,
    -- Future: the member account verified as being this artist.
    verified_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artists IS
  'Curated artist facts (studio, disciplines, active years, notes). Work counts and sculpted-for lists are computed from catalog_items, never stored here.';

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Public reference data; trust features are never paywalled.
DROP POLICY IF EXISTS "artists are public" ON public.artists;
CREATE POLICY "artists are public"
    ON public.artists FOR SELECT
    USING (true);

GRANT SELECT ON public.artists TO anon, authenticated;
-- No INSERT/UPDATE/DELETE policies: service-role only until verified
-- artist accounts exist.

-- Verify:
--   1. As an anon client key:
--        SELECT count(*) FROM artists;      -- succeeds
--        INSERT INTO artists (name) ...;    -- denied

-- ── Artist suggestions ride the existing pipeline ──
-- A suggestion carrying artist_name targets the artists table instead
-- of a catalog row (catalog_item_id stays NULL). Same review queue,
-- same admin notifications, same audit trail.
ALTER TABLE public.catalog_suggestions
    ADD COLUMN IF NOT EXISTS artist_name TEXT;
COMMENT ON COLUMN public.catalog_suggestions.artist_name IS
  'When set, this suggestion edits the named artists-table row (e.g. registry notes) rather than a catalog item.';
