---
description: V27 Stabilization & Scale Sprint — Public storage, caching, XSS sanitization, type-safe queries, Playwright E2E, Stolen/Missing status, relational pedigrees, competition scale enforcement. FEATURE FREEZE until complete.
---

# V27 Stabilization & Scale Sprint

> **Context:** The platform's feature velocity has outpaced its infrastructure. We have accumulated critical technical debt that will cause Out-Of-Memory crashes, database DDoS scenarios, and type-safety blindspots at scale. This sprint freezes all new features and hardens the foundation.
>
> **Pre-requisites:** V29 Competition Engine complete. Migration 077 deployed. Clean build (`npx next build` = 0 errors).
>
> **RULE: NO NEW FEATURES** until all 8 tasks pass build.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately by adding `✅ DONE` and the date after the task heading. Run `npx next build` after every task to verify zero errors. Commit after each task with a descriptive message. Do NOT move to the next task until the build passes.

---

# EPIC 1: Performance & Caching (The Scaling Bottlenecks)

---

## Task 1.1: Defuse the Signed URL DDoS Bomb

**Problem:** Every image render generates a cryptographic Signed URL via `supabase.storage.createSignedUrl()`. On pages like the Feed, Show Ring, and Dashboard, this means N async calls per page load — each hitting the Supabase API. At scale (100+ horses per page × 100+ concurrent users), this will exhaust Vercel serverless execution time and Supabase API quotas.

**Root Cause:** The `horse-images` storage bucket is currently **private**, requiring signed URLs.

**Solution:** Make the bucket public for reads. Keep writes restricted via RLS.

### Step 1: Create migration `078_public_horse_images_bucket.sql`

```sql
-- ============================================================
-- 078: Make horse-images bucket public for reads
-- Signed URLs are a scaling bottleneck. Public reads + private
-- writes gives us CDN-cacheable URLs without security loss.
-- ============================================================

-- NOTE: Supabase bucket visibility is set via the Dashboard or
-- supabase.storage.updateBucket API, not raw SQL.
-- This migration documents the intent. Execute via Dashboard:
--   Storage → horse-images → Policies → Toggle "Public" ON

-- Verify that INSERT/UPDATE/DELETE policies remain owner-only:
-- Policy: "Users can upload images to their own horse folder"
-- Policy: "Users can delete their own horse images"
```

> **IMPORTANT:** The bucket public toggle must be done via the **Supabase Dashboard** → Storage → horse-images → Settings → Toggle "Public bucket" ON. Raw SQL cannot toggle bucket visibility. The developer agent should note this clearly and defer to the user.

### Step 2: Refactor `src/lib/utils/storage.ts`

Replace the entire file. The new version must:

1. **Remove** `getSignedImageUrl()` and `getSignedImageUrls()` functions entirely.
2. **Add** a new `getPublicImageUrl()` function that performs simple string concatenation:
   ```
   `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/horse-images/${path}`
   ```
3. **Add** a `getPublicImageUrls()` batch version that returns `Map<string, string>` (same interface as before, but synchronous — no `await` needed).
4. **Keep** `extractStoragePath()` — it's still needed for path normalization.

### Step 3: Find and replace all consumers

Search for all files importing from `@/lib/utils/storage` or calling `getSignedImageUrl(s)`:

**Files to update (15 total — verified via grep):**

| File | What to change |
|------|---------------|
| `src/app/dashboard/page.tsx` | Replace `await getSignedImageUrls(supabase, ...)` with `getPublicImageUrls(...)`. Remove `supabase` param. |
| `src/app/community/page.tsx` | Same as above. |
| `src/app/community/[id]/page.tsx` | Same. |
| `src/app/community/help-id/page.tsx` | Same. |
| `src/app/community/help-id/[id]/page.tsx` | Same. |
| `src/app/profile/[alias_name]/page.tsx` | Same. |
| `src/app/stable/[id]/page.tsx` | Same. |
| `src/app/stable/collection/[id]/page.tsx` | Same. |
| `src/app/inbox/[id]/page.tsx` | Same. |
| `src/app/wishlist/page.tsx` | Same. |
| `src/app/feed/page.tsx` | Remove signed URL loop entirely — feed images use `activity_events.metadata` URLs. |
| `src/app/actions/activity.ts` | If it calls `getSignedImageUrl`, replace. |
| `src/app/actions/shows.ts` | Same. |
| `src/app/actions/parked-export.ts` | Same. |

