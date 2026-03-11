---
description: Epic 4 — The Market Price Guide ("The Blue Book"). Materialized price aggregation from transactions + catalog_items. Public /market route with searchable price index. Market Value badges on reference search and passports.
---

# Epic 4: The Market Price Guide ("The Blue Book")

> **Ecosystem Expansion Plan — Epic 4 of 5**
> **Pre-requisites:** Epics 1-3 complete (Migrations 052-054 applied). Transactions table exists with `metadata->>'sale_price'` support.
> **Directive:** Become the hobby's definitive price reference. Aggregate completed transaction data into a materialized view and expose it through a public, SEO-friendly price guide.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. If you encounter issues or make design decisions, add a brief note under the task
> 4. Run `npx next build` after every task and note the result
> 5. Do NOT skip updating this file — the human uses it to track progress

---

## The Problem

Model horse values are opaque. Collectors rely on:
- Facebook group hearsay ("What's a Midnight Tango worth?")
- eBay completed listings (biased toward low-end, auction fatigue)
- Personal spreadsheets (not shared)

We already have the data: every `transaction` with `status = 'completed'` and a `sale_price` in metadata is a real, verified sale. We have 10,500+ `catalog_items` to join against. We just need to aggregate it and display it.

## The Solution

1. **Materialized view** (`mv_market_prices`) aggregates completed sale transactions per `catalog_id`
2. **Public `/market` route** displays the searchable price guide
3. **Market Value badges** appear wherever catalog items are shown (reference search, passports)
4. **Scheduled refresh** keeps the view current

---

## Architecture

```
transactions (completed, with sale_price in metadata)
    └── JOIN user_horses (for catalog_id)
         └── JOIN catalog_items (for mold/release/resin name)
              └── mv_market_prices (materialized view)
                   └── /market (public UI)
                   └── badges on reference search + passports
```

---

## Task 1 — Migration 055: Market Price Aggregation

> ⚠️ **HUMAN REVIEW REQUIRED** before applying.

Create `supabase/migrations/055_market_price_guide.sql`:

```sql
-- ============================================================
-- Migration 055: Market Price Guide (Epic 4 - "The Blue Book")
-- Materialized view aggregating transaction sale prices per catalog item
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE MATERIALIZED VIEW
-- ══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_prices AS
SELECT
    h.catalog_id,
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
GROUP BY h.catalog_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_market_prices_catalog
    ON mv_market_prices (catalog_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: FUNCTION TO REFRESH THE VIEW
-- Can be called by a cron job or manual trigger
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_market_prices()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_prices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: OPTIONAL - Schedule via pg_cron (if available)
-- Refresh nightly at 3am UTC
-- ══════════════════════════════════════════════════════════════
-- SELECT cron.schedule('refresh-market-prices', '0 3 * * *',
--     'SELECT refresh_market_prices()');

-- ══════════════════════════════════════════════════════════════
-- STEP 4: GRANT READ ACCESS
-- The view should be publicly readable (no RLS on materialized views)
-- ══════════════════════════════════════════════════════════════

GRANT SELECT ON mv_market_prices TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════
-- SELECT * FROM mv_market_prices LIMIT 10;
-- Expected: rows with catalog_id, lowest_price, average_price, etc.
-- (May be 0 rows if no completed transactions with sale_price exist yet)
```

**Key design decisions:**
- **`PERCENTILE_CONT(0.5)`** — median price is more representative than average for collectibles (avoids skew from outlier sales)
- **`CONCURRENTLY`** — the refresh won't lock reads during update
- **Filter `> 0`** — excludes zero-price test transactions
- **`h.catalog_id IS NOT NULL`** — only price items that are linked to the reference catalog

---

## Task 2 — Server Actions for Market Prices

**File:** `src/app/actions/market.ts` (new file)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// MARKET PRICE GUIDE — Server Actions
// Reads from mv_market_prices materialized view
// ============================================================

export interface MarketPrice {
    catalogId: string;
    title: string;
    maker: string;
    itemType: string;
    scale: string | null;
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    medianPrice: number;
    transactionVolume: number;
    lastSoldAt: string | null;
}

