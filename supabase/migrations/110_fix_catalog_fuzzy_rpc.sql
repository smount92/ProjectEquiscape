-- ═══════════════════════════════════════
-- MIGRATION 110: Update search_catalog_fuzzy RPC
-- Add maker, scale, attributes to return columns
-- Switch from SECURITY DEFINER to SECURITY INVOKER
-- ═══════════════════════════════════════

-- Drop old function first (return type changed — PG requires DROP before recreate)
DROP FUNCTION IF EXISTS search_catalog_fuzzy(TEXT, INT);

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
    ORDER BY extensions.similarity(ci.title, search_term) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public;

-- Re-grant permissions (needed after CREATE OR REPLACE with new return type)
GRANT EXECUTE ON FUNCTION search_catalog_fuzzy TO authenticated, anon;
