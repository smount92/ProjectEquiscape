---
description: "V24 Trust & Scale Sprint — Verified provenance, Blue Book resin blanks, commerce rug-pull lock, handler show conflicts, storage ghost file GC. 5 directives."
---

# V24 Trust & Scale Sprint

> **Philosophy:** Zero orphaned state. Every mutation guards its invariants.
> **Estimated effort:** 4–6 hours across 5 tasks.
> **Pre-requisite:** Phase 6.5 complete (v23). Build passing. Migration 061 deployed.

---

## Task 1: Verified Provenance (Fake Artist Prevention)

**Goal:** When a commission is delivered, the finishing artist is automatically stamped on the horse with a "✅ Verified" flag. Prevents collectors from falsely claiming a prestigious artist finished their model.

**Files to modify:**
- NEW migration: `supabase/migrations/062_verified_artist.sql`
- `src/app/actions/art-studio.ts` — `updateCommissionStatus()` (line 421–555)
- `src/app/community/[id]/page.tsx` — public passport (line ~503)
- `src/app/stable/[id]/page.tsx` — private stable detail (line ~420)

### Step 1.1 — Create migration

Create `supabase/migrations/062_verified_artist.sql`:

```sql
-- ============================================================
-- Migration 062: Verified Finishing Artist
-- Prevents fake artist attribution on model horses
-- ============================================================

ALTER TABLE user_horses
    ADD COLUMN IF NOT EXISTS finishing_artist_verified BOOLEAN DEFAULT false;

-- Index for quick lookup of verified customs
CREATE INDEX IF NOT EXISTS idx_user_horses_verified_artist
    ON user_horses (finishing_artist_verified)
    WHERE finishing_artist_verified = true;
```

### Step 1.2 — Stamp artist on commission delivery

Open `src/app/actions/art-studio.ts`. Find the `updateCommissionStatus()` function.

Inside the `if (newStatus === "delivered")` block (around line 488), **after** the transaction creation and **before** the WIP photo pipeline, add:

```typescript
        // ── Verified Artist Stamp ──
        // When a commission is delivered, stamp the finishing artist on the horse
        if (c.horse_id) {
            try {
                const { data: artistUser } = await supabase
                    .from("users")
                    .select("alias_name")
                    .eq("id", c.artist_id)
                    .single();
                const artistAlias = (artistUser as { alias_name: string } | null)?.alias_name || null;
                if (artistAlias) {
                    await supabase
                        .from("user_horses")
                        .update({
                            finishing_artist: artistAlias,
                            finishing_artist_verified: true,
                        })
                        .eq("id", c.horse_id);
                }
            } catch { /* non-blocking */ }
        }
```

> **Important:** Note that this section already fetches `artistAlias` later in the WIP pipeline for `customization_logs`. To avoid a duplicate query, you can move the `artistUser` fetch earlier and reuse it. Or just keep both — the second one is in a try/catch and the penalty is one extra SELECT.

### Step 1.3 — Update horse queries to include the flag

In `src/app/community/[id]/page.tsx` (public passport), find the `.select()` call (around line 166–167). Add `finishing_artist_verified` to the select string:

**FROM:**
```
is_public, created_at, finishing_artist, edition_number, edition_size, catalog_id,
```
**TO:**
```
is_public, created_at, finishing_artist, finishing_artist_verified, edition_number, edition_size, catalog_id,
```

Also update the type interface (around line 29) to include:
```typescript
  finishing_artist_verified: boolean;
```

In the JSX where `finishing_artist` is displayed (around line 503–506), add a verified badge:

```tsx
{horse.finishing_artist && (
    <div className="passport-detail-item">
        <span className="passport-detail-label">🎨 Finishing Artist</span>
        <span className="passport-detail-value">
            {horse.finishing_artist}
            {horse.finishing_artist_verified && (
                <span className="verified-badge" title="Verified via commission delivery">
                    {" "}✅ Verified
                </span>
            )}
        </span>
    </div>
)}
```

