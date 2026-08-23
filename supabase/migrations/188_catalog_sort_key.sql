-- 188: the Registry's first page should be horses, not punctuation.
--
-- Ordering by title put every quoted nickname ahead of the alphabet. All 72
-- rows of page one were titles starting with " or ' — ten consecutive
-- "Commander" The Five Gaiter, eight consecutive "Quelle Surprise!" — so a
-- visitor's first impression of 11,109 models was a wall of quotation marks.
--
-- sort_key files a title the way a librarian would:
--   * leading punctuation is ignored, so "Commander" files under C
--   * accented initials fold to their base letter, so Eclair files under E.
--     This matters because the column collation sorts multi-byte characters
--     after z, which exiles them to the very end of the catalog.
--   * anything not starting with a letter — years, piece counts, "429" —
--     sorts AFTER everything that does. That is the owner's call: those
--     rows are real, but they are not what a first page should open with.
--
-- STORED so reads cost nothing and the key can never drift from the title.
-- Every function here is IMMUTABLE, which a generated column requires;
-- unaccent() is only STABLE, which is why the fold is a translate().

ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS sort_key text
    GENERATED ALWAYS AS (
        CASE
            WHEN regexp_replace(
                    translate(
                        title,
                        'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
                        'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy'),
                    '^[^[:alnum:]]+', '') ~ '^[[:alpha:]]'
            THEN '1'
            ELSE '2'
        END
        || lower(regexp_replace(
                translate(
                    title,
                    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
                    'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy'),
                '^[^[:alnum:]]+', ''))
    ) STORED;

-- The Registry's default browse order.
CREATE INDEX IF NOT EXISTS catalog_items_sort_key_idx
    ON public.catalog_items (sort_key);
