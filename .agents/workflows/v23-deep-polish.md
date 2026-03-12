---
description: "Phase 6.5 — Deep Polish & Hardening. 5 directives: Commerce escape hatches, Blue Book finish-type split, crypto PIN generation, Body Quality grade + insurance OOM prevention, Supabase type generation."
---

# Phase 6.5 — Deep Polish & Hardening

> **Philosophy:** Right, not fast. Ship zero regressions.
> **Estimated effort:** 4–6 hours across 5 tasks.
> **Pre-requisite:** Phase 6 complete. Build passing. Migration 060 deployed.

---

## Task 1: Commerce State Machine Escape Hatches

**Files to modify:**
- `src/app/actions/transactions.ts`
- `src/components/OfferCard.tsx`

### Step 1.1 — Create `cancelTransaction()` action

Open `src/app/actions/transactions.ts`. After the `verifyFundsAndRelease` function (around line 632), add a new server action:

```typescript
// ── Cancel Transaction ──
// Seller can cancel when buyer ghosts during pending_payment
export async function cancelTransaction(
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

    // Only seller can cancel; only from pending_payment
    if (t.party_a_id !== user.id) return { success: false, error: "Only the seller can cancel." };
    if (t.status !== "pending_payment") return { success: false, error: "Transaction cannot be cancelled in this state." };

    // 1. Cancel the transaction
    await admin.from("transactions").update({ status: "cancelled" }).eq("id", transactionId);

    // 2. Revert horse trade_status — look up what it was before we locked it
    //    Since we set it to "Pending Sale" on accept, revert to "Open to Offers"
    await admin.from("user_horses").update({ trade_status: "Open to Offers" }).eq("id", t.horse_id);

    // 3. Notify the buyer
    const { data: sellerProfile } = await supabase.from("users").select("alias_name").eq("id", user.id).single();
    const sellerAlias = (sellerProfile as { alias_name: string } | null)?.alias_name || "Seller";
    await createNotification({
        userId: t.party_b_id,
        type: "offer",
        actorId: user.id,
        content: `@${sellerAlias} cancelled the transaction.`,
        conversationId: t.conversation_id,
    });

    revalidatePath(`/inbox/${t.conversation_id}`);
    return { success: true };
}
```

### Step 1.2 — Auto-cancel competing offers on accept

In the same file, find the `respondToOffer` function (line ~473). Locate the `// Accept: update status, lock horse` section (around line 517). **After** the line that locks the horse (`trade_status: "Pending Sale"`), add:

```typescript
    // Auto-cancel all other active offers on this horse
    const { data: otherOffers } = await admin
        .from("transactions")
        .select("id, party_b_id, conversation_id")
        .eq("horse_id", t.horse_id)
        .eq("status", "offer_made")
        .neq("id", transactionId);

    if (otherOffers && otherOffers.length > 0) {
        for (const other of otherOffers as { id: string; party_b_id: string; conversation_id: string }[]) {
            await admin.from("transactions").update({ status: "cancelled" }).eq("id", other.id);
            // Notify the losing buyer
            await createNotification({
                userId: other.party_b_id,
                type: "offer",
                actorId: user.id,
                content: `Another offer on ${horseName} was accepted. Your offer has been cancelled.`,
                conversationId: other.conversation_id,
            });
        }
    }
```

> **Important:** Place this AFTER the horse name lookup (the `horseName` variable must already be defined).

### Step 1.3 — Add Cancel button to OfferCard

Open `src/components/OfferCard.tsx`. 

**A.** Import the new action at the top (line 6):
```typescript
import { respondToOffer, markPaymentSent, verifyFundsAndRelease, cancelTransaction } from "@/app/actions/transactions";
```

**B.** Add a handler function inside the `OfferCard` component (after `handleVerify`, around line 76):
```typescript
    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel this transaction? The horse will be relisted.")) return;
        setSaving(true);
        setError("");
        const result = await cancelTransaction(transaction.transactionId);
        if (result.success) {
            setStatus("cancelled");
            router.refresh();
        } else {
            setError(result.error || "Failed to cancel.");
        }
        setSaving(false);
    };
```

