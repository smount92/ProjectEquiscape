---
description: Open Beta Infrastructure Hardening — Phase 1 of the Open Beta & Freemium Architecture Plan. Patches data-loss risks, neutralizes DDoS-style polling, fixes commerce race conditions, and hardens legal/observability posture.
---

# Open Beta Hardening — Developer Workflow

> **Source Plan:** `.agents/docs/Open_Beta_Plan.md`
> **Scope:** Phase 1 only (Infrastructure Hardening & Liability Shield)
> **Why Phase 1 only:** Phases 2–3 (Stripe monetization, AI Stablemaster) require external service setup (Stripe account, API keys, pricing decisions) that are human-gated product decisions. Phase 1 is pure engineering.
> **Last Updated:** 2026-03-24

// turbo-all

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Check recent git history for context:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -5
```

---

# ═══════════════════════════════════════
# TASK 1: Tombstone Soft-Delete (Data Integrity)
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** CRITICAL — Current `deleteHorse()` does a hard DELETE with ON DELETE CASCADE, wiping Hoofprint™ provenance for all previous owners.

### Step 1.1: Create the migration

Create file `supabase/migrations/098_soft_delete_horses.sql`:

```sql
-- ═══════════════════════════════════════
-- MIGRATION 098: Soft-Delete for user_horses
-- ═══════════════════════════════════════
-- Adds a `deleted_at` timestamp column and a partial index
-- so deleted horses are excluded from normal queries but
-- their FK relationships (hoofprint, transfers, show records) survive.

ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index: only non-deleted horses appear in normal queries
CREATE INDEX IF NOT EXISTS idx_user_horses_active
  ON user_horses (owner_id)
  WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN user_horses.deleted_at IS 'Soft-delete timestamp. When set, the horse is treated as deleted but FK relationships (transfers, show records, hoofprint) are preserved.';
```

### Step 1.2: Update `deleteHorse()` in `src/app/actions/horse.ts`

Replace the hard-delete logic (currently lines 77–81):

**Current code (DELETE):**
```typescript
const { error } = await supabase
    .from("user_horses")
    .delete()
    .eq("id", horseId);
```

**New code (SOFT-DELETE):**
```typescript
// Soft-delete: scrub PII but preserve the row for provenance chains
const { error } = await supabase
    .from("user_horses")
    .update({
        deleted_at: new Date().toISOString(),
        life_stage: "orphaned",
        visibility: "private",
        custom_name: "[Deleted]",
        trade_status: "Not for Sale",
    })
    .eq("id", horseId);
```

Also update the JSDoc comment on line 36:
```
- * Permanently delete a horse and all associated data (images, vault, records).
+ * Soft-delete a horse — scrubs PII and hides it, but preserves the row for provenance chains.
```

Keep the Storage image deletion logic (lines 58–74) — we still want to free storage costs. Also keep the `horse_images` rows since they'll have broken URLs (acceptable — the images are gone).

### Step 1.3: Update `bulkDeleteHorses()` in the same file

Find the bulk delete function (~line 484). Apply the same soft-delete pattern:
- Replace `.delete().in("id", ...)` with `.update({ deleted_at, life_stage, visibility, custom_name, trade_status }).in("id", ...)`

### Step 1.4: Add `deleted_at IS NULL` guards to queries

Search all files that query `user_horses` and ensure they filter `deleted_at IS NULL`. Key files:
- `src/app/actions/horse.ts` — `getUserHorses()`, `getHorseById()`
- `src/app/actions/activity.ts` — feed queries
- `src/app/actions/shows.ts` — show entry queries
- `src/app/actions/parked-export.ts` — export queries

Add `.is("deleted_at", null)` to every `from("user_horses").select(...)` that fetches user-visible horses.

**Exception:** `getHorseById()` for provenance/hoofprint views should NOT filter deleted horses — previous owners need to see the timeline.

### Step 1.5: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

---

# ═══════════════════════════════════════
# TASK 2: Commerce Atomic RPCs (Concurrency)
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** HIGH — `makeOffer()` and `respondToOffer()` manage state checks in Node.js, creating TOCTOU race conditions. Two users can simultaneously lock the same horse.

### Step 2.1: Create the migration

Create file `supabase/migrations/099_commerce_locks.sql`:

```sql
-- ═══════════════════════════════════════
-- MIGRATION 099: Atomic Commerce RPCs
-- ═══════════════════════════════════════
-- Replaces Node.js state checks with Postgres row-locking RPCs
-- to prevent TOCTOU race conditions in the commerce engine.