**Verification:** After refactoring, grep the entire `src/` directory for `createSignedUrl` — there should be ZERO results in any file except avatar-related code (avatars bucket may remain private).

> **Note on avatars:** The `avatars` bucket is separate from `horse-images`. Avatar signed URL calls (in `discover/page.tsx`, `profile/page.tsx`, etc.) are low-volume and can remain as-is for now. Do NOT change avatar handling in this task.

### Step 4: Build and verify

```
npx next build
```

---

## Task 1.2: Eradicate `force-dynamic` on Public Routes & Implement Caching

**Problem:** Every page declares `export const dynamic = "force-dynamic"`, which tells Next.js to bypass all caching and re-render on every request. This is correct for authenticated private pages (dashboard, inbox, settings) but wasteful for public/community routes that serve the same data to all users.

**Current state:** 30 pages have `force-dynamic` (confirmed via grep).

### Step 1: Categorize all routes

**Routes that MUST keep `force-dynamic`** (user-specific, auth-gated data):
- `dashboard/page.tsx`
- `stable/[id]/page.tsx`
- `stable/[id]/edit/page.tsx`
- `stable/collection/[id]/page.tsx`
- `stable/import/page.tsx`
- `inbox/page.tsx`
- `inbox/[id]/page.tsx`
- `notifications/page.tsx`
- `wishlist/page.tsx`
- `admin/page.tsx`
- `settings/page.tsx`
- `studio/dashboard/page.tsx`
- `studio/my-commissions/page.tsx`
- `studio/commission/[id]/page.tsx`
- `shows/planner/page.tsx`
- `feed/page.tsx` (personalized feed)

**Routes to REMOVE `force-dynamic` from** (public data, cacheable):
- `community/page.tsx` (Show Ring — public horses)
- `community/[id]/page.tsx` (public passport)
- `community/[id]/hoofprint/page.tsx` (public hoofprint)
- `community/events/page.tsx` (event listing)
- `community/events/[id]/page.tsx` (event detail)
- `community/groups/page.tsx` (group listing)
- `community/groups/[slug]/page.tsx` (group detail)
- `community/help-id/page.tsx` (Help ID listing)
- `community/help-id/[id]/page.tsx` (Help ID detail)
- `discover/page.tsx` (user listing)
- `profile/[alias_name]/page.tsx` (public profile)
- `shows/page.tsx` (show listing)
- `shows/[id]/page.tsx` (show detail)
- `market/page.tsx` (Blue Book — already served from materialized view)
- `studio/page.tsx` (artist listing)
- `studio/[slug]/page.tsx` (artist profile)
- `studio/[slug]/request/page.tsx` (commission request — still needs auth but public data)
- `feed/[id]/page.tsx` (single post detail)

### Step 2: Remove `force-dynamic` from public routes

For each file listed above:
1. Delete the `export const dynamic = "force-dynamic";` line.
2. Next.js will now use its default caching behavior (static generation where possible, or ISR).

### Step 3: Add `revalidateTag()` to server actions

Currently, **zero** server actions use `revalidateTag()` (confirmed via grep). Add tag-based revalidation to key mutations:

| Server Action File | After mutation, add: |
|---|---|
| `horse.ts` (`createHorseRecord`) | `revalidateTag("public_horses")` |
| `horse.ts` (`updateHorseAction`) | `revalidateTag("public_horses")` |
| `horse.ts` (`deleteHorseAction`) | `revalidateTag("public_horses")` |
| `shows.ts` (create/close show) | `revalidateTag("shows")` |
| `events.ts` (create/update event) | `revalidateTag("events")` |
| `groups.ts` (create/update group) | `revalidateTag("groups")` |
| `posts.ts` (create post) | `revalidateTag("feed")` |
| `art-studio.ts` (create/update listing) | `revalidateTag("studio")` |
| `market.ts` (refresh) | `revalidateTag("market")` |

Import in each file:
```typescript
import { revalidateTag } from "next/cache";
```

### Step 4: Wrap public-route queries with `unstable_cache`

For the highest-traffic public routes, wrap the DB query in `unstable_cache`:

**Example for `community/page.tsx`:**
```typescript
import { unstable_cache } from "next/cache";

const getPublicHorses = unstable_cache(
  async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("user_horses")
      .select("...")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50);
    return data || [];
  },
  ["public_horses"],
  { revalidate: 60, tags: ["public_horses"] }
);
```

Apply this pattern to:
- `community/page.tsx` — `public_horses` tag, 60s revalidation
- `discover/page.tsx` — `discover_users` tag, 120s revalidation
- `shows/page.tsx` — `shows` tag, 60s revalidation
- `market/page.tsx` — `market` tag, 3600s revalidation (refreshed by cron daily)

> **CAUTION:** `unstable_cache` functions cannot use cookies/auth. The queries must be purely public data. If a page mixes public and private data (e.g., "is this MY horse?"), pass the user ID as a prop to a client component for the private check — do NOT put auth-gated logic inside the cached function.

### Step 5: Build and verify

```
npx next build
```

---

# EPIC 2: Security & Code Quality

---

## Task 2.1: Pre-DB Input Sanitization (XSS Prevention)

**Problem:** All free-text inputs (horse names, post bodies, messages, notes) are inserted directly into PostgreSQL without sanitization. React's JSX escaping prevents XSS at render time, but the database contains raw unsanitized HTML. This is dangerous for:
- CSV exports (opens in Excel, which renders HTML)
- PDF generation (react-pdf renders raw text)
- Future API consumers

### Step 1: Install sanitization library

```
npm install sanitize-html
npm install -D @types/sanitize-html
```

> **Why `sanitize-html` over `dompurify`?** DOMPurify requires a DOM environment (jsdom) on the server. `sanitize-html` is server-native and works in Node.js/edge runtimes without polyfills.

### Step 2: Add `sanitizeText()` to `src/lib/utils/validation.ts`

Add a new export to the existing file:

```typescript
import sanitizeHtml from "sanitize-html";

/**
 * Strip ALL HTML tags from free-text input.
 * Used server-side before database insertion.
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],       // Strip everything
    allowedAttributes: {}, // No attributes
  }).trim();
}

/**
 * Sanitize with limited markdown-safe tags (bold, italic, links).
 * Used for post bodies and messages where basic formatting is allowed.
 */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ["b", "i", "em", "strong", "a", "br"],
    allowedAttributes: {
      a: ["href", "title"],
    },
    allowedSchemes: ["https", "http"],
  }).trim();
}
```

### Step 3: Apply sanitization to server actions

Update these server action files to call `sanitizeText()` on all text fields **before** database insertion:

| File | Fields to sanitize |
|------|-------------------|
| `horse.ts` → `createHorseRecord` | `customName`, `sculptor`, `finishingArtist`, `finishDetails`, `publicNotes`, `assignedBreed`, `assignedGender`, `assignedAge`, `regionalId`, `marketplaceNotes`, `insuranceNotes` |
| `horse.ts` → `updateHorseAction` | Same fields in the update object |
| `posts.ts` → `createPost` | `body` (use `sanitizeRichText` here) |
| `messaging.ts` → `sendMessage` | `content` (use `sanitizeRichText`) |
| `groups.ts` → `createGroup` | `name`, `description` |
| `events.ts` → `createEvent` | `title`, `description` |
| `help-id.ts` → `createHelpIdRequest` | `description`, `notes` |
| `suggestions.ts` → `submitSuggestion` | `title`, `details` |
| `contact.ts` → contact form | `name`, `email`, `message` |