**C.** In the `pending_payment` JSX section, find the seller's view (the `{isSeller && ...}` block). Add a Cancel button:
```tsx
{isSeller && (
    <div className={styles.actions}>
        <button
            className="btn btn-ghost btn-sm"
            onClick={handleCancel}
            disabled={saving}
            style={{ color: "#ef4444" }}
        >
            {saving ? "…" : "🚫 Cancel / Dispute"}
        </button>
    </div>
)}
```

Find where the seller currently only sees "Waiting for buyer to send payment" text. The seller should now also see the cancel button. Look for the `pending_payment` status block's `isBuyer` branch — the seller (`!isBuyer`) needs the new button.

### Step 1.4 — Verify

```bash
npx next build
```

Expected: 0 errors. All existing OfferCard states still render.

---

## Task 2: Blue Book Integrity — Finish Type Split

**Files to modify:**
- NEW migration: `supabase/migrations/061_market_finish_split.sql`
- `src/app/actions/market.ts`
- `src/app/market/page.tsx`
- `src/components/MarketFilters.tsx`

### Step 2.1 — Create migration

Create `supabase/migrations/061_market_finish_split.sql`:

```sql
-- ============================================================
-- Migration 061: Market Price Guide — Finish Type Split
-- An OF model and a Custom on the same mold must track separately
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_market_prices;

CREATE MATERIALIZED VIEW mv_market_prices AS
SELECT
    h.catalog_id,
    h.finish_type,
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
GROUP BY h.catalog_id, h.finish_type;

-- Composite unique index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_market_prices_catalog_finish
    ON mv_market_prices (catalog_id, finish_type);

-- Recreate the refresh function (unchanged)
CREATE OR REPLACE FUNCTION refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT SELECT ON mv_market_prices TO anon, authenticated;
```

### Step 2.2 — Update `MarketPrice` interface

Open `src/app/actions/market.ts`. Add `finishType` to the `MarketPrice` interface (after `itemType`):

```typescript
export interface MarketPrice {
    catalogId: string;
    title: string;
    maker: string;
    itemType: string;
    finishType: string;         // ← ADD
    scale: string | null;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    medianPrice: number;
    transactionVolume: number;
    lastSoldAt: string | null;
}
```

### Step 2.3 — Update `getMarketPrice()` 

In `getMarketPrice()`, change the query from `.eq("catalog_id", catalogId).single()` to accept an optional `finishType` parameter:

```typescript
export async function getMarketPrice(catalogId: string, finishType?: string): Promise<MarketPrice | null> {
```

Update the query to filter by `finish_type` when provided, and fall back to returning the first result if not:

```typescript
    let query = supabase
        .from("mv_market_prices" as string)
        .select("*")
        .eq("catalog_id", catalogId);
    
    if (finishType) {
        query = query.eq("finish_type", finishType);
    }
    
    const { data } = await query.maybeSingle();
```

Add `finishType` to the return object:
```typescript
    finishType: (row.finish_type as string) || "OF",
```

### Step 2.4 — Update `searchMarketPrices()` 

Add a `finishType?: string` option to the search options. When the price map is built, include `finish_type` as part of the key. Update the merged results to include `finishType`:

In the search options interface, add:
```typescript
    finishType?: string;
```

In the query section where `priceData` is fetched, filter by finish_type if provided:
```typescript
    let priceQuery = supabase.from("mv_market_prices" as string).select("*");
    if (options?.finishType) {
        priceQuery = priceQuery.eq("finish_type", options.finishType);
    }
    const { data: priceData } = await priceQuery;
```

In the merged map, use `catalog_id + finish_type` as the composite key to avoid collisions:
```typescript
    const priceMap = new Map<string, Record<string, unknown>>();
    for (const row of priceRows) {
        priceMap.set(`${row.catalog_id}::${row.finish_type || "OF"}`, row);
    }
```

When merging with catalog items, iterate over all price rows that match each catalog item (since one mold can have multiple finish types now).

### Step 2.5 — Update Market UI

In `src/components/MarketFilters.tsx`, add a "Finish Type" filter dropdown with options: All, OF, Custom, Artist Resin.

In `src/app/market/page.tsx`, pass the `finishType` search param to `searchMarketPrices()` and display the finish type on each price row.

### Step 2.6 — Update type definitions

In `src/lib/types/database.ts`, update the `mv_market_prices` View type to include `finish_type: string`.

### Step 2.7 — Verify

```bash
npx next build
```

Expected: 0 errors. The `/market` page should now show finish type per row.

---