Do the same in `src/app/stable/[id]/page.tsx` (private detail) — same pattern at lines ~107 and ~420.

### Step 1.4 — Add whitelist entry

In `src/app/actions/horse.ts`, find `HORSE_ALLOWED` (line 86). Add `'finishing_artist_verified'` to the array so it can be updated:

```typescript
const HORSE_ALLOWED = [
    'custom_name', 'sculptor', 'finishing_artist', 'finishing_artist_verified', 'finish_type',
```

### Step 1.5 — Verify

```bash
npx next build
```

Expected: 0 errors. Passport and stable detail pages show "✅ Verified" badge.

---

## Task 2: Blue Book Resin Blanks (Life Stage Split)

**Goal:** An unpainted Artist Resin blank and a completed custom on the same mold must track separate prices. Currently they're grouped together, skewing valuations.

**Files to modify:**
- NEW migration: `supabase/migrations/063_bluebook_lifestage.sql`
- `src/app/actions/market.ts` — `MarketPrice` interface + `searchMarketPrices()`
- `src/app/market/page.tsx` — display life stage
- `src/components/MarketFilters.tsx` — add life stage filter

### Step 2.1 — Create migration

Create `supabase/migrations/063_bluebook_lifestage.sql`:

```sql
-- ============================================================
-- Migration 063: Blue Book — Life Stage Split
-- Blank resins and completed customs must price separately
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_market_prices;

CREATE MATERIALIZED VIEW mv_market_prices AS
SELECT
    h.catalog_id,
    h.finish_type,
    h.life_stage,
    MIN(CAST(t.metadata->>'sale_price' AS DECIMAL)) AS lowest_price,
    MAX(CAST(t.metadata->>'sale_price' AS DECIMAL)) AS highest_price,
    AVG(CAST(t.metadata->>'sale_price' AS DECIMAL))::DECIMAL(10,2) AS average_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY CAST(t.metadata->>'sale_price' AS DECIMAL)
    )::DECIMAL(10,2) AS median_price,
    COUNT(t.id) AS transaction_volume,
    MAX(t.completed_at) AS last_sold_at
FROM transactions t
JOIN user_horses h ON t.horse_id = h.id
WHERE t.status = 'completed'
  AND t.metadata->>'sale_price' IS NOT NULL
  AND CAST(t.metadata->>'sale_price' AS DECIMAL) > 0
  AND h.catalog_id IS NOT NULL
GROUP BY h.catalog_id, h.finish_type, h.life_stage;

CREATE UNIQUE INDEX idx_mv_market_prices_composite
    ON mv_market_prices (catalog_id, finish_type, life_stage);

CREATE OR REPLACE FUNCTION refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON mv_market_prices TO anon, authenticated;
```

> **Note:** If v23 Task 2 already created migration 061 with `finish_type` split, this migration supersedes it by also adding `life_stage`. Number accordingly — use the next available migration number.

### Step 2.2 — Update `MarketPrice` interface

Open `src/app/actions/market.ts`. Add `lifeStage` to the interface:

```typescript
export interface MarketPrice {
    catalogId: string;
    title: string;
    maker: string;
    itemType: string;
    finishType: string;
    lifeStage: string;      // ← ADD
    scale: string | null;
    // ... rest unchanged
}
```

### Step 2.3 — Update price mapping

In `searchMarketPrices()`, update the price map key to include life_stage:

```typescript
priceMap.set(`${row.catalog_id}::${row.finish_type || "OF"}::${row.life_stage || "completed"}`, row);
```

And in the merged results, include:
```typescript
lifeStage: (price.life_stage as string) || "completed",
```

Add `lifeStage?: string` to the search options and pass it through as a query filter.

### Step 2.4 — Update Market UI

In `src/app/market/page.tsx`, display life stage per row (e.g., show "Blank" vs "Completed" badge).

In `src/components/MarketFilters.tsx`, add a "Stage" filter dropdown: All, Blank, In Progress, Completed.

