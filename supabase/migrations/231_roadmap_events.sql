-- ============================================================
-- 231: roadmap history — notes and recorded changes per item
--
-- "A spot to enter text, and a history as well — think of a Jira
-- board" (owner, 2026-10-12). Every roadmap item gets a thread: notes
-- the owners type, plus one row the server writes whenever a tracked
-- field changes (status, horizon, priority, due…), so the board can
-- answer "what happened to this and when". Same access shape as 230:
-- service role only, RLS on with no policies, revoked from the API
-- roles. Deleting an item deletes its history.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roadmap_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('created', 'comment', 'change')),
  body        TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  -- [{field, from, to}] as display strings; empty for notes.
  changes     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roadmap_events IS
  'History of a roadmap item: owner notes (comment) and recorded field changes (change), plus one created row (231). Service role only.';

CREATE INDEX IF NOT EXISTS roadmap_events_item_idx ON public.roadmap_events (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS roadmap_events_recent_idx ON public.roadmap_events (created_at DESC);

ALTER TABLE public.roadmap_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roadmap_events FROM anon, authenticated;

-- Every item that exists already gets its opening line, so no thread starts empty.
INSERT INTO public.roadmap_events (item_id, kind, body, created_at)
SELECT i.id, 'created', 'Seeded from the 2026-10-12 backlog', i.created_at
FROM public.roadmap_items i
WHERE NOT EXISTS (SELECT 1 FROM public.roadmap_events e WHERE e.item_id = i.id AND e.kind = 'created');
