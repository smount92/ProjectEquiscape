---
description: "Phase 7 — The Masterclass Sprint. 15 directives across 4 pillars: Data Integrity & AI Safety, Infrastructure & Cost, Commerce & Art Studio, Hobby-Native UX. The 'right, not fast' graduation exam."
---

# Phase 7: The Masterclass Sprint (V26)

> **Philosophy:** Every edge case is a trust violation waiting to happen. Fix them all.
> **Estimated effort:** 10–14 hours across 15 tasks in 4 phases.
> **Pre-requisite:** V25 complete. Build passing. Migrations through 066.
> **Overlap:** Directives 5 (WebSocket) and 10 (Expired Transfer) are already completed in V25 Tasks 1 and 3. Marked DONE below.

---

# ═══════════════════════════════════════════════════════════
# PHASE A: DATA INTEGRITY & AI SAFETY (Directives 1–4)
# ═══════════════════════════════════════════════════════════

## Task 1: The "Breyer Adios" Search Bug (CRITICAL)

**The Flaw:** `searchCatalogAction()` uses `.or('title.ilike.%${q}%,maker.ilike.%${q}%')`. Searching "Breyer Adios" returns 0 results because "Breyer Adios" isn't in `title` alone or `maker` alone — "Breyer" is the maker and "Adios" is the title.

**Files to modify:**
- `src/app/actions/reference.ts` — `searchCatalogAction()` (lines 29–60)

### Step 1.1 — Split query into words and chain filters

Replace the entire `searchCatalogAction` function body:

```typescript
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q) return [];

    const words = q.split(/\s+/).filter(w => w.length > 0);

    // Build a query where ALL words must appear across title, maker, or model_number
    let queryBuilder = supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes");

    for (const word of words) {
        // Each word must appear in title OR maker OR model_number
        queryBuilder = queryBuilder.or(
            `title.ilike.%${word}%,maker.ilike.%${word}%,attributes->>model_number.ilike.%${word}%`
        );
    }

    const { data } = await queryBuilder
        .order("item_type")
        .order("title")
        .limit(50);

    return (data ?? []).map(mapCatalogRow);
}
```

**Why this works:** Searching "Breyer Adios" splits into `["Breyer", "Adios"]`. The first `.or()` finds rows where "Breyer" appears in title/maker/model_number. The second `.or()` further filters to rows where "Adios" also appears. Result: matches where both words exist across any combination of fields.

> **Note:** This removes the separate fallback query since `attributes->>model_number` is now searched in the primary query.

### Step 1.2 — Verify

```bash
npx next build
```

---

## Task 2: AI Vision Guardrails

**The Flaw:** `identify-mold/route.ts` forces Gemini to pick a mold even for non-equine images. A photo of a coffee mug will get identified as "Adios" with 0.3 confidence.

**Files to modify:**
- `src/app/api/identify-mold/route.ts` — `BASE_SYSTEM_PROMPT` (line 20), response handling (lines ~190–220)

### Step 2.1 — Update the system prompt

Replace `BASE_SYSTEM_PROMPT` (line 20):

```typescript
const BASE_SYSTEM_PROMPT = `You are an expert equine model appraiser. 

STEP 1: Determine if the image contains a model horse, model equine, or equine statue/figurine.
If the image does NOT contain any equine model or statue, you MUST respond with ONLY this JSON:
{"error": "Not a model horse"}

STEP 2: If it IS a model horse, identify the specific physical Mold. Ignore the coat color. Output strictly in JSON format with keys: manufacturer, mold_name, scale, and confidence_score.`;
```

### Step 2.2 — Handle the error response in the route

After parsing the JSON response (around line 208), add an error check:

```typescript
    // Check if AI detected a non-equine image
    if (parsed.error) {
        return NextResponse.json(
            { error: parsed.error, not_equine: true },
            { status: 200 }
        );
    }
```

### Step 2.3 — Update client UI

Find the component that calls `/api/identify-mold` (likely in the add-horse form or a dedicated identify page). After receiving the response, check for the error:

