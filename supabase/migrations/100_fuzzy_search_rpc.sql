-- ═══════════════════════════════════════
-- MIGRATION 100: Server-side fuzzy catalog search
-- ═══════════════════════════════════════

-- Ensure trigram index exists on catalog_items.name
-- Note: pg_trgm extension lives in 'extensions' schema per migration 092
CREATE INDEX IF NOT EXISTS idx_catalog_items_name_trgm
  ON catalog_items USING gin (name extensions.gin_trgm_ops);

-- RPC: search_catalog_fuzzy
CREATE OR REPLACE FUNCTION search_catalog_fuzzy(
    search_term TEXT,
    max_results INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    name TEXT,
    item_type TEXT,
    parent_id UUID,
    parent_name TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ci.id,
        ci.name,
        ci.item_type,
        ci.parent_id,
        p.name AS parent_name,
        extensions.similarity(ci.name, search_term) AS similarity
    FROM catalog_items ci
    LEFT JOIN catalog_items p ON ci.parent_id = p.id
    WHERE extensions.similarity(ci.name, search_term) > 0.15
       OR ci.name ILIKE '%' || search_term || '%'
    ORDER BY extensions.similarity(ci.name, search_term) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_catalog_fuzzy TO authenticated, anon;
