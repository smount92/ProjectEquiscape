---
description: Enforce search_catalog_fuzzy RPC — replace all PostgREST .or(ilike) queries on catalog_items with the pg_trgm RPC
---

# 076 — Enforce `search_catalog_fuzzy` RPC

> **The Problem:** The client issues `.or('title.ilike...,maker.ilike...')` queries against the 10,500-row `catalog_items` table. `pg_stat_statements` shows max execution time of 517ms per keystroke. These queries bypass the `pg_trgm` GIN index created in Migration 100.
> **Root Cause:** `searchCatalogAction()` in `reference.ts` uses PostgREST `.or()` with `ilike` operators. The RPC `search_catalog_fuzzy` exists but is only used for CSV import batch matching. The primary search path (UnifiedReferenceSearch → searchCatalogAction) bypasses it entirely.
> **Objective:** Route ALL catalog text search through `search_catalog_fuzzy` RPC, enforce 300ms debounce, and eliminate bare `ilike` scans on the 10,500-row table.

// turbo-all

---

## Task 1: Refactor `searchCatalogAction()` to Use the RPC

**File:** `src/app/actions/reference.ts`

### 1.1 Current state (lines 34-58)

```ts
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q) return [];
    const words = q.split(/\s+/).filter(w => w.length > 0);

    let queryBuilder = supabase
        .from("catalog_items")
        .select("id, item_type, parent_id, title, maker, scale, attributes");

    for (const word of words) {
        queryBuilder = queryBuilder.or(
            `title.ilike.%${word}%,maker.ilike.%${word}%,attributes->>model_number.ilike.%${word}%`
        );  // ❌ Sequential table scan per word — O(n) per keystroke
    }

    const { data } = await queryBuilder.order("item_type").order("title").limit(50);
    return (data ?? []).map(mapCatalogRow);
}
```

### 1.2 Target state — Use the existing RPC

Replace the entire function body with a call to `search_catalog_fuzzy`:

```ts
export async function searchCatalogAction(query: string): Promise<CatalogItem[]> {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q || q.length < 2) return [];

    // Use pg_trgm trigram search — leverages GIN index from Migration 100
    const { data, error } = await supabase.rpc("search_catalog_fuzzy", {
        search_term: q,
        max_results: 50,
    });

    if (error || !data) return [];

    // Map RPC result rows to CatalogItem shape
    return (data as Array<{
        id: string;
        item_type: string;
        parent_id: string | null;
        title: string;
        maker: string;
        scale: string | null;
        attributes: Record<string, unknown>;
    }>).map(mapCatalogRow);
}
```

**Why this is faster:**
- The RPC uses `similarity()` with a `pg_trgm` GIN index — O(1) vs O(n) table scan
- Single database round-trip (no chained `.or()` per word)
- Pre-optimized query plan cached by Postgres

### 1.3 Verify the RPC returns compatible columns

Check the RPC definition in the migration:

```powershell
cmd /c "npx rg -n 'search_catalog_fuzzy' supabase/migrations/ --include '*.sql' 2>&1"
```

The RPC must return at minimum: `id, item_type, parent_id, title, maker, scale, attributes`.

If it returns fewer columns, it needs to be updated. If it returns all required columns, no migration change is needed.

### 1.4 Remove `sanitizeSearchQuery` if unused

After the refactor, `sanitizeSearchQuery` is only used by `searchCatalogAction`. Verify no other consumers exist:

```powershell
cmd /c "npx rg -n 'sanitizeSearchQuery' src/ --include '*.ts' --include '*.tsx' 2>&1"
```

If only `reference.ts` uses it, keep it — the RPC input should still be sanitized.

### Validation Checklist
- [ ] `searchCatalogAction()` calls `supabase.rpc("search_catalog_fuzzy", ...)` instead of `.or(ilike)`
- [ ] Function returns `CatalogItem[]` with same shape as before
- [ ] Minimum query length is 2 characters (prevents empty/single-char trigram searches)
- [ ] `npx next build` succeeds

---

## Task 2: Audit All Other `ilike` Usage on `catalog_items`

### 2.1 Identified offenders

From the codebase audit, these files use `.ilike()` or `.or()` with ilike on tables that could benefit from the RPC:

| File | Line | Query | Table | Action |
|------|------|-------|-------|--------|
| `reference.ts:48` | `.or(title.ilike...maker.ilike...)` | `catalog_items` | **FIXED in Task 1** |
| `market.ts:129` | `.or(title.ilike...maker.ilike...)` | `catalog_items` | **FIX — replace with RPC** |
| `catalog-suggestions.ts:101` | `.ilike("title", ...)` | `catalog_items` (suggestions) | **KEEP — filtered subset** |
| `community/page.tsx:68` | `.or(custom_name.ilike...sculptor.ilike...)` | `user_horses` | **KEEP — different table** |
| `groups.ts:205` | `.or(name.ilike...description.ilike...)` | `groups` | **KEEP — small table** |
| `events.ts:32,193` | `.ilike("alias_name", ...)` | `users` / `events` | **KEEP — small table** |
| `horse.ts:707` | `.ilike("custom_name", ...)` | `user_horses` | **KEEP — user-scoped** |