-- RPC: make_offer_atomic
-- Locks the horse row, validates it's still available, then inserts the offer.
CREATE OR REPLACE FUNCTION make_offer_atomic(
    p_horse_id UUID,
    p_buyer_id UUID,
    p_seller_id UUID,
    p_offered_price NUMERIC,
    p_message TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_horse RECORD;
    v_existing_txn RECORD;
    v_new_txn RECORD;
BEGIN
    -- Lock the horse row to prevent concurrent modifications
    SELECT * INTO v_horse
    FROM user_horses
    WHERE id = p_horse_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_horse IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Horse not found');
    END IF;

    IF v_horse.owner_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Seller does not own this horse');
    END IF;

    IF v_horse.trade_status NOT IN ('For Sale', 'Open to Offers') THEN
        RETURN json_build_object('success', false, 'error', 'Horse is not available for offers');
    END IF;

    -- Check for existing active transaction on this horse
    SELECT * INTO v_existing_txn
    FROM transactions
    WHERE horse_id = p_horse_id
      AND status NOT IN ('completed', 'cancelled', 'retracted')
    FOR UPDATE;

    IF v_existing_txn IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'An active transaction already exists for this horse');
    END IF;

    -- Insert the offer
    INSERT INTO transactions (horse_id, buyer_id, seller_id, offered_price, message, status)
    VALUES (p_horse_id, p_buyer_id, p_seller_id, p_offered_price, p_message, 'offer_made')
    RETURNING * INTO v_new_txn;

    RETURN json_build_object('success', true, 'data', row_to_json(v_new_txn));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC: respond_to_offer_atomic
-- Locks the transaction row, validates state, then applies accept/decline.
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT  -- 'accept' or 'decline'
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    SELECT * INTO v_txn
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_txn IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_txn.seller_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_txn.status != 'offer_made' THEN
        RETURN json_build_object('success', false, 'error', 'Transaction is no longer in offer_made state');
    END IF;

    IF p_action = 'accept' THEN
        UPDATE transactions SET status = 'pending_payment', updated_at = NOW()
        WHERE id = p_transaction_id;
    ELSIF p_action = 'decline' THEN
        UPDATE transactions SET status = 'cancelled', updated_at = NOW()
        WHERE id = p_transaction_id;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION make_offer_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_offer_atomic TO authenticated;
```

### Step 2.2: Update `transactions.ts` to use RPCs

In `src/app/actions/transactions.ts`, find the `makeOffer` function. Replace the Node.js state checks + insert with:

```typescript
const admin = getAdminClient();
const { data: result, error } = await admin.rpc("make_offer_atomic", {
    p_horse_id: horseId,
    p_buyer_id: user.id,
    p_seller_id: sellerId,
    p_offered_price: offeredPrice,
    p_message: message ?? null,
});
```

Similarly update `respondToOffer` to call `respond_to_offer_atomic`.

### Step 2.3: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

---

# ═══════════════════════════════════════
# TASK 3: Neutralize Polling DDoS (Performance)
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** MEDIUM — `NotificationBell.tsx` polls every 60s regardless of tab visibility. At 500+ users with multiple tabs, this hammers the connection pool.

### Step 3.1: Update `src/components/NotificationBell.tsx`

Find the `setInterval(fetchCount, 60_000)` pattern. Wrap it in a visibility-aware pattern:

```typescript
useEffect(() => {
    // Fetch immediately on mount
    fetchCount();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
        if (!intervalId) {
            intervalId = setInterval(fetchCount, 60_000);
        }
    };

    const stopPolling = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    const handleVisibility = () => {
        if (document.visibilityState === "visible") {
            fetchCount(); // Immediate fetch when user returns
            startPolling();
        } else {
            stopPolling();
        }
    };

    // Only poll if tab is visible
    if (document.visibilityState === "visible") {
        startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
        stopPolling();
        document.removeEventListener("visibilitychange", handleVisibility);
    };
}, [fetchCount]);
```

### Step 3.2: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# ═══════════════════════════════════════
# TASK 4: Server-Side Catalog Search (Memory/Bandwidth)
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** MEDIUM — The `/api/reference-dictionary` route fetches all 10,500+ catalog rows to the client for `fuzzysort`. This will crash mobile devices at scale.

### Step 4.1: Create the fuzzy search RPC migration

Create file `supabase/migrations/100_fuzzy_search_rpc.sql`:

```sql
-- ═══════════════════════════════════════
-- MIGRATION 100: Server-side fuzzy catalog search
-- ═══════════════════════════════════════

