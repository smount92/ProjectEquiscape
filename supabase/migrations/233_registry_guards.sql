-- ============================================================
-- 233: Registry guards: old addresses forward, values are checked,
--      links and history can't be lost
--
-- Release 1 (2026-10), tickets MHH-001, MHH-010, MHH-011.
--
-- 1. catalog_slug_history: every address a Registry page has had. When a
--    maker correction moves a page (232) or a duplicate is merged away,
--    the old address is recorded and the site forwards it to the page's
--    current address instead of showing "not found" (owner ruling Q1).
-- 2. updated_at on catalog_items and user_horses, kept by one shared
--    trigger function.
-- 3. The database refuses a scale, run type or material outside the
--    Registry's lists (src/lib/catalog/taxonomy.ts and editableFields.ts;
--    a test fails if the lists here and there ever differ). Added NOT VALID
--    and then validated, so a stray old row can't stop the migration; if
--    validation fails, a NOTICE says which check, and new writes are still
--    checked.
-- 4. A member can't have the same model on their want list twice (the
--    guard went missing in 052). Existing exact duplicates are folded into
--    the oldest row first.
-- 5. A catalog row that a horse or a want list points at can no longer be
--    deleted (it used to silently unlink them). Duplicates are merged,
--    which moves those links first, so merging keeps working.
-- 6. A horse's permanent history (ownership, transfers, show results,
--    cards, titles, condition, work records, papers) can no longer be
--    erased by deleting the horse. Horses are soft-deleted, so nothing on
--    the site changes; this stops a hard delete from wiping history. One
--    consequence: deleting a member outright in the Supabase dashboard is
--    refused if their horses have history (members delete themselves
--    from Settings, which is a soft delete).
--
-- Safe to paste twice.
-- ============================================================

-- ── 1. Old addresses ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.catalog_slug_history (
  old_maker_slug TEXT NOT NULL,
  old_slug       TEXT NOT NULL,
  item_id        UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (old_maker_slug, old_slug)
);
CREATE INDEX IF NOT EXISTS idx_catalog_slug_history_item ON public.catalog_slug_history (item_id);

ALTER TABLE public.catalog_slug_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads old Registry addresses" ON public.catalog_slug_history;
CREATE POLICY "Anyone reads old Registry addresses" ON public.catalog_slug_history
  FOR SELECT USING (true);

-- 232's trigger, now also recording the address it moves away from.
CREATE OR REPLACE FUNCTION public.trg_catalog_items_maker_slug_update()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE candidate TEXT; n INT := 1;
BEGIN
  IF NEW.maker IS DISTINCT FROM OLD.maker THEN
    NEW.maker_slug := public.catalog_slugify(NEW.maker);
    IF NEW.maker_slug IS DISTINCT FROM OLD.maker_slug THEN
      candidate := coalesce(NULLIF(NEW.slug, ''), 'item-' || left(NEW.id::text, 8));
      WHILE EXISTS (
        SELECT 1 FROM public.catalog_items
        WHERE maker_slug = NEW.maker_slug AND slug = candidate AND id <> NEW.id
      ) LOOP
        n := n + 1;
        candidate := coalesce(NULLIF(NEW.slug, ''), 'item-' || left(NEW.id::text, 8)) || '-' || n;
      END LOOP;
      NEW.slug := candidate;
    END IF;
  END IF;
  IF OLD.maker_slug IS NOT NULL AND OLD.slug IS NOT NULL
     AND (NEW.maker_slug IS DISTINCT FROM OLD.maker_slug OR NEW.slug IS DISTINCT FROM OLD.slug) THEN
    INSERT INTO public.catalog_slug_history (old_maker_slug, old_slug, item_id)
    VALUES (OLD.maker_slug, OLD.slug, NEW.id)
    ON CONFLICT (old_maker_slug, old_slug) DO UPDATE SET item_id = EXCLUDED.item_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS catalog_items_maker_slug_bu ON public.catalog_items;
CREATE TRIGGER catalog_items_maker_slug_bu
  BEFORE UPDATE OF maker, maker_slug, slug ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_items_maker_slug_update();

-- The duplicate deleted by the 2026-10-15 repair: /reference/breyer/silky-sullivan
-- forwards to the Stablemate Silky Sullivan mold that was kept.
INSERT INTO public.catalog_slug_history (old_maker_slug, old_slug, item_id)
SELECT 'breyer', 'silky-sullivan', m.id
FROM public.catalog_items m
WHERE m.item_type = 'plastic_mold' AND m.maker = 'Breyer' AND m.scale = 'Stablemate (1:32)'
  AND m.title ILIKE 'Silky Sullivan%'
  AND NOT EXISTS (SELECT 1 FROM public.catalog_items x WHERE x.maker_slug = 'breyer' AND x.slug = 'silky-sullivan')
