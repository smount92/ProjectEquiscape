---
description: Infrastructure Hardening — Rate limiting, immutable storage paths, PDF payload fix, tombstone deletion, client-side CSV, fire-and-forget safety, CSS optimization. FEATURE FREEZE until complete.
---

# Infrastructure Hardening Workflow

> **Goal:** Fix 6 infrastructure vulnerabilities before scaling beyond trusted beta. No new features until this is done.
> **Pre-requisites:** Phases 1–4 ✅ complete. Build must be clean.
> **Estimated Effort:** ~9 working days across 6 tasks.
> **Execution Order:** P0 Security → P1 Data Safety → P2 Reliability → P3 Polish

// turbo-all

---

## P0: DATABASE-BACKED RATE LIMITING (Do First — Security Critical)

> **Why:** The current rate limiter in `contact.ts` is an in-memory `Map<>` that resets on every Vercel cold start. It provides ZERO protection. The 6-char Hoofprint transfer codes and Parked Horse PINs can be brute-forced at thousands of attempts per second.

### Task 0A: Migration — `032_rate_limiting.sql`

Create `supabase/migrations/032_rate_limiting.sql`:

```sql
-- ============================================================
-- Migration 032: Database-Backed Rate Limiting
-- Replaces in-memory Map<> with Postgres-backed rate limiter
-- ============================================================

-- 1. Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,         -- IP address or user ID
    endpoint TEXT NOT NULL,           -- e.g. 'claim_pin', 'contact_form', 'identify_mold'
    attempts INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(identifier, endpoint)
);

-- 2. Enable RLS (service role only — never queried from client)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies — only accessible via RPC with SECURITY DEFINER

-- 3. Rate limit check RPC
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_attempts INT,
    p_window_interval INTERVAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
BEGIN
    -- Try to find existing record
    SELECT * INTO v_record
    FROM rate_limits
    WHERE identifier = p_identifier AND endpoint = p_endpoint;

    IF NOT FOUND THEN
        -- First attempt in this window
        INSERT INTO rate_limits (identifier, endpoint, attempts, window_start)
        VALUES (p_identifier, p_endpoint, 1, now());
        RETURN TRUE;
    END IF;

    -- Check if window has expired
    IF v_record.window_start + p_window_interval < now() THEN
        -- Reset the window
        UPDATE rate_limits
        SET attempts = 1, window_start = now()
        WHERE id = v_record.id;
        RETURN TRUE;
    END IF;

    -- Window is active — check if under limit
    IF v_record.attempts >= p_max_attempts THEN
        RETURN FALSE;  -- Rate limited!
    END IF;

    -- Increment attempts
    UPDATE rate_limits
    SET attempts = attempts + 1
    WHERE id = v_record.id;
    RETURN TRUE;
END;
$$;

-- 4. Cleanup job — purge expired windows (run periodically or via cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '24 hours';
$$;

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits(identifier, endpoint);
```

**Run this migration in the Supabase SQL Editor.** Verify the `check_rate_limit` function exists by running:
```sql
SELECT check_rate_limit('test_ip', 'test_endpoint', 5, INTERVAL '15 minutes');
-- Should return TRUE
```

### Task 0B: Create Rate Limit Utility — `src/lib/utils/rateLimit.ts`

Create a new file `src/lib/utils/rateLimit.ts`:

```typescript
import { getAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

/**
 * Database-backed rate limiter for serverless.
 * Uses Supabase RPC to check rate limits in Postgres.
 * 
 * @param endpoint - The endpoint identifier (e.g. 'claim_pin', 'contact_form')
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMinutes - Window duration in minutes
 * @param identifierOverride - Optional: use a specific identifier instead of IP
 * @returns true if request is allowed, false if rate-limited
 */
export async function checkRateLimit(
    endpoint: string,
    maxAttempts: number,
    windowMinutes: number,
    identifierOverride?: string,
): Promise<boolean> {
    try {
        const identifier = identifierOverride || await getClientIp();
        const supabaseAdmin = getAdminClient();

        const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
            p_identifier: identifier,
            p_endpoint: endpoint,
            p_max_attempts: maxAttempts,
            p_window_interval: `${windowMinutes} minutes`,
        });

        if (error) {
            console.error("[RateLimit] RPC error:", error.message);
            return true; // Fail open — don't block legitimate users on DB errors
        }

        return data as boolean;
    } catch (err) {
        console.error("[RateLimit] Unexpected error:", err);
        return true; // Fail open
    }
}

/**
 * Extract client IP from request headers.
 * Vercel provides x-forwarded-for; fallback to x-real-ip.
 */
async function getClientIp(): Promise<string> {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return headersList.get("x-real-ip") || "unknown";
}
```