### Step 2.5 — Verify

```bash
npx next build
```

---

## Task 3: The "Rug Pull" Commerce Lock

**Goal:** Prevent a seller from deleting, editing, or unparking a horse while an active transaction is pending. Without this, a seller can accept an offer, receive payment, then delete the horse — a "rug pull."

**Files to modify:**
- `src/app/actions/horse.ts` — `deleteHorse()` (line 6), `updateHorseAction()` (line 72), `bulkDeleteHorses()` (line 317)
- `src/app/actions/parked-export.ts` — `unparkHorse()` (line 105)

### Step 3.1 — Create a shared guard function

At the top of `src/app/actions/horse.ts` (after imports, around line 5), add:

```typescript
import { getAdminClient } from "@/lib/supabase/admin";

const ACTIVE_TRANSACTION_STATUSES = ["offer_made", "pending_payment", "funds_verified"];

/** Check if a horse has an active transaction that blocks mutations */
async function checkActiveTransaction(horseId: string): Promise<string | null> {
    const admin = getAdminClient();
    const { data } = await admin
        .from("transactions")
        .select("id")
        .eq("horse_id", horseId)
        .in("status", ACTIVE_TRANSACTION_STATUSES)
        .limit(1)
        .maybeSingle();

    if (data) {
        return "Cannot modify or delete a horse while an active transaction or parked claim is pending. Please cancel the transaction first.";
    }
    return null;
}
```

### Step 3.2 — Guard `deleteHorse()`

In `deleteHorse()` (line 6), after the ownership verification (around line 20), add:

```typescript
    // Guard: check for active transactions
    const txnError = await checkActiveTransaction(horseId);
    if (txnError) return { success: false, error: txnError };
```

### Step 3.3 — Guard `updateHorseAction()`

In `updateHorseAction()` (line 72), after the user auth check (around line 83), add the same guard:

```typescript
    // Guard: check for active transactions
    const txnError = await checkActiveTransaction(horseId);
    if (txnError) return { success: false, error: txnError };
```

### Step 3.4 — Guard `bulkDeleteHorses()`

In `bulkDeleteHorses()` (line 317), before the delete loop, check ALL horse IDs:

```typescript
    // Guard: check for active transactions on any horse in the batch
    const admin = getAdminClient();
    const { data: activeTxns } = await admin
        .from("transactions")
        .select("horse_id")
        .in("horse_id", horseIds)
        .in("status", ACTIVE_TRANSACTION_STATUSES)
        .limit(1);

    if (activeTxns && activeTxns.length > 0) {
        return { success: false, error: "One or more horses have active transactions. Cancel them before deleting." };
    }
```

### Step 3.5 — Guard `unparkHorse()` in `parked-export.ts`

Open `src/app/actions/parked-export.ts`. In `unparkHorse()` (line 105), after ownership check (around line 122), add:

```typescript
    // Guard: check for active commerce transactions
    const admin = getAdminClient();
    const { data: activeTxn } = await admin
        .from("transactions")
        .select("id")
        .eq("horse_id", horseId)
        .in("status", ["offer_made", "pending_payment", "funds_verified"])
        .limit(1)
        .maybeSingle();

    if (activeTxn) {
        return { success: false, error: "Cannot unpark a horse while an active transaction is pending. Please cancel the transaction first." };
    }
```

> **Note:** `getAdminClient` is already imported in `parked-export.ts` (line 4).

### Step 3.6 — Verify

```bash
npx next build
```

Expected: 0 errors. Attempting to delete/edit/unpark a horse with an active transaction returns a clear error.

---

## Task 4: Handler Conflicts in Show Strings

**Goal:** The current `detectConflicts()` only flags conflicts when the same horse is in the same time slot. But in live shows, a human handler can only be in ONE ring at a time — even with different horses. Add handler-level time conflict detection.

**Files to modify:**
- `src/app/actions/competition.ts` — `detectConflicts()` (line 481–524)