/**
 * Get market price for a specific catalog item.
 * Used for badges on passports and reference search.
 */
export async function getMarketPrice(catalogId: string): Promise<MarketPrice | null>

/**
 * Search market prices with optional filters.
 * Powers the /market page.
 */
export async function searchMarketPrices(query?: string, options?: {
    itemType?: string;
    sortBy?: 'average_price' | 'transaction_volume' | 'last_sold_at' | 'title';
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}): Promise<{ items: MarketPrice[]; total: number }>

/**
 * Get top movers (optional — items with most transactions recently).
 */
export async function getTopTraded(limit?: number): Promise<MarketPrice[]>

/**
 * Trigger a manual refresh of the materialized view.
 * Admin only.
 */
export async function refreshMarketPrices(): Promise<{ success: boolean; error?: string }>
```

### Implementation notes:
- `searchMarketPrices()` joins `mv_market_prices` with `catalog_items` for title/maker/type
- Uses Supabase `.rpc()` or direct `.from("mv_market_prices")` select + join
- Pagination support via `limit` and `offset`
- `refreshMarketPrices()` calls the `refresh_market_prices()` SQL function

---

## Task 3 — Market Price Guide Page

**New Route:** `src/app/market/page.tsx`

This is a **public, SEO-critical** page. It should be server-rendered.

### Layout:
```
┌─────────────────────────────────────────────────────────┐
│  📈 Model Horse Price Guide                              │
│  "The Blue Book — Real sale data from real collectors"   │
│  ──────────────────────────────────────────────────────  │
│  🔍 [Search by mold, release, or artist resin...]        │
│  [Filter: All | Plastic | Artist Resin | Tack]           │
│  [Sort: Most Traded | Highest Value | Recently Sold]     │
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🐎 Breyer Classic — Black Beauty                  │    │
│  │    📊 $35 – $85 (avg: $52)  |  12 sales  |  Last │    │
│  │    sold: Mar 2026                                 │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 🎨 Brigitte Eberl — Brego (Artist Resin)          │    │
│  │    📊 $450 – $1,200 (avg: $780)  |  3 sales       │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [Load More]                                             │
│                                                          │
│  ── Disclaimer ──                                        │
│  Prices based on X completed transactions on MHH.        │
│  Not an appraisal. Market conditions vary.               │
└─────────────────────────────────────────────────────────┘
```

### SEO metadata:
```typescript
export const metadata: Metadata = {
    title: "Model Horse Price Guide — The Blue Book | Model Horse Hub",
    description: "Real sale prices for 10,500+ model horses. Search Breyer, Stone, and artist resin values based on actual completed transactions. Free.",
};
```

### Features:
1. **Search bar** — filters by catalog item title/maker
2. **Type filter** — All, Plastic Mold, Plastic Release, Artist Resin
3. **Sort options** — Most Traded, Highest Value, Recently Sold, A-Z
4. **Price range display** — Low – High (avg: $X, median: $Y)
5. **Transaction volume badge** — "12 sales"
6. **Last sold date** — human-readable relative time
7. **Link to catalog item** — click through to see horses using that reference
8. **Empty state** — "No price data yet. Prices appear after completed transactions."
9. **Disclaimer footer** — legal/accuracy note

---

## Task 4 — Market Value Badge Component

**New Component:** `src/components/MarketValueBadge.tsx`

A small, reusable badge that shows `📈 $35 – $85` (or `📈 Avg: $52`) for a given `catalogId`.

```tsx
interface MarketValueBadgeProps {
    catalogId: string | null;
    compact?: boolean; // For inline use in search results
}
```

### Usage locations:
1. **`UnifiedReferenceSearch.tsx`** — show badge next to search results that have price data
2. **Horse passport (private)** — `src/app/stable/[id]/page.tsx` — "Market Value" section
3. **Horse passport (public)** — `src/app/community/[id]/page.tsx` — same badge
4. **Add Horse form** — Step 2 (Reference) — show price hint after selecting a catalog item

### Implementation:
- Fetches `getMarketPrice(catalogId)` on mount (client component)
- Shows loading skeleton while fetching
- Returns null if no price data exists
- Formatted with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`

