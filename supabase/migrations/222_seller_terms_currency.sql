-- 222: The seller's currency rides with their seller terms (2026-09-22).
--
-- Every listing price was printed as US dollars, while sellers have set a
-- currency symbol in Settings since the first release and nothing on the
-- market read it (outside review, 2026-09-22). get_public_seller_terms
-- (218) is the one anon-safe read the market and passports already use
-- for a seller's public facts, so the symbol joins it. The return shape
-- changes, hence DROP + CREATE rather than REPLACE.

DROP FUNCTION IF EXISTS public.get_public_seller_terms(UUID[], TEXT[]);

CREATE FUNCTION public.get_public_seller_terms(
  p_user_ids UUID[]  DEFAULT NULL,
  p_aliases  TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
  user_id         UUID,
  country         TEXT,
  ships_to        TEXT,
  ships_not_to    TEXT,
  open_to_trades  BOOLEAN,
  looking_for     TEXT,
  currency_symbol TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    u.id,
    u.country::TEXT,
    u.ships_to,
    u.ships_not_to,
    COALESCE(u.open_to_trades, false),
    u.looking_for,
    NULLIF(btrim(u.currency_symbol), '')
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
  'Seller terms (218) plus currency symbol (222) for up to 100 members by id or alias. Public-safe by construction; anon may call it.';