### Step 4.1 — Add handler time conflict

Open `src/app/actions/competition.ts`. In `detectConflicts()`, find the inner loop (the `for (let j = i + 1; ...)` block). After the two existing conflict checks, add a third:

```typescript
            // Handler time conflict: ANY two entries in the same time slot
            // (even different horses, because the handler can only be in one ring)
            if (a.time_slot && a.time_slot === b.time_slot && a.horse_id !== b.horse_id) {
                conflicts.push({
                    entryA: a.id,
                    entryB: b.id,
                    reason: `Handler Time Conflict: Two entries scheduled in time slot "${a.time_slot}". You can only handle one horse at a time.`,
                });
            }
```

> **Note:** This is intentionally separate from the existing "Same horse in overlapping time slot" check. The existing check catches `horse_id === horse_id && time_slot === time_slot`. This new check catches `horse_id !== horse_id && time_slot === time_slot`. Together they cover all time slot conflicts.

### Step 4.2 — Verify

```bash
npx next build
```

Expected: 0 errors. Show string planner now detects handler-level time conflicts.

---

## Task 5: Storage Ghost File Garbage Collection

**Goal:** When posts, events, group files, or help-id requests are deleted, the associated storage files (images/docs) are left orphaned. Add cleanup to every delete path.

**Files to modify:**
- `src/app/actions/posts.ts` — `deletePost()` (line 119–131)
- `src/app/actions/posts.ts` — `deleteEventMedia()` (line 331–343)
- `src/app/actions/events.ts` — `deleteEvent()` (line 349–371), `deleteEventPhoto()` (line 553–567)
- `src/app/actions/groups.ts` — `deleteGroupFile()` (line 651–664)

> **Note:** `deleteIdRequest()` in `help-id.ts` already cleans up its `image_url` (lines 259–262). ✅ No change needed there.

### Step 5.1 — Fix `deletePost()` in posts.ts

Current code just deletes the post row. Before the delete, fetch and remove associated media:

```typescript
export async function deletePost(
    postId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Clean up storage files for attached media
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("image_url")
            .eq("post_id", postId);

        if (media && media.length > 0) {
            const paths = (media as { image_url: string }[])
                .map(m => {
                    const match = m.image_url.match(/horse-images\/(.+?)(\?|$)/);
                    return match ? match[1] : null;
                })
                .filter(Boolean) as string[];

            if (paths.length > 0) {
                await supabase.storage.from("horse-images").remove(paths);
            }
        }
    } catch { /* best effort — don't block deletion */ }

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
    return { success: true };
}
```

### Step 5.2 — Fix `deleteEventMedia()` in posts.ts

Before deleting the `media_attachments` row, fetch and remove the storage file:

```typescript
export async function deleteEventMedia(
    mediaId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch the image URL before deleting the row
    try {
        const { data: media } = await supabase
            .from("media_attachments")
            .select("image_url")
            .eq("id", mediaId)
            .maybeSingle();

        if (media) {
            const url = (media as { image_url: string }).image_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch { /* best effort */ }

    const { error } = await supabase.from("media_attachments").delete().eq("id", mediaId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}
```

### Step 5.3 — Fix `deleteEvent()` in events.ts

Before deleting the event, fetch and remove all event photos from storage:

After the ownership check (around line 364) and before the RSVP/event delete, add:

