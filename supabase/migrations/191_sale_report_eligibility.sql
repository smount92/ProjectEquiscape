-- ============================================================
-- 191: Who may report a sale
--
-- Reporting a sale moves a price the whole hobby may end up trusting, so
-- it needs a higher bar than reading one. Three conditions, all checked
-- in one place:
--
--   * a real, active, non-test account   (not anon, not deleted)
--   * not suspended                      (a struck member stays struck)
--   * older than SALE_REPORT_MIN_AGE     (a fresh account cannot arrive
--                                         and immediately move a price)
--
-- WHY THE AGE GATE IS MODEST. Seven days stops the throwaway account
-- created to push one number; it does not pretend to stop a patient
-- adversary, and it must not lock out genuine new members — MODEL HORSES
-- INTERNATIONAL joined recently and is already the second most active
-- catalog contributor. The real defences against manipulation are the
-- aggregation rules (several sales, several members, one listing one data
-- point, outliers dropped, self-reported never priced from). This gate
-- only raises the cost of the cheapest attack.
--
-- WHY A SECURITY DEFINER HELPER RATHER THAN A JOIN IN THE POLICY. This is
-- the lesson of 186. RLS policies and security_invoker views run with the
-- CALLER's permissions, so a policy that reads users.created_at or
-- users.is_suspended directly would require every member to hold SELECT
-- on those columns. They do not, and the failure is silent — 169 broke
-- the entire Members room this exact way and nobody noticed until a
-- member said the room looked empty. The helper returns only a boolean.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_report_sales(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.account_status = 'active'
        AND u.is_test_account = false
        AND COALESCE(u.is_suspended, false) = false
        AND u.deleted_at IS NULL
        AND u.created_at <= now() - interval '7 days'
     FROM users u
     WHERE u.id = p_user_id),
    false  -- No such user: not eligible. Absence is never permission.
  );
$$;

COMMENT ON FUNCTION public.can_report_sales(UUID) IS
  'Boolean-only DEFINER check of sale-report eligibility: active, non-test, unsuspended, not deleted, account older than 7 days. Same pattern as is_user_suspended (186) — views and RLS policies must never read those user columns directly.';

REVOKE ALL ON FUNCTION public.can_report_sales(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_report_sales(UUID) TO anon, authenticated, service_role;

-- Replace the insert policy: still "as yourself", now also "eligible".
DROP POLICY IF EXISTS "members file their own reports" ON public.catalog_sale_reports;
CREATE POLICY "eligible members file their own reports"
    ON public.catalog_sale_reports FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = reporter_id
        AND public.can_report_sales((SELECT auth.uid()))
    );

-- Anon was already read-only and stays that way. Stated explicitly here
-- because it is a deliberate decision rather than an oversight: a price
-- claim has to be attributable to a person, or it is worth nothing.
REVOKE INSERT, UPDATE, DELETE ON public.catalog_sale_reports FROM anon;

-- Verify (with CLIENT keys — the SQL editor runs as postgres and would
-- report success for all of these):
--   1. SELECT public.can_report_sales('<a day-old account>')  -> false
--   2. SELECT public.can_report_sales('<an established account>') -> true
--   3. SELECT public.can_report_sales(gen_random_uuid())      -> false
--   4. Signed in as a day-old account, INSERT is denied.
--   5. Signed out, SELECT still works and INSERT is still denied.