**Pattern for each:**
```typescript
import { sanitizeText } from "@/lib/utils/validation";

// Before insert:
const safeName = sanitizeText(data.customName);
```

### Step 4: Build and verify

```
npx next build
```

---

## Task 2.2: Eradicate TypeScript `as unknown as` Casting

**Problem:** The codebase has `as unknown as Type` casts in 20 files (confirmed via grep). These are runtime type violations — if the DB schema changes, TypeScript won't catch the mismatch.

### Step 1: Add type generation script

Add to `package.json` scripts:

```json
"gen-types": "npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/database.generated.ts"
```

> **NOTE:** The developer agent should ask the user for their `PROJECT_ID` (found in Supabase Dashboard → Settings → General). If unavailable, skip this sub-step and proceed with manual type narrowing.

### Step 2: Use `QueryData` for complex joins

For each file with `as unknown as` casts, replace the cast with proper Supabase `QueryData` inference.

**Files to fix (20 total):**

| File | # of casts | Fix approach |
|------|-----------|-------------|
| `dashboard/page.tsx` | 2-3 | Define query, use `QueryData<typeof query>` |
| `community/page.tsx` | 2-3 | Same |
| `community/[id]/page.tsx` | 1-2 | Same |
| `community/[id]/hoofprint/page.tsx` | 1 | Same |
| `profile/[alias_name]/page.tsx` | 2 | Same |
| `stable/[id]/page.tsx` | 3-4 | Same |
| `stable/collection/[id]/page.tsx` | 1 | Same |
| `wishlist/page.tsx` | 1 | Same |
| `admin/page.tsx` | 1 | Same |
| `actions/activity.ts` | 2-3 | Same |
| `actions/events.ts` | 2-3 | Same |
| `actions/help-id.ts` | 1-2 | Same |
| `actions/insurance-report.ts` | 1 | Same |
| `actions/notifications.ts` | 1 | Same |
| `actions/parked-export.ts` | 2 | Same |
| `actions/posts.ts` | 1-2 | Same |
| `actions/shows.ts` | 2 | Same |
| `actions/transactions.ts` | 2-3 | Same |
| `api/export/route.ts` | 1 | Same |
| `components/CsvImport.tsx` | 1 | Client-side — use interface narrowing |

**Pattern:**

Before (unsafe):
```typescript
const { data } = await supabase.from("user_horses").select("id, custom_name, catalog_items:catalog_id(title, maker)");
const horses = (data as unknown as MyType[]) ?? [];
```

After (type-safe):
```typescript
const horseQuery = supabase
  .from("user_horses")
  .select("id, custom_name, catalog_items:catalog_id(title, maker)");

type HorseRow = QueryData<typeof horseQuery>[number];

const { data } = await horseQuery;
const horses: HorseRow[] = data ?? [];
```

Import `QueryData`:
```typescript
import type { QueryData } from "@supabase/supabase-js";
```

