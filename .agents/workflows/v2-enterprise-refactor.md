---
description: V2 Enterprise Refactor — Atomic RPCs, direct-to-storage uploads, N+1 elimination, dashboard parallelization, server-side search. FEATURE FREEZE until complete.
---

# V2 Enterprise Refactor Workflow

> **Goal:** Replace fragile sequential DB calls with atomic Postgres RPCs, bypass Vercel payload limits with direct-to-storage uploads, eliminate N+1 queries, and parallelize dashboard data fetching.
> **Pre-requisites:** Infrastructure Hardening ✅ complete. Migrations 032-034 applied. Build must be clean.
> **Estimated Effort:** ~8 working days across 3 phases.
> **Execution:** Strict phase order. Do not start Phase B until Phase A is tested.

// turbo-all

---

## PHASE A: ATOMIC MUTATIONS (Do First — Data Integrity)

> **Why:** The `claimTransfer()` function has a TOCTOU race condition — 13 sequential DB calls without a row lock. Two simultaneous claims can both succeed, duplicating the horse. The condition history trusts client-supplied `oldCondition` values. The vote toggle has a read-modify-write race.

### Task A.1: Migration — `035_atomic_mutations.sql`

Create `supabase/migrations/035_atomic_mutations.sql`:

```sql
-- ============================================================
-- Migration 035: Atomic Mutations
-- Replaces sequential JS DB calls with transactional Postgres RPCs
-- ============================================================

-- ─── 1. Atomic Transfer Claim ────────────────────────────────
-- Fixes TOCTOU race condition in claimTransfer().
-- Uses FOR UPDATE row lock to prevent concurrent claims.
CREATE OR REPLACE FUNCTION claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD;
    v_horse RECORD;
    v_sender_alias TEXT;
    v_receiver_alias TEXT;
    v_thumb TEXT;
BEGIN
    -- Lock the transfer row to prevent concurrent claims
    SELECT * INTO v_transfer FROM horse_transfers
    WHERE transfer_code = upper(trim(p_code)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed transfer code.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This transfer code has expired.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot claim your own horse.');
    END IF;

    -- Gather context
    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    -- ── Execute all state changes atomically ──

    -- Close sender's ownership record with ghost snapshot
    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    -- Create receiver's ownership record
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via transfer');

    -- Transfer ownership (keep existing life_stage — don't override)
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- Create timeline events
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred', 'Transferred to @' || v_receiver_alias, 'Ownership transferred.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired', 'Received from @' || v_sender_alias, 'Ownership acquired.', true);

    -- Clear financial vault (private data doesn't transfer)
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias
    );
END;
$$;


-- ─── 2. Server-Side Condition Change Tracker ─────────────────
-- Fixes "client dictates old condition" security hole.
-- Trigger fires AFTER UPDATE on user_horses.condition_grade,
-- reading OLD.condition_grade from the actual DB row.
CREATE OR REPLACE FUNCTION log_condition_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.condition_grade IS DISTINCT FROM NEW.condition_grade THEN
        INSERT INTO condition_history (horse_id, changed_by, old_condition, new_condition)
        VALUES (NEW.id, NEW.owner_id, OLD.condition_grade, NEW.condition_grade);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_horses_condition ON user_horses;
CREATE TRIGGER trg_user_horses_condition
AFTER UPDATE OF condition_grade ON user_horses
FOR EACH ROW EXECUTE FUNCTION log_condition_change();


-- ─── 3. Atomic Vote Toggle ───────────────────────────────────
-- Fixes read-modify-write race condition in voteForEntry().
-- Single transaction: insert/delete vote + increment/decrement count.
CREATE OR REPLACE FUNCTION toggle_show_vote(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_votes INT;
    v_entry_owner UUID;
    v_action TEXT;
BEGIN
    -- Get entry owner (for self-vote check)
    SELECT user_id INTO v_entry_owner FROM show_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entry not found.');
    END IF;
    IF v_entry_owner = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry.');
    END IF;

    IF EXISTS(SELECT 1 FROM show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) THEN
        DELETE FROM show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
        UPDATE show_entries SET votes = GREATEST(0, votes - 1) WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'unvoted';
    ELSE
        INSERT INTO show_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
        UPDATE show_entries SET votes = votes + 1 WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'voted';
    END IF;

    RETURN jsonb_build_object('success', true, 'new_votes', v_new_votes, 'action', v_action, 'entry_owner', v_entry_owner);
END;
$$;


-- ─── 4. Scrub DMs on Account Deletion ────────────────────────
-- Add to existing soft_delete_account RPC
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (SELECT auth.uid()) != target_uid THEN
        RAISE EXCEPTION 'Unauthorized: can only delete your own account';
    END IF;

    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted Collector]',
        bio = NULL,
        avatar_url = NULL,
        notification_prefs = NULL
    WHERE id = target_uid;

    UPDATE public.user_horses SET
        is_public = false,
        trade_status = 'Not for Sale'
    WHERE owner_id = target_uid;

    -- Scrub private messages (privacy compliance)
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;

    UPDATE horse_transfers SET status = 'cancelled'
    WHERE sender_id = target_uid AND status = 'pending';

    UPDATE commissions SET status = 'cancelled'
    WHERE (artist_id = target_uid OR client_id = target_uid)
      AND status NOT IN ('completed', 'delivered', 'cancelled');

    DELETE FROM group_memberships WHERE user_id = target_uid;
END;
$$;
```