```typescript
if (result.error && result.not_equine) {
    setError("This doesn't appear to be a model horse. Please upload a photo of an equine model or figurine.");
    return;
}
```

### Step 2.4 — Verify

```bash
npx next build
```

---

## Task 3: The Reference "Bait & Switch" Log

**The Flaw:** A seller lists as "Breyer #123" (rare), gets an offer, then quietly edits `catalog_id` to "Breyer #456" (common) before delivery. No audit trail.

**Files to modify:**
- `src/app/actions/horse.ts` — `updateHorseAction()` (around line 96)

### Step 3.1 — Detect catalog_id changes and log

In `updateHorseAction()`, after the rug-pull guard and before the actual update, add a catalog change detector:

```typescript
        // ── Bait & Switch detection: log catalog_id changes ──
        if (horseUpdate && horseUpdate.catalog_id !== undefined) {
            try {
                const { data: existing } = await supabase
                    .from("user_horses")
                    .select("catalog_id")
                    .eq("id", horseId)
                    .eq("owner_id", user.id)
                    .single();

                const oldCatalogId = (existing as { catalog_id: string | null } | null)?.catalog_id;
                const newCatalogId = horseUpdate.catalog_id as string | null;

                if (oldCatalogId !== newCatalogId && (oldCatalogId || newCatalogId)) {
                    // Fetch names for both catalog items
                    let oldName = "Unlinked";
                    let newName = "Unlinked";

                    if (oldCatalogId) {
                        const { data: oldItem } = await supabase
                            .from("catalog_items")
                            .select("title, maker")
                            .eq("id", oldCatalogId)
                            .maybeSingle();
                        if (oldItem) oldName = `${(oldItem as { maker: string }).maker} ${(oldItem as { title: string }).title}`;
                    }
                    if (newCatalogId) {
                        const { data: newItem } = await supabase
                            .from("catalog_items")
                            .select("title, maker")
                            .eq("id", newCatalogId)
                            .maybeSingle();
                        if (newItem) newName = `${(newItem as { maker: string }).maker} ${(newItem as { title: string }).title}`;
                    }

                    // Create Hoofprint event via posts table
                    await supabase.from("posts").insert({
                        author_id: user.id,
                        horse_id: horseId,
                        content: `📋 Reference identity updated from "${oldName}" to "${newName}".`,
                    });
                }
            } catch { /* non-blocking audit log */ }
        }
```

### Step 3.2 — Verify

```bash
npx next build
```

---

## Task 4: Blue Book "Bundle" Skew Prevention

**The Flaw:** A $500 mare+foal set sale linked only to the foal inflates the foal's price to $500 in the Blue Book.

**Files to modify:**
- `src/app/actions/transactions.ts` — `makeOffer()` (line 390) — accept `isBundle` flag
- `src/components/ChatThread.tsx` or wherever the offer UI is — add bundle toggle
- NEW migration: `supabase/migrations/067_bundle_sale_filter.sql` — update `mv_market_prices`

### Step 4.1 — Add `isBundle` to `makeOffer()`

In `makeOffer()` (line 392), add to the function signature:

```typescript
export async function makeOffer(data: {
    horseId: string;
    sellerId: string;
    amount: number;
    message?: string;
    isBundle?: boolean;    // ← ADD
}):
```

In the `.insert()` call (around line 449), add metadata:

```typescript
            metadata: data.isBundle ? { is_bundle_sale: true } : null,
```

### Step 4.2 — Create migration to filter bundles

Create `supabase/migrations/067_bundle_sale_filter.sql`:

```sql
-- ============================================================
-- Migration 067: Blue Book — Exclude Bundle Sales
-- Bundle sales inflate individual model prices unfairly
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
  AND (t.metadata->>'is_bundle_sale') IS DISTINCT FROM 'true'
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

### Step 4.3 — Add bundle toggle to offer UI

Wherever the make-offer form renders (in `ChatThread.tsx` or a modal), add a checkbox:

```tsx
<label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer", marginTop: "var(--space-sm)" }}>
    <input type="checkbox" checked={isBundle} onChange={e => setIsBundle(e.target.checked)} />
    This is a bundle/lot sale (excludes from market price index)
