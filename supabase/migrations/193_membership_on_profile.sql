-- ============================================================
-- 193: Opt-in membership display on profiles
--
-- Whether a member's Pro/Studio standing shows on their public profile.
-- Owner decision 2026-08-23: PRIVATE BY DEFAULT, opt-in to display.
--
-- The reasoning, so it survives the conversation that produced it:
--   * Paid status is billing information. Some members would rather not
--     advertise what they spend on the hobby; that is their call.
--   * Trust must never look purchasable. Curator medals are EARNED
--     (approved suggestions); a paid chip rendering in the same space
--     would blur the two, and the earned kind is the site's currency.
--   * The one-time Supporter purchase already shows unconditionally —
--     deliberately, because with Supporter the recognition IS the product
--     ("Supporter unlocks nothing"). Pro's product is features, so its
--     display is incidental and therefore the member's choice.
--
-- WHY A DEFINER FUNCTION. The tier of record lives in
-- auth.users.raw_app_meta_data (see paypal/entitlement), which no client
-- can read for another user — correctly. The profile page therefore asks
-- this boolean-ish helper, which reveals exactly one bit ("displays as a
-- member") and only when the target opted in. Same pattern as
-- is_user_suspended (186) and can_report_sales (191).
--
-- THE ENTITLEMENT CLOCK APPLIES HERE TOO (src/lib/entitlement/clock.ts):
--   1. absent paid_through means forever, never expired
--   2. the check happens at read time
--   3. unparseable keeps access — a garbled date is our bug, not theirs
-- A lapsed member must not keep wearing the chip just because nothing
-- rewrote their tier yet.
-- ============================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS show_membership_on_profile BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.show_membership_on_profile IS
  'Member opt-IN to display their Pro/Studio membership on their public profile. Default off: paid status is billing information, and trust must never look purchasable.';

CREATE OR REPLACE FUNCTION public.public_membership_label(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_opted_in BOOLEAN;
    v_tier TEXT;
    v_paid_through TEXT;
    v_expiry TIMESTAMPTZ;
BEGIN
    SELECT u.show_membership_on_profile INTO v_opted_in
    FROM users u WHERE u.id = p_user_id;
    IF v_opted_in IS DISTINCT FROM true THEN
        RETURN NULL;  -- not opted in, or no such user: nothing to show
    END IF;

    SELECT au.raw_app_meta_data->>'tier',
           au.raw_app_meta_data->>'paid_through'
    INTO v_tier, v_paid_through
    FROM auth.users au WHERE au.id = p_user_id;

    IF v_tier IS NULL OR v_tier NOT IN ('pro', 'studio') THEN
        RETURN NULL;
    END IF;

    -- Entitlement clock, mirrored: absent means forever; expired means
    -- free; unparseable keeps access (our bug, not the member's).
    IF v_paid_through IS NOT NULL AND v_paid_through <> '' THEN
        BEGIN
            v_expiry := v_paid_through::timestamptz;
            IF v_expiry < now() THEN
                RETURN NULL;  -- term over: the chip comes off at read time
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;  -- unparseable keeps access, per the clock's rule 3
        END;
    END IF;

    -- One label for both tiers, deliberately: the chip says "this person
    -- supports the site", not how much they spend.
    RETURN 'member';
END;
$$;

COMMENT ON FUNCTION public.public_membership_label(UUID) IS
  'Returns ''member'' when the target member has opted in AND holds an unexpired pro/studio tier; NULL otherwise. DEFINER because tier lives in auth.users app_metadata. Applies the entitlement clock at read time.';

REVOKE ALL ON FUNCTION public.public_membership_label(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_membership_label(UUID) TO anon, authenticated, service_role;

-- Verify (client key, not the SQL editor):
--   1. SELECT public_membership_label('<a pro member who has NOT opted in>')  -> NULL
--   2. Flip their show_membership_on_profile to true                          -> 'member'
--   3. SELECT public_membership_label('<a free member opted in>')             -> NULL
--   4. SELECT public_membership_label(gen_random_uuid())                      -> NULL