### 2.2 Fix `market.ts:129`

**File:** `src/app/actions/market.ts`

Find the line that queries `catalog_items` with `ilike`:

```ts
catalogQuery = catalogQuery.or(`title.ilike.%${query.trim()}%,maker.ilike.%${query.trim()}%`);
```

Replace with an RPC call to get matching catalog IDs first, then join:

```ts
// Instead of ilike on catalog_items, use the fuzzy RPC to get matching IDs
const { data: fuzzyResults } = await supabase.rpc("search_catalog_fuzzy", {
    search_term: query.trim(),
    max_results: 100,
});
const matchingCatalogIds = (fuzzyResults ?? []).map((r: { id: string }) => r.id);

if (matchingCatalogIds.length === 0) {
    return { items: [], totalCount: 0, priceStats: null };
}

// Filter market data to only these catalog items
catalogQuery = catalogQuery.in("id", matchingCatalogIds);
```

> **Important:** Review the full market.ts function to ensure this fits the query flow. The `catalogQuery` may have additional filters that should be preserved.

### Validation Checklist
- [ ] `market.ts` no longer uses `ilike` on `catalog_items`
- [ ] Market search results match before/after (smoke test)
- [ ] Only `catalog-suggestions.ts` retains `ilike` on `catalog_items` (acceptable — admin-only filtered query)
- [ ] `npx next build` succeeds

---

## Task 3: Verify Debounce Timing

### 3.1 Current debounce in UnifiedReferenceSearch

**File:** `src/components/UnifiedReferenceSearch.tsx` (line 100)

```tsx
debounceRef.current = setTimeout(() => runSearch(query), 300);
```

✅ Already has 300ms debounce. **No change needed.**

### 3.2 Verify other search inputs

| Component | File | Debounce | Action |
|-----------|------|----------|--------|
| `UnifiedReferenceSearch` | `UnifiedReferenceSearch.tsx:100` | 300ms ✅ | No change |
| `CatalogBrowser` | `CatalogBrowser.tsx` | Check | Verify 300ms+ debounce |
| Market search bar | `market/page.tsx` or `MarketSearch.tsx` | Check | Verify 300ms+ debounce |
| `CsvImport` | `CsvImport.tsx` | N/A | Uses batch RPC, no live search |

For each search input that queries `catalog_items`, verify the debounce is ≥ 300ms. If missing, add:

```tsx
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => executeSearch(value), 300);
};
```

### Validation Checklist
- [ ] `UnifiedReferenceSearch` debounce is 300ms ✅
- [ ] All other catalog search inputs have ≥ 300ms debounce
- [ ] No search fires on every keystroke without debounce

---

## Task 4: Verify `pg_trgm` Index Integrity

### 4.1 Check the migration

```powershell
cmd /c "npx rg -n 'pg_trgm|trigram|search_catalog_fuzzy' supabase/migrations/ --include '*.sql' 2>&1"
```

Verify that:
1. The `pg_trgm` extension is enabled
2. A GIN index exists on `catalog_items(title)` and/or `catalog_items(maker)`
3. The `search_catalog_fuzzy` function uses `similarity()` or `%` operator (trigram match)

### 4.2 Verify the RPC returns `attributes` column

The current `searchCatalogAction` returns `attributes` (for model_number rendering in the UI). Verify the RPC also returns this column. If not, the RPC needs a migration update:

```sql
-- If attributes is missing from the RPC:
CREATE OR REPLACE FUNCTION search_catalog_fuzzy(search_term text, max_results int DEFAULT 20)
RETURNS TABLE (
    id uuid,
    item_type text,
    parent_id uuid,
    title text,
    maker text,
    scale text,
    attributes jsonb,    -- ← Must include this
    similarity_score real
) AS $$
    SELECT id, item_type, parent_id, title, maker, scale, attributes,
           similarity(title || ' ' || maker, search_term) AS similarity_score
    FROM catalog_items
    WHERE title % search_term OR maker % search_term
    ORDER BY similarity_score DESC
    LIMIT max_results;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '';
```

If a migration is needed, create `supabase/migrations/110_fix_catalog_fuzzy_rpc.sql`.

### Validation Checklist
- [ ] `pg_trgm` extension is enabled in migration
- [ ] GIN index exists on `catalog_items` title/maker columns
- [ ] `search_catalog_fuzzy` RPC returns `attributes` column
- [ ] RPC uses `SECURITY INVOKER` with `SET search_path = ''`

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Test catalog search performance:**

1. Open DevTools → Network tab
2. Navigate to Add Horse → Reference Search
3. Type "Breyer Adios" — observe:
   - **Before:** 517ms PostgREST ilike query
   - **After:** <50ms RPC trigram search
4. Navigate to Market → Search "Stablemate" — observe similar speedup
5. Check Supabase Dashboard → SQL → `pg_stat_statements` for `search_catalog_fuzzy` call counts

Await human input: "Phase 076 Verified. Proceed."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
