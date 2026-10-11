-- ============================================================
-- 229: a member's outbound links on their profile
--
-- "Links to Facebook groups and the transaction board would be super
-- cool… or we could just link in our bios" (member, 2026-10-11). The
-- bio was plain text, so neither worked. Profiles now carry the same
-- links block the Art Studio has had since 212, with one extra slot
-- for a trader's feedback board: {facebook, instagram, website,
-- feedback} as full https URLs, normalised in src/lib/links/memberLinks.
--
-- users has column-level SELECT grants (133); a new column is
-- invisible to every reader until it is granted — 142 and 171 hit the
-- same trap. The payload is exactly what the member chose to publish on
-- their own public profile, so it is granted to anon as well.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.links IS
  'Outbound links the member chose to show on their profile: {facebook, instagram, website, feedback} as full https URLs (229). Normalised by src/lib/links/memberLinks.';

GRANT SELECT (links) ON public.users TO anon, authenticated;