> **IMPORTANT:** Some casts may be legitimately needed for Supabase views or RPC calls that PostgREST can't infer. Those are acceptable — annotate them with a `// VIEW: type can't be inferred` comment.

### Step 3: Build and verify

```
npx next build
```

---

## Task 2.3: Playwright E2E Testing Scaffold

**Problem:** The vitest scaffold is unused. Complex state machines (commerce, transfers) need integration tests.

### Step 1: Install Playwright

```
npm install -D @playwright/test
npx playwright install chromium
```

### Step 2: Create Playwright config

Create `playwright.config.ts` at project root:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

### Step 3: Create `e2e/safe-trade.spec.ts`

Scaffold with descriptive comments and `test.skip()` markers for the critical flow:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Safe-Trade Commerce Flow", () => {
  test.skip("Seller lists horse as For Sale", async ({ page }) => {
    // TODO: Login as seller, navigate to horse, set trade status
  });

  test.skip("Buyer makes an offer", async ({ page }) => {
    // TODO: Login as buyer, navigate to Show Ring, click Make Offer
  });

  test.skip("Seller accepts offer → status = pending_payment", async ({ page }) => {
    // TODO: Verify offer card state change
  });

  test.skip("Buyer marks payment sent → status = funds_verified", async ({ page }) => {
    // TODO: Verify state machine transition
  });

  test.skip("Seller confirms receipt → status = completed", async ({ page }) => {
    // TODO: Verify completion, review prompt appears
  });
});
```

### Step 4: Create `e2e/hoofprint-transfer.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Hoofprint Transfer Flow", () => {
  test.skip("Owner generates transfer code", async ({ page }) => {
    // TODO: Login, navigate to horse, click Transfer, verify 6-char code
  });

  test.skip("Recipient claims horse with code", async ({ page }) => {
    // TODO: Login as different user, go to /claim, enter code
  });

  test.skip("Ownership is swapped correctly", async ({ page }) => {
    // TODO: Verify horse appears in recipient's dashboard
    // TODO: Verify horse removed from sender's dashboard
  });
});
```

### Step 5: Add npm script

Add to `package.json`:
```json
"test:e2e": "npx playwright test"
```

### Step 6: Build and verify

```
npx next build
```

---

# EPIC 3: Hobby-Native Domain Polish

---

## Task 3.1: Stolen / Missing Trade Status

**Problem:** High-end artist resins ($500–$5,000+) are occasionally stolen at shows or lost in shipping. The community needs a way to flag these models to prevent unknowing resale.

### Step 1: Create migration `079_stolen_missing_status.sql`

```sql
-- ============================================================
-- 079: Add 'Stolen/Missing' trade status
-- Prevents transfers and CoA generation for flagged horses.
-- ============================================================

-- No CHECK constraint change needed — trade_status is a free TEXT column.
-- The application enforces allowed values via the TradeStatus TypeScript type.
-- If there IS a CHECK constraint, alter it:

-- Drop and recreate CHECK if it exists (safe to run if none exists):
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'user_horses' AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%trade_status%'
    ) THEN
        EXECUTE 'ALTER TABLE user_horses DROP CONSTRAINT ' || (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'user_horses' AND constraint_type = 'CHECK'
            AND constraint_name LIKE '%trade_status%' LIMIT 1
        );
    END IF;
