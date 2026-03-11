---
description: Post-Epic cleanup — auto-refresh market prices on transaction completion, navigation links for /market, deferred items from Epics 2-4, and general polish.
---

# Post-Epic Cleanup & Polish Sprint

> **Context:** Epics 1-4 complete. Epic 5 (PWA/Offline) deferred to user-volume milestone.
> **Objective:** Wire up loose ends, add auto-refresh for market prices, clean up deferred items across all epics, add nav links, and polish.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom

---

## Task 1 — Auto-Refresh Market Prices on Transaction Completion

Since `pg_cron` is not available on Supabase free/pro tier, we need an **application-level trigger** to refresh the materialized view whenever a transaction completes.

### Option A — Fire-and-Forget Refresh After `completeTransaction()` (Recommended)

**File:** `src/app/actions/transactions.ts`

After `completeTransaction()` successfully updates the transaction status, fire a non-blocking refresh:

```typescript
export async function completeTransaction(
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const { error } = await supabase
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", transactionId);

    if (error) return { success: false, error: error.message };

    // Fire-and-forget: refresh market prices materialized view
    // Don't await — user shouldn't wait for this
    supabase.rpc("refresh_market_prices" as string).catch(() => {});

    return { success: true };
}
```

**Why fire-and-forget:**
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` can take a few seconds on large datasets
- User should not wait for it
- If it fails, the view just stays slightly stale — no data loss
- Next transaction will try again

### Option B — Postgres Trigger (Alternative)

If preferred, create a Postgres trigger that auto-refreshes on transaction INSERT/UPDATE:

```sql
CREATE OR REPLACE FUNCTION trg_refresh_market_prices()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status <> 'completed') THEN
        PERFORM refresh_market_prices();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_complete_refresh
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_market_prices();
```

> ⚠️ **Caution:** DB triggers are synchronous. If `REFRESH MATERIALIZED VIEW CONCURRENTLY` is slow, it will slow down the INSERT/UPDATE. Option A is safer.

### Recommendation: Use **Option A** (application-level, fire-and-forget).

---

## Task 2 — Add `/market` to Navigation

### Header/Nav component:
Add "Price Guide" or "📈 Market" link to the main navigation. Find where the nav links are defined and add:

```tsx
<Link href="/market" className="nav-link">📈 Market</Link>
```

### Footer:
Add link in the footer nav (landing page + app layout):

```tsx
<Link href="/market" className="footer-link" id="footer-market">Price Guide</Link>
```

### Landing page feature grid:
The landing page already mentions marketplace features. Add a mention of the Price Guide in the "On the Horizon" or features section, or promote it to a main feature card now that it's live.

---

## Task 3 — Community Page Category Badge (Deferred from Epic 2)

**File:** `src/app/community/page.tsx` (or wherever the Show Ring grid renders)

Horse cards in the community Show Ring should display the `asset_category` badge, matching what the dashboard already does:

```tsx
{horse.asset_category && horse.asset_category !== 'model' && (
    <span className="category-badge">
        {horse.asset_category === 'tack' ? '🏇' : horse.asset_category === 'prop' ? '🌲' : '🎭'}
    </span>
)}
```

Ensure the community page `select()` query includes `asset_category`.

---

## Task 4 — Dashboard Horse Cards: Catalog Info Display (Deferred from v9)

**File:** `src/app/dashboard/page.tsx`

The dashboard horse cards currently show basic info. Enhance them to show the linked catalog item name if one exists:

```tsx
{horse.catalogTitle && (
    <span className="horse-card-reference">{horse.catalogTitle}</span>
)}
```

This requires joining `catalog_items(title)` in the dashboard query via `catalog_id`.

---

## Task 5 — Horse Passport: Catalog Reference Display (Deferred from v9)

Both `/stable/[id]` and `/community/[id]` pages should display the linked catalog item info in the Details section:

```tsx
{horse.catalog_id && catalogItem && (
    <div className="detail-row">
        <span className="detail-label">Reference</span>
        <span className="detail-value">{catalogItem.title} · {catalogItem.maker}</span>
    </div>
)}
```

This may already be partially implemented. Verify and complete.

---

## Task 6 — Show String Planner: Structured Class Selection (Deferred from Epic 3)

**File:** `src/app/shows/planner/page.tsx`

When a show string is linked to an event that has `event_divisions`, the "Add Entry" form should use cascading dropdowns instead of free-text:

1. Fetch `getEventDivisions(eventId)` when the show string has an associated event
2. If divisions exist → show Division dropdown, then Class dropdown
3. If no divisions → keep existing free-text input

**Lower priority** — can be deferred further if time is tight. Show strings currently work fine with free-text.

---

## Task 7 — Event Entry Form: Cascading Dropdowns (Deferred from Epic 3)

**File:** Event entry components

When entering an event that has structured divisions, replace the free-text class input with cascading dropdowns.

**Lower priority** — current photo shows don't use the class structure. This becomes important when live show features are actively used.

---

## Task 8 — Link /market from Reference Search "No Results"

When `UnifiedReferenceSearch` returns no results, show a helpful message:

```tsx
<p>Can't find your model? <Link href="/market">Check the Price Guide</Link> for market data, or use "Custom Entry" below.</p>
```

---

## Task 9 — General CSS Polish

Review and fix any visual inconsistencies:
- Market page mobile responsiveness
- Category toggle on very small screens
- Show Host Builder inline edit inputs alignment
- MarketValueBadge loading skeleton smoothness

---

## Completion Checklist

**Auto-Refresh**
- [x] `completeTransaction()` fires `refresh_market_prices()` (fire-and-forget via void IIFE)
- [x] Verified: build passes, logic correct

**Navigation**
- [x] `/market` link in main nav (desktop: "📈 Market", mobile: "📈 Price Guide")
- [x] `/market` link in footer ("Price Guide")
- [x] Landing page mentions Price Guide feature (replaced Insurance Reports in On the Horizon)

**Deferred Items**
- [x] Community page — `asset_category` badge on cards (query + ShowRingGrid updated)
- [x] Dashboard — catalog item title on horse cards (already implemented via `refName` from `catalog_items`)
- [x] Passport — catalog reference display in Details section (already implemented via `refInfo`)
- [ ] Show string planner — structured class selection (deferred — lower priority)
- [ ] Event entry form — cascading dropdowns (deferred — lower priority)

**Polish**
- [x] "No results" in reference search links to /market
- [x] CSS polish pass (market page CSS already includes mobile responsive)
- [x] `npx next build` — 0 errors (March 11, 2026)

**Estimated effort:** ~3-4 hours

