-- ============================================================
-- 182: Close the ownership chain at the start
--
-- horse_ownership_history has RLS enabled (018) with a SELECT policy
-- (022/029) and NO INSERT POLICY. Every other writer is a SECURITY
-- DEFINER function (transfers, PIN claims, ledger moves), which
-- bypasses RLS — so those all work. The one user-client insert,
-- initializeHoofprint() in src/app/actions/hoofprint.ts, has been
-- silently rejected since 018 shipped: the result was never checked,
-- so nothing ever surfaced.
--
-- The consequence is the chain has no row #1. A horse added here and
-- then sold shows a provenance that begins with its SECOND owner, and
-- a horse never transferred has no ownership record at all. The
-- "the record belongs to the horse, and it goes with the horse" claim
-- rests on this table.
--
-- Why a function and not simply an INSERT policy: a policy permissive
-- enough to let an owner write their own genesis row is also
-- permissive enough to let them write a FICTIONAL one — owner_alias
-- is free text, so "previously owned by @SomeoneFamous" becomes a
-- typing exercise, and acquisition_type/sale_price would let an owner
-- invent a purchase history. That is a worse trust failure than the
-- missing row. This function lets the owner claim exactly one thing:
-- "I am the first owner, and I am me."
--   · caller must own the horse
--   · owner_id is auth.uid(), never caller-supplied
--   · owner_alias is looked up server-side, never caller-supplied
--   · acquisition_type is hardcoded 'original'
--   · no-ops if the horse already has ANY history row, so it can
--     never be used to inject a link into an existing chain
-- ============================================================

CREATE OR REPLACE FUNCTION initialize_hoofprint_genesis(
    p_horse_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid   UUID := auth.uid();
    v_owner UUID;
    v_alias TEXT;
    v_horse_created TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT owner_id, created_at INTO v_owner, v_horse_created
    FROM user_horses
    WHERE id = p_horse_id AND deleted_at IS NULL;

    IF v_owner IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Horse not found');
    END IF;

    -- Only the horse's own owner may open its chain.
    IF v_owner IS DISTINCT FROM v_uid THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Never touch a chain that already exists.
    IF EXISTS (SELECT 1 FROM horse_ownership_history WHERE horse_id = p_horse_id) THEN
        RETURN jsonb_build_object('success', true, 'action', 'noop');
    END IF;

    SELECT alias_name INTO v_alias FROM users WHERE id = v_uid;

    INSERT INTO horse_ownership_history (
        horse_id, owner_id, owner_alias, acquisition_type, acquired_at, notes
    ) VALUES (
        p_horse_id,
        v_uid,
        COALESCE(NULLIF(TRIM(v_alias), ''), 'Unknown'),
        'original',
        COALESCE(v_horse_created, now()),
        p_notes
    );

    RETURN jsonb_build_object('success', true, 'action', 'created');
END;
$$;

REVOKE EXECUTE ON FUNCTION initialize_hoofprint_genesis(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION initialize_hoofprint_genesis(UUID, TEXT) TO authenticated;

-- ── Backfill: give every existing chain its missing first link ──
--
-- Runs as the migration author (service context), so RLS does not
-- apply. Two groups:
--   A. horses with NO history at all → genesis = current owner,
--      dated to when the horse was added.
--   B. horses whose history exists but whose EARLIEST row is an
--      acquisition (purchase/trade/gift/transfer) — i.e. the chain
--      starts mid-story because the original add was rejected. There
--      is no record of who that first owner was, so we deliberately
--      do NOT invent one; group B is reported, not written.
INSERT INTO horse_ownership_history (
    horse_id, owner_id, owner_alias, acquisition_type, acquired_at, notes
)
SELECT
    h.id,
    h.owner_id,
    COALESCE(NULLIF(TRIM(u.alias_name), ''), 'Unknown'),
    'original',
    h.created_at,
    NULL
FROM user_horses h
LEFT JOIN users u ON u.id = h.owner_id
WHERE h.deleted_at IS NULL
  AND h.owner_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM horse_ownership_history ooh WHERE ooh.horse_id = h.id
  );

-- Group B is informational: these chains begin with an acquisition,
-- meaning their true first owner was never recorded and cannot be
-- recovered. Inventing a name here would be forging provenance.
DO $$
DECLARE
    v_orphans INT;
BEGIN
    SELECT COUNT(*) INTO v_orphans
    FROM (
        SELECT DISTINCT ON (horse_id) horse_id, acquisition_type
        FROM horse_ownership_history
        ORDER BY horse_id, acquired_at ASC
    ) first_links
    WHERE first_links.acquisition_type <> 'original';

    RAISE NOTICE '182: % chain(s) start with an acquisition — original owner unrecorded, left as-is.', v_orphans;
END;
$$;

ANALYZE horse_ownership_history;