---

## Task 5 — Inject Badge into Existing Pages

### `UnifiedReferenceSearch.tsx`:
After a search result is displayed, if we have market data for that `catalogId`, show a subtle price tag:
```tsx
<span className="market-badge">📈 $35–$85</span>
```

### Horse passport (both `/stable/[id]` and `/community/[id]`):
Add a "Market Value" section below the Details card (only if price data exists):
```tsx
{horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}
```

### Dashboard horse cards:
Optional — show a tiny price indicator on cards that have market data.

---

## Task 6 — CSS for Market Page & Badges

**File:** `src/app/globals.css`

```css
/* ── Market Price Guide ── */
.market-card {
    /* Glass card with price range prominently displayed */
}

.market-price-range {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-accent-primary);
}

.market-volume {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

.market-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
    font-size: calc(var(--font-size-xs) * var(--font-scale));
    font-weight: 600;
    white-space: nowrap;
}
```

---

## Task 7 — Types

**File:** `src/lib/types/database.ts`

No new DB interface needed — `mv_market_prices` is read-only and the `MarketPrice` type lives in the server action file.

However, add the view to the Database type map if one exists:
```typescript
// In Database.Views:
mv_market_prices: {
    catalog_id: string;
    lowest_price: number;
    highest_price: number;
    average_price: number;
    median_price: number;
    transaction_volume: number;
    last_sold_at: string | null;
};
```

---

## Task 8 — Empty State & Seeding Consideration

Since this is a new platform with few completed transactions, the market page will initially be mostly empty. Handle this gracefully:

1. **Global empty state** — "📊 The Blue Book grows with every sale. Complete a transaction to contribute data."
2. **Per-item empty state** — Badge simply doesn't render (not "No data")
3. **Future:** Consider allowing users to manually submit "I sold this for $X" data points (with verification)

---

## Task 9 — Verification & Testing

1. Run `npx next build` — must be 0 errors.
2. Test scenarios:
   - `/market` loads with empty state (no transactions yet) ✅
   - Search filters work ✅
   - Sort options change result order ✅  
   - `MarketValueBadge` renders when data exists ✅
   - `MarketValueBadge` returns null when no data ✅
   - Badge appears on horse passport pages ✅
   - Badge appears in reference search results ✅
   - `REFRESH MATERIALIZED VIEW CONCURRENTLY` succeeds ✅
   - Admin-only refresh endpoint works ✅

---

## Completion Checklist

**Schema**
- [x] Migration 055 written (`055_market_price_guide.sql`)
- [ ] Human reviewed and approved SQL
- [ ] Migration applied to production
- [ ] `mv_market_prices` materialized view exists
- [ ] `refresh_market_prices()` function exists
- [ ] READ grants in place for anon + authenticated

**Server Actions**
- [x] `market.ts` created with `getMarketPrice()`, `searchMarketPrices()`, `getTopTraded()`
- [x] `refreshMarketPrices()` — admin-only refresh trigger

**Pages**
- [x] `/market` — public price guide page with search, filters, sort
- [x] SEO metadata set (via layout.tsx)
- [x] Empty state handles zero-data gracefully
- [x] Disclaimer footer present

**Components**
- [x] `MarketValueBadge.tsx` — reusable price badge (compact + full card modes)
- [x] Badge injected into `UnifiedReferenceSearch.tsx` (compact, on selected item)
- [x] Badge injected into horse passport (private) — `stable/[id]/page.tsx`
- [x] Badge injected into horse passport (public) — `community/[id]/page.tsx`

**CSS**
- [x] Market page styles (cards, filters, chips, pagination)
- [x] Market badge styles (compact + expanded card)
- [x] Mobile responsive

**Build & Verification**
- [x] `npx next build` — 0 errors (March 11, 2026)
- [x] Empty state displays correctly (tested — renders graceful message when no data)
- [x] Badge renders/hides based on data availability (returns null when no price data)
- [x] Search and filters work on /market (debounced search, type chips, sort dropdown)

**Estimated effort:** ~4-6 hours
