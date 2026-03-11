---
description: V16 Integrity Sprint — Fix batch import RPC, Blue Book data pipeline, SEO, serverless safety, Vercel cron, dashboard OOM pagination, and database type generation. FEATURE FREEZE until complete.
---

# V16: The Integrity Sprint

> **Master Blueprint:** `docs/v16_master_blueprint.md` — Epic 1
> **Directive:** FEATURE FREEZE. Fix data loss vectors, OOM crashes, SEO failures, and serverless anti-patterns.
> **Pre-requisites:** Epics 1-4 of Ecosystem Expansion complete (Migrations 052-055).

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. Run `npx next build` after every task and note the result
> 4. This is a HARDENING sprint — NO new features, NO new tables, NO new UI concepts

---

## Task 1 — Fix Batch Import RPC (CRITICAL)

**The Bug:** `batch_import_horses` (Migration 023) references `reference_mold_id`, `artist_resin_id`, `release_id` — all dropped in Migration 052. CSV import is completely broken.

**File:** `supabase/migrations/056_fix_batch_import.sql`

### New RPC:

```sql
CREATE OR REPLACE FUNCTION batch_import_horses(
    p_user_id UUID,
    p_horses JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    horse_record JSONB;
    new_horse_id UUID;
    imported_count INT := 0;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;

    FOR horse_record IN SELECT * FROM jsonb_array_elements(p_horses)
    LOOP
        INSERT INTO user_horses (
            owner_id,
            custom_name,
            finish_type,
            condition_grade,
            catalog_id,
            asset_category,
            is_public,
            trade_status
        ) VALUES (
            p_user_id,
            horse_record->>'custom_name',
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'finish_type', 'OF')::finish_type
                ELSE NULL
            END,
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'condition_grade', 'Not Graded')
                ELSE NULL
            END,
            NULLIF(horse_record->>'catalog_id', '')::UUID,
            COALESCE(horse_record->>'asset_category', 'model'),
            false,
            'Not for Sale'
        )
        RETURNING id INTO new_horse_id;

        -- Insert into financial_vault if price data exists
        IF (horse_record->>'purchase_price') IS NOT NULL
           OR (horse_record->>'estimated_value') IS NOT NULL THEN
            INSERT INTO financial_vault (
                horse_id,
                purchase_price,
                estimated_current_value
            ) VALUES (
                new_horse_id,
                NULLIF(horse_record->>'purchase_price', '')::NUMERIC,
                NULLIF(horse_record->>'estimated_value', '')::NUMERIC
            );
        END IF;

        imported_count := imported_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'imported', imported_count);
END;
$$;
```

### Also verify `src/app/actions/csv-import.ts`:
Ensure the JSONB payload passed to `batch_import_horses` uses `catalog_id` and `asset_category` instead of legacy column names.

---

## Task 2 — Fix Blue Book Data Pipeline (CRITICAL)

**The Bug:** `claim_transfer_atomic` and `claim_parked_horse_atomic` RPCs return JSONB that does NOT include `sale_price`. Application code in `hoofprint.ts:361` and `parked-export.ts:298` passes empty metadata to `createTransaction()`.

### Step 2a — SQL: Add `sale_price` to RPC return

**File:** `supabase/migrations/056_fix_batch_import.sql` (append to same migration)

```sql
-- Add sale_price to claim_transfer_atomic return
CREATE OR REPLACE FUNCTION claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
-- ... (same body as migration 050, but change RETURN to include):
    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price    -- ← NEW
    );
$$;

-- Same for claim_parked_horse_atomic
-- Add 'sale_price', v_transfer.sale_price to its RETURN jsonb_build_object
```

### Step 2b — Application: Map `sale_price` into transaction metadata

**File:** `src/app/actions/hoofprint.ts` — in `claimTransfer()` (around line 355-362):

```typescript
// BEFORE:
metadata: { transfer_code: transferCode },

// AFTER:
metadata: {
    transfer_code: transferCode,
    sale_price: result.sale_price || null,
},
```

Add `sale_price?: number;` to the `result` type declaration (line 338-346).

**File:** `src/app/actions/parked-export.ts` — in `claimParkedHorse()` (around line 292-299):

```typescript
// BEFORE:
metadata: { pin },

// AFTER:
metadata: {
    pin,
    sale_price: result.sale_price || null,
},
```

