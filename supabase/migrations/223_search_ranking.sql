-- 223: Search results in the order a person expects (2026-09-22).
--
-- search_catalog_fuzzy (110) ordered by trigram similarity alone. That
-- is right for typos and wrong for typing: "Boll" ranked Bolo, Bolya and
-- Bolero above Bollywood Surprise, "sherm" put Sheba (four times) above
-- Sherman Morgan, and the reference picker and the Registry both showed
-- "a bunch of random names above the one I typed" (owner's wife).
--
-- Same signature and columns, so CREATE OR REPLACE. The WHERE is
-- unchanged (similarity > 0.15, or title / maker contains the term); the
-- ORDER BY now ranks exact title, then title starts with the term, then a
-- word in the title starts with it, then the title contains it, and only
-- then similarity — shorter titles first within a tie, so "Smoky" beats
-- "Smoky the Cow Horse".

CREATE OR REPLACE FUNCTION search_catalog_fuzzy(
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
    FROM catalog_items ci
    LEFT JOIN catalog_items p ON ci.parent_id = p.id
    WHERE extensions.similarity(ci.title, search_term) > 0.15
       OR ci.title ILIKE '%' || search_term || '%'
       OR ci.maker ILIKE '%' || search_term || '%'
    ORDER BY
        (lower(ci.title) = lower(btrim(search_term))) DESC,
        (ci.title ILIKE btrim(search_term) || '%') DESC,
        (ci.title ILIKE '% ' || btrim(search_term) || '%') DESC,
        (ci.title ILIKE '%' || btrim(search_term) || '%') DESC,
        extensions.similarity(ci.title, search_term) DESC,
        length(ci.title) ASC,
        ci.title ASC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public;
