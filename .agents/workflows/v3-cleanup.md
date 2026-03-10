---
description: V3 CRUD Completion & V2 Cleanup Sprint — Edit Horse direct-to-storage, Parked Horse atomic RPC, N+1 join eradication, missing delete/manage CRUD, WIP uploader, admin suggestion execution.
---

# V3 CRUD Completion & V2 Cleanup Workflow

> **Pre-requisites:** V2 Enterprise Refactor (migration 035 applied, Phase A complete). Build must be clean.
> **Sequencing:** Complete V2 first. V3 picks up where V2 left off.
> **Estimated Effort:** ~6 working days across 3 phases.

// turbo-all

---

## PHASE 1: V2 LEFTOVER INFRASTRUCTURE

### Task 1A: Direct-to-Storage "Edit Horse" Refactor

**Problem:** `src/app/stable/[id]/edit/page.tsx` still appends compressed `File` objects to `FormData` and sends them through `updateHorseAction()` — risking Vercel's 4.5MB payload limit.

**Step 1:** Modify `updateHorseAction()` in `src/app/actions/horse.ts`.

The function currently accepts `(horseId: string, formData: FormData)`. It reads both text fields AND file fields from `formData`. Split it to ONLY handle text/JSON data — no files.

Remove all code that:
- Uses `formData.get('slotFile_...')` or `formData.get('extraFile_...')`
- Calls `supabase.storage.from('horse-images').upload(...)` 
- Inserts into `horse_images` table