### Task 0C: Apply Rate Limiting to Vulnerable Endpoints

**File: `src/app/actions/parked-export.ts`**

Find the `claimParkedHorse` function (currently around line 255). Add rate limiting at the very top of the function, BEFORE any database queries:

```typescript
import { checkRateLimit } from "@/lib/utils/rateLimit";
```

At the top of `claimParkedHorse()`, add:
```typescript
// Rate limit: 5 attempts per 15 minutes per IP
const allowed = await checkRateLimit("claim_pin", 5, 15);
if (!allowed) {
    return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
}
```

**File: `src/app/actions/hoofprint.ts`**

Find the `claimTransfer` function (currently around line 324). Add the same pattern:

```typescript
import { checkRateLimit } from "@/lib/utils/rateLimit";
```

At the top of `claimTransfer()`, add:
```typescript
// Rate limit: 5 attempts per 15 minutes per IP
const allowed = await checkRateLimit("claim_transfer", 5, 15);
if (!allowed) {
    return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
}
```

**File: `src/app/actions/contact.ts`**

Replace the entire in-memory rate limiter. Remove these lines (approximately lines 5–20):
```typescript
// DELETE THESE:
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(key: string): boolean {
    // ... entire function
}
```

Add the import:
```typescript
import { checkRateLimit } from "@/lib/utils/rateLimit";
```

In `submitContactForm()`, replace the old `checkRateLimit(email)` call with:
```typescript
// Rate limit: 5 submissions per 60 minutes per IP
const allowed = await checkRateLimit("contact_form", 5, 60);
if (!allowed) {
    return { error: "Too many messages. Please try again in an hour.", success: false };
}
```

**File: `src/app/api/identify-mold/route.ts`**

Find the identify mold API route. Add user-based rate limiting (not IP — use auth.uid()):

```typescript
import { checkRateLimit } from "@/lib/utils/rateLimit";
```

After getting the user, add:
```typescript
// Rate limit: 5 identifications per 24 hours per user
const allowed = await checkRateLimit("identify_mold", 5, 1440, user.id);
if (!allowed) {
    return NextResponse.json(
        { error: "Daily identification limit reached (5/day). Try again tomorrow." },
        { status: 429 }
    );
}
```

### Task 0D: Verify & Build

1. Run `npx next build` — must compile with 0 errors.
2. Test: Submit a contact form 6 times rapidly. The 6th should be rejected.
3. Verify the `rate_limits` table has rows by checking the Supabase table viewer.

---

## P1-A: IMMUTABLE STORAGE PATHS (Data Safety)

> **Why:** Images are stored at `{user_id}/{horse_id}/{file}.webp`. On transfer, files stay under the old owner's folder but access is granted via signed URLs. If the old owner deletes their account or the storage bucket policy changes, transferred images are lost forever.

### Task 1A: Migration — `033_immutable_storage.sql`

Create `supabase/migrations/033_immutable_storage.sql`:

```sql
-- ============================================================
-- Migration 033: Immutable Storage Paths
-- Changes image storage from {user_id}/{horse_id}/ to horses/{horse_id}/
-- Adds dynamic RLS policy on storage.objects for horse-images bucket
-- ============================================================

-- 1. Drop any existing write policies on horse-images bucket
--    (These may vary — check your Supabase Storage settings)
--    NOTE: If your bucket currently uses Supabase Dashboard policies,
--    those need to be removed from the Dashboard first.

-- 2. Dynamic Storage RLS — allows read/write based on horse ownership
--    The path format is: horses/{horse_id}/{filename}.webp
--    We extract the horse_id from the path and join to user_horses.

-- Allow authenticated users to INSERT images for horses they own
CREATE POLICY "Horse image insert (owner)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow authenticated users to UPDATE images for horses they own
CREATE POLICY "Horse image update (owner)"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow authenticated users to DELETE images for horses they own
CREATE POLICY "Horse image delete (owner)"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'horse-images'
    AND (storage.foldername(name))[1] = 'horses'
    AND EXISTS (
        SELECT 1 FROM public.user_horses
        WHERE id = ((storage.foldername(name))[2])::uuid
        AND owner_id = (SELECT auth.uid())
    )
);

-- Allow anyone (including anon) to SELECT/read images for public horses
-- This enables signed URLs to work for public passport pages
CREATE POLICY "Horse image read (public horses)"
ON storage.objects FOR SELECT TO authenticated, anon
USING (
    bucket_id = 'horse-images'
    AND (
        -- New path format: horses/{horse_id}/...
        (
            (storage.foldername(name))[1] = 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR
        -- Legacy path format: {user_id}/{horse_id}/...
        -- Keep until all images are migrated
        (
            (storage.foldername(name))[1] != 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
    )
);
```

> **IMPORTANT:** Before running this migration, go to the Supabase Dashboard → Storage → horse-images bucket → Policies and note/remove any existing policies. The new policies above will replace them. If your bucket is currently set to "Public", change it to "Private" — access will be controlled purely by these RLS policies.

### Task 1B: Update Upload Paths in `horse.ts`

In `src/app/actions/horse.ts`, there are TWO places where the upload path is constructed. Change BOTH:

**In `addHorseAction()` (around line 149):**
```typescript
// BEFORE:
const filePath = `${user.id}/${horseId}/${safeFileName}.webp`;

// AFTER:
const filePath = `horses/${horseId}/${safeFileName}.webp`;
```

**In `updateHorseAction()` (around line 282):**
```typescript
// BEFORE:
const filePath = `${user.id}/${horseId}/${safeFileName}.webp`;

// AFTER:
const filePath = `horses/${horseId}/${safeFileName}.webp`;
```

### Task 1C: Update Upload Path in `help-id.ts`

Check `src/app/actions/help-id.ts` for any upload paths in `createIdRequest()`. If it uses `{user_id}/` prefix in the upload path, change it to `help-id/{request_id}/` or similar horse-less pattern. Help ID images are NOT horse images, so they may use a different bucket — verify before changing.

### Task 1D: Remove File Move Logic from Transfer (if any exists)

Grep the codebase for any `storage.move` or `storage.copy` calls. As of our last audit, none exist — but verify:

```bash
grep -r "storage.move\|storage.copy" src/
```

If any are found, DELETE them entirely. The dynamic RLS policy means transferring horse ownership (updating `user_horses.owner_id`) automatically grants the new owner storage access. No files need to move.

### Task 1E: Update `deleteHorse()` Storage Cleanup

In `src/app/actions/horse.ts`, the `deleteHorse()` function (around line 28-37) extracts storage paths from `image_url` using a regex. Update the regex to handle BOTH old and new path formats:

```typescript
// BEFORE:
const match = img.image_url.match(/horse-images\/(.+)$/);

// AFTER (handles both legacy and new paths):
const match = img.image_url.match(/horse-images\/(.+?)(\?|$)/);
```

### Task 1F: Update `extractStoragePath()` Utility

Check `src/lib/utils/storage.ts` — the `extractStoragePath()` function must handle both the old `{user_id}/{horse_id}/` and new `horses/{horse_id}/` path formats. It likely already does (regex-based), but verify.

### Task 1G: Verify & Build

1. Run `npx next build` — must compile with 0 errors.
2. Test: Add a new horse with a photo. Verify in Supabase Storage that the file lands at `horses/{horse_id}/` NOT `{user_id}/{horse_id}/`.
3. Test: Verify old images (under `{user_id}/{horse_id}/`) still display correctly on existing horse passports. The legacy SELECT policy handles this.
4. **DO NOT** write a batch migration script for existing images yet. Old images will continue to work via the legacy SELECT policy. We can migrate them lazily later.

---

## P1-B: DEFUSE THE PDF PAYLOAD BOMB

