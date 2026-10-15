-- Export the admin Roadmap tab before it is retired (2026-10-15).
-- Read-only. Paste into the Supabase SQL editor, run, and copy the result
-- into the conversation. Items from the original seed (migration 230) are
-- already tickets on the Backlog board; this lists what was added or changed
-- since, plus every comment and change in the history, so nothing is lost.

SELECT 'item' AS what, i.created_at AS at, i.title,
       i.detail AS text,
       concat_ws(' · ', i.kind, i.horizon, i.status, 'p' || i.priority, nullif(i.area, ''),
                 nullif(i.source, ''), nullif(i.link, ''), i.due_on::text) AS facts
FROM public.roadmap_items i
WHERE i.created_at > (SELECT min(created_at) + interval '1 minute' FROM public.roadmap_items)
   OR i.updated_at > i.created_at + interval '1 minute'
UNION ALL
SELECT e.kind, e.created_at, r.title, e.body, e.changes::text
FROM public.roadmap_events e
JOIN public.roadmap_items r ON r.id = e.item_id
WHERE e.kind IN ('comment', 'change')
ORDER BY at;