-- Ensure trigram index exists on catalog_items.name
CREATE INDEX IF NOT EXISTS idx_catalog_items_name_trgm
  ON catalog_items USING gin (name extensions.gin_trgm_ops);

-- RPC: search_catalog_fuzzy
CREATE OR REPLACE FUNCTION search_catalog_fuzzy(
    search_term TEXT,
    max_results INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    name TEXT,
    item_type TEXT,
    parent_id UUID,
    parent_name TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ci.id,
        ci.name,
        ci.item_type,
        ci.parent_id,
        p.name AS parent_name,
        extensions.similarity(ci.name, search_term) AS similarity
    FROM catalog_items ci
    LEFT JOIN catalog_items p ON ci.parent_id = p.id
    WHERE extensions.similarity(ci.name, search_term) > 0.15
       OR ci.name ILIKE '%' || search_term || '%'
    ORDER BY extensions.similarity(ci.name, search_term) DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION search_catalog_fuzzy TO authenticated, anon;
```

### Step 4.2: Create a server action for catalog search

In `src/app/actions/reference.ts`, add:

```typescript
export async function searchCatalogFuzzy(term: string, maxResults = 20) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_catalog_fuzzy", {
        search_term: term,
        max_results: maxResults,
    });
    if (error) return [];
    return data ?? [];
}
```

### Step 4.3: Create `matchCsvRowsBatch` server action

In `src/app/actions/csv-import.ts`, add a server action that accepts parsed CSV rows and matches them server-side using `search_catalog_fuzzy`:

```typescript
export async function matchCsvRowsBatch(
    rows: { name: string; moldName?: string }[]
): Promise<{ matches: { rowIndex: number; catalogId: string | null; catalogName: string | null }[] }> {
    const supabase = await createClient();
    const matches = await Promise.all(
        rows.map(async (row, index) => {
            const searchTerm = row.moldName || row.name;
            const { data } = await supabase.rpc("search_catalog_fuzzy", {
                search_term: searchTerm,
                max_results: 1,
            });
            const best = data?.[0];
            return {
                rowIndex: index,
                catalogId: best?.id ?? null,
                catalogName: best?.name ?? null,
            };
        })
    );
    return { matches };
}
```

### Step 4.4: Refactor `CsvImport.tsx` Step 2

Update the CSV import component to call `matchCsvRowsBatch` instead of fetching the entire dictionary:
- Remove the fetch to `/api/reference-dictionary` 
- Add a `useEffect` with a 400ms debounce that calls `matchCsvRowsBatch(parsedRows)`
- Display server-returned matches in the review table

### Step 4.5: Keep `/api/reference-dictionary` for now (deprecate later)

The `UnifiedReferenceSearch.tsx` component still uses client-side `fuzzysort` for the Add Horse form. Deprecate `reference-dictionary` in a follow-up task — it's lower risk since the Add Horse form loads one item at a time, not 50 rows.

### Step 4.6: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

---

# ═══════════════════════════════════════
# TASK 5: Escrow Liability UX (Legal/UX)
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** MEDIUM — Commerce UI implies MHH processes payments. This creates legal liability.

### Step 5.1: Update payment button labels

**File: `src/components/OfferCard.tsx`**
- Find `"💳 I Have Paid"` (line ~200) → change to `"💳 External Payment Sent"`
- Find `"Confirm Funds & Release"` or similar → change to `"Acknowledge External Payment & Release PIN"`

**File: `src/components/TransactionActions.tsx`**
- Apply same label changes for any payment confirmation buttons

### Step 5.2: Add required disclaimer checkbox

**File: `src/components/MakeOfferModal.tsx`**

Before the submit button, add a required checkbox:

```tsx
<label className="flex items-start gap-2 text-xs text-muted mt-4">
    <input
        type="checkbox"
        required
        checked={disclaimerAccepted}
        onChange={(e) => setDisclaimerAccepted(e.target.checked)}
        className="mt-0.5"
    />
    <span>
        I understand that Model Horse Hub does not process payments and cannot
        mediate financial disputes. All transactions are between buyer and seller.
    </span>