ORDER BY m.created_at
LIMIT 1
ON CONFLICT (old_maker_slug, old_slug) DO NOTHING;

-- ── 2. updated_at ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.user_horses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_horses_updated_at ON public.user_horses;
CREATE TRIGGER trg_user_horses_updated_at
  BEFORE UPDATE ON public.user_horses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Registry values ────────────────────────────────────────
-- Lists must match taxonomy.ts CANONICAL_SCALES and RUN_TYPES and
-- editableFields.ts MATERIAL_OPTIONS (src/__tests__/registry-vocabulary.test.ts).

ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS catalog_items_scale_check;
ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_scale_check CHECK (
  scale IS NULL OR scale IN (
    'Large Traditional (1:8)', 'Traditional (1:9)', 'Small Traditional (1:10)', 'Classic (1:12)',
    'Pebbles (1:18)', '1:20', 'Paddock Pal (1:24)', 'Stablemate (1:32)', 'Mini Whinnies (1:64)',
    'Venti', 'Curio', 'Micro Mini', 'Plush', 'Other'
  )
) NOT VALID;

ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS catalog_items_run_type_check;
ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_run_type_check CHECK (
  attributes->>'run_type' IS NULL OR attributes->>'run_type' IN (
    'Regular Run', 'Special Run', 'BreyerFest', 'Collector''s Club', 'Web Special',
    'Store Special', 'Test Run', 'One of a Kind', 'Other'
  )
) NOT VALID;

ALTER TABLE public.catalog_items DROP CONSTRAINT IF EXISTS catalog_items_material_check;
ALTER TABLE public.catalog_items ADD CONSTRAINT catalog_items_material_check CHECK (
  attributes->>'material' IS NULL OR attributes->>'material' IN (
    'Plastic', 'Rubber/PVC/Vinyl', 'Resin', 'Pewter', 'China/Ceramic', 'Metal', 'Other'
  )
) NOT VALID;

DO $$
DECLARE c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['catalog_items_scale_check', 'catalog_items_run_type_check', 'catalog_items_material_check'] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.catalog_items VALIDATE CONSTRAINT %I', c);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE '233: % not validated: some existing rows break it. New writes are still checked; send this notice to the developer.', c;
    END;
  END LOOP;
END $$;

-- ── 4. One want-list row per model ────────────────────────────

DELETE FROM public.user_wishlists w
USING public.user_wishlists keep
WHERE w.catalog_id IS NOT NULL
  AND w.user_id = keep.user_id
  AND w.catalog_id = keep.catalog_id
  AND (keep.created_at, keep.id) < (w.created_at, w.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wishlists_user_catalog
  ON public.user_wishlists (user_id, catalog_id)
  WHERE catalog_id IS NOT NULL;

-- ── 5 and 6. Foreign keys that must refuse a delete ───────────

DO $$
DECLARE
  spec RECORD;
  con  RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      -- Member links to the Registry (5): merge moves these first.
      ('user_horses', 'catalog_id', 'catalog_items'),
      ('user_wishlists', 'catalog_id', 'catalog_items'),
      -- A horse's permanent history (6).
      ('horse_ownership_history', 'horse_id', 'user_horses'),
      ('horse_transfers', 'horse_id', 'user_horses'),
      ('horse_timeline', 'horse_id', 'user_horses'),
      ('show_records', 'horse_id', 'user_horses'),
      ('show_class_entries', 'horse_id', 'user_horses'),
      ('qualification_cards', 'horse_id', 'user_horses'),
      ('horse_titles', 'horse_id', 'user_horses'),
      ('condition_history', 'horse_id', 'user_horses'),
      ('customization_logs', 'horse_id', 'user_horses'),
      ('horse_papers', 'horse_id', 'user_horses'),
      ('horse_accomplishments', 'horse_id', 'user_horses')
    ) AS t(tbl, col, ref)
  LOOP
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_class refrel ON refrel.oid = c.confrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND ns.nspname = 'public'
        AND rel.relname = spec.tbl AND refrel.relname = spec.ref AND a.attname = spec.col
        AND array_length(c.conkey, 1) = 1
        AND c.confdeltype IN ('c', 'n', 'd')
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, con.conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE RESTRICT NOT VALID',
        spec.tbl, con.conname, spec.col, spec.ref);
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', spec.tbl, con.conname);
    END LOOP;
  END LOOP;
END $$;