## Task 3: Cryptographic PIN Generation

**Files to modify:**
- `src/app/actions/parked-export.ts` (line 14–21)
- `src/app/actions/hoofprint.ts` (line 256–263)

### Step 3.1 — Fix `generatePin()` in parked-export.ts

Open `src/app/actions/parked-export.ts`. Replace the `generatePin()` function (lines 13–21):

**FROM:**
```typescript
/** Generate a unique 6-char PIN (no ambiguous chars: 0/O, 1/I/L) */
function generatePin(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let pin = "";
    for (let i = 0; i < 6; i++) {
        pin += chars[Math.floor(Math.random() * chars.length)];
    }
    return pin;
}
```

**TO:**
```typescript
import { randomInt } from "crypto";

/** Generate a unique 6-char PIN (no ambiguous chars: 0/O, 1/I/L) */
function generatePin(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let pin = "";
    for (let i = 0; i < 6; i++) {
        pin += chars[randomInt(chars.length)];
    }
    return pin;
}
```

> **Note:** The `import { randomInt } from "crypto"` goes at the top of the file, with the other imports (after line 7).

### Step 3.2 — Fix `generateCode()` in hoofprint.ts

Open `src/app/actions/hoofprint.ts`. Find the `generateCode()` function (line ~256). 

Add `import { randomInt } from "crypto";` to the top of the file.

Replace:
```typescript
code += chars[Math.floor(Math.random() * chars.length)];
```

With:
```typescript
code += chars[randomInt(chars.length)];
```

### Step 3.3 — Verify

```bash
npx next build
```

Expected: 0 errors. `crypto.randomInt` is native Node.js — no package install needed.

---

## Task 4: Hobby UX — Body Quality Grade + Insurance OOM Prevention

**Files to modify:**
- `src/app/add-horse/page.tsx` (CONDITION_GRADES array, ~line 47)
- `src/app/stable/[id]/edit/page.tsx` (CONDITION_GRADES array, ~line 39)
- `src/app/actions/insurance-report.ts`
- `src/components/InsuranceReportButton.tsx`

### Step 4.1 — Add "Body Quality" to CONDITION_GRADES

In **both** `src/app/add-horse/page.tsx` (line 47) and `src/app/stable/[id]/edit/page.tsx` (line 39), add one entry to the `CONDITION_GRADES` array. Insert it between "Good" and "Fair":

```typescript
const CONDITION_GRADES = [
  { value: "Mint", label: "Mint — Flawless, like new" },
  { value: "Near Mint", label: "Near Mint — Minimal handling wear" },
  { value: "Excellent", label: "Excellent — Very light wear, no breaks" },
  { value: "Very Good", label: "Very Good — Minor rubs or scuffs" },
  { value: "Good", label: "Good — Noticeable wear, still displays well" },
  { value: "Body Quality", label: "Body Quality — Suitable for customizing" },   // ← ADD
  { value: "Fair", label: "Fair — Visible flaws, repairs, or damage" },
  { value: "Poor", label: "Poor — Significant damage or missing parts" },
];
```

### Step 4.2 — Add collection filter to insurance report

Open `src/app/actions/insurance-report.ts`. Update the function signature to accept an optional `collectionId`:

```typescript
export async function getInsuranceReportData(collectionId?: string): Promise<{
```

In the horse query (around line 51), add a conditional filter:

```typescript
        let horseQuery = supabase
            .from("user_horses")
            .select(
                `id, custom_name, finish_type, condition_grade,
         catalog_items:catalog_id(title, maker, item_type),
         horse_images(image_url, angle_profile)`
            )
            .eq("owner_id", user.id)
            .order("custom_name");

        // Filter by collection if provided (OOM prevention for large herds)
        if (collectionId) {
            horseQuery = horseQuery.eq("collection_id", collectionId);
        }

        const { data: rawHorses } = await horseQuery;
```

### Step 4.3 — Add collection picker to InsuranceReportButton

Open `src/components/InsuranceReportButton.tsx`. This component needs a new step: before generating the report, show a dropdown asking the user to pick a collection (or "Entire Stable").

Import `useEffect` and `useState`. Add state:
```typescript
const [showPicker, setShowPicker] = useState(false);
const [collections, setCollections] = useState<{ id: string; name: string; emoji: string }[]>([]);
const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
```