</label>
```

Add `const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);` to the component state, and disable the submit button unless `disclaimerAccepted` is true.

### Step 5.3: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# ═══════════════════════════════════════
# TASK 6: Observability — Silent Catch Blocks
# ═══════════════════════════════════════

## Status: NOT STARTED
**Risk:** MEDIUM — 20+ silent `catch { /* non-blocking */ }` blocks inside `after()` hooks. If background tasks fail, we'll never know.

### Step 6.1: Audit all silent catch blocks

Run this search to find all instances:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\app\actions\*.ts" -Pattern "catch \{.*non-blocking" -List | Select-Object Filename
```

Known files (from audit):
- `transactions.ts` (line 97)
- `shows.ts` (lines 365, 551)
- `posts.ts` (lines 138, 192, 321)
- `horse.ts` (lines 166, 231, 373, 422)
- `help-id.ts` (line 130)
- `groups.ts` (line 376)
- `follows.ts` (line 77)
- `events.ts` (lines 605, 696)
- `catalog-suggestions.ts` (lines 226, 552)
- `art-studio.ts` (line 515)
- `activity.ts` (line 89)

### Step 6.2: Replace every instance

**Pattern to find:**
```typescript
} catch { /* non-blocking */ }
```

**Replace with (per-domain):**
```typescript
} catch (err) { logger.error("Domain", "Description of what failed", err); }
```

Use the file's domain as the first argument (e.g., `"Horse"`, `"Commerce"`, `"Shows"`, `"Posts"`, `"Groups"`, `"Follows"`, `"Events"`, `"Activity"`, `"Catalog"`, `"ArtStudio"`, `"HelpId"`).

Import `logger` at the top of each file:
```typescript
import { logger } from "@/lib/logger";
```

**Note:** Some files like `transactions.ts` already use `logger` (line 88). Only add the import if it's missing.

### Step 6.3: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

---

# ═══════════════════════════════════════
# SIGN-OFF CHECKLIST
# ═══════════════════════════════════════

After completing all tasks, verify:

- [ ] `deleteHorse` performs soft-delete (sets `deleted_at`, scrubs PII)
- [ ] Previous owner Hoofprint™ timelines are intact after soft-delete
- [ ] `makeOffer` uses `make_offer_atomic` RPC with row locks
- [ ] `respondToOffer` uses `respond_to_offer_atomic` RPC with row locks
- [ ] `NotificationBell` stops polling when browser tab is hidden
- [ ] `NotificationBell` fetches immediately when user returns to tab
- [ ] CSV import matches rows server-side without fetching 10,500 rows
- [ ] "I Have Paid" → "External Payment Sent" in all UIs
- [ ] Disclaimer checkbox required before making an offer
- [ ] Zero silent `catch { /* non-blocking */ }` blocks remain
- [ ] All 3 new migrations (098, 099, 100) exist and are syntactically valid
- [ ] `npx next build` passes cleanly
- [ ] `npx vitest run` — all tests pass
- [ ] Changes committed with descriptive message

Final build check:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Final test run:
```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

Push:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: open beta hardening — soft-delete, atomic commerce RPCs, visibility-aware polling, server-side search, liability UX, observability" && git push
```

---

# ═══════════════════════════════════════
# DEFERRED TO FUTURE PHASES
# ═══════════════════════════════════════

The following tasks from Open_Beta_Plan.md Phase 2–3 are **intentionally deferred** because they require human product decisions and external service setup:

## Phase 2 (Days 31–60) — Trust & Monetization
- **Task 2.1:** Community Verified Seller Algorithm (`mv_trusted_sellers` materialized view)
- **Task 2.2:** Stripe Webhook & JWT Custom Claims (requires Stripe account, pricing model)

## Phase 3 (Days 61–90) — Freemium & AI
- **Task 3.1:** Zero-Latency Premium RLS Policies (depends on Phase 2 Stripe setup)
- **Task 3.2:** Blue Book PRO charts with `recharts` (depends on tier system)
- **Task 3.3:** LSQ Photo Suite+ tier limits (depends on tier system)
- **Task 3.4:** Stablemaster AI Agent (depends on Gemini API key, tier system)

These will be executed when the human developer provides:
1. Stripe account credentials and pricing decisions
2. Feature tier definitions (what's free vs. pro)
3. Gemini API budget approval
