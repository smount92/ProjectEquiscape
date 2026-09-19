-- 215 — where an artist works.
--
-- Collectors ask "who is near me" and "who ships from my country"; the
-- studio directory had no field to answer with. One free-text line
-- ("Ohio, USA", "Kent, UK") — searchable in the directory and shown on
-- the studio card and page. Not a filter facet: regions are too varied
-- to chip.
--
-- The app tolerates this column being absent (saves retry without it),
-- so paste order does not matter.

ALTER TABLE public.artist_profiles
    ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE public.artist_profiles
    DROP CONSTRAINT IF EXISTS artist_profiles_region_len;
ALTER TABLE public.artist_profiles
    ADD CONSTRAINT artist_profiles_region_len
    CHECK (region IS NULL OR char_length(region) <= 60);

COMMENT ON COLUMN public.artist_profiles.region IS
    'Where the artist works, as they wrote it (<= 60 chars). Searchable in the directory; shown on the card and studio page.';
