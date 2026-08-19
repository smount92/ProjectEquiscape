-- ============================================================
-- 152 — BLUE BOOK SALES HISTORY (makes Blue Book PRO real)
--
-- Anon-safe, aggregate-style read: per-catalog-item completed
-- sale points (date, price, finish) for the Pro price-history
-- chart. Exposes NO transaction ids and NO party information —
-- the same class of data the public price guide already promises
-- ("real sale data"). SECURITY DEFINER because transactions RLS
-- is party-scoped; search_path pinned per house rule.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_market_history(p_catalog_id UUID)
RETURNS TABLE (sale_date DATE, price NUMERIC, finish_type TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    t.completed_at::date AS sale_date,
    (t.metadata->>'sale_price')::numeric AS price,
    COALESCE(h.finish_type, 'OF') AS finish_type
  FROM public.transactions t
  JOIN public.user_horses h ON h.id = t.horse_id
  WHERE h.catalog_id = p_catalog_id
    AND t.status = 'completed'
    AND t.completed_at IS NOT NULL
    AND (t.metadata->>'sale_price') IS NOT NULL
    AND (t.metadata->>'sale_price')::numeric > 0
  ORDER BY t.completed_at ASC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION public.get_market_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_history(UUID) TO anon, authenticated;

-- ============================================================
-- After applying: no gen-types needed.
-- Verify: SELECT * FROM get_market_history('<any catalog uuid>');
-- ============================================================
