-- ============================================================
-- 232: a catalog row's page address follows its maker
--
-- Migration 129 set maker_slug and slug once, on insert. A later
-- correction to the maker left the page under the old maker: one
-- D'Arry Jone Frank resin still lives at /reference/paul-sanders/…,
-- and the maker page for D'Arry Jone Frank does not list it. The
-- 2026-10-15 Registry repair corrects maker spellings ("grace newhouse",
-- "Maggie Bennett.", "?"), so from here on a change of maker recomputes
-- maker_slug, and the slug takes a -N suffix only if the new maker
-- already uses it. A title change still keeps the slug: published
-- links to a model must not move when its name is tidied.
-- ============================================================

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
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS catalog_items_maker_slug_bu ON public.catalog_items;
CREATE TRIGGER catalog_items_maker_slug_bu
  BEFORE UPDATE OF maker ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_items_maker_slug_update();