**Run this migration in the Supabase SQL Editor.** Verify:
```sql
-- Test the condition trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trg_user_horses_condition';
-- Should return 1 row

-- Test toggle_show_vote returns JSONB
SELECT toggle_show_vote('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
-- Should return {"error": "Entry not found.", "success": false}
```

### Task A.2: Refactor `claimTransfer()` in `hoofprint.ts`

**File: `src/app/actions/hoofprint.ts`**

Replace the entire `claimTransfer()` function body (lines ~325-474) with the RPC call pattern:

```typescript
export async function claimTransfer(transferCode: string): Promise<{
    success: boolean;
    horseName?: string;
    horseId?: string;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Rate limit: 5 attempts per 15 minutes per IP
    const allowed = await checkRateLimit("claim_transfer", 5, 15);
    if (!allowed) {
        return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
    }

    // Single atomic RPC — handles locking, validation, ownership swap, timeline, vault clearing
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("claim_transfer_atomic", {
        p_code: transferCode,
        p_claimant_id: user.id,
    });

    if (error) {
        return { success: false, error: error.message };
    }

    const result = data as {
        success: boolean;
        error?: string;
        horse_id?: string;
        horse_name?: string;
        sender_id?: string;
        sender_alias?: string;
        receiver_alias?: string;
    };

    if (!result.success) {
        return { success: false, error: result.error || "Transfer failed." };
    }

    // Background: Send notifications (non-critical — OK to fail)
    try {
        // Notify sender
        await admin.from("notifications").insert({
            user_id: result.sender_id,
            type: "transfer_claimed",
            actor_id: user.id,
            content: `@${result.receiver_alias} claimed ${result.horse_name}!`,
            horse_id: result.horse_id,
        });
    } catch { /* Non-blocking */ }

    revalidatePath("/dashboard");
    revalidatePath(`/stable/${result.horse_id}`);

    return {
        success: true,
        horseName: result.horse_name,
        horseId: result.horse_id,
    };
}
```

This replaces ~150 lines of sequential DB calls with ~50 lines. The RPC handles ALL state changes atomically.

### Task A.3: Refactor `voteForEntry()` in `shows.ts`

**File: `src/app/actions/shows.ts`**

Replace the entire `voteForEntry()` function body (lines ~268-357) with the RPC call:

```typescript
export async function voteForEntry(
    entryId: string
): Promise<{ success: boolean; newVotes?: number; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "You must be logged in." };

    // Single atomic RPC — handles self-vote check, toggle, count update
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("toggle_show_vote", {
        p_entry_id: entryId,
        p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };

    const result = data as {
        success: boolean;
        error?: string;
        new_votes?: number;
        action?: string;
        entry_owner?: string;
    };

    if (!result.success) return { success: false, error: result.error };

    // Send notification on upvote (not on unvote)
    if (result.action === "voted" && result.entry_owner) {
        try {
            const { data: voter } = await supabase
                .from("users")
                .select("alias_name")
                .eq("id", user.id)
                .single();
            const voterAlias = (voter as { alias_name: string } | null)?.alias_name || "Someone";

            await admin.from("notifications").insert({
                user_id: result.entry_owner,
                type: "show_vote",
                actor_id: user.id,
                content: `@${voterAlias} voted for your show entry!`,
            });
        } catch { /* Non-blocking */ }
    }

    revalidatePath("/shows");
    return { success: true, newVotes: result.new_votes };
}
```