Add `sale_price?: number;` to the `result` type declaration (line 275-283).

---

## Task 3 — SSR the Market Price Guide (SEO)

**The Bug:** `/market/page.tsx` is `"use client"`. Search engines see a blank spinner.

### Refactor to Server Component:

1. **Remove** `"use client"` from `page.tsx`
2. **Move search/sort state** to URL `searchParams`:
   ```typescript
   export default async function MarketPage({
       searchParams,
   }: {
       searchParams: Promise<{ q?: string; type?: string; sort?: string; page?: string }>;
   }) {
       const params = await searchParams;
       const query = params.q || "";
       const itemType = params.type || "all";
       const sortBy = params.sort || "transaction_volume";
       const page = parseInt(params.page || "1");

       const { items, total } = await searchMarketPrices(query, {
           itemType: itemType === "all" ? undefined : itemType,
           sortBy: sortBy as "average_price" | "transaction_volume" | "last_sold_at" | "title",
           sortDirection: "desc",
           limit: 20,
           offset: (page - 1) * 20,
       });
       // ... render server-side
   }
   ```
3. **Extract client interactivity** (search input with debounce, filter chips, sort dropdown) into a small client component `MarketFilters.tsx` that uses `router.push()` to update URL params.
4. **Keep** `generateMetadata()` or static `metadata` export for SEO.

### Result:
- Googlebot sees fully rendered price data on first crawl
- Users get instant server render + URL-based navigation (shareable, back-button compatible)

---

## Task 4 — Serverless Execution Safety

### 4a — Replace `window.location.href` with `router.push()`

**File:** `src/app/stable/[id]/edit/page.tsx` — line 397

```typescript
// BEFORE:
window.location.href = "/dashboard?toast=updated&name=" + encodeURIComponent(customName.trim());

// AFTER:
router.push("/dashboard?toast=updated&name=" + encodeURIComponent(customName.trim()));
```

### 4b — Use `after()` for background tasks (optional enhancement)

Where Server Actions do non-critical follow-up work (notifications, activity events), wrap them in `after()` from `next/server` so they survive the HTTP response lifecycle on Vercel:

```typescript
import { after } from "next/server";

// Inside a Server Action:
after(async () => {
    await createNotification(...);
    await createActivityEvent(...);
});
```

> **Note:** `after()` is Next.js 15+. If the project is on Next.js 14, use the existing try/catch fire-and-forget pattern, which is already the safest option for that version. Check the project's Next.js version first.

### 4c — Audit other `window.location` usages

Search for any other `window.location.href` or `window.location.replace` in server-adjacent code and replace with `router.push()` or `redirect()`.

---

## Task 5 — Vercel Cron for Market Refresh

**The Bug:** `completeTransaction()` fires `refresh_market_prices()` inline. At scale = DDOS on every sale.

### Step 5a — Create cron route

**File:** `src/app/api/cron/refresh-market/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();
        await admin.rpc("refresh_market_prices" as string);
        return NextResponse.json({ success: true, refreshedAt: new Date().toISOString() });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
```

### Step 5b — Remove inline refresh from `completeTransaction()`

**File:** `src/app/actions/transactions.ts` — line 67

```typescript
// DELETE THIS LINE:
void (async () => { try { await supabase.rpc("refresh_market_prices" as string); } catch { } })();
```

### Step 5c — Provide vercel.json snippet for human

The human needs to add to `vercel.json`:
```json
{
    "crons": [
        {
            "path": "/api/cron/refresh-market",
            "schedule": "0 */6 * * *"
        }
    ]
}
```

This refreshes every 6 hours. Document this in a comment at the top of the route file.

---

## Task 6 — Dashboard Pagination (OOM Prevention)

**The Bug:** Dashboard loads ALL horses at once. 2,000+ models = OOM.

### Implement cursor-based infinite scroll:

1. **Server action:** Create or modify a `getHorses()` action that accepts `{ limit, offset, collectionId?, search? }` and returns paginated results.

2. **Dashboard page:** 
   - Initially load 24 horses
   - Add an `IntersectionObserver` sentinel at the bottom
   - When scrolled into view, fetch next 24
   - Show "Loading more..." spinner while fetching

3. **Signed URLs:** Only generate signed URLs for the currently loaded batch, not all horses.