> **Why:** `getInsuranceReportData()` fetches every horse image via `fetch()`, converts to base64, and returns the entire payload as a server action response. For 200 horses, this exceeds Vercel's 4.5MB payload limit and causes OOM crashes on mobile.

### Task 2A: Refactor `insurance-report.ts`

**File: `src/app/actions/insurance-report.ts`**

The goal: Remove ALL base64 conversion. Return signed URLs instead.

1. Change the `HorseReportData` interface (around line 11):
```typescript
// BEFORE:
photoBase64: string | null;

// AFTER:
photoUrl: string | null;
```

2. Remove the entire base64 fetch block (the `try/catch` block around lines 116-135 that does `fetch → arrayBuffer → Buffer.from().toString('base64')`). Replace with a simple signed URL generation:

```typescript
// BEFORE the big try/catch block:
let photoBase64: string | null = null;
// ... 20 lines of fetch + base64 conversion ...

// AFTER — replace the ENTIRE block with:
let photoUrl: string | null = null;
const thumb = horse.horse_images?.find(
    (img) => img.angle_profile === "Primary_Thumbnail"
);
const imageUrl = thumb?.image_url || horse.horse_images?.[0]?.image_url;

if (imageUrl) {
    const path = extractStoragePath(imageUrl);
    const { data: signedData } = await supabase.storage
        .from("horse-images")
        .createSignedUrl(path, 600); // 10 min expiry — enough for PDF render
    photoUrl = signedData?.signedUrl || null;
}
```

3. Update the `reportHorses.push()` call:
```typescript
// BEFORE:
photoBase64,

// AFTER:
photoUrl,
```

4. Update the `InsuranceReportPayload` interface to match (`photoBase64` → `photoUrl`).

### Task 2B: Update `InsuranceReport.tsx` PDF Component

**File: `src/components/pdf/InsuranceReport.tsx`**

Find the `<Image>` component that uses `horse.photoBase64` (around line 319-320):

```typescript
// BEFORE:
{horse.photoBase64 ? (
    <Image src={horse.photoBase64} style={styles.detailPhoto} />

// AFTER:
{horse.photoUrl ? (
    <Image src={horse.photoUrl} style={styles.detailPhoto} />
```

Update the interface/type in this file to accept `photoUrl` instead of `photoBase64`.

### Task 2C: Same Fix for `parked-export.ts` CoA (Lower Priority)

**File: `src/app/actions/parked-export.ts`**

The `getCoaData()` function (around line 500-511) does the same base64 pattern for the Certificate of Authenticity. Apply the same fix:
- Return a `photoUrl` (signed URL) instead of `photoBase64`
- Update `CertificateOfAuthenticity.tsx` component to use `<Image src={data.photoUrl}>`

### Task 2D: Configure CORS on Supabase Storage

In the Supabase Dashboard → Storage → Settings, add CORS configuration:

```json
[
  {
    "AllowedOrigins": ["https://modelhorsehub.com", "http://localhost:3000"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

This allows `@react-pdf/renderer` to fetch images cross-origin during client-side PDF blob generation.

### Task 2E: Verify & Build

1. Run `npx next build` — 0 errors.
2. Test: Generate an insurance report for an account with 5+ horses. Verify the PDF renders with photos.
3. Verify: The server action response payload should be much smaller (just URLs, not base64 blobs).

---

## P2-A: TOMBSTONE ACCOUNT DELETION

> **Why:** When account deletion is eventually built, `ON DELETE CASCADE` will destroy commission histories, show records, ownership chains, and transfer histories — violating Hoofprint™ provenance guarantees.

### Task 3A: Migration — `034_tombstone_deletion.sql`

Create `supabase/migrations/034_tombstone_deletion.sql`:

```sql
-- ============================================================
-- Migration 034: Tombstone Account Deletion
-- Soft-delete pattern to preserve provenance
-- ============================================================

-- 1. Add status columns to users
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Change foreign keys on provenance tables from CASCADE to SET NULL
--    This prevents chain-breaking when a user is tombstoned.
--    NOTE: Only alter tables where historical records must survive.
--    Check which FKs currently exist and only alter those that use CASCADE.