END $$;
```

### Step 2: Update TypeScript types

In `src/lib/types/database.ts`, update:

```typescript
export type TradeStatus = "Not for Sale" | "For Sale" | "Open to Offers" | "Stolen/Missing";
```

### Step 3: Update trade status dropdowns

In ALL trade status `<select>` elements across the codebase, add:

```html
<option value="Stolen/Missing">🚨 Stolen/Missing</option>
```

**Files with trade status dropdowns** (search for `Not for Sale`):
- `src/app/add-horse/page.tsx`
- `src/app/stable/[id]/edit/page.tsx`
- `src/components/ShowRingFilters.tsx` (filter option)
- `src/components/MarketFilters.tsx` (filter option)

### Step 4: Add visual banner on passport pages

In `src/app/stable/[id]/page.tsx` and `src/app/community/[id]/page.tsx`, add a prominent red banner at the top if `trade_status === 'Stolen/Missing'`:

```tsx
{horse.trade_status === "Stolen/Missing" && (
  <div style={{
    background: "linear-gradient(135deg, #9B3028, #7A2520)",
    color: "#fff",
    padding: "var(--space-md) var(--space-lg)",
    borderRadius: "var(--radius-md)",
    textAlign: "center",
    fontWeight: 600,
    fontSize: "calc(1rem * var(--font-scale))",
    marginBottom: "var(--space-lg)",
  }}>
    🚨 This model has been reported as STOLEN or MISSING.
    Transfers and exports are disabled.
  </div>
)}
```

### Step 5: Block transfers and exports

In `src/app/actions/hoofprint.ts`:

- In `generateTransferCode()`: Add a check before generating the PIN:
  ```typescript
  // Fetch horse trade_status
  const { data: horse } = await supabase
    .from("user_horses")
    .select("trade_status")
    .eq("id", data.horseId)
    .single();
  
  if (horse?.trade_status === "Stolen/Missing") {
    return { success: false, error: "Cannot transfer a horse flagged as Stolen/Missing." };
  }
  ```

In `src/app/actions/parked-export.ts`:
- Add the same guard before generating CoA/export data.

### Step 6: Hide TransferModal button when Stolen/Missing

In `src/app/stable/[id]/page.tsx` (where TransferModal is rendered), conditionally hide it:
```tsx
{horse.trade_status !== "Stolen/Missing" && (
  <TransferModal horseId={horse.id} horseName={horse.custom_name} />
)}
```

### Step 7: Build and verify

```
npx next build
```

---

## Task 3.2: Relational Pedigrees

**Problem:** Current pedigree fields (`sire_name`, `dam_name`) are free-text strings with no relational integrity. Users can't trace bloodlines across their collection.

### Step 1: Create migration `080_relational_pedigrees.sql`

```sql
-- ============================================================
-- 080: Add relational FK references to horse_pedigrees
-- sire_id and dam_id point to actual user_horses records.
-- Free-text sire_name/dam_name remain as fallback for horses
-- not in the system (e.g., "GG Valentine" owned by another person).
-- ============================================================

ALTER TABLE horse_pedigrees
    ADD COLUMN IF NOT EXISTS sire_id UUID REFERENCES user_horses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dam_id UUID REFERENCES user_horses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedigree_sire ON horse_pedigrees(sire_id) WHERE sire_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedigree_dam ON horse_pedigrees(dam_id) WHERE dam_id IS NOT NULL;
```

### Step 2: Update `HorsePedigree` type

In `src/lib/types/database.ts`, add:

```typescript
export interface HorsePedigree {
  // ... existing fields ...
  sire_id: string | null;
  dam_id: string | null;
}
```

### Step 3: Update `PedigreeCard.tsx`

Currently `PedigreeCard.tsx` (264 lines) has free-text inputs for sire/dam names. Enhance it:

1. Add new props: `sireId`, `damId` (optional UUIDs).
2. Add state variables: `selectedSireId`, `selectedDamId`.
3. Replace the sire/dam text inputs with a **combo pattern**: a searchable dropdown that queries public horses (via a new server action `searchPublicHorses(query: string)`) PLUS a free-text fallback.
4. In read mode, if `sireId` is set, render the sire name as a clickable link to `/community/${sireId}`.

**New server action** — add to `src/app/actions/horse.ts`:
```typescript
export async function searchPublicHorses(query: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_horses")
    .select("id, custom_name, finish_type")
    .eq("is_public", true)
    .ilike("custom_name", `%${query}%`)
    .limit(10);
  return data || [];
}
```

### Step 4: Update `savePedigree` in `src/app/actions/provenance.ts`

Add `sire_id` and `dam_id` to the upsert data. They should be optional and nullable.

### Step 5: Update passport page to pass new props

In `src/app/stable/[id]/page.tsx` — where `PedigreeCard` is rendered, include `sireId` and `damId` from the pedigree query.

### Step 6: Build and verify

```
npx next build
```

---

## Task 3.3: Competition Scale Enforcement

**Problem:** Users can enter 1:32 Stablemates into 1:9 Traditional classes. Real-world NAMHSA shows enforce scale restrictions per class.

### Step 1: Create migration `081_class_scale_filter.sql`

```sql
-- ============================================================
-- 081: Add optional scale restriction to event_classes
-- Enforced at entry time — matches against catalog_items.scale
-- ============================================================