This replaces ~90 lines of race-prone code with ~40 lines.

### Task A.4: Remove Client-Side Condition History from `horse.ts`

**File: `src/app/actions/horse.ts`**

In `updateHorseAction()`, find the "Condition History Ledger" block (approximately lines 311-342). The Postgres trigger now handles `condition_history` inserts automatically when `condition_grade` is updated.

**Keep the `horse_timeline` event insertion** — the trigger only writes to `condition_history`, not the timeline. But remove the condition_history insert and change the timeline event to use the server-known values:

```typescript
// ── Condition History Ledger ──
// NOTE: The condition_history INSERT is now handled by a Postgres trigger
// (trg_user_horses_condition). We only need to add the Hoofprint timeline event.
const conditionChangeStr = formData.get("conditionChange") as string;
if (conditionChangeStr) {
    try {
        const cc = JSON.parse(conditionChangeStr) as {
            newCondition: string;
            note: string | null;
        };

        // Insert Hoofprint timeline event (the note is user-provided context)
        await supabase.from("horse_timeline").insert({
            horse_id: horseId,
            user_id: user.id,
            event_type: "condition_change",
            title: `Condition updated to ${cc.newCondition}`,
            description: cc.note || undefined,
        });
    } catch { /* Non-blocking — don't fail the save */ }
}
```

**Also update the Edit Horse form** (`src/app/stable/[id]/edit/page.tsx`) to stop sending `oldCondition` in the `conditionChange` payload. The trigger reads the old value from the DB row directly.

### Task A.5: Verify Phase A

1. Run `npx next build` — must compile with 0 errors.
2. Test: Transfer a horse. Verify ownership swaps, timeline events appear, vault is cleared.
3. Test: Try to claim the same transfer code from two browsers simultaneously. Only one should succeed.
4. Test: Change a horse's condition. Verify `condition_history` has a new row with correct `old_condition` (from the DB, not the client).
5. Test: Vote on a show entry. Verify vote count is correct.

---

## PHASE B: NETWORK PIPELINE (Bypassing Vercel Limits)

> **Why:** Server Actions receive raw `File` objects for image uploads, approaching the 4.5MB payload limit. The insurance report calls `createSignedUrl()` in a loop — 200 API calls when it should be 1.

### Task B.1: Direct-to-Storage Client Uploads — Add Horse

**This is the biggest refactor in the workflow.** The Add Horse form currently sends images through the Server Action. We need to split it into 3 steps.

**Step 1: Create a new server action `createHorseRecord()` in `horse.ts`**

