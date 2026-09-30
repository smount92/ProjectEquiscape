-- 224: Set purchases — several horses bought for one price (2026-09-30).
--
-- A member entering purchase prices asked how to record a set (the VC
-- Classic Mustang Family): split the total across the models, or put
-- the full price under each? Either answer breaks the vault total —
-- the split is guesswork, the full price triple-counts. Now a group of
-- horses can share ONE purchase: every member carries the set price and
-- a purchase_group_id, the summary counts the set once by giving each
-- member an equal share, and the passport says so.
--
-- Additive: two nullable columns + an index, and get_stable_summary
-- (123) re-created with share arithmetic. Estimated current value is
-- still per horse — a replacement value is a fact about one model.
-- After paste: nothing else (the app tolerates the columns being absent
-- until then and says "paste 224" when a set is linked too early).

ALTER TABLE public.financial_vault
  ADD COLUMN IF NOT EXISTS purchase_group_id UUID,
  ADD COLUMN IF NOT EXISTS purchase_group_label TEXT;

COMMENT ON COLUMN public.financial_vault.purchase_group_id IS
  'Horses bought together for one price share a group id; purchase_price on each member is the SET price and the summary counts it once (equal shares).';
COMMENT ON COLUMN public.financial_vault.purchase_group_label IS
  'What the set was, in the owner''s words ("VC Classic Mustang Family").';

CREATE INDEX IF NOT EXISTS financial_vault_purchase_group_idx
  ON public.financial_vault (purchase_group_id)
  WHERE purchase_group_id IS NOT NULL;

-- Summary: a set's price is counted once — each member's fallback value
-- is its equal share of the set, not the whole set.
CREATE OR REPLACE FUNCTION get_stable_summary(p_owner UUID)
RETURNS TABLE (
    total_horses   INTEGER,
    vault_total    NUMERIC,
    for_sale_count INTEGER,
    collections    JSONB
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
WITH horses AS (
    SELECT id, collection_id, trade_status
    FROM public.user_horses
    WHERE owner_id = p_owner AND deleted_at IS NULL
),
memberships AS (
    SELECT h.id AS horse_id, h.collection_id
    FROM horses h
    WHERE h.collection_id IS NOT NULL
    UNION
    SELECT hc.horse_id, hc.collection_id
    FROM public.horse_collections hc
    JOIN horses h ON h.id = hc.horse_id
),
vault AS (
    SELECT fv.horse_id,
           COALESCE(
               fv.estimated_current_value,
               CASE
                   WHEN fv.purchase_group_id IS NULL THEN fv.purchase_price
                   ELSE fv.purchase_price
                        / NULLIF(COUNT(*) OVER (PARTITION BY fv.purchase_group_id), 0)
               END,
               0
           ) AS value
    FROM public.financial_vault fv
    JOIN horses h ON h.id = fv.horse_id
),
per_collection AS (
    SELECT c.id,
           c.name,
           COUNT(DISTINCT m.horse_id)  AS horse_count,
           COALESCE(SUM(v.value), 0)   AS vault_value
    FROM public.user_collections c
    LEFT JOIN memberships m ON m.collection_id = c.id
    LEFT JOIN vault v       ON v.horse_id = m.horse_id
    WHERE c.user_id = p_owner
    GROUP BY c.id, c.name
)
SELECT
    (SELECT COUNT(*) FROM horses)::INTEGER                              AS total_horses,
    COALESCE((SELECT SUM(value) FROM vault), 0)                         AS vault_total,
    (SELECT COUNT(*) FROM horses WHERE trade_status = 'For Sale')::INTEGER AS for_sale_count,
    COALESCE(
        (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', id, 'name', name,
                        'count', horse_count, 'value', vault_value
                    ) ORDER BY name)
         FROM per_collection),
        '[]'::jsonb
    ) AS collections;
$$;
