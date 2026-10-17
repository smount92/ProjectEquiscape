-- ============================================================
-- 243: Registry merges and removals that can be undone
--
-- Release 3, Registry Desk Phase 1 (docs/design/registry-desk-phase1-plan.md).
-- Paste after 242.
--
-- 1. catalog_removed_items: a removed or merged-away Registry row is kept
--    here, whole, with the id of every link that was moved, for 30 days.
-- 2. registry_link_counts(item): what points at a row (horses, including
--    deleted ones; want lists; releases filed under it; Help ID answers;
--    pending suggestions; member sale reports; price flags).
-- 3. registry_merge(keep, remove, ...): one transaction. Every link moves
--    to the kept row and its id is saved; a member who wants both keeps
--    one want-list row (the other is saved); the removed row's address
--    forwards to the kept row; the row is archived, then deleted.
--    This also fixes a bug: the old merge deleted members' sale reports
--    and price flags along with the duplicate. They now move.
--    A merge runs once: its History entry is locked first, so a second
--    "Confirm" (or a "Decline" at the same moment) waits, then is told the
--    merge already happened. When two molds merge, the releases of the
--    one removed move to the one kept and take its scale; the old scales
--    are saved so an unmerge puts them back.
-- 4. registry_unmerge(action): puts the row back with the same id and
--    moves back only the links that still point at the kept row; a
--    member who re-linked since is left alone.
-- 5. registry_remove(item, ...): removes a row nothing points at, keeping
--    it in the archive. Refused with the counts if anything links to it.
-- 6. registry_restore(archive row): the reverse.
--
-- Not brought back by an undo: machine price data (price signals, history,
-- sweep attempts) for the removed row; the next price sweep collects it
-- again. Only the server can call these functions. Nothing here changes
-- Registry data when pasted. Safe to paste twice. If the site is busy
-- the paste may stop with "lock timeout"; paste it again a minute later.
-- ============================================================

SET lock_timeout = '5s';

-- ── 1. The archive ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.catalog_removed_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL,
  -- The full row, without the generated sort_key and search_key.
  item          JSONB NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('removed', 'merged')),
  merged_into   UUID,
  reason        TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 1000),
  action_id     UUID REFERENCES public.registry_actions(id) ON DELETE SET NULL,
  removed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL, -- embed-checked: the only link to users on this new table
  links         JSONB NOT NULL DEFAULT '{}'::jsonb,
  restore_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at   TIMESTAMPTZ,
  restored_by   UUID,
  restored_slug TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_removed_items_live
  ON public.catalog_removed_items (item_id) WHERE restored_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_removed_items_action ON public.catalog_removed_items (action_id);
CREATE INDEX IF NOT EXISTS idx_catalog_removed_items_created ON public.catalog_removed_items (created_at DESC);

ALTER TABLE public.catalog_removed_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_removed_items FROM anon, authenticated;

-- ── 2. What points at a row ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.registry_link_counts(p_item UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'horses', (SELECT count(*) FROM public.user_horses WHERE catalog_id = p_item),
    'wishlists', (SELECT count(*) FROM public.user_wishlists WHERE catalog_id = p_item),
    'children', (SELECT count(*) FROM public.catalog_items WHERE parent_id = p_item),
    'id_suggestions', (SELECT count(*) FROM public.id_suggestions WHERE catalog_id = p_item),
    'pending_suggestions', (
      SELECT count(*) FROM public.catalog_suggestions
      WHERE status IN ('pending', 'under_review')
        AND (catalog_item_id = p_item OR field_changes->>'duplicate_of' = p_item::text)
    ),
    'sale_reports', (SELECT count(*) FROM public.catalog_sale_reports WHERE catalog_item_id = p_item),
    'price_flags', (SELECT count(*) FROM public.catalog_price_signal_flags WHERE catalog_item_id = p_item)
  );
$$;

REVOKE ALL ON FUNCTION public.registry_link_counts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_link_counts(UUID) TO service_role;

