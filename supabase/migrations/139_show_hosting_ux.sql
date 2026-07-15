-- 139: show-hosting UX batch (SHOWUX tier, owner feedback 2026-07-15)
--
-- 1. shows.about_md — free-text "About this show" welcome/description,
--    rendered above Rules on the public page. Rules/fees stayed, this
--    is the missing human introduction.
-- 2. show_fee_payments — the "fees v1 = manual checklist" that the
--    code comments promised but was never built. One row per entrant
--    per show, marked by a host/co-host. Fee stays informational
--    (fee_info text); this just tracks who has squared up.
--
-- APPLY BEFORE merging the feat/shows-host-ux branch, then gen-types.

ALTER TABLE public.shows
    ADD COLUMN IF NOT EXISTS about_md TEXT;

COMMENT ON COLUMN public.shows.about_md IS
    'Host-written About/welcome text; shown above rules on the public show page.';

CREATE TABLE IF NOT EXISTS public.show_fee_payments (
    show_id    uuid        NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    paid_at    timestamptz NOT NULL DEFAULT now(),
    marked_by  uuid        NOT NULL REFERENCES public.users(id),
    PRIMARY KEY (show_id, user_id)
);

ALTER TABLE public.show_fee_payments ENABLE ROW LEVEL SECURITY;

-- Hosts/co-hosts keep the checklist for their show.
CREATE POLICY "Managers manage fee checklist"
  ON public.show_fee_payments FOR ALL
  TO authenticated
  USING (show_role_check(show_id, ARRAY['host', 'co_host']))
  WITH CHECK (show_role_check(show_id, ARRAY['host', 'co_host']));

-- An entrant may see their own paid status.
CREATE POLICY "Entrants read own fee status"
  ON public.show_fee_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
