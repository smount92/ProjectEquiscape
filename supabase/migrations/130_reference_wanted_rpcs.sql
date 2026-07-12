-- ══════════════════════════════════════════════════════════════
-- Migration 130: Reference-page + "Wanted" engine RPCs
-- ══════════════════════════════════════════════════════════════
-- Powers the public reference pages (MOVE 1) and the Wanted demand engine:
--   • count_catalog_collectors — "N collectors have this" (aggregate)
--   • count_catalog_wanters     — "N want this" (aggregate; wishlists are
--                                 RLS owner-only so a DEFINER counter is needed)
--   • notify_catalog_owners_of_demand — the seller-side nudge: tell owners of a
--                                 model that someone wants it, WITHOUT ever
--                                 exposing owner identities to the buyer.
--
-- All SECURITY DEFINER (mirror migration 108's RLS-safe counter pattern),
-- SET search_path = '' with fully-qualified names. Aggregate-only — never
-- returns owner ids/rows or vault values. Additive + idempotent.
-- ══════════════════════════════════════════════════════════════

-- "N collectors have this" — all owners of the model, aggregate only.
CREATE OR REPLACE FUNCTION count_catalog_collectors(p_catalog_id UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT count(DISTINCT owner_id)
  FROM public.user_horses
  WHERE catalog_id = p_catalog_id AND deleted_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION count_catalog_collectors(UUID) TO anon, authenticated;

-- "N want this" — distinct wishlisters of the model, aggregate only.
CREATE OR REPLACE FUNCTION count_catalog_wanters(p_catalog_id UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT count(DISTINCT user_id)
  FROM public.user_wishlists
  WHERE catalog_id = p_catalog_id;
$$;
GRANT EXECUTE ON FUNCTION count_catalog_wanters(UUID) TO anon, authenticated;

-- The seller-side demand nudge. Called (behind NEXT_PUBLIC_WANTED_NUDGE) when a
-- user wishlists a model. Notifies every current owner of that model — including
-- private owners RLS would hide — that someone is looking, WITHOUT returning any
-- owner identity to the caller and WITHOUT naming the buyer (actor_id left null →
-- anonymous). Aggregate, throttled, opt-out-aware. Returns count nudged.
CREATE OR REPLACE FUNCTION notify_catalog_owners_of_demand(
  p_catalog_id UUID,
  p_wanter_id UUID
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count INT := 0;
  v_title TEXT;
  v_maker_slug TEXT;
  v_slug TEXT;
  v_link TEXT;
  r RECORD;
BEGIN
  SELECT title, maker_slug, slug
  INTO v_title, v_maker_slug, v_slug
  FROM public.catalog_items
  WHERE id = p_catalog_id;

  IF v_title IS NULL THEN
    RETURN 0;
  END IF;

  v_link := '/reference/' || coalesce(v_maker_slug, 'x') || '/' || coalesce(v_slug, p_catalog_id::text);

  FOR r IN
    SELECT DISTINCT uh.owner_id
    FROM public.user_horses uh
    JOIN public.users u ON u.id = uh.owner_id
    WHERE uh.catalog_id = p_catalog_id
      AND uh.deleted_at IS NULL
      AND uh.owner_id <> p_wanter_id
      -- opt-out: nudges on by default; users can disable via notification_prefs
      AND coalesce((u.notification_prefs ->> 'demand_alerts')::boolean, true) = true
      -- dedupe: don't re-nudge the same owner about the same model within 30 days
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = uh.owner_id
          AND n.type = 'demand_alert'
          AND n.link_url = v_link
          AND n.created_at > now() - interval '30 days'
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, content, link_url)
    VALUES (
      r.owner_id,
      'demand_alert',
      'Someone is looking for a ' || v_title || ' like yours.',
      v_link
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;

-- Only signed-in users can trigger a nudge (the wanter). Never anon.
REVOKE ALL ON FUNCTION notify_catalog_owners_of_demand(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notify_catalog_owners_of_demand(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 130 Complete — count_catalog_collectors, count_catalog_wanters,
-- notify_catalog_owners_of_demand. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
