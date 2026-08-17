-- ============================================================
-- 149 — SECURITY SWEEP (adversarial audit Part 2 closeout)
--
--   A. Storage write limits: horse-images/avatars had NO size or
--      MIME caps — a hostile signup could upload unbounded files
--      straight to storage (client-side validation is bypassable;
--      chat-attachments has had caps since 111 — same template).
--   B. Rate-limit RPCs: check_rate_limit was publicly executable
--      (default PostgREST grant) — anyone could burn a victim's
--      contact/claim/mold-ID quota by looping it with the victim's
--      identifier. Service-role only now.
--   C. Identity RPCs: soft_delete_account & the claim RPCs kept
--      the default EXECUTE-to-PUBLIC grant (the class 133 revoked
--      for commerce RPCs), and soft_delete_account's `!=` guard is
--      NULL-fragile (NULL auth.uid() skips the RAISE).
--   D. Migration-108 counting helpers: SECURITY DEFINER without a
--      pinned search_path (SEC-5 stragglers).
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- A. Storage bucket caps (10 MB, image MIME only — matches the
--    client validators; chat-attachments pattern from 111)
-- ══════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id IN ('horse-images', 'avatars');

-- ══════════════════════════════════════════════════════════════
-- B. Rate-limit RPCs: service-role only
-- ══════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INTERVAL)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()
  FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- C. Identity RPCs
-- ══════════════════════════════════════════════════════════════

-- soft_delete_account: NULL-safe guard (IS DISTINCT FROM — the old
-- `!=` yields NULL, not TRUE, when auth.uid() is NULL, skipping the
-- RAISE) + explicit grants. Body otherwise identical to 092.
CREATE OR REPLACE FUNCTION public.soft_delete_account(target_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF (SELECT auth.uid()) IS DISTINCT FROM target_uid THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted] ' || substr(target_uid::text, 1, 8),
        bio = NULL, avatar_url = NULL, notification_prefs = NULL
    WHERE id = target_uid;

    UPDATE public.user_horses SET is_public = false, trade_status = 'Not for Sale', life_stage = 'orphaned' WHERE owner_id = target_uid;
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;
    UPDATE public.horse_transfers SET status = 'cancelled' WHERE sender_id = target_uid AND status = 'pending';
    UPDATE public.commissions SET status = 'cancelled' WHERE (artist_id = target_uid OR client_id = target_uid) AND status NOT IN ('completed', 'delivered', 'cancelled');
    DELETE FROM public.group_memberships WHERE user_id = target_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_account(UUID) TO authenticated;

-- Claim RPCs: anon must never execute (they take caller-supplied
-- claimant ids; the actions layer passes the session user). The
-- in-body auth.uid() = p_claimant_id check is a follow-up — the
-- bodies are long and owner-applied; this closes the anon door now.
REVOKE EXECUTE ON FUNCTION public.claim_transfer_atomic(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_transfer_atomic(TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_parked_horse_atomic(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_parked_horse_atomic(TEXT, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- D. 108 counting helpers: pin search_path (schema-qualified)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.count_user_horses_total(p_user_id UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT count(*)
  FROM public.user_horses
  WHERE owner_id = p_user_id
    AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.count_user_horses_public(p_user_id UUID)
RETURNS BIGINT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT count(*)
  FROM public.user_horses
  WHERE owner_id = p_user_id
    AND visibility = 'public'
    AND deleted_at IS NULL;
$$;

-- ============================================================
-- After applying: no gen-types needed (no table changes).
-- Verify:
--   SELECT file_size_limit, allowed_mime_types FROM storage.buckets
--     WHERE id IN ('horse-images','avatars');
--   -- both rows: 10485760 + the 4 image MIMEs
-- ============================================================