```typescript
/**
 * Step 1 of 2-step save: Create the horse DB record WITHOUT images.
 * Returns the horseId so the client can upload images directly to Storage.
 */
export async function createHorseRecord(data: {
    customName: string;
    finishType: string;
    conditionGrade?: string;
    isPublic: boolean;
    tradeStatus?: string;
    lifeStage?: string;
    selectedMoldId?: string;
    selectedResinId?: string;
    selectedReleaseId?: string;
    selectedCollectionId?: string;
    sculptor?: string;
    finishingArtist?: string;
    editionNumber?: number;
    editionSize?: number;
    listingPrice?: number;
    marketplaceNotes?: string;
    purchasePrice?: number;
    purchaseDate?: string;
    estimatedValue?: number;
    insuranceNotes?: string;
}): Promise<{ success: boolean; horseId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Build insert object (same field mapping as current addHorseAction)
    const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: data.customName,
        finish_type: data.finishType,
        condition_grade: data.conditionGrade || null,
        is_public: data.isPublic,
        trade_status: data.tradeStatus || null,
        life_stage: data.lifeStage || "Living",
    };

    if (data.selectedMoldId) horseInsert.reference_mold_id = data.selectedMoldId;
    if (data.selectedResinId) horseInsert.artist_resin_id = data.selectedResinId;
    if (data.selectedReleaseId) horseInsert.release_id = data.selectedReleaseId;
    if (data.selectedCollectionId) horseInsert.collection_id = data.selectedCollectionId;
    if (data.sculptor) horseInsert.sculptor = data.sculptor;
    if (data.finishingArtist) horseInsert.finishing_artist = data.finishingArtist;
    if (data.editionNumber) horseInsert.edition_number = data.editionNumber;
    if (data.editionSize) horseInsert.edition_size = data.editionSize;

    if (data.tradeStatus && data.tradeStatus !== "Not for Sale") {
        if (data.listingPrice) horseInsert.listing_price = data.listingPrice;
        if (data.marketplaceNotes) horseInsert.marketplace_notes = data.marketplaceNotes;
    }

    const { data: horse, error } = await supabase
        .from("user_horses")
        .insert(horseInsert)
        .select("id")
        .single<{ id: string }>();

    if (error || !horse) return { success: false, error: error?.message || "Failed to save horse." };

    // Insert financial vault if any data provided
    const hasVault = data.purchasePrice || data.purchaseDate || data.estimatedValue || data.insuranceNotes;
    if (hasVault) {
        const vaultInsert: Record<string, unknown> = { horse_id: horse.id };
        if (data.purchasePrice) vaultInsert.purchase_price = data.purchasePrice;
        if (data.purchaseDate) vaultInsert.purchase_date = data.purchaseDate;
        if (data.estimatedValue) vaultInsert.estimated_current_value = data.estimatedValue;
        if (data.insuranceNotes) vaultInsert.insurance_notes = data.insuranceNotes;
        await supabase.from("financial_vault").insert(vaultInsert);
    }

    return { success: true, horseId: horse.id };
}
```

**Step 2: Create `finalizeHorseImages()` in `horse.ts`**

```typescript
/**
 * Step 2 of 2-step save: Record image metadata after client-side upload.
 * Called AFTER the browser has uploaded files directly to Supabase Storage.
 */
export async function finalizeHorseImages(
    horseId: string,
    images: { path: string; angle: string }[]
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    // Insert image records
    const inserts = images.map((img) => ({
        horse_id: horseId,
        image_url: img.path, // Store the raw path, not the full URL
        angle_profile: img.angle,
    }));

    const { error } = await supabase.from("horse_images").insert(inserts);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard");
    return { success: true };
}
```

**Step 3: Refactor `AddHorsePage` (`src/app/add-horse/page.tsx`)**

Update the form submit handler to use the 2-step pattern:

```typescript
async function handleSubmit() {
    setSaving(true);
    setError("");

    // Step 1: Create DB record (no files)
    const result = await createHorseRecord({
        customName, finishType, conditionGrade, isPublic,
        tradeStatus, lifeStage,
        selectedMoldId: selectedMoldId || undefined,
        selectedResinId: selectedResinId || undefined,
        selectedReleaseId: selectedReleaseId || undefined,
        selectedCollectionId: selectedCollectionId || undefined,
        sculptor: sculptor || undefined,
        finishingArtist: finishingArtist || undefined,
        // ... other fields
    });

    if (!result.success || !result.horseId) {
        setError(result.error || "Failed to save horse.");
        setSaving(false);
        return;
    }

    const horseId = result.horseId;

    // Step 2: Upload images directly from browser to Supabase Storage
    const uploadedImages: { path: string; angle: string }[] = [];

    // You need a BROWSER supabase client for this:
    const { createClient: createBrowserClient } = await import("@supabase/ssr");
    const browserSupabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    for (const [angle, file] of Object.entries(imageSlots)) {
        if (file instanceof File && file.size > 0) {
            const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
            const { error: uploadError } = await browserSupabase.storage
                .from("horse-images")
                .upload(filePath, file, { contentType: "image/webp" });

            if (!uploadError) {
                uploadedImages.push({ path: filePath, angle });
            }
        }
    }

    // Upload extra detail images
    for (let i = 0; i < extraFiles.length; i++) {
        const file = extraFiles[i];
        if (file.size > 0) {
            const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
            const { error: uploadError } = await browserSupabase.storage
                .from("horse-images")
                .upload(filePath, file, { contentType: "image/webp" });

            if (!uploadError) {
                uploadedImages.push({ path: filePath, angle: "extra_detail" });
            }
        }
    }

    // Step 3: Finalize image metadata
    if (uploadedImages.length > 0) {
        await finalizeHorseImages(horseId, uploadedImages);
    }

    router.push(`/dashboard?toast=Horse+added+successfully`);
}
```