ALTER TABLE event_classes
    ADD COLUMN IF NOT EXISTS allowed_scales TEXT[];

-- Example: allowed_scales = ARRAY['Traditional', '1:9']
-- NULL means "any scale allowed" (backward compatible)

COMMENT ON COLUMN event_classes.allowed_scales IS
    'Array of allowed scale strings. NULL = no restriction. Matches catalog_items.scale.';
```

### Step 2: Update `EventClass` type

In `src/lib/types/database.ts`:

```typescript
export interface EventClass {
  // ... existing fields ...
  allowed_scales: string[] | null;
}
```

### Step 3: Update class creation UI

In the Manage Event page (`src/app/community/events/[id]/manage/page.tsx`), where classes are created within divisions, add an optional multi-select for allowed scales:

```tsx
<label className="form-label">Allowed Scales (optional)</label>
<select multiple className="form-select" ...>
  <option value="Traditional">Traditional (1:9)</option>
  <option value="Classic">Classic (1:12)</option>
  <option value="Stablemate">Stablemate (1:32)</option>
  <option value="Paddock Pal">Paddock Pal (1:24)</option>
  <option value="Mini Whinnies">Mini Whinnies</option>
  <option value="Other">Other</option>
</select>
```

When saving a class, include `allowed_scales` in the insert (as a PostgreSQL `TEXT[]` array).

### Step 4: Enforce at entry time

In `src/app/actions/competition.ts` (or `events.ts`, wherever the entry creation logic is):

When a user enters a horse into a class that has `allowed_scales` set:
1. Look up the horse's `catalog_id`.
2. If `catalog_id` is set, look up `catalog_items.scale`.
3. If the horse's scale is NOT in `allowed_scales`, reject with error:
   `"This class only accepts: Traditional, Classic. Your horse is a Stablemate."`
4. If `catalog_id` is null or scale is null, allow entry (benefit of the doubt).

### Step 5: Client-side warning

In `ShowEntryForm.tsx`, when a class is selected that has `allowed_scales`, show a note:
```
📏 This class accepts: Traditional, Classic
```

### Step 6: Build and verify

```
npx next build
```

---

# Verification Checklist

After ALL tasks are complete, run through this checklist:

- [ ] `npx next build` passes with 0 errors
- [ ] Grep for `createSignedUrl` in `src/` — zero hits (except avatars)
- [ ] Grep for `force-dynamic` — only on private/auth-gated routes
- [ ] Grep for `as unknown as` — reduced count, remaining ones annotated
- [ ] `Stolen/Missing` option visible in trade status dropdowns
- [ ] `sanitize-html` installed and wired into server actions
- [ ] `@playwright/test` installed with 2 scaffolded spec files
- [ ] `horse_pedigrees` has `sire_id` and `dam_id` columns
- [ ] `event_classes` has `allowed_scales` column
- [ ] All migrations (078–081) documented (078 is dashboard-only)
- [ ] Git commit after each task

---

# Commit Plan

| Task | Commit Message |
|------|---------------|
| 1.1 | `perf: public horse-images bucket — eliminate signed URL DDoS bottleneck` |
| 1.2 | `perf: remove force-dynamic from public routes, add unstable_cache + revalidateTag` |
| 2.1 | `security: add sanitize-html for pre-DB XSS prevention on all text inputs` |
| 2.2 | `types: eradicate as-unknown-as casts with QueryData inference` |
| 2.3 | `test: scaffold Playwright E2E for safe-trade and transfer flows` |
| 3.1 | `feat: Stolen/Missing trade status — blocks transfers and exports` |
| 3.2 | `feat: relational pedigrees — sire_id/dam_id FKs with searchable dropdown` |
| 3.3 | `feat: competition scale enforcement — allowed_scales per event class` |