The function should ONLY:
1. Update `user_horses` row with the JSON horse data
2. Upsert/delete `financial_vault` row
3. Handle condition change timeline event (note: the trigger handles `condition_history`)
4. Return `{ success: true }` (no longer needs to return `horseId` since it's already known)

**Step 2:** Refactor the `handleSave()` function in `src/app/stable/[id]/edit/page.tsx`.

Apply the same 2-step save pattern used in `AddHorsePage`. The supabase browser client is already imported on line 6 (`import { createClient } from "@/lib/supabase/client"`).

```typescript
const handleSave = async () => {
    // ... validation ...
    setIsSaving(true);
    setSaveError(null);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Step 1: Update DB record (text only — no files)
        const result = await updateHorseAction(horseId, {
            horseUpdate: { /* ... all the text fields ... */ },
            vaultData: hasVaultData ? { /* ... */ } : null,
            hasExistingVault,
            deleteVault: !hasVaultData && hasExistingVault,
            conditionChange: conditionGrade !== originalCondition ? {
                newCondition: conditionGrade,
                note: conditionNote.trim() || null,
            } : null,
        });

        if (!result.success) throw new Error(result.error || "Failed to save.");

        // Step 2: Upload NEW images directly from browser → Supabase Storage
        const uploadedImages: { path: string; angle: string }[] = [];

        // Upload new slot images (replacing existing ones)
        for (const [angle, file] of Object.entries(newFiles)) {
            if (!file) continue;
            const compressed = await compressImage(file);

            // Delete old image from storage if it exists
            const existing = existingImages[angle as AngleProfile];
            if (existing?.storagePath) {
                await supabase.storage.from("horse-images").remove([existing.storagePath]);
            }
            // Delete old DB record
            if (existing?.recordId) {
                await deleteHorseImageAction(existing.recordId, null); // storage already handled
            }

            const filePath = `horses/${horseId}/${angle}_${Date.now()}.webp`;
            const { error: uploadError } = await supabase.storage
                .from("horse-images")
                .upload(filePath, compressed, { contentType: "image/webp" });

            if (!uploadError) {
                uploadedImages.push({ path: filePath, angle });
            }
        }

        // Upload new extra detail images
        for (let i = 0; i < newExtraFiles.length; i++) {
            const compressed = await compressImage(newExtraFiles[i].file);
            const filePath = `horses/${horseId}/extra_detail_${Date.now()}_${i}.webp`;
            const { error: uploadError } = await supabase.storage
                .from("horse-images")
                .upload(filePath, compressed, { contentType: "image/webp" });

            if (!uploadError) {
                uploadedImages.push({ path: filePath, angle: "extra_detail" });
            }
        }

        // Step 3: Finalize image metadata
        if (uploadedImages.length > 0) {
            await finalizeHorseImages(horseId, uploadedImages);
        }

        window.location.href = "/dashboard?toast=updated&name=" + encodeURIComponent(customName.trim());
    } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
        setIsSaving(false);
    }
};
```

**Step 3:** Update the imports in `edit/page.tsx`:
```typescript
import { updateHorseAction, deleteHorseImageAction, finalizeHorseImages } from "@/app/actions/horse";
```

**Verify:** `npx next build` — 0 errors. Test editing a horse with 5+ images.

---

### Task 1B: Atomic RPC for Parked Horse Claims

**Problem:** `claimParkedHorse()` in `parked-export.ts` has the same TOCTOU race condition as the pre-refactor `claimTransfer()` — 150 lines of sequential DB calls with no row lock.

**Step 1:** Create `supabase/migrations/036_parked_atomic.sql`:

```sql
-- ============================================================
-- Migration 036: Atomic Parked Horse Claim
-- Prevents TOCTOU race conditions on concurrent PIN claims
-- ============================================================

CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
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
    WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed PIN.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This claim PIN has expired.');
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

    -- Close sender's ownership record with ghost snapshot
    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    -- Create receiver's ownership record
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type,
            v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via Certificate of Authenticity PIN');

    -- Transfer ownership (keep existing life_stage)
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- Create timeline events
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred',
     'Sold off-platform to @' || v_receiver_alias,
     'Sold off-platform and claimed via Certificate of Authenticity.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired',
     'Claimed from @' || v_sender_alias,
     'Acquired off-platform via Certificate of Authenticity PIN.', true);

    -- Clear financial vault (private data doesn't transfer)
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL,
        insurance_notes = NULL, purchase_date = NULL
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
```

**Run this migration in the Supabase SQL Editor.**

**Step 2:** Refactor `claimParkedHorse()` in `src/app/actions/parked-export.ts`.

Replace the entire function body (~150 lines) with the RPC pattern:

```typescript
export async function claimParkedHorse(pin: string): Promise<{
    success: boolean;
    horseName?: string;
    horseId?: string;
    error?: string;
}> {
    try {
        // Rate limit: 5 attempts per 15 minutes per IP
        const allowed = await checkRateLimit("claim_pin", 5, 15);
        if (!allowed) {
            return { success: false, error: "Too many attempts. Please wait 15 minutes." };
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated. Please log in first." };

        // Single atomic RPC — locks, validates, swaps ownership, clears vault
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("claim_parked_horse_atomic", {
            p_pin: pin,
            p_claimant_id: user.id,
        });

        if (error) return { success: false, error: error.message };

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
            return { success: false, error: result.error || "Claim failed." };
        }

        // Background notifications (non-critical)
        try {
            await admin.from("notifications").insert({
                user_id: result.sender_id,
                type: "transfer_claimed",
                actor_id: user.id,
                content: `@${result.receiver_alias} claimed ${result.horse_name} via PIN!`,
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
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred.",
        };
    }
}
```

**Verify:** `npx next build` — 0 errors. Test claiming a parked horse via PIN.

---

### Task 1C: N+1 Alias Join Eradication (Expanded)

**Problem:** The `aliasMap` fetch-then-map pattern exists in **8 action files** (14 call sites). Each does a secondary query against `users` to get `alias_name`. PostgREST inner joins eliminate all of these.

**For each file below, find the aliasMap pattern and replace it with a join in the primary query.**

**Pattern to find:**
```typescript
const userIds = [...new Set(items.map(e => e.user_id))];
const { data: users } = await supabase.from("users").select("id, alias_name").in("id", userIds);
const aliasMap = new Map<string, string>();
(users || []).forEach(u => aliasMap.set(u.id, u.alias_name));
```

**Replace with a join in the primary `.select()` — example:**
```typescript
// BEFORE:
const { data } = await supabase.from("activity_events").select("*");
// + aliasMap fetch + manual mapping

// AFTER:
const { data } = await supabase.from("activity_events")
    .select("*, actor:users!actor_id(alias_name, avatar_url)");
// Access: item.actor.alias_name
```

**Files to update (in order):**

1. **`src/app/actions/activity.ts`** — 2 aliasMap patterns (lines 104-111, 221-227)
   - Join: `users!actor_id(alias_name, avatar_url)`

2. **`src/app/actions/shows.ts`** — 1 pattern (line 148-150)
   - Join: `users!user_id(alias_name)`

3. **`src/app/actions/events.ts`** — 1 pattern (line 136-137)
   - Join: `users!created_by(alias_name)`

4. **`src/app/actions/groups.ts`** — 3 patterns (lines 208-209, 405-406, 436)
   - Joins: `users!created_by(alias_name)` and `users!user_id(alias_name)`

5. **`src/app/actions/hoofprint.ts`** — 1 pattern (line 62-69)
   - Join: `users!user_id(alias_name)`

6. **`src/app/actions/notifications.ts`** — 1 pattern (line 70-77)
   - Join: `users!actor_id(alias_name)`

7. **`src/app/actions/ratings.ts`** — 1 pattern (line 120-127)
   - Join: `users!reviewer_id(alias_name)`

8. **`src/app/actions/art-studio.ts`** — 5 patterns via `batchFetchAliases`
   - After converting all call sites, **delete the `batchFetchAliases` function** (line ~743)

**Important notes:**
- For each join, verify the foreign key exists. If the FK doesn't exist (e.g. `horse_timeline.user_id → users.id`), you may need to use the column syntax: `users!inner(alias_name)` with `.eq()` on the FK column, or add a migration to create the FK.
- Some tables may not have declared FKs. In those cases, keep the aliasMap pattern or add the FK in a separate migration.
- After each file, run `npx next build` to catch any regressions.

---

## PHASE 2: CRUD COMPLETION (Social & Collections)

### Task 2A: Social Post Deletion

**Step 1:** Add `deleteTextPost()` to `src/app/actions/activity.ts`:

```typescript
export async function deleteTextPost(eventId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership before deleting
    const { data: event } = await supabase
        .from("activity_events")
        .select("id")
        .eq("id", eventId)
        .eq("actor_id", user.id)
        .maybeSingle();

    if (!event) return { success: false, error: "Post not found or not yours." };

    const { error } = await supabase.from("activity_events").delete().eq("id", eventId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/feed");
    return { success: true };
}
```

**Step 2:** Add `deleteGroupPost()` to `src/app/actions/groups.ts`:

```typescript
export async function deleteGroupPost(postId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify ownership (post author or group admin)
    const { data: post } = await supabase
        .from("group_posts")
        .select("id")
        .eq("id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!post) return { success: false, error: "Post not found or not yours." };

    // Delete replies first
    await supabase.from("group_post_replies").delete().eq("post_id", postId);
    const { error } = await supabase.from("group_posts").delete().eq("id", postId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    return { success: true };
}
```

**Step 3:** Add 🗑️ delete buttons to `ActivityFeed.tsx` and any group feed components.

Show the button only when the current user owns the post:
```tsx
{currentUserId === post.actorId && (
    <button className="btn btn-ghost btn-sm" onClick={async () => {
        if (confirm("Delete this post?")) {
            await deleteTextPost(post.id);
            router.refresh();
        }
    }}>🗑️</button>
)}
```

### Task 2B: Collection Folder Management

**Step 1:** Add CRUD actions. Check if `src/app/actions/collections.ts` exists. If not, create it:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCollectionAction(
    collectionId: string,
    data: { name?: string; description?: string; isPublic?: boolean }
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.description !== undefined) update.description = data.description.trim() || null;
    if (data.isPublic !== undefined) update.is_public = data.isPublic;

    const { error } = await supabase
        .from("user_collections")
        .update(update)
        .eq("id", collectionId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/collection/${collectionId}`);
    return { success: true };
}

export async function deleteCollectionAction(
    collectionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Unassign horses from collection (or rely on ON DELETE SET NULL if FK is configured)
    await supabase
        .from("user_horses")
        .update({ collection_id: null })
        .eq("collection_id", collectionId)
        .eq("owner_id", user.id);

    const { error } = await supabase
        .from("user_collections")
        .delete()
        .eq("id", collectionId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard");
    return { success: true };
}
```

**Step 2:** In `src/app/stable/collection/[id]/page.tsx`, add a "⚙️ Manage" button (visible to owner only) that opens a modal with rename/delete options.

### Task 2C: Markdown Formatting for Posts (Optional / Low Priority)

**Step 1:** Install `react-markdown` and `remark-gfm`:
```bash
npm install react-markdown remark-gfm
```

**Step 2:** In `ActivityFeed.tsx`, replace `<p>{post.content}</p>` with:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// In the render:
<ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
```

**Step 3:** Add CSS for markdown content in `globals.css`:
```css
.activity-post-content a { color: var(--color-accent-primary); text-decoration: underline; }
.activity-post-content strong { font-weight: 600; }
.activity-post-content ul, .activity-post-content ol { padding-left: var(--space-lg); margin: var(--space-xs) 0; }
```

---

## PHASE 3: ART STUDIO, EVENTS & ADMIN

### Task 3A: WIP Photo Uploader in CommissionTimeline

**Step 1:** In `CommissionTimeline.tsx`, find the update type dropdown/selector. When the selected type is `"wip_photo"`, conditionally render a file input:

```tsx
{updateType === "wip_photo" && (
    <div className="form-group">
        <input
            type="file"
            accept="image/*"
            onChange={(e) => setWipFile(e.target.files?.[0] || null)}
        />
    </div>
)}
```

**Step 2:** On submit, compress the image and upload directly to Storage:
```typescript
if (wipFile) {
    const compressed = await compressImage(wipFile);
    const filePath = `commissions/${commissionId}/wip_${Date.now()}.webp`;
    await supabase.storage.from("horse-images").upload(filePath, compressed, { contentType: "image/webp" });
    // Pass filePath to addCommissionUpdate in the imageUrls array
}
```

### Task 3B: Event & Help ID Deletion

**Step 1:** Add `deleteEvent()` in `src/app/actions/events.ts`:

```typescript
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Verify creator
    const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .eq("created_by", user.id)
        .maybeSingle();

    if (!event) return { success: false, error: "Event not found or not yours." };

    // Delete RSVPs first
    await supabase.from("event_rsvps").delete().eq("event_id", eventId);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/events");
    return { success: true };
}
```

**Step 2:** Add "Delete Event" button on the event detail page (`events/[id]/page.tsx`), visible only when `user.id === event.createdBy`.

**Step 3:** Similarly, add `deleteIdRequest()` in the help-id action file. Add delete button on `HelpIdDetailClient.tsx` for the request creator.

### Task 3C: Admin Suggestion Execution

**Step 1:** Find `reviewSuggestion` in `src/app/actions/suggestions.ts`. If it doesn't exist, create it. When `status === 'approved'`, execute the actual DB insertion:

```typescript
export async function reviewSuggestion(
    suggestionId: string,
    status: "approved" | "rejected",
    adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
    const admin = getAdminClient();
    
    // Fetch the suggestion
    const { data: suggestion } = await admin
        .from("user_suggestions")
        .select("*")
        .eq("id", suggestionId)
        .single();

    if (!suggestion) return { success: false, error: "Suggestion not found." };

    if (status === "approved") {
        // Execute the actual database insertion based on suggestion_type
        try {
            if (suggestion.suggestion_type === "mold") {
                await admin.from("reference_molds").insert({
                    mold_name: suggestion.name,
                    manufacturer: suggestion.details?.manufacturer || "Unknown",
                    // ... other fields from suggestion.details
                });
            } else if (suggestion.suggestion_type === "release") {
                await admin.from("reference_releases").insert({
                    release_name: suggestion.name,
                    mold_id: suggestion.details?.mold_id,
                    // ... other fields
                });
            } else if (suggestion.suggestion_type === "resin") {
                await admin.from("artist_resins").insert({
                    resin_name: suggestion.name,
                    sculptor_alias: suggestion.details?.sculptor || "Unknown",
                    // ... other fields
                });
            }
        } catch (insertError) {
            return { success: false, error: `Failed to insert: ${insertError}` };
        }
    }

    // Update suggestion status
    await admin.from("user_suggestions").update({
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
    }).eq("id", suggestionId);

    revalidatePath("/admin");
    return { success: true };
}
```

---

## COMPLETION CHECKLIST

- [ ] `npx next build` — 0 TypeScript errors
- [ ] Edit Horse: Images upload directly from browser to Storage (no FormData files)
- [ ] Parked Claim: Atomic RPC with row lock, concurrent claims blocked
- [ ] N+1 Joins: aliasMap pattern eliminated from all 8 action files
- [ ] `batchFetchAliases` function deleted from art-studio.ts
- [ ] Social Posts: Delete button on own posts (Feed + Groups)
- [ ] Collections: Rename and delete functionality
- [ ] Events: Creator can delete their events
- [ ] Help ID: Creator can delete their requests
- [ ] Art Studio: WIP photo upload works end-to-end
- [ ] Admin: Approving a suggestion inserts the record into the reference table

After this workflow completes, V3 CLEANUP SPRINT is done. Resume feature development.