**IMPORTANT:** You will need to initialize a Supabase browser client. Check if `src/lib/supabase/client.ts` already exports a browser client. If not, create one:

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
```

**Apply the same pattern to `updateHorseAction()` and the Edit Horse form** — split into data update + client-side image upload + finalize.

### Task B.2: Tighten Image Compression

**File: `src/lib/utils/imageCompression.ts`**

Find and update the compression constants:

```typescript
// BEFORE:
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

// AFTER:
const MAX_DIMENSION = 1000;
const QUALITY = 0.7;
```

This reduces average image size from ~200-400KB to ~50-100KB.

### Task B.3: Batch Signed URLs in Insurance Report

**File: `src/app/actions/insurance-report.ts`**

The current code calls `createSignedUrl()` inside a `for` loop (line ~130). Refactor to batch:

```typescript
// BEFORE (inside the for loop):
for (const horse of horses) {
    // ... 
    const { data: signedData } = await supabase.storage
        .from("horse-images")
        .createSignedUrl(path, 600);
    photoUrl = signedData?.signedUrl || null;
}

// AFTER (batch outside the loop):
// 1. Collect all image paths
const imagePathMap = new Map<string, string>(); // horseId -> storagePath
for (const horse of horses) {
    const thumb = horse.horse_images?.find(img => img.angle_profile === "Primary_Thumbnail");
    const imageUrl = thumb?.image_url || horse.horse_images?.[0]?.image_url;
    if (imageUrl) {
        imagePathMap.set(horse.id, extractStoragePath(imageUrl));
    }
}

// 2. One API call for all signed URLs
const allPaths = Array.from(imagePathMap.values());
const signedUrlMap = new Map<string, string>();
if (allPaths.length > 0) {
    const { data: signedData } = await supabase.storage
        .from("horse-images")
        .createSignedUrls(allPaths, 600);
    if (signedData) {
        signedData.forEach((item, i) => {
            if (item.signedUrl) {
                // Map path back to horse ID
                const path = allPaths[i];
                for (const [horseId, horsePath] of imagePathMap) {
                    if (horsePath === path) {
                        signedUrlMap.set(horseId, item.signedUrl);
                        break;
                    }
                }
            }
        });
    }
}