```typescript
    // Clean up event photos from storage
    try {
        const { data: photos } = await supabase
            .from("event_photos")
            .select("image_url")
            .eq("event_id", eventId);

        if (photos && photos.length > 0) {
            const paths = (photos as { image_url: string }[])
                .map(p => {
                    const match = p.image_url.match(/horse-images\/(.+?)(\?|$)/);
                    return match ? match[1] : null;
                })
                .filter(Boolean) as string[];

            if (paths.length > 0) {
                await supabase.storage.from("horse-images").remove(paths);
            }
        }

        // Also clean up any media_attachments (posts within this event)
        const { data: eventPosts } = await supabase
            .from("posts")
            .select("id")
            .eq("event_id", eventId);

        if (eventPosts && eventPosts.length > 0) {
            const postIds = (eventPosts as { id: string }[]).map(p => p.id);
            const { data: media } = await supabase
                .from("media_attachments")
                .select("image_url")
                .in("post_id", postIds);

            if (media && media.length > 0) {
                const mediaPaths = (media as { image_url: string }[])
                    .map(m => {
                        const match = m.image_url.match(/horse-images\/(.+?)(\?|$)/);
                        return match ? match[1] : null;
                    })
                    .filter(Boolean) as string[];

                if (mediaPaths.length > 0) {
                    await supabase.storage.from("horse-images").remove(mediaPaths);
                }
            }
        }
    } catch { /* best effort */ }
```

### Step 5.4 — Fix `deleteEventPhoto()` in events.ts

Before deleting the row, fetch and remove the storage file:

```typescript
export async function deleteEventPhoto(
    photoId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch the photo URL before deleting
    try {
        const { data: photo } = await supabase
            .from("event_photos")
            .select("image_url")
            .eq("id", photoId)
            .maybeSingle();

        if (photo) {
            const url = (photo as { image_url: string }).image_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch { /* best effort */ }

    const { error } = await supabase.from("event_photos").delete().eq("id", photoId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/community/events");
    return { success: true };
}
```

### Step 5.5 — Fix `deleteGroupFile()` in groups.ts

Before deleting the row, fetch and remove the storage file:

```typescript
export async function deleteGroupFile(
    fileId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch the file URL before deleting the row
    try {
        const { data: file } = await supabase
            .from("group_files")
            .select("file_url")
            .eq("id", fileId)
            .maybeSingle();

        if (file) {
            const url = (file as { file_url: string }).file_url;
            const match = url.match(/horse-images\/(.+?)(\?|$)/);
            if (match) {
                await supabase.storage.from("horse-images").remove([match[1]]);
            }
        }
    } catch { /* best effort */ }

    const { error } = await supabase.from("group_files").delete().eq("id", fileId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/community/groups");
    return { success: true };
}
```

### Step 5.6 — Verify

```bash
npx next build
```

Expected: 0 errors. All delete paths now clean up storage before removing rows.

---

## Verification Checklist

After all 5 tasks are done:

- [ ] `npx next build` — 0 errors
- [ ] Task 1: Migration 062 adds `finishing_artist_verified` column
- [ ] Task 1: `updateCommissionStatus()` stamps artist + verified on delivery
- [ ] Task 1: Passport and stable detail show "✅ Verified" badge
- [ ] Task 2: Migration 063 recreates `mv_market_prices` with `life_stage` GROUP BY
- [ ] Task 2: Market page shows Blank vs Completed distinction
- [ ] Task 3: `deleteHorse()` blocks when active transaction exists
- [ ] Task 3: `updateHorseAction()` blocks when active transaction exists
- [ ] Task 3: `bulkDeleteHorses()` blocks when active transaction exists
- [ ] Task 3: `unparkHorse()` blocks when active transaction exists
- [ ] Task 4: `detectConflicts()` flags handler time conflicts (different horses, same slot)
- [ ] Task 5: `deletePost()` cleans up media_attachments storage
- [ ] Task 5: `deleteEventMedia()` cleans up storage before row delete
- [ ] Task 5: `deleteEvent()` cleans up event photos + post media storage
- [ ] Task 5: `deleteEventPhoto()` cleans up storage before row delete
- [ ] Task 5: `deleteGroupFile()` cleans up storage before row delete

## Status Tracker

| Task | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Verified provenance (fake artist prevention) | ⬜ TODO | |
| 2 | Blue Book resin blanks (life stage split) | ⬜ TODO | |
| 3 | Commerce rug-pull lock | ⬜ TODO | |
| 4 | Handler show string conflicts | ⬜ TODO | |
| 5 | Storage ghost file GC | ⬜ TODO | |