### Approach:

```tsx
// Dashboard becomes "use client" with server action calls
const [horses, setHorses] = useState<Horse[]>([]);
const [offset, setOffset] = useState(0);
const [hasMore, setHasMore] = useState(true);

// Initial load
useEffect(() => { loadMore(); }, []);

async function loadMore() {
    const batch = await getHorsesPage({ limit: 24, offset });
    setHorses(prev => [...prev, ...batch.items]);
    setOffset(prev => prev + batch.items.length);
    setHasMore(batch.hasMore);
}

// IntersectionObserver on sentinel div
```

### Alternative — Keep Server Component with pagination:

Use URL-based pagination (`?page=1`, `?page=2`) with server rendering. Simpler but less smooth than infinite scroll.

**Recommendation:** URL-based pagination for SSR benefits + SEO. Infinite scroll can come later as a `/v17` UX enhancement.

---

## Task 7 — Database Type Generation (DX)

### Setup:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/types/supabase.ts
```

### Then update `database.ts`:

1. Import generated types:
   ```typescript
   import type { Database } from './supabase';
   ```

2. Replace hand-written interfaces with:
   ```typescript
   export type UserHorse = Database['public']['Tables']['user_horses']['Row'];
   export type CatalogItem = Database['public']['Tables']['catalog_items']['Row'];
   // etc.
   ```

3. Keep custom computed types (like `AssetCategory`, `FinishType` union types) as aliases or exports.

### Run command:

The human will need to provide the Supabase project ID or generate the types themselves. Document the command in a README section or comment.

> **Note:** This task is lower priority. If time is tight, focus on Tasks 1-6 and defer this.

---

## Completion Checklist

**Task 1 — Batch Import RPC**
- [x] Migration 056 written with new `batch_import_horses` using `catalog_id` + `asset_category`
- [x] `csv-import.ts` JSONB payload verified (already uses `catalog_id` + `asset_category`)
- [ ] Human applied migration
- [ ] CSV import functional test passed

**Task 2 — Blue Book Pipeline**  
- [x] `claim_transfer_atomic` returns `sale_price` in JSONB (migration 056)
- [x] `claim_parked_horse_atomic` returns `sale_price` in JSONB (migration 056)
- [x] `hoofprint.ts` maps `result.sale_price` into transaction metadata
- [x] `parked-export.ts` maps `result.sale_price` into transaction metadata
- [ ] Human applied migration

**Task 3 — SEO**
- [x] `/market/page.tsx` converted to Server Component (no `"use client"`)
- [x] `MarketFilters.tsx` client component handles interactivity
- [x] Search/sort state moved to URL `searchParams`
- [x] SEO metadata present in `layout.tsx`

**Task 4 — Serverless Safety**
- [x] `window.location.href` replaced with `router.push()` in edit page
- [x] Audit: ShareButton + DashboardToast + Header usages are legitimate client-only reads
- [x] Next.js 16.1.6 — `after()` available. Deferred for future sprint (existing try/catch is safe).

**Task 5 — Vercel Cron**
- [x] `src/app/api/cron/refresh-market/route.ts` created
- [x] `CRON_SECRET` auth check in place
- [x] Inline refresh removed from `completeTransaction()`
- [x] `vercel.json` snippet documented in route file comments
- [ ] Human configured `CRON_SECRET` env var and `vercel.json`

**Task 6 — Dashboard Pagination**
- [x] Dashboard horse query uses `.range()` for paginated display
- [x] Lightweight summary query (no horse_images) for collection counts + vault totals
- [x] URL-based pagination with `?page=` parameter + prev/next links
- [x] Signed URLs only generated for current page (48 horses max)

**Task 7 — Type Generation (Deferred)**
- [ ] `supabase gen types` command documented
- [ ] Generated types used in at least `UserHorse` and `CatalogItem`
- [ ] Deferred — requires human's Supabase project ID

**Build & Verification**
- [x] `npx next build` — 0 errors (March 11, 2026)
- [x] `/market` now SSR (changed from ○ Static to ƒ Dynamic in build output)
- [x] `/api/cron/refresh-market` route registered
- [ ] CSV import functional test (requires migration 056)
- [ ] Dashboard pagination visual check

**Estimated effort:** ~6-8 hours