-- horse_timeline: preserve show results, customization notes
ALTER TABLE horse_timeline
    DROP CONSTRAINT IF EXISTS horse_timeline_user_id_fkey,
    ADD CONSTRAINT horse_timeline_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- commissions: preserve commission history for both artist and client
ALTER TABLE commissions
    DROP CONSTRAINT IF EXISTS commissions_artist_id_fkey,
    ADD CONSTRAINT commissions_artist_id_fkey
        FOREIGN KEY (artist_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE commissions
    DROP CONSTRAINT IF EXISTS commissions_client_id_fkey,
    ADD CONSTRAINT commissions_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- commission_updates: preserve WIP history
ALTER TABLE commission_updates
    DROP CONSTRAINT IF EXISTS commission_updates_author_id_fkey,
    ADD CONSTRAINT commission_updates_author_id_fkey
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- show_records: preserve show history
ALTER TABLE show_records
    DROP CONSTRAINT IF EXISTS show_records_user_id_fkey,
    ADD CONSTRAINT show_records_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- horse_ownership_history: preserve provenance chain
ALTER TABLE horse_ownership_history
    DROP CONSTRAINT IF EXISTS horse_ownership_history_owner_id_fkey,
    ADD CONSTRAINT horse_ownership_history_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- user_ratings: preserve trust history
ALTER TABLE user_ratings
    DROP CONSTRAINT IF EXISTS user_ratings_reviewer_id_fkey,
    ADD CONSTRAINT user_ratings_reviewer_id_fkey
        FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE user_ratings
    DROP CONSTRAINT IF EXISTS user_ratings_reviewed_id_fkey,
    ADD CONSTRAINT user_ratings_reviewed_id_fkey
        FOREIGN KEY (reviewed_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Soft delete RPC
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the caller is the account owner
    IF (SELECT auth.uid()) != target_uid THEN
        RAISE EXCEPTION 'Unauthorized: can only delete your own account';
    END IF;

    -- Anonymize the user record
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted Collector]',
        bio = NULL,
        avatar_url = NULL,
        notification_prefs = NULL
    WHERE id = target_uid;

    -- Transfer all owned horses to "orphaned" status
    -- (They keep their Hoofprint but are no longer in anyone's stable)
    UPDATE public.user_horses SET
        is_public = false,
        trade_status = 'Not for Sale',
        life_stage = 'orphaned'
    WHERE owner_id = target_uid;

    -- Close any pending transfers
    UPDATE horse_transfers SET
        status = 'cancelled'
    WHERE sender_id = target_uid AND status = 'pending';

    -- Cancel any open commissions
    UPDATE commissions SET
        status = 'cancelled'
    WHERE (artist_id = target_uid OR client_id = target_uid)
      AND status NOT IN ('completed', 'delivered', 'cancelled');

    -- Remove from all groups
    DELETE FROM group_memberships WHERE user_id = target_uid;

    -- Disable auth account (prevents login but preserves ID)
    -- NOTE: This requires the auth.users admin API, which can't be called
    -- from PL/pgSQL directly. The calling Server Action must handle this.
END;
$$;

-- 4. Index for filtering active users in queries
CREATE INDEX IF NOT EXISTS idx_users_account_status
    ON public.users(account_status);
```

### Task 3B: Add Delete Account UI to Settings

**File: `src/app/actions/settings.ts`**

Add a new server action:

```typescript
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Call the soft delete RPC
    const adminClient = getAdminClient();
    const { error: rpcError } = await adminClient.rpc("soft_delete_account", {
        target_uid: user.id,
    });

    if (rpcError) return { success: false, error: rpcError.message };

    // Disable the auth account (prevents login)
    // This uses the admin API which requires service role
    const { error: authError } = await adminClient.auth.admin.updateUserById(
        user.id,
        { ban_duration: "876000h" } // ~100 years = effectively permanent
    );

    if (authError) {
        console.error("[DeleteAccount] Failed to disable auth:", authError.message);
        // Non-fatal — the soft delete already happened
    }

    // Sign out the user
    await supabase.auth.signOut();

    return { success: true };
}
```

Add the import at the top:
```typescript
import { getAdminClient } from "@/lib/supabase/admin";
```

**File: `src/app/settings/page.tsx`**

Add a "Delete Account" danger zone section at the bottom of the settings page. This should:
1. Be a red-bordered section with a warning
2. Require the user to type "DELETE" to confirm
3. Show a confirmation modal explaining what happens (horses orphaned, data anonymized, cannot be undone)
4. Call the `deleteAccount()` server action
5. Redirect to `/` on success

### Task 3C: Filter Deleted Users from Public Queries

Add `.eq('account_status', 'active')` (or `.neq('account_status', 'deleted')`) to these queries:

- `src/app/discover/page.tsx` — user listing queries
- `src/app/community/page.tsx` — horse listing (filter by owner status)
- `src/app/actions/activity.ts` — `getActivityFeed()` and `getFollowingFeed()` — filter out activity from deleted users
- Any query that batch-fetches user aliases — return `[Deleted Collector]` for null user_ids

### Task 3D: Verify & Build

1. Run `npx next build` — 0 errors.
2. **DO NOT** test account deletion on your own account in production. Create a test account, add a horse, then delete the test account. Verify:
   - The user's alias shows as `[Deleted Collector]` on their old horses' ownership history
   - The user cannot log in
   - The horse's Hoofprint timeline is intact

---

## P2-B: CLIENT-SIDE CSV PROCESSING

> **Why:** `matchCsvBatch()` fetches the entire 10,500+ reference database into server memory and runs fuzzysort on a serverless function. This times out on large CSVs (500+ rows) and wastes server resources.

### Task 4A: Create Reference Dictionary API Route

Create `src/app/api/reference-dictionary/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-static"; // Cache this aggressively
export const revalidate = 86400; // Revalidate once per day

export async function GET() {
    const supabase = await createClient();

    // Fetch releases with mold info (compact format)
    const { data: releases } = await supabase
        .from("reference_releases")
        .select(`
            id,
            release_name,
            model_number,
            color_description,
            reference_molds(mold_name, manufacturer, scale)
        `)
        .order("release_name");

    // Fetch resins (compact format)
    const { data: resins } = await supabase
        .from("artist_resins")
        .select("id, resin_name, sculptor_alias, scale")
        .order("resin_name");

    // Compress: short keys to reduce payload size
    const dictionary = {
        releases: (releases || []).map((r: Record<string, unknown>) => ({
            i: r.id,
            n: r.release_name,
            m: r.model_number,
            c: r.color_description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mn: (r.reference_molds as any)?.mold_name || null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mf: (r.reference_molds as any)?.manufacturer || null,
        })),
        resins: (resins || []).map((r: Record<string, unknown>) => ({
            i: r.id,
            n: r.resin_name,
            s: r.sculptor_alias,
        })),
    };

    return NextResponse.json(dictionary, {
        headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    });
}
```

### Task 4B: Move Fuzzy Matching to `CsvImport.tsx`

**File: `src/components/CsvImport.tsx`**

This component is already `"use client"`. Add:

1. A `useEffect` that fetches `/api/reference-dictionary` on mount and stores the dictionary in state.
2. Import `fuzzysort` directly in this file (it's already a dependency in `package.json`).
3. Run the fuzzy matching logic ENTIRELY in the browser, using the fetched dictionary.
4. Only call the server action for the final import step.

The key change: the "Match" step no longer calls `matchCsvBatch()`. Instead, it runs `fuzzysort.go()` against the client-side dictionary.

### Task 4C: Simplify `csv-import.ts` Server Action

**File: `src/app/actions/csv-import.ts`**

Remove the `matchCsvBatch()` function entirely — it's no longer needed (matching happens client-side).

Keep `executeBatchImport()` but refactor it to accept already-matched UUIDs only:

```typescript
export async function executeBatchImport(
    confirmedRows: {
        customName: string;
        condition: string;
        finishType: string;
        purchasePrice: string;
        estimatedValue: string;
        notes: string;
        moldId: string | null;
        releaseId: string | null;
        resinId: string | null;
    }[]
): Promise<{ success: boolean; imported?: number; error?: string }> {
    // Process in chunks of 50 to prevent transaction timeouts
    const CHUNK_SIZE = 50;
    // ... rest of implementation
}
```

Remove the `fuzzysort` import from this file.

### Task 4D: Verify & Build

1. Run `npx next build` — 0 errors.
2. Test: Import a 10-row CSV. Verify matching happens instantly (client-side) and import succeeds.
3. Test: Import a 200-row CSV. Verify no timeout.

---

## P3: FIRE-AND-FORGET SAFETY

> **Why:** Un-awaited promises in Server Actions *usually* complete on Vercel, but there's no guarantee. Email sending via Resend can take 500ms+, which is genuinely at risk.

### Task 5A: Await Critical Background Operations

This is the conservative approach: simply `await` the operations that are currently fire-and-forget. This adds a few milliseconds of latency but guarantees delivery.

**File: `src/app/actions/messaging.ts`**

In `sendMessage()`, the Resend email call should be awaited:
```typescript
// If there's a fire-and-forget sendResendEmail or sendNewMessageNotification call,
// ADD await in front of it:
await sendNewMessageNotification(...);
```

**File: `src/app/actions/horse-events.ts`**

In `notifyHorsePublic()`, the wishlist matching call uses `.catch(() => {})`. Change to try/catch with await:
```typescript
// BEFORE:
checkWishlistMatches(data).catch(() => {});

// AFTER:
try {
    await checkWishlistMatches(data);
} catch {
    // Non-blocking — best effort
}
```

**Files: `src/app/actions/social.ts`, `follows.ts`, `ratings.ts`**

In each of these, `createNotification()` and `createActivityEvent()` are called without `await`. Add `await` to each:

```typescript
// BEFORE:
createNotification({...});
createActivityEvent({...});

// AFTER:
await createNotification({...});
await createActivityEvent({...});
```

These DB inserts take ~5ms each. The added latency is imperceptible but guarantees the notification/activity event is persisted.

### Task 5B: Verify & Build

1. Run `npx next build` — 0 errors.
2. Test: Favorite a horse. Verify the notification appears in the horse owner's notification list.
3. Test: Send a message. Verify the email notification arrives.

---

## P4: CSS OPTIMIZATION (Polish)

> **Why:** `globals.css` is 208KB. While it gzips to ~30-40KB, reducing it improves parse time on mobile.

### Task 6A: Audit for Unused CSS

**NOTE:** We do NOT use Tailwind CSS—`globals.css` is hand-written vanilla CSS. Do not look for a `tailwind.config.ts`.

1. Use a tool like `purgecss` or the Chrome DevTools Coverage tab to identify unused CSS rules.
2. Focus on removing:
   - Duplicate class definitions
   - Unused animation keyframes
   - Media query blocks that duplicate identical styles
   - Over-specific selectors that could be consolidated

### Task 6B: Split CSS by Feature

Consider splitting `globals.css` into feature-specific imports:
- `globals.css` — core design system (tokens, base styles, layout, header, forms, buttons, cards)
- `studio.css` — already separate ✅
- `competition.css` — already separate ✅
- `community.css` — extract groups/events/help-id styles
- `marketplace.css` — extract inbox/rating/wishlist styles

**Only do this if the CSS audit in 6A shows significant savings.** The single-file approach has the advantage of one cacheable resource.

### Task 6C: Verify

1. Run `npx next build` — 0 errors.
2. Visually check the landing page, dashboard, community, and shows pages for broken styles.
3. Check mobile (375px) and desktop (1440px) viewports.

---

## COMPLETION CHECKLIST

When all tasks are done, verify:

- [ ] `npx next build` — 0 TypeScript errors
- [ ] Rate limiting: Contact form rejects after 5 rapid submissions
- [ ] Rate limiting: Claim PIN rejects after 5 wrong attempts in 15 min
- [ ] Storage: New horse images upload to `horses/{horse_id}/` path
- [ ] Storage: Old images still display correctly (legacy path support)
- [ ] PDF: Insurance report generates without OOM for 50+ horse collections
- [ ] PDF: CoA generates with photo from signed URL
- [ ] Tombstone: Test account deletion preserves ownership history
- [ ] CSV: 200-row import completes without server timeout
- [ ] Notifications: All fire-and-forget operations are awaited
- [ ] CSS: No visual regressions on landing, dashboard, community pages

After this workflow is complete, the FEATURE FREEZE is lifted and new development can resume.