</label>
```

### Step 4.4 — Verify

```bash
npx next build
```

---

# ═══════════════════════════════════════════════════════════
# PHASE B: INFRASTRUCTURE & COST (Directives 5–7)
# ═══════════════════════════════════════════════════════════

## Task 5: The WebSocket Black Hole

> ✅ **ALREADY DONE in V25 Task 1.** NotificationBell now uses `setInterval(60_000)` polling.

---

## Task 6: System Garbage Collection

**The Flaw:** Read notifications and stale offers accumulate forever, degrading query performance.

**Files to modify:**
- NEW migration: `supabase/migrations/068_system_garbage_collection.sql`
- `src/app/api/cron/refresh-market/route.ts` — call the new RPC

### Step 6.1 — Create GC RPC

Create `supabase/migrations/068_system_garbage_collection.sql`:

```sql
-- ============================================================
-- Migration 068: System Garbage Collection
-- Clean up read notifications and stale offers
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_system_garbage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    deleted_notifications INT;
    cancelled_offers INT;
BEGIN
    -- 1. Delete read notifications older than 30 days
    DELETE FROM notifications
    WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

    -- 2. Auto-cancel offer_made transactions older than 7 days
    UPDATE transactions
    SET status = 'cancelled', metadata = COALESCE(metadata, '{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
    WHERE status = 'offer_made'
      AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cancelled_offers = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_notifications', deleted_notifications,
        'cancelled_offers', cancelled_offers,
        'ran_at', now()
    );
END;
$$;
```

### Step 6.2 — Call GC from cron route

Update `src/app/api/cron/refresh-market/route.ts`. After the market refresh, add:

```typescript
        // System garbage collection
        let gcResult = null;
        try {
            const { data } = await admin.rpc("cleanup_system_garbage" as string);
            gcResult = data;
        } catch { /* non-blocking */ }

        return NextResponse.json({
            success: true,
            refreshedAt: new Date().toISOString(),
            gc: gcResult,
        });
```

### Step 6.3 — Verify

```bash
npx next build
```

---

## Task 7: Extra Detail Photo Abuse Limits

**The Flaw:** No limit on extra detail photo uploads. A user can crash the browser or drain storage.

**Files to modify:**
- `src/app/add-horse/page.tsx` — wherever extra detail files are handled
- `src/app/stable/[id]/edit/page.tsx` — same pattern

### Step 7.1 — Find the extra detail upload handler

Search for where extra files are accumulated. The constant should be:

```typescript
const MAX_EXTRA_PHOTOS = 10;
```

### Step 7.2 — Add limit check

In the file input `onChange` handler for extra detail photos, add:

```typescript
if (currentExtraFiles.length + newFiles.length > MAX_EXTRA_PHOTOS) {
    alert(`Maximum ${MAX_EXTRA_PHOTOS} extra detail photos allowed.`);
    return;
}
```

### Step 7.3 — Add visual indicator

Near the upload zone, show the count:

```tsx
<span className="form-hint">
    {extraFiles.length}/{MAX_EXTRA_PHOTOS} photos
