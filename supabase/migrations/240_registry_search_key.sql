-- ============================================================
-- 240: Registry search finds a title however it was punctuated
--
-- Release 3 (2026-10), ticket MHH-080. Safe to paste twice.
--
-- A volunteer cataloguing Stablemates typed titles exactly as the
-- Registry holds them and still missed, because of punctuation:
--   * quotes:              "Horspital" Play Set
--   * hyphens:             12-Piece Stablemates Set  (typed "12 Piece")
--   * curly apostrophes:   Horse Lover’s Collection  (typed Lover's)
--   * word order:          Prancing Morgan  vs  Morgan - Prancing
--
-- 1. public.catalog_search_key(text): the title the way a person types
--    it. Lowercase, accents folded, quotes and other punctuation removed,
--    hyphens, dashes and slashes turned into spaces, "&" read as "and",
--    spaces squashed. A non-breaking space (U+00A0) and the other Unicode
--    spaces are turned into plain spaces first: [:space:] does not cover
--    them, so "Silky<nbsp>Sullivan" would otherwise key as one word. The
--    app's TypeScript twin is searchKey() in src/lib/catalog/searchKey.ts;
--    change the two together (a test checks the lists match).
-- 2. catalog_items.search_key, kept by the database: a STORED generated
--    column, like sort_key (188), so it fills every existing row when this
--    is pasted and can never drift from the title. (A trigger plus a
--    one-time UPDATE would also work, but the UPDATE would stamp
--    updated_at (233) on all ~11,900 rows as if each had been edited.)
--    Adding it rewrites catalog_items once: about 12,000 rows, well under
--    a second. A trigram index sits on it.
-- 3. search_catalog_fuzzy, re-created from 223 with the same signature,
--    columns, grants and SECURITY INVOKER. Only the matching changes: a
--    row also matches when every typed word is inside its search_key, or
--    when the trigram similarity of the keys is over the same 0.15
--    threshold. Every old way of matching still matches. The order is
--    223's, with two additions: a title whose key equals the typed key
--    ranks right after an exact title, and `id` breaks the last ties so
--    the order is the same on every call. search_path is now '' (every
--    name below is schema-qualified).
--
-- The app sends the term as typed and works the same before and after
-- this is pasted; after it, the four cases above find their rows.
--
-- Adding the column locks catalog_items for that second. If the site is
-- busy the paste may stop with "lock timeout" (nothing is changed when
-- it does); paste it again a minute later.
-- ============================================================

SET lock_timeout = '5s';

-- ── 1. The key ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.catalog_search_key(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          replace(
            lower(translate(translate(coalesce(t, ''),
              chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279),
              repeat(' ', 19)),
              'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿĄĆĘŁŃŚŹŻąćęłńśźżØøŠšŽžČčŘřĚěŮů',
              'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyyACELNSZZacelnszzOoSsZzCcRrEeUu')),
            '&', ' and '),
          '[-‐‑‒–—―/_]+', ' ', 'g'),
        '[^[:alnum:][:space:]]+', '', 'g'),
      '[[:space:]]+', ' ', 'g'));
$$;

GRANT EXECUTE ON FUNCTION public.catalog_search_key(text) TO authenticated, anon;

-- ── 2. The column and its index ──────────────────────────────

ALTER TABLE public.catalog_items
    ADD COLUMN IF NOT EXISTS search_key text
    GENERATED ALWAYS AS (public.catalog_search_key(title)) STORED;

CREATE INDEX IF NOT EXISTS idx_catalog_items_search_key_trgm
    ON public.catalog_items USING gin (search_key extensions.gin_trgm_ops);

-- ── 3. The search ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_catalog_fuzzy(
    search_term TEXT,
    max_results INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    title TEXT,
    item_type TEXT,
    parent_id UUID,
    maker TEXT,
    scale TEXT,
    attributes JSONB,
    parent_title TEXT,
    similarity REAL
) AS $$
DECLARE
    v_key text := public.catalog_search_key(search_term);
    v_words text[] := CASE WHEN v_key = '' THEN ARRAY[]::text[] ELSE string_to_array(v_key, ' ') END;
BEGIN
    RETURN QUERY
    SELECT
        ci.id,
        ci.title,
        ci.item_type,
        ci.parent_id,
        ci.maker,
        ci.scale,
        ci.attributes,
        p.title AS parent_title,
        extensions.similarity(ci.title, search_term) AS similarity
    FROM public.catalog_items ci
    LEFT JOIN public.catalog_items p ON ci.parent_id = p.id
    WHERE extensions.similarity(ci.title, search_term) > 0.15
       OR ci.title ILIKE '%' || search_term || '%'
       OR ci.maker ILIKE '%' || search_term || '%'
       -- Every typed word is in the key, in any order.
       OR (cardinality(v_words) > 0
           AND NOT EXISTS (
               SELECT 1 FROM unnest(v_words) AS w(word)
               WHERE strpos(coalesce(ci.search_key, ''), w.word) = 0))
       -- Or the keys are close (typos), on the same threshold as titles.
       OR (v_key <> '' AND extensions.similarity(coalesce(ci.search_key, ''), v_key) > 0.15)
    ORDER BY
        (lower(ci.title) = lower(btrim(search_term))) DESC,
        coalesce(v_key <> '' AND ci.search_key = v_key, false) DESC,
        (ci.title ILIKE btrim(search_term) || '%') DESC,
        (ci.title ILIKE '% ' || btrim(search_term) || '%') DESC,
        (ci.title ILIKE '%' || btrim(search_term) || '%') DESC,
        extensions.similarity(ci.title, search_term) DESC,
        length(ci.title) ASC,
        ci.title ASC,
        ci.id ASC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.search_catalog_fuzzy(TEXT, INT) TO authenticated, anon;

RESET lock_timeout;

NOTIFY pgrst, 'reload schema';

-- ── After pasting ────────────────────────────────────────────
-- Check (each should return a row):
--   SELECT title FROM public.search_catalog_fuzzy('Horspital Play Set', 5);
--   SELECT title FROM public.search_catalog_fuzzy('Horse Lover''s Collection', 5);
--   SELECT count(*) FROM public.catalog_items WHERE search_key IS NULL;  -- 0
-- Then: npm run gen-types.