// 3. Use in the report building loop
for (const horse of horses) {
    const photoUrl = signedUrlMap.get(horse.id) || null;
    // ... rest of report building
}
```

This drops Supabase Storage API calls from N (one per horse) to 1.

### Task B.4: Verify Phase B

1. Run `npx next build` — 0 errors.
2. Test: Add a horse with 5+ images. Verify images upload and display correctly.
3. Verify: Check browser DevTools Network tab — images should go directly to Supabase Storage, NOT through the Next.js server.
4. Test: Generate an insurance report for 20+ horses. Should complete in under 3 seconds.

---

## PHASE C: DATA FETCHING REWRITE (Performance)

> **Why:** The dashboard loads sequentially (~450ms). The Show Ring searches only client-side data. `batchFetchAliases` does manual N+1 alias lookups when PostgREST joins are available.

### Task C.1: Dashboard `Promise.all` Parallelization

**File: `src/app/dashboard/page.tsx`**

Restructure the data fetching from sequential awaits to parallel batches:

```typescript
export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // ── Round 1: Independent queries in parallel ──
    const [profileResult, horsesResult, collectionsResult, showRecordsResult, convosResult] = await Promise.all([
        supabase.from("users").select("alias_name").eq("id", user.id).single<{ alias_name: string }>(),
        supabase.from("user_horses").select(`
            id, custom_name, finish_type, condition_grade, created_at, collection_id, sculptor, trade_status,
            reference_molds(mold_name, manufacturer),
            artist_resins(resin_name, sculptor_alias),
            reference_releases(release_name, model_number),
            horse_images(image_url, angle_profile)
        `).eq("owner_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_collections").select("id, name, description").eq("user_id", user.id).order("name"),
        supabase.from("show_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("conversations").select("id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
    ]);

    const profile = profileResult.data;
    const horses = (horsesResult.data as unknown as HorseWithDetails[]) ?? [];
    const collections = (collectionsResult.data as unknown as UserCollection[]) ?? [];
    const totalShowRecords = showRecordsResult.count;
    const convoIds = (convosResult.data ?? []).map((c: { id: string }) => c.id);

    // ── Round 2: Dependent queries in parallel ──
    const horseIds = horses.map(h => h.id);
    const [vaultsResult, unreadResult, signedUrlMap] = await Promise.all([
        horseIds.length > 0
            ? supabase.from("financial_vault").select("purchase_price, estimated_current_value, horse_id").in("horse_id", horseIds)
            : Promise.resolve({ data: [] }),
        convoIds.length > 0
            ? supabase.from("messages").select("id", { count: "exact", head: true }).neq("sender_id", user.id).eq("is_read", false).in("conversation_id", convoIds)
            : Promise.resolve({ count: 0 }),
        getSignedImageUrls(supabase, horses.flatMap(h => {
            const thumb = h.horse_images?.find(img => img.angle_profile === "Primary_Thumbnail");
            return thumb ? [thumb.image_url] : [];
        })),
    ]);

    // ... rest of the page (same as current)
```

### Task C.2: Server-Side Show Ring Search

**File: `src/app/community/page.tsx`**

1. Add `searchParams` to the page props:
```typescript
export default async function CommunityPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; finish?: string; trade?: string }>;
}) {
    const params = await searchParams;
```

2. Apply filters to the Supabase query:
```typescript
let query = supabase
    .from("user_horses")
    .select(`...`)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

if (params.q) {
    query = query.or(`custom_name.ilike.%${params.q}%,reference_molds.mold_name.ilike.%${params.q}%`);
}
if (params.finish && params.finish !== "all") {
    query = query.eq("finish_type", params.finish);
}
if (params.trade && params.trade !== "all") {
    query = query.eq("trade_status", params.trade);
}

query = query.limit(60);
```

3. Update `ShowRingFilters.tsx` and any search bar to use `useRouter().push()` with URL params instead of local state.

4. Remove any local `useMemo` filtering logic from `ShowRingGrid.tsx` — it should be a pure presentation component.

### Task C.3: Replace `batchFetchAliases` with PostgREST Joins

**File: `src/app/actions/art-studio.ts`**

Find all 5 call sites of `batchFetchAliases` and replace with PostgREST inner joins.

**Example — in commission listing queries:**
```typescript
// BEFORE:
const { data: commissions } = await supabase.from("commissions").select("*").eq("artist_id", user.id);
const aliasMap = await batchFetchAliases(supabase, [...clientIds, user.id]);

// AFTER:
const { data: commissions } = await supabase
    .from("commissions")
    .select("*, client:users!client_id(alias_name, avatar_url), artist:users!artist_id(alias_name)")
    .eq("artist_id", user.id);
// Access via: commission.client.alias_name
```

After all 5 call sites are converted, **delete the `batchFetchAliases` function** (around line 743).

### Task C.4: Verify Phase C

1. Run `npx next build` — 0 errors.
2. Test: Dashboard load should feel noticeably snappier.
3. Test: Search for a horse on the Show Ring that's beyond the first 60. It should appear.
4. Test: Art Studio commission list — aliases should still display correctly.

---

## COMPLETION CHECKLIST

When all phases are done, verify:

- [ ] `npx next build` — 0 TypeScript errors
- [ ] Transfer: Atomic claim works, concurrent claims are blocked
- [ ] Transfer: Vault is cleared, ghost remnant is created, timeline is correct
- [ ] Condition: Trigger populates condition_history from DB (not client)
- [ ] Votes: Toggle works atomically, counts are always correct
- [ ] Images: Upload goes directly from browser to Storage
- [ ] Images: Add Horse and Edit Horse both work with new 2-step pattern
- [ ] Insurance PDF: One batch signed URL call (check server logs for timing)
- [ ] Dashboard: Loads in < 200ms (was ~450ms)
- [ ] Show Ring: Server-side search finds horses beyond first 60
- [ ] Art Studio: No more batchFetchAliases — uses PostgREST joins

After this workflow is complete, the V2 FEATURE FREEZE is lifted.
