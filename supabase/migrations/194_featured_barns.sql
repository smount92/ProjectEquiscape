-- ============================================================
-- 194: Featured barns
--
-- The official barns — The Suggestion Box and Help Desk, suggested by
-- MODEL HORSES INTERNATIONAL — need to sit at the top of the barn
-- directory, or a new member never finds where to report a bug. A full
-- pin system would be machinery without a load at nine barns; one flag
-- and a sort is the whole feature.
-- ============================================================

ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.is_featured IS
  'Featured barns sort to the top of the directory and wear an Official stamp. Set by the owner in SQL — deliberately not exposed in any UI, so it cannot be self-assigned.';

-- After creating the two official barns in the UI, feature them with:
--
--   UPDATE groups SET is_featured = true
--   WHERE slug IN ('the-suggestion-box', 'help-desk');
--
-- (Adjust the slugs to whatever the create form produced — check with
--  SELECT slug, name FROM groups ORDER BY created_at DESC LIMIT 5;)