On mount, fetch the user's collections:
```typescript
useEffect(() => {
    import("@/app/actions/collections").then(({ getUserCollections }) => {
        getUserCollections().then(setCollections);
    });
}, []);
```

When the user clicks the button:
1. If they have collections, show a picker modal with a "Select Collection" dropdown + "Entire Stable" option
2. When they confirm, call `getInsuranceReportData(selectedCollection)` with the chosen collection ID (or `undefined` for entire stable)
3. A warning should appear when "Entire Stable" is selected for users with >200 horses

### Step 4.4 — Verify

```bash
npx next build
```

Expected: 0 errors. Both add-horse and edit forms now show "Body Quality" in the condition dropdown.

---

## Task 5: Type Safety — Supabase Generated Types

**Files to modify:**
- `src/lib/types/database.ts` (complete replacement)

### Step 5.1 — Generate types

Run:
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/database.generated.ts
```

> **Note:** You need the Supabase project ID. Check `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` — the project ID is the subdomain (e.g., `abc123` from `https://abc123.supabase.co`).

If this fails due to auth, you can also run:
```bash
npx supabase gen types typescript --local > src/lib/types/database.generated.ts
```

### Step 5.2 — Create compatibility shim

Do NOT delete `database.ts` yet. Instead, rename it to `database.legacy.ts` and create a new `database.ts` that:
1. Re-exports everything from `database.generated.ts`
2. Adds any custom type aliases that the codebase relies on (e.g., `AngleProfile`, `FinishType`, `TradeStatus`, `AssetCategory`, `CatalogItemType`)

```typescript
// src/lib/types/database.ts
// Re-export Supabase-generated types + custom aliases

export type { Database } from "./database.generated";
export type { Json } from "./database.generated";

// Legacy aliases — maintained for backward compatibility
// These map to the generated enums
export type AngleProfile = 
  | "Primary_Thumbnail" | "Left_Side" | "Right_Side" | "Front_Chest" 
  | "Back_Hind" | "Detail_Face_Eyes" | "Detail_Ears" | "Detail_Hooves" 
  | "Flaw_Rub_Damage" | "Belly_Makers_Mark" | "extra_detail" | "Other";

export type FinishType = "OF" | "Custom" | "Artist Resin";
export type TradeStatus = "Not for Sale" | "For Sale" | "Open to Offers";
export type CatalogItemType = "plastic_mold" | "plastic_release" | "artist_resin" | "tack" | "medallion" | "micro_mini" | "prop" | "diorama";
export type AssetCategory = "model" | "tack" | "prop" | "diorama";
```

### Step 5.3 — Verify imports

Grep for all imports from `@/lib/types/database` and verify they still resolve:
```bash
grep -r "from.*types/database" src/ --include="*.ts" --include="*.tsx"
```

### Step 5.4 — Verify

```bash
npx next build
```

Expected: 0 errors. All existing imports continue to resolve.

---

## Verification Checklist

After all 5 tasks are done:

- [ ] `npx next build` — 0 errors
- [ ] Task 1: `cancelTransaction` action exists in `transactions.ts`
- [ ] Task 1: `respondToOffer("accept")` auto-cancels other offers on same horse
- [ ] Task 1: OfferCard has Cancel button for seller in `pending_payment` state
- [ ] Task 2: Migration 061 exists with `GROUP BY catalog_id, finish_type`
- [ ] Task 2: `MarketPrice` interface has `finishType` field
- [ ] Task 2: `/market` page shows finish type per entry
- [ ] Task 3: `parked-export.ts` uses `randomInt()` not `Math.random()`
- [ ] Task 3: `hoofprint.ts` uses `randomInt()` not `Math.random()`
- [ ] Task 4: "Body Quality" appears in CONDITION_GRADES in both forms
- [ ] Task 4: `getInsuranceReportData()` accepts optional `collectionId`
- [ ] Task 5: Generated types file exists at `database.generated.ts`
- [ ] Task 5: All imports from `@/lib/types/database` still resolve

## Status Tracker

| Task | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Commerce escape hatches | ⬜ TODO | |
| 2 | Blue Book finish-type split | ⬜ TODO | |
| 3 | Cryptographic PIN generation | ⬜ TODO | |
| 4 | Body Quality grade + OOM prevention | ⬜ TODO | |
| 5 | Supabase type generation | ⬜ TODO | |
