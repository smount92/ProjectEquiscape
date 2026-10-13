-- Repair for the first "fill in what you know" corrections from the
-- reference linker (2026-10-13). The action stored each fact as a bare
-- value, {"color_description": "black"}, where every suggestion surface
-- and the apply path expect {"color_description": {"from": "", "to": "black"}}.
-- Thirteen pending rows read "undefined → undefined" on the admin queue
-- and would have applied nothing. This rewrites only those rows: pending
-- corrections with the linker's reason whose values are not objects, and
-- fills `from` with what the Registry holds today so the diff is honest.
--
-- Run the SELECT first; the UPDATE touches the same rows and nothing else.

-- 1. Dry run: what will change
SELECT s.id, s.created_at, s.field_changes AS before,
       (SELECT jsonb_object_agg(e.key, jsonb_build_object(
                 'from', coalesce(ci.attributes ->> e.key, ''),
                 'to',   e.value #>> '{}'))
          FROM jsonb_each(s.field_changes) e) AS after
FROM public.catalog_suggestions s
LEFT JOIN public.catalog_items ci ON ci.id = s.catalog_item_id
WHERE s.status = 'pending'
  AND s.suggestion_type = 'correction'
  AND s.reason LIKE 'Filled in from the reference linker%'
  AND EXISTS (SELECT 1 FROM jsonb_each(s.field_changes) x WHERE jsonb_typeof(x.value) <> 'object');

-- 2. The repair
UPDATE public.catalog_suggestions s
SET field_changes = (
      SELECT jsonb_object_agg(e.key, jsonb_build_object(
               'from', coalesce(ci.attributes ->> e.key, ''),
               'to',   e.value #>> '{}'))
        FROM jsonb_each(s.field_changes) e)
FROM public.catalog_items ci
WHERE ci.id = s.catalog_item_id
  AND s.status = 'pending'
  AND s.suggestion_type = 'correction'
  AND s.reason LIKE 'Filled in from the reference linker%'
  AND EXISTS (SELECT 1 FROM jsonb_each(s.field_changes) x WHERE jsonb_typeof(x.value) <> 'object');
