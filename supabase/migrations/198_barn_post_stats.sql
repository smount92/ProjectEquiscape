-- ============================================================
-- 198: barn post stats visible to everyone — the empty-room fix
--
-- The barns directory shows "N posts · last post <date>" on every card,
-- but the query behind it runs under posts RLS, where group posts are
-- members-only. So a brand-new member (or any non-member) sees "0
-- posts" on every barn — the room looks dead to exactly the people
-- deciding whether to walk in. Post COUNTS and a last-post date are not
-- content; hiding them defends nothing and costs the first impression.
--
-- SECURITY DEFINER, aggregate-only (the get_catalog_stats pattern):
-- returns counts and timestamps, never content, and only for barns that
-- are not private. Private barns are absent from the result on purpose
-- — their stats keep coming from the caller's own RLS-scoped query,
-- so members see them and outsiders don't.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_barn_post_stats(p_group_ids uuid[])
RETURNS TABLE (group_id uuid, post_count bigint, last_post_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.group_id,
           count(*) + COALESCE(sum(p.replies_count), 0) AS post_count,
           max(COALESCE(p.bumped_at, p.created_at))     AS last_post_at
    FROM posts p
    JOIN groups g ON g.id = p.group_id
    WHERE p.group_id = ANY(p_group_ids)
      AND p.parent_id IS NULL
      AND COALESCE(g.is_private, false) = false
    GROUP BY p.group_id;
$$;

REVOKE ALL ON FUNCTION public.get_barn_post_stats(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_barn_post_stats(uuid[]) TO anon, authenticated;

-- Verify:
--   1. As an anon client key: SELECT * FROM get_barn_post_stats(
--        ARRAY[(SELECT id FROM groups WHERE name = 'MHH - Suggestion Box')]::uuid[]);
--      -- returns 1 row with post_count >= 2 (the thread + its reply)
--   2. A private barn's id in the array returns NO row for it.