</span>
```

### Step 7.4 — Verify

```bash
npx next build
```

> **Note:** The exact variable names depend on the AddHorsePage implementation. Grep for `extra` or `detail` in the file to find the right state variables.

---

# ═══════════════════════════════════════════════════════════
# PHASE C: COMMERCE & ART STUDIO (Directives 8–10)
# ═══════════════════════════════════════════════════════════

## Task 8: Buyer Offer Retraction

**The Flaw:** `cancelTransaction()` only allows the seller (`party_a_id`) to cancel, and only from `pending_payment`. If a seller ghosts an `offer_made`, the buyer is stuck.

**Files to modify:**
- `src/app/actions/transactions.ts` — new `retractOffer()` action
- `src/components/OfferCard.tsx` — add "Retract Offer" button for buyer

### Step 8.1 — Create `retractOffer()`

Add to `src/app/actions/transactions.ts`:

```typescript
/** Buyer retracts their offer while still in offer_made state */
export async function retractOffer(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const admin = getAdminClient();
    const { data: txn } = await admin
        .from("transactions")
        .select("id, status, party_a_id, party_b_id, horse_id, conversation_id")
        .eq("id", transactionId)
        .single();

    if (!txn) return { success: false, error: "Transaction not found." };
    const t = txn as { id: string; status: string; party_a_id: string; party_b_id: string; horse_id: string; conversation_id: string };

    // Only buyer (party_b) can retract; only from offer_made
    if (t.party_b_id !== user.id) return { success: false, error: "Only the buyer can retract an offer." };
    if (t.status !== "offer_made") return { success: false, error: "Offer can only be retracted while pending." };

    // Cancel the transaction
    await admin.from("transactions").update({ status: "cancelled" }).eq("id", transactionId);

    // Notify seller
    const { data: buyerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const buyerAlias = (buyerProfile as { alias_name: string } | null)?.alias_name || "Buyer";
    await createNotification({
        userId: t.party_a_id,
        type: "offer",
        actorId: user.id,
        content: `@${buyerAlias} retracted their offer.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}
```

### Step 8.2 — Add button to OfferCard

In `src/components/OfferCard.tsx`, add a "Retract Offer" button that's visible when:
- `transaction.status === "offer_made"`
- Current user is `party_b_id` (the buyer)

```tsx
{transaction.status === "offer_made" && isBuyer && (
    <button
        className="btn btn-ghost btn-sm"
        onClick={() => retractOffer(transaction.id)}
        style={{ color: "var(--color-text-muted)" }}
    >
        ↩️ Retract Offer
    </button>
)}
```

### Step 8.3 — Verify

```bash
npx next build
```

---

## Task 9: The Guest Client Portal

**The Flaw:** Artists can't share commission WIP timelines with clients who aren't on MHH.

**Files to modify:**
- NEW migration: `supabase/migrations/069_guest_token.sql`
- `src/app/actions/art-studio.ts` — `createCommission()` — generate guest token
- `src/app/studio/commission/[id]/page.tsx` — handle `?token=` query param

### Step 9.1 — Create migration

Create `supabase/migrations/069_guest_token.sql`:

```sql
-- ============================================================
-- Migration 069: Guest Client Portal
-- Allow artists to share commission timelines with non-MHH clients
-- ============================================================

ALTER TABLE commissions
    ADD COLUMN IF NOT EXISTS guest_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_guest_token
    ON commissions (guest_token);
```

### Step 9.2 — Update commission detail page

In `src/app/studio/commission/[id]/page.tsx`:

1. Accept `searchParams` in the page props
2. If `searchParams.token` exists, query by `guest_token` instead of requiring auth
3. Render the timeline in read-only mode (hide status buttons, hide artist actions)

```typescript
export default async function CommissionDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}) {
    const { id } = await params;
    const { token } = await searchParams;

    let isGuestMode = false;

    if (token) {
        // Guest mode — verify token
        const supabase = await createClient();
        const { data: commission } = await supabase
            .from("commissions")
            .select("id, guest_token")
            .eq("id", id)
            .eq("guest_token", token)
            .maybeSingle();

        if (!commission) return notFound();
        isGuestMode = true;
    } else {
        // Normal auth flow
        // ... existing auth check ...
    }

    // Pass isGuestMode to the component so it hides edit controls
```

### Step 9.3 — Add "Copy Guest Link" button for artist

On the commission detail page (when not in guest mode and user is artist), add:

```tsx
{isArtist && commission.guestToken && (
    <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
            navigator.clipboard.writeText(
                `${window.location.origin}/studio/commission/${commission.id}?token=${commission.guestToken}`
            );
        }}
    >
        🔗 Copy Guest Link
    </button>
)}
```

### Step 9.4 — Verify

```bash
npx next build
```

---

## Task 10: Expired Transfer Auto-Recovery

> ✅ **ALREADY DONE in V25 Task 3.** Both `getParkedHorseByPin()` and `claim_parked_horse_atomic` RPC now revert `life_stage` and insert a system post on expiration.

---

# ═══════════════════════════════════════════════════════════
# PHASE D: HOBBY-NATIVE UX & ENGAGEMENT (Directives 11–15)
# ═══════════════════════════════════════════════════════════

## Task 11: Reverse Matchmaker (Seller Hype)

**The Flaw:** Sellers don't know their horse is in demand until they list it.

**Files to modify:**
- `src/app/stable/[id]/page.tsx` — add demand banner
- NEW or existing action to count wishlist demand

### Step 11.1 — Add demand query

In `src/app/stable/[id]/page.tsx`, after fetching the horse details, add:

```typescript
    // Check wishlist demand (only for owner, unlisted horses with catalog_id)
    let wishlistDemand = 0;
    if (isOwner && horse.trade_status === "Not for Sale" && horse.catalog_id) {
        const { count } = await supabase
            .from("user_wishlists")
            .select("id", { count: "exact", head: true })
            .eq("catalog_id", horse.catalog_id)
            .neq("user_id", user.id); // Don't count the owner's own wishlist

        wishlistDemand = count || 0;
    }
```

### Step 11.2 — Render demand banner

In the JSX, above the horse detail cards:

```tsx
{wishlistDemand > 0 && (
    <div className="getting-started-tip" style={{ marginBottom: "var(--space-lg)", background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
        🔥 <strong>{wishlistDemand} collector{wishlistDemand > 1 ? "s" : ""}</strong> {wishlistDemand > 1 ? "are" : "is"} looking for this model!
        List it for sale to notify them.
    </div>
)}
```

> **Note:** This requires that a `user_wishlists` table exists with `catalog_id` and `user_id` columns. If the table doesn't exist yet, create a migration first.

### Step 11.3 — Verify

```bash
npx next build
```

---

## Task 12: Show String "Carryover" (Duplication)

**The Flaw:** Rebuilding a 50-horse show string from scratch for every show.

**Files to modify:**
- `src/app/actions/competition.ts` — new `duplicateShowString()` action
- Show planner UI — add "Duplicate" button

### Step 12.1 — Create `duplicateShowString()`

In `src/app/actions/competition.ts`, add:

```typescript
/** Duplicate a show string with all its entries */
export async function duplicateShowString(
    stringId: string
): Promise<{ success: boolean; newStringId?: string; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Fetch original
    const { data: original } = await supabase
        .from("show_strings")
        .select("name, notes, user_id")
        .eq("id", stringId)
        .eq("user_id", user.id)
        .single();

    if (!original) return { success: false, error: "Show string not found or not yours." };
    const o = original as { name: string; notes: string | null };

    // Create copy
    const { data: newString, error } = await supabase
        .from("show_strings")
        .insert({
            user_id: user.id,
            name: `${o.name} (copy)`,
            notes: o.notes,
        })
        .select("id")
        .single();

    if (error || !newString) return { success: false, error: error?.message || "Failed to create copy." };
    const newId = (newString as { id: string }).id;

    // Copy entries
    const { data: entries } = await supabase
        .from("show_string_entries")
        .select("horse_id, class_name, class_id, division, time_slot, notes")
        .eq("show_string_id", stringId);

    if (entries && entries.length > 0) {
        const inserts = (entries as { horse_id: string; class_name: string; class_id: string | null; division: string | null; time_slot: string | null; notes: string | null }[]).map(e => ({
            show_string_id: newId,
            horse_id: e.horse_id,
            class_name: e.class_name,
            class_id: e.class_id,
            division: e.division,
            time_slot: e.time_slot,
            notes: e.notes,
        }));
        await supabase.from("show_string_entries").insert(inserts);
    }

    revalidatePath("/shows/planner");
    return { success: true, newStringId: newId };
}
```

### Step 12.2 — Add Duplicate button to UI

On the show string list page, next to each string:

```tsx
<button
    className="btn btn-ghost btn-sm"
    onClick={async () => {
        const result = await duplicateShowString(string.id);
        if (result.success) router.refresh();
    }}
>
    📋 Duplicate
</button>
```

### Step 12.3 — Verify

```bash
npx next build
```

---

## Task 13: Bulk Visibility Panic Button

**The Flaw:** `bulkUpdateHorses()` supports `collectionId` and `tradeStatus` but not `visibility`. A user can't hide their entire stable with one click.

**Files to modify:**
- `src/app/actions/horse.ts` — `bulkUpdateHorses()` (line 300)
- Dashboard/binder bulk action bar — add visibility option

### Step 13.1 — Add visibility to bulk update

In `bulkUpdateHorses()`, update the function signature and body:

```typescript
export async function bulkUpdateHorses(
    horseIds: string[],
    updates: {
        collectionId?: string | null;
        tradeStatus?: string;
        visibility?: "public" | "unlisted" | "private";  // ← ADD
    }
): Promise<{ success: boolean; count?: number; error?: string }> {
```

In the `updateObj` construction:
```typescript
    if (updates.visibility) updateObj.visibility = updates.visibility;
```

### Step 13.2 — Add to bulk action bar

In the dashboard's bulk operations floating bar, add a visibility dropdown:

```tsx
<select
    className="form-input"
    onChange={async (e) => {
        if (!e.target.value) return;
        const result = await bulkUpdateHorses(selectedIds, { visibility: e.target.value as "public" | "unlisted" | "private" });
        if (result.success) { router.refresh(); clearSelection(); }
    }}
    style={{ width: "auto" }}
>
    <option value="">Visibility…</option>
    <option value="public">🌐 Public</option>
    <option value="unlisted">🔗 Unlisted</option>
    <option value="private">🔒 Private</option>
</select>
```

### Step 13.3 — Verify

```bash
npx next build
```

---

## Task 14: The "Stripped" Life Stage

**The Flaw:** Models between factory paint and a new custom are stripped to bare plastic ("bodies"). There's no life stage for this common state.

**Files to modify:**
- NEW migration: `supabase/migrations/070_stripped_life_stage.sql`
- `src/app/add-horse/page.tsx` — life stage dropdown
- `src/app/stable/[id]/edit/page.tsx` — life stage dropdown
- Any component that renders life stage labels

### Step 14.1 — Create migration

Create `supabase/migrations/070_stripped_life_stage.sql`:

```sql
-- ============================================================
-- Migration 070: Add "stripped" life stage
-- For models stripped of factory paint, sold as bodies
-- ============================================================

ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;

ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN ('blank', 'stripped', 'in_progress', 'completed', 'for_sale', 'parked'));
```

### Step 14.2 — Update UI dropdowns

Find all life stage select/dropdown elements. Add the new option:

```tsx
<option value="stripped">🛁 Stripped / Body</option>
```

The full list should be: Blank, Stripped / Body, In Progress, Completed, For Sale.

### Step 14.3 — Update any label maps

If there's a label map like:
```typescript
const LIFE_STAGE_LABELS: Record<string, string> = {
    blank: "🆕 Blank",
    stripped: "🛁 Stripped / Body",
    in_progress: "🎨 In Progress",
    completed: "✅ Completed",
    for_sale: "💰 For Sale",
    parked: "📦 Parked",
};
```

### Step 14.4 — Verify

```bash
npx next build
```

---

## Task 15: Universal Post Editing

**The Flaw:** Users can delete posts but can't edit them. A typo in a 500-word show report means delete and rewrite.

**Files to modify:**
- `src/app/actions/posts.ts` — new `updatePost()` action
- Post rendering components — add edit mode
- Post display — show `(edited)` flag

### Step 15.1 — Add `updated_at` column (if not exists)

Check if `posts` table has `updated_at`. If not, add to migration:

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
```

### Step 15.2 — Create `updatePost()` action

In `src/app/actions/posts.ts`, add:

```typescript
/** Update a post's content (author only) */
export async function updatePost(
    postId: string,
    newContent: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    if (!newContent.trim()) return { success: false, error: "Content cannot be empty." };
    if (newContent.length > 10000) return { success: false, error: "Content is too long." };

    const { error } = await supabase
        .from("posts")
        .update({
            content: newContent.trim(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .eq("author_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath("/feed");
    return { success: true };
}
```

### Step 15.3 — Add edit UI to post rendering

In the post card component, add an "Edit" button (only for the author):

```tsx
{isAuthor && !isEditing && (
    <button className="btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
        ✏️ Edit
    </button>
)}

{isEditing && (
    <div>
        <textarea
            className="form-input"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={4}
        />
        <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
    </div>
)}
```

### Step 15.4 — Show edited flag

In the timestamp display, add:

```tsx
<span className="post-timestamp">
    {formatDate(post.createdAt)}
    {post.updatedAt && (
        <span style={{ fontStyle: "italic", opacity: 0.7 }}> (edited)</span>
    )}
</span>
```

### Step 15.5 — Verify

```bash
npx next build
```

---

# ═══════════════════════════════════════════════════════════
# VERIFICATION CHECKLIST
# ═══════════════════════════════════════════════════════════

After all tasks are complete:

- [ ] `npx next build` — 0 errors
- [ ] Task 1: "Breyer Adios" multi-word search returns correct results
- [ ] Task 2: AI rejects non-equine images with clear message
- [ ] Task 3: Changing `catalog_id` creates a Hoofprint audit post
- [ ] Task 4: Bundle sales excluded from `mv_market_prices`
- [ ] Task 5: ✅ (V25)
- [ ] Task 6: `cleanup_system_garbage()` RPC exists, called from cron
- [ ] Task 7: Extra photos capped at 10
- [ ] Task 8: `retractOffer()` works for buyer in `offer_made` state
- [ ] Task 9: Guest token allows read-only commission view
- [ ] Task 10: ✅ (V25)
- [ ] Task 11: Demand banner shows wishlist count on unlisted horses
- [ ] Task 12: `duplicateShowString()` copies entries to new string
- [ ] Task 13: `bulkUpdateHorses()` supports visibility
- [ ] Task 14: "stripped" life stage in DB, forms, and labels
- [ ] Task 15: `updatePost()` works, "(edited)" flag renders

---

## Status Tracker

| Phase | Task | Description | Status | Date |
|-------|------|-------------|--------|------|
| A | 1 | Breyer Adios search bug (multi-word) | ⬜ TODO | |
| A | 2 | AI vision guardrails (non-equine rejection) | ⬜ TODO | |
| A | 3 | Reference bait & switch log | ⬜ TODO | |
| A | 4 | Blue Book bundle skew prevention | ⬜ TODO | |
| B | 5 | WebSocket black hole | ✅ DONE (V25) | 2026-03-12 |
| B | 6 | System garbage collection (notifications + stale offers) | ⬜ TODO | |
| B | 7 | Extra detail photo abuse limits | ⬜ TODO | |
| C | 8 | Buyer offer retraction | ⬜ TODO | |
| C | 9 | Guest client portal (commission timeline sharing) | ⬜ TODO | |
| C | 10 | Expired transfer auto-recovery | ✅ DONE (V25) | 2026-03-12 |
| D | 11 | Reverse matchmaker (seller hype banner) | ⬜ TODO | |
| D | 12 | Show string duplication | ⬜ TODO | |
| D | 13 | Bulk visibility panic button | ⬜ TODO | |
| D | 14 | "Stripped" life stage | ⬜ TODO | |
| D | 15 | Universal post editing | ⬜ TODO | |