-- ── 3. Merge ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registry_merge(
  p_keep UUID, p_remove UUID, p_action_id UUID, p_actor UUID, p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_keep         public.catalog_items%ROWTYPE;
  v_remove       public.catalog_items%ROWTYPE;
  v_item         JSONB;
  v_links        JSONB;
  v_horses       UUID[];
  v_wishlists    UUID[];
  v_wish_folded  JSONB;
  v_id_sugs      UUID[];
  v_sugs         UUID[];
  v_log          UUID[];
  v_children     UUID[];
  v_sales        UUID[];
  v_flags        UUID[];
  v_flag_folded  JSONB;
  v_slugs        JSONB;
  v_slug_added   JSONB := 'null'::jsonb;
  v_reason       TEXT;
  v_moved        INT;
  v_action       public.registry_actions%ROWTYPE;
  v_rescaled     JSONB := '[]'::jsonb;
BEGIN
  IF p_keep IS NULL OR p_remove IS NULL OR p_keep = p_remove THEN
    RAISE EXCEPTION 'same' USING DETAIL = 'Those are the same entry.';
  END IF;

  -- The History entry first, locked, so two people confirming the same
  -- merge (or one confirming while another declines) queue up here and
  -- the second sees what the first did. "Already applied" is checked
  -- before "missing": once a merge has run, its duplicate IS missing, and
  -- a second confirm must not mark the applied merge failed.
  IF p_action_id IS NOT NULL THEN
    SELECT * INTO v_action FROM public.registry_actions WHERE id = p_action_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING DETAIL = 'That merge request is not in the history.';
    END IF;
    IF v_action.kind <> 'merge' THEN
      RAISE EXCEPTION 'not_merge' USING DETAIL = 'That history entry is not a merge.';
    END IF;
    IF v_action.applied_at IS NOT NULL OR v_action.status IN ('applied', 'undone')
       OR EXISTS (SELECT 1 FROM public.catalog_removed_items WHERE action_id = p_action_id) THEN
      RAISE EXCEPTION 'already_applied' USING DETAIL = 'This merge has already been applied.';
    END IF;
    -- A moderator's merge waiting for its second look, or the owner's
    -- merge recorded as pending just before it runs. Nothing else.
    IF v_action.status NOT IN ('awaiting_second_look', 'pending') THEN
      RAISE EXCEPTION 'not_waiting' USING DETAIL = 'This merge is no longer waiting for a second look.';
    END IF;
    IF v_action.catalog_item_id IS DISTINCT FROM p_remove OR v_action.related_item_id IS DISTINCT FROM p_keep THEN
      RAISE EXCEPTION 'mismatch' USING DETAIL = 'That history entry is about two other entries.';
    END IF;
  END IF;

  -- Both rows, locked in a fixed order so two merges can't deadlock.
  PERFORM 1 FROM public.catalog_items WHERE id IN (p_keep, p_remove) ORDER BY id FOR UPDATE;
  SELECT * INTO v_keep FROM public.catalog_items WHERE id = p_keep;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing' USING DETAIL = 'The entry to keep no longer exists.'; END IF;
  SELECT * INTO v_remove FROM public.catalog_items WHERE id = p_remove;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing' USING DETAIL = 'The duplicate no longer exists.'; END IF;
  IF v_keep.parent_id = p_remove THEN
    RAISE EXCEPTION 'keep_is_child' USING DETAIL = 'The entry to keep is filed under the duplicate.';
  END IF;
  IF (v_keep.item_type = 'plastic_mold') <> (v_remove.item_type = 'plastic_mold') THEN
    RAISE EXCEPTION 'mixed' USING DETAIL = 'A mold merges only into a mold, and a release only into a release.';
  END IF;

  v_reason := left(coalesce(NULLIF(btrim(p_reason), ''), 'Merged as a duplicate'), 1000);
  IF char_length(v_reason) < 3 THEN v_reason := 'Merged as a duplicate'; END IF;

  -- A member who wants both keeps their row on the kept entry; the other is saved.
  SELECT coalesce(jsonb_agg(to_jsonb(w.*)), '[]'::jsonb) INTO v_wish_folded
  FROM public.user_wishlists w
  WHERE w.catalog_id = p_remove
    AND EXISTS (SELECT 1 FROM public.user_wishlists k WHERE k.catalog_id = p_keep AND k.user_id = w.user_id);
  DELETE FROM public.user_wishlists w
  WHERE w.catalog_id = p_remove
    AND EXISTS (SELECT 1 FROM public.user_wishlists k WHERE k.catalog_id = p_keep AND k.user_id = w.user_id);

  -- One price flag per member per model: the same fold.
  SELECT coalesce(jsonb_agg(to_jsonb(f.*)), '[]'::jsonb) INTO v_flag_folded
  FROM public.catalog_price_signal_flags f
  WHERE f.catalog_item_id = p_remove
    AND EXISTS (
      SELECT 1 FROM public.catalog_price_signal_flags k
      WHERE k.catalog_item_id = p_keep AND k.reporter_id = f.reporter_id
    );
  DELETE FROM public.catalog_price_signal_flags f
  WHERE f.catalog_item_id = p_remove
    AND EXISTS (
      SELECT 1 FROM public.catalog_price_signal_flags k
      WHERE k.catalog_item_id = p_keep AND k.reporter_id = f.reporter_id
    );

  -- Move every link, keeping each moved row's id.
  WITH m AS (UPDATE public.user_horses SET catalog_id = p_keep WHERE catalog_id = p_remove RETURNING id)
  SELECT coalesce(array_agg(id), '{}') INTO v_horses FROM m;
  WITH m AS (UPDATE public.user_wishlists SET catalog_id = p_keep WHERE catalog_id = p_remove RETURNING id)
  SELECT coalesce(array_agg(id), '{}') INTO v_wishlists FROM m;
  WITH m AS (UPDATE public.id_suggestions SET catalog_id = p_keep WHERE catalog_id = p_remove RETURNING id)
  SELECT coalesce(array_agg(id), '{}') INTO v_id_sugs FROM m;
  WITH m AS (
    UPDATE public.catalog_suggestions SET catalog_item_id = p_keep WHERE catalog_item_id = p_remove RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_sugs FROM m;
  WITH m AS (
    UPDATE public.catalog_changelog SET catalog_item_id = p_keep WHERE catalog_item_id = p_remove RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_log FROM m;
  -- Releases filed under a merged mold move to the kept mold and take its
  -- scale (a release's scale follows its mold). Each old scale is saved,
  -- in links and in the History rows, so an unmerge puts it back.
  IF v_keep.scale IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_array(c.id, c.scale)), '[]'::jsonb) INTO v_rescaled
    FROM public.catalog_items c
    WHERE c.parent_id = p_remove AND c.id <> p_keep AND c.scale IS DISTINCT FROM v_keep.scale;
  END IF;
  WITH m AS (
    UPDATE public.catalog_items
    SET parent_id = p_keep, scale = coalesce(v_keep.scale, scale)
    WHERE parent_id = p_remove AND id <> p_keep RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_children FROM m;
  WITH m AS (
    UPDATE public.catalog_sale_reports SET catalog_item_id = p_keep WHERE catalog_item_id = p_remove RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_sales FROM m;
  WITH m AS (
    UPDATE public.catalog_price_signal_flags SET catalog_item_id = p_keep
    WHERE catalog_item_id = p_remove RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_flags FROM m;

  -- Old addresses that led to the duplicate now lead to the kept entry.
  WITH m AS (
    UPDATE public.catalog_slug_history SET item_id = p_keep WHERE item_id = p_remove
    RETURNING old_maker_slug, old_slug
  )
  SELECT coalesce(jsonb_agg(jsonb_build_array(old_maker_slug, old_slug)), '[]'::jsonb) INTO v_slugs FROM m;
  IF v_remove.maker_slug IS NOT NULL AND v_remove.slug IS NOT NULL THEN
    INSERT INTO public.catalog_slug_history (old_maker_slug, old_slug, item_id)
    VALUES (v_remove.maker_slug, v_remove.slug, p_keep)
    ON CONFLICT (old_maker_slug, old_slug) DO UPDATE SET item_id = EXCLUDED.item_id;
    v_slug_added := jsonb_build_array(v_remove.maker_slug, v_remove.slug);
  END IF;

  v_links := jsonb_build_object(
    'user_horses', to_jsonb(v_horses),
    'user_wishlists', to_jsonb(v_wishlists),
    'wishlists_folded', v_wish_folded,
    'id_suggestions', to_jsonb(v_id_sugs),
    'catalog_suggestions', to_jsonb(v_sugs),
    'catalog_changelog', to_jsonb(v_log),
    'children', to_jsonb(v_children),
    'sale_reports', to_jsonb(v_sales),
    'price_flags', to_jsonb(v_flags),
    'price_flags_folded', v_flag_folded,
    'slug_history', v_slugs,
    'slug_added', v_slug_added,
    'children_scales', v_rescaled
  );
  v_moved := cardinality(v_horses) + cardinality(v_wishlists) + cardinality(v_id_sugs) + cardinality(v_sugs)
           + cardinality(v_log) + cardinality(v_children) + cardinality(v_sales) + cardinality(v_flags);

  v_item := to_jsonb(v_remove) - 'sort_key' - 'search_key';
  INSERT INTO public.catalog_removed_items (item_id, item, kind, merged_into, reason, action_id, removed_by, links)
  VALUES (p_remove, v_item, 'merged', p_keep, v_reason, p_action_id, p_actor, v_links);

  DELETE FROM public.catalog_items WHERE id = p_remove;

  IF p_action_id IS NOT NULL THEN
    INSERT INTO public.registry_action_rows (action_id, catalog_item_id, before, after, outcome)
    VALUES (p_action_id, p_remove, v_item, jsonb_build_object('merged_into', p_keep), 'applied');
    -- One row per release whose scale followed the kept mold.
    INSERT INTO public.registry_action_rows (action_id, catalog_item_id, before, after, outcome)
    SELECT p_action_id, (e->>0)::uuid, jsonb_build_object('scale', e->1), jsonb_build_object('scale', v_keep.scale), 'applied'
    FROM jsonb_array_elements(v_rescaled) e;
    -- The confirmer of a second look is stamped here, in the same
    -- transaction as the merge, never by a confirm that lost the race.
    UPDATE public.registry_actions
    SET status = 'applied', applied_at = now(),
        row_count = 1 + jsonb_array_length(v_rescaled),
        second_look_by = CASE WHEN v_action.status = 'awaiting_second_look' THEN p_actor ELSE second_look_by END,
        second_look_at = CASE WHEN v_action.status = 'awaiting_second_look' THEN now() ELSE second_look_at END
    WHERE id = p_action_id;
  END IF;

  RETURN jsonb_build_object(
    'moved', v_moved, 'links', v_links, 'kept', p_keep, 'removed', p_remove,
    'rescaled', jsonb_array_length(v_rescaled)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registry_merge(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_merge(UUID, UUID, UUID, UUID, TEXT) TO service_role;

-- ── Putting an archived row back (shared by unmerge and restore) ──
-- Same id, explicit columns (no generated ones). If the old address is
-- taken now, slug is left NULL and the 129 trigger gives a new one; if
-- the mold it was filed under is gone, it comes back unfiled.

CREATE OR REPLACE FUNCTION public.registry_reinsert_item(p_item JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id          UUID := (p_item->>'id')::uuid;
  v_slug        TEXT := p_item->>'slug';
  v_parent      UUID := NULLIF(p_item->>'parent_id', '')::uuid;
  v_parent_lost BOOLEAN := false;
BEGIN
  IF EXISTS (SELECT 1 FROM public.catalog_items WHERE id = v_id) THEN
    RAISE EXCEPTION 'exists' USING DETAIL = 'That entry is already in the Registry.';
  END IF;
  IF v_slug IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.catalog_items WHERE maker_slug = p_item->>'maker_slug' AND slug = v_slug
  ) THEN
    v_slug := NULL;
  END IF;
  IF v_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.catalog_items WHERE id = v_parent) THEN
    v_parent := NULL;
    v_parent_lost := true;
  END IF;

  INSERT INTO public.catalog_items (
    id, item_type, parent_id, title, maker, maker_slug, slug, scale, attributes, artist, manufacturer, created_at
  ) VALUES (
    v_id,
    p_item->>'item_type',
    v_parent,
    p_item->>'title',
    p_item->>'maker',
    p_item->>'maker_slug',
    v_slug,
    p_item->>'scale',
    NULLIF(p_item->'attributes', 'null'::jsonb),
    p_item->>'artist',
    p_item->>'manufacturer',
    coalesce((p_item->>'created_at')::timestamptz, now())
  );

  RETURN jsonb_build_object(
    'slug', (SELECT slug FROM public.catalog_items WHERE id = v_id),
    'same_address', v_slug IS NOT NULL,
    'parent_lost', v_parent_lost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registry_reinsert_item(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_reinsert_item(JSONB) TO service_role;

-- ── 4. Unmerge ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.registry_unmerge(p_action_id UUID, p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a        public.registry_actions%ROWTYPE;
  r        public.catalog_removed_items%ROWTYPE;
  v_back   JSONB;
  v_keep   UUID;
  v_item   UUID;
  v_ids    UUID[];
  v_n      INT;
  v_back_n INT := 0;
  v_stay_n INT := 0;
  v_moved  JSONB := '{}'::jsonb;
  v_left   JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO a FROM public.registry_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING DETAIL = 'That merge is not in the history.'; END IF;
  IF a.kind <> 'merge' THEN RAISE EXCEPTION 'not_merge' USING DETAIL = 'That history entry is not a merge.'; END IF;
  IF a.status = 'undone' THEN RAISE EXCEPTION 'already_undone' USING DETAIL = 'That merge has already been undone.'; END IF;
  IF a.status <> 'applied' THEN RAISE EXCEPTION 'not_applied' USING DETAIL = 'That merge was never applied.'; END IF;

  SELECT * INTO r FROM public.catalog_removed_items
  WHERE action_id = p_action_id AND kind = 'merged' AND restored_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING DETAIL = 'The merged entry is not in the archive.'; END IF;
  IF r.restore_until < now() THEN
    RAISE EXCEPTION 'too_late' USING DETAIL = 'A merge can be undone for 30 days; this one is older.';
  END IF;

  v_keep := r.merged_into;
  v_item := r.item_id;
  v_back := public.registry_reinsert_item(r.item);

  -- Move links back only where they still point at the kept entry.
  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'user_horses', '[]'::jsonb))::uuid);
  WITH m AS (UPDATE public.user_horses SET catalog_id = v_item WHERE id = ANY(v_ids) AND catalog_id = v_keep RETURNING 1)
  SELECT count(*) INTO v_n FROM m;
  v_moved := v_moved || jsonb_build_object('user_horses', v_n);
  v_left := v_left || jsonb_build_object('user_horses', cardinality(v_ids) - v_n);
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'user_wishlists', '[]'::jsonb))::uuid);
  WITH m AS (UPDATE public.user_wishlists SET catalog_id = v_item WHERE id = ANY(v_ids) AND catalog_id = v_keep RETURNING 1)
  SELECT count(*) INTO v_n FROM m;
  v_moved := v_moved || jsonb_build_object('user_wishlists', v_n);
  v_left := v_left || jsonb_build_object('user_wishlists', cardinality(v_ids) - v_n);
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'id_suggestions', '[]'::jsonb))::uuid);
  WITH m AS (UPDATE public.id_suggestions SET catalog_id = v_item WHERE id = ANY(v_ids) AND catalog_id = v_keep RETURNING 1)
  SELECT count(*) INTO v_n FROM m;
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'catalog_suggestions', '[]'::jsonb))::uuid);
  WITH m AS (
    UPDATE public.catalog_suggestions SET catalog_item_id = v_item
    WHERE id = ANY(v_ids) AND catalog_item_id = v_keep RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'catalog_changelog', '[]'::jsonb))::uuid);
  WITH m AS (
    UPDATE public.catalog_changelog SET catalog_item_id = v_item
    WHERE id = ANY(v_ids) AND catalog_item_id = v_keep RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'children', '[]'::jsonb))::uuid);
  WITH m AS (
    UPDATE public.catalog_items SET parent_id = v_item WHERE id = ANY(v_ids) AND parent_id = v_keep RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_moved := v_moved || jsonb_build_object('children', v_n);
  v_left := v_left || jsonb_build_object('children', cardinality(v_ids) - v_n);
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  -- Releases that took the kept mold's scale get their own back: only
  -- those now filed under the restored mold again, and only while they
  -- still hold the scale the merge gave them.
  WITH m AS (
    UPDATE public.catalog_items c SET scale = rr.before->>'scale'
    FROM public.registry_action_rows rr
    WHERE rr.action_id = p_action_id AND rr.catalog_item_id = c.id AND rr.after ? 'scale'
      AND c.parent_id = v_item AND c.scale IS NOT DISTINCT FROM rr.after->>'scale'
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_moved := v_moved || jsonb_build_object('scales', v_n);

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'sale_reports', '[]'::jsonb))::uuid);
  WITH m AS (
    UPDATE public.catalog_sale_reports SET catalog_item_id = v_item
    WHERE id = ANY(v_ids) AND catalog_item_id = v_keep RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'price_flags', '[]'::jsonb))::uuid);
  WITH m AS (
    UPDATE public.catalog_price_signal_flags SET catalog_item_id = v_item
    WHERE id = ANY(v_ids) AND catalog_item_id = v_keep RETURNING 1
  )
  SELECT count(*) INTO v_n FROM m;
  v_back_n := v_back_n + v_n; v_stay_n := v_stay_n + cardinality(v_ids) - v_n;

  -- Folded rows come back where nothing now conflicts.
  INSERT INTO public.user_wishlists
  SELECT (jsonb_populate_record(NULL::public.user_wishlists, e)).*
  FROM jsonb_array_elements(coalesce(r.links->'wishlists_folded', '[]'::jsonb)) e
  ON CONFLICT DO NOTHING;
  INSERT INTO public.catalog_price_signal_flags
  SELECT (jsonb_populate_record(NULL::public.catalog_price_signal_flags, e)).*
  FROM jsonb_array_elements(coalesce(r.links->'price_flags_folded', '[]'::jsonb)) e
  ON CONFLICT DO NOTHING;

  -- Old addresses that led to it lead to it again.
  UPDATE public.catalog_slug_history h SET item_id = v_item
  FROM jsonb_array_elements(coalesce(r.links->'slug_history', '[]'::jsonb)) e
  WHERE h.old_maker_slug = e->>0 AND h.old_slug = e->>1 AND h.item_id = v_keep;
  -- Its own address no longer forwards (the 233 trigger already dropped it
  -- when the row took that address back).
  IF jsonb_typeof(r.links->'slug_added') = 'array' THEN
    DELETE FROM public.catalog_slug_history
    WHERE old_maker_slug = r.links->'slug_added'->>0 AND old_slug = r.links->'slug_added'->>1
      AND item_id = v_keep
      AND EXISTS (SELECT 1 FROM public.catalog_items x
                  WHERE x.id = v_item AND x.maker_slug = r.links->'slug_added'->>0
                    AND x.slug = r.links->'slug_added'->>1);
  END IF;

  UPDATE public.catalog_removed_items
  SET restored_at = now(), restored_by = p_actor, restored_slug = v_back->>'slug'
  WHERE id = r.id;
  UPDATE public.registry_actions SET status = 'undone', undone_by = p_actor, undone_at = now() WHERE id = a.id;

  RETURN jsonb_build_object(
    'item_id', v_item,
    'restored', v_back_n,
    'left', v_stay_n,
    'moved', v_moved,
    'left_by_kind', v_left,
    'slug', v_back->>'slug',
    'same_address', v_back->'same_address',
    'parent_lost', v_back->'parent_lost'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registry_unmerge(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_unmerge(UUID, UUID) TO service_role;

-- ── 5. Remove a row nothing points at ────────────────────────

CREATE OR REPLACE FUNCTION public.registry_remove(p_item UUID, p_action_id UUID, p_actor UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row    public.catalog_items%ROWTYPE;
  v_counts JSONB;
  v_item   JSONB;
  v_slugs  JSONB;
  v_log    UUID[];
  v_sugs   UUID[];
  v_reason TEXT := btrim(coalesce(p_reason, ''));
  v_archive UUID;
  v_action public.registry_actions%ROWTYPE;
BEGIN
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'reason' USING DETAIL = 'Give a reason of 3 to 1,000 characters.';
  END IF;
  -- The History entry is written as pending just before this runs; it
  -- turns applied here, in the same transaction, and never twice.
  IF p_action_id IS NOT NULL THEN
    SELECT * INTO v_action FROM public.registry_actions WHERE id = p_action_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not_found' USING DETAIL = 'That removal is not in the history.';
    END IF;
    IF v_action.applied_at IS NOT NULL OR v_action.status <> 'pending' THEN
      RAISE EXCEPTION 'already_applied' USING DETAIL = 'This removal has already been made.';
    END IF;
  END IF;
  SELECT * INTO v_row FROM public.catalog_items WHERE id = p_item FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing' USING DETAIL = 'That entry no longer exists.'; END IF;

  v_counts := public.registry_link_counts(p_item);
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_counts) WHERE value::int > 0) THEN
    RAISE EXCEPTION 'linked' USING DETAIL = v_counts::text;
  END IF;

  -- Old addresses cascade away with the row; keep them to put back.
  SELECT coalesce(jsonb_agg(jsonb_build_array(old_maker_slug, old_slug)), '[]'::jsonb) INTO v_slugs
  FROM public.catalog_slug_history WHERE item_id = p_item;
  -- The changelog's foreign key (091) has no ON DELETE and would block.
  WITH m AS (UPDATE public.catalog_changelog SET catalog_item_id = NULL WHERE catalog_item_id = p_item RETURNING id)
  SELECT coalesce(array_agg(id), '{}') INTO v_log FROM m;
  -- Decided suggestions null themselves (ON DELETE SET NULL); keep their ids.
  SELECT coalesce(array_agg(id), '{}') INTO v_sugs FROM public.catalog_suggestions WHERE catalog_item_id = p_item;

  v_item := to_jsonb(v_row) - 'sort_key' - 'search_key';
  INSERT INTO public.catalog_removed_items (item_id, item, kind, reason, action_id, removed_by, links)
  VALUES (
    p_item, v_item, 'removed', v_reason, p_action_id, p_actor,
    jsonb_build_object('slug_history', v_slugs, 'catalog_changelog', to_jsonb(v_log), 'catalog_suggestions', to_jsonb(v_sugs))
  )
  RETURNING id INTO v_archive;

  DELETE FROM public.catalog_items WHERE id = p_item;

  IF p_action_id IS NOT NULL THEN
    INSERT INTO public.registry_action_rows (action_id, catalog_item_id, before, after, outcome)
    VALUES (p_action_id, p_item, v_item, NULL, 'applied');
    UPDATE public.registry_actions SET status = 'applied', applied_at = now() WHERE id = p_action_id;
  END IF;

  RETURN jsonb_build_object('removed_id', v_archive, 'item_id', p_item);
END;
$$;

REVOKE ALL ON FUNCTION public.registry_remove(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_remove(UUID, UUID, UUID, TEXT) TO service_role;

-- ── 6. Restore a removed row ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.registry_restore(p_removed_id UUID, p_actor UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r      public.catalog_removed_items%ROWTYPE;
  v_back JSONB;
  v_ids  UUID[];
BEGIN
  SELECT * INTO r FROM public.catalog_removed_items WHERE id = p_removed_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING DETAIL = 'That removal is not in the archive.'; END IF;
  IF r.kind <> 'removed' THEN
    RAISE EXCEPTION 'not_removed' USING DETAIL = 'That entry was merged; undo the merge instead.';
  END IF;
  IF r.restored_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_restored' USING DETAIL = 'That entry has already been put back.';
  END IF;
  IF r.restore_until < now() THEN
    RAISE EXCEPTION 'too_late' USING DETAIL = 'A removal can be undone for 30 days; this one is older.';
  END IF;

  v_back := public.registry_reinsert_item(r.item);

  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'catalog_changelog', '[]'::jsonb))::uuid);
  UPDATE public.catalog_changelog SET catalog_item_id = r.item_id
  WHERE id = ANY(v_ids) AND catalog_item_id IS NULL;
  v_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(r.links->'catalog_suggestions', '[]'::jsonb))::uuid);
  UPDATE public.catalog_suggestions SET catalog_item_id = r.item_id
  WHERE id = ANY(v_ids) AND catalog_item_id IS NULL;
  -- Old addresses forward again, unless a live page holds one now.
  INSERT INTO public.catalog_slug_history (old_maker_slug, old_slug, item_id)
  SELECT e->>0, e->>1, r.item_id
  FROM jsonb_array_elements(coalesce(r.links->'slug_history', '[]'::jsonb)) e
  WHERE NOT EXISTS (SELECT 1 FROM public.catalog_items x WHERE x.maker_slug = e->>0 AND x.slug = e->>1)
  ON CONFLICT (old_maker_slug, old_slug) DO NOTHING;

  UPDATE public.catalog_removed_items
  SET restored_at = now(), restored_by = p_actor, restored_slug = v_back->>'slug'
  WHERE id = r.id;
  IF r.action_id IS NOT NULL THEN
    UPDATE public.registry_actions SET status = 'undone', undone_by = p_actor, undone_at = now()
    WHERE id = r.action_id;
  END IF;

  RETURN jsonb_build_object(
    'item_id', r.item_id,
    'slug', v_back->>'slug',
    'same_address', v_back->'same_address',
    'parent_lost', v_back->'parent_lost'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registry_restore(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_restore(UUID, UUID) TO service_role;

RESET lock_timeout;

NOTIFY pgrst, 'reload schema';
