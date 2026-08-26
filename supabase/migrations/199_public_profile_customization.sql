-- ============================================================
-- 199: profile cosmetics visible to logged-out visitors
--
-- profile_customization lives as a column on public.users, and users
-- has NO anon SELECT policy — so the exact payload a member designed
-- for their PUBLIC profile page (banner, tagline, theme) renders only
-- for logged-in viewers. A logged-out visitor (or Google) sees the
-- default plain profile: MHI's banner and tagline vanished the moment
-- she signed out. 171 even predicted this ("the anon grant is inert
-- while users has no anon SELECT policy").
--
-- Same shape as 198: a SECURITY DEFINER read exposing exactly the
-- thing that is public by intent, and nothing else. Returns NULL for
-- suspended accounts — their profile page is a moderation notice, and
-- their cosmetics should not outlive that.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_profile_customization(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.profile_customization
    FROM users u
    WHERE u.id = p_user_id
      AND COALESCE(u.is_suspended, false) = false;
$$;

REVOKE ALL ON FUNCTION public.get_profile_customization(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_customization(uuid) TO anon, authenticated;

-- Verify:
--   1. As an anon client key:
--        SELECT get_profile_customization('<MHI user id>');
--      -- returns her customization JSONB (banner path, tagline, theme)
--   2. Any other users column stays unreadable to anon as before.
