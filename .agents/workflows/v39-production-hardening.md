---
description: V39 Production Hardening & Stabilization Sprint — Fix edge middleware, Suspense streaming, generated types, and pedigree validation
---

# V39: Production Hardening & Stabilization Sprint

> **Version:** 39
> **Created:** 2026-03-22
> **Status:** Ready for execution
> **Pre-requisite:** All 239 tests passing, Tailwind migration complete

---

## Pre-Flight Checklist

// turbo
1. Run `npm test` to confirm baseline — expect 239/239 passing.
// turbo
2. Run `npx next build` to confirm baseline builds cleanly.

---

## EPIC 1: Edge Security & Session Integrity

### Task 1.1: Fix the Middleware Routing Hole

**Problem:** The file `src/proxy.ts` exports a function named `proxy()` and a `config.matcher`. 
Next.js **strictly requires** the middleware file to be named `middleware.ts` (or `middleware.js`) in the `src/` directory, and it must export a **default function** named `middleware` (not `proxy`).

Because of the wrong filename AND wrong export name, Next.js completely ignores our edge-level route protection. The Supabase session-refresh + auth redirect logic in `proxy.ts` is **dead code in production**.

**Evidence:** `ls .next/server/middleware*` shows build artifacts exist — but only because Next.js generates a no-op middleware by default.

**Steps:**

1. **Rename the file:**
   ```
   src/proxy.ts → src/middleware.ts
   ```

2. **Rename the exported function** inside `src/middleware.ts`:
   - Change `export async function proxy(request: NextRequest)` → `export async function middleware(request: NextRequest)`
   - The `config` export stays as-is (it's already correct).

3. **Add missing public routes** to the `publicPaths` array. Currently it has:
   ```ts
   "/login", "/signup", "/auth", "/forgot-password", "/getting-started",
   "/community", "/profile", "/discover", "/about", "/contact", "/claim",
   "/api", "/_next", "/favicon.ico"
   ```
   
   **Add these missing routes** that should be publicly accessible:
   ```ts
   "/catalog",        // Public catalog browsing
   "/market",         // Blue Book is public
   "/show-ring",      // Public show ring
   "/faq",            // Static info page
   "/privacy",        // Static legal page
   "/terms",          // Static legal page
   "/leaderboard",    // Public leaderboard
   "/search",         // Global search
   ```

4. **Verify the `config.matcher`** — the current regex pattern is correct:
   ```ts
   "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
   ```
   This correctly excludes static assets. No change needed here.

5. **Search for any imports of `proxy.ts`** — run:
   ```
   grep -r "proxy" src/ --include="*.ts" --include="*.tsx" -l
   ```
   Update any import paths that reference the old filename.

// turbo
6. **Verify:** Run `npx next build` — confirm the build still succeeds and the middleware is recognized (build output should show "Middleware" in the routes list).

// turbo
7. **Verify:** Run `npm test` — confirm 239/239 still pass.

---

## EPIC 2: Performance & Perceived Load Time

### Task 2.1: Remove `force-dynamic` from ALL pages

**Problem:** 35 pages export `export const dynamic = "force-dynamic"`. This is unnecessary because Next.js automatically opts into dynamic rendering when `cookies()` or `supabase.auth.getUser()` is called. The `force-dynamic` directive disables ALL caching including the Next.js Full Route Cache, Data Cache, and Router Cache — causing every navigation to be a full server render.

**Steps:**

1. **Remove `export const dynamic = "force-dynamic";`** from ALL of these files:
   
   **Authenticated pages (cookie-based auth already forces dynamic):**
   - `src/app/dashboard/page.tsx` (line 28)
   - `src/app/stable/[id]/page.tsx` (line 16)
   - `src/app/stable/collection/[id]/page.tsx` (line 7)
   - `src/app/inbox/page.tsx` (line 10)
   - `src/app/inbox/[id]/page.tsx` (line 21)
   - `src/app/feed/page.tsx` (line 14)
   - `src/app/feed/[id]/page.tsx` (line 8)
   - `src/app/notifications/page.tsx` (line 11)
   - `src/app/settings page` — (check if it has one)
   - `src/app/wishlist/page.tsx` (line 14)
   - `src/app/admin/page.tsx` (line 14)
   - `src/app/shows/planner/page.tsx` (line 7)
   - `src/app/studio/dashboard/page.tsx` (line 7)
   - `src/app/studio/my-commissions/page.tsx` (line 6)
   - `src/app/studio/setup/page.tsx` — (check if it has one)
   - `src/app/studio/commission/[id]/page.tsx` (line 10)
   
   **Public pages (still need fresh data but cookie read already forces dynamic):**
   - `src/app/community/page.tsx` (line 42)
   - `src/app/community/[id]/page.tsx` (line 19)
   - `src/app/community/[id]/hoofprint/page.tsx` (line 8)
   - `src/app/community/help-id/page.tsx` (line 14)
   - `src/app/community/help-id/[id]/page.tsx` (line 8)
   - `src/app/community/events/page.tsx` (line 9)
   - `src/app/community/events/[id]/page.tsx` (line 19)
   - `src/app/community/groups/page.tsx` (line 8)
   - `src/app/community/groups/[slug]/page.tsx` (line 9)
   - `src/app/discover/page.tsx` (line 10)
   - `src/app/profile/[alias_name]/page.tsx` (line 18)
   - `src/app/shows/page.tsx` (line 24)
   - `src/app/shows/[id]/page.tsx` (line 23)
   - `src/app/studio/page.tsx` (line 6)
   - `src/app/studio/[slug]/page.tsx` (line 7)
   - `src/app/studio/[slug]/request/page.tsx` (line 7)
   - `src/app/catalog/page.tsx` (line 11)
   - `src/app/catalog/[id]/page.tsx` (line 25)
   - `src/app/catalog/changelog/page.tsx` (line 11)
   - `src/app/catalog/suggestions/page.tsx` (line 12)
   - `src/app/catalog/suggestions/[id]/page.tsx` (line 20)

// turbo
2. **Verify:** Run `npx next build` — confirm clean build, no regressions.

// turbo
3. **Verify:** Run `npm test` — confirm 239/239 still pass.

---

### Task 2.2: Implement React Suspense Streaming on Dashboard

**Problem:** The dashboard awaits TWO rounds of `Promise.all` (6 queries in round 1, 3 queries in round 2) before rendering a single byte. Users see a blank white screen during this ~500ms–2s window.

**Architecture:**

```
DashboardPage (immediate render — shell + skeleton)
  └── <Suspense fallback={<DashboardSkeleton />}>
        └── <DashboardContent /> (async — fetches all data, renders grid + sidebar)
      </Suspense>
```

**Steps:**

1. **In `src/app/dashboard/page.tsx`:**

   a. **Keep in `DashboardPage`:** The auth check (`supabase.auth.getUser()` + redirect). This is fast and must run before anything else.
   
   b. **Extract ALL data fetching + rendering** into a new async Server Component `DashboardContent`:
      - Move the `Promise.all` blocks (both Round 1 and Round 2) into `DashboardContent`.
      - Move all the display data computation (`horseCards`, `collectionCounts`, `collectionValues`, etc.) into `DashboardContent`.
      - Move the JSX for the two-column grid layout into `DashboardContent`.
      - `DashboardContent` receives `userId` and `page` as props.
   
   c. **In `DashboardPage`**, immediately render:
      - The welcome card (if needed — but this depends on horse count, so skip it for the shell)
      - The sticky shelf header with the "Digital Stable" title and action buttons
      - Wrap `<DashboardContent userId={user.id} page={page} />` in `<Suspense fallback={<DashboardSkeleton />}>`
   
   d. **Create `DashboardSkeleton`** — a lightweight loading skeleton:
      - Two-column grid with placeholder pulse animations
      - Left column: 6 horse card skeletons (rounded rectangles with shimmer)
      - Right column: 2 sidebar card skeletons
      - Use Tailwind `animate-pulse` classes

   e. **Note:** The `profile` (alias_name) fetch should stay in `DashboardPage` since it's needed for the shelf header title. This is a single fast query.

// turbo
2. **Verify:** Run `npx next build` — confirm the dashboard still builds.

// turbo
3. **Verify:** Run `npm test` — confirm 239/239 still pass.

---

### Task 2.3: Implement React Suspense Streaming on Community Page

**Problem:** Same issue as dashboard — `src/app/community/page.tsx` awaits a massive query for all public horses before rendering.

**Steps:**

1. **In `src/app/community/page.tsx`:**

   a. **Keep in the main component:** Auth check (for blocked users filter), search params parsing.
   
   b. **Extract the horse query + grid rendering** into `<ShowRingContent />` async Server Component.
   
   c. **Wrap in Suspense:**
      ```tsx
      <Suspense fallback={<ShowRingSkeleton />}>
        <ShowRingContent userId={user?.id} searchParams={params} />
      </Suspense>
      ```
   
   d. **Create `ShowRingSkeleton`** — horse grid skeleton with 12 card placeholders using `animate-pulse`.

// turbo
2. **Verify:** Run `npx next build` — confirm clean build.

// turbo
3. **Verify:** Run `npm test` — confirm 239/239 still pass.

---

## EPIC 3: Type Safety & Eliminating Blindspots

### Task 3.1: Generate Supabase TypeScript Types

**Problem:** The codebase uses a manually maintained `src/lib/types/database.ts` (420+ lines). There are **41 instances** of `as unknown as` type casts across 20+ files. These completely bypass TypeScript's safety — if the database schema drifts from the manual types, the app crashes silently at runtime.

**Steps:**

1. **Generate types using the existing script:**
   ```bash
   npm run gen-types
   ```
   This runs: `npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/types/database.generated.ts`

   > **Note:** This requires `SUPABASE_PROJECT_ID` to be set in the environment. If not available, the developer should:
   > - Check `.env` or `.env.local` for the project ID
   > - Or extract it from `NEXT_PUBLIC_SUPABASE_URL` (it's the subdomain before `.supabase.co`)

2. **Inject the `Database` type into all three Supabase clients:**

   **File: `src/lib/supabase/client.ts`**
   ```ts
   import { createBrowserClient } from "@supabase/ssr";
   import type { Database } from "@/lib/types/database.generated";
   
   export function createClient() {
     return createBrowserClient<Database>(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     );
   }
   ```

   **File: `src/lib/supabase/server.ts`**
   ```ts
   import { createServerClient } from "@supabase/ssr";
   import { cookies } from "next/headers";
   import type { Database } from "@/lib/types/database.generated";
   
   export async function createClient() {
     const cookieStore = await cookies();
     return createServerClient<Database>(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       { cookies: { /* ...same as current... */ } }
     );
   }
   ```

   **File: `src/lib/supabase/admin.ts`**
   ```ts
   import { createClient } from "@supabase/supabase-js";
   import type { Database } from "@/lib/types/database.generated";
   
   let adminClient: ReturnType<typeof createClient<Database>> | null = null;
   
   export function getAdminClient() {
     if (!adminClient) {
       adminClient = createClient<Database>(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );
     }
     return adminClient;
   }
   ```
   Remove the `eslint-disable` comments and `any` types — the generated types replace them.

// turbo
3. **Verify:** Run `npx next build` — expect type errors. This is expected and good.

4. **Fix type errors systematically.** For each `as unknown as` cast:
   
   **Strategy A (preferred):** If the Supabase query shape already matches, simply remove the cast:
   ```ts
   // Before:
   const horses = (rawHorses as unknown as HorseDetail[]) ?? [];
   // After — let Supabase infer the type from the select string:
   const { data: horses } = await supabase.from("user_horses").select("id, custom_name, ...");
   ```

   **Strategy B (complex joins):** Use `QueryData` for complex selects:
   ```ts
   import type { QueryData } from "@supabase/supabase-js";
   
   const horseQuery = supabase.from("user_horses").select(`
     id, custom_name, catalog_items:catalog_id(title, maker)
   `).eq("owner_id", userId);
   
   type HorseWithCatalog = QueryData<typeof horseQuery>[number];
   ```

   **Strategy C (acceptable last resort):** For extremely complex queries where QueryData can't infer (e.g., RPC calls, admin client), keep the cast but use the generated type:
   ```ts
   const horses = data as Database["public"]["Tables"]["user_horses"]["Row"][];
   ```

   **Priority files to fix** (highest traffic / most casts):
   - `src/app/dashboard/page.tsx` (3 casts)
   - `src/app/community/page.tsx` (2 casts)
   - `src/app/community/[id]/page.tsx` (3 casts)
   - `src/app/stable/[id]/page.tsx` (2 casts)
   - `src/app/actions/activity.ts` (2 casts)
   - `src/app/actions/shows.ts` (1 cast)
   - `src/app/actions/transactions.ts` (1 cast)
   - `src/app/actions/notifications.ts` (1 cast)
   - `src/app/actions/posts.ts` (1 cast)

   **Files OK to leave** (test mocks are fine with `as unknown as`):
   - `src/lib/utils/__tests__/rateLimit.test.ts` — test mocks, acceptable

// turbo
5. **Verify:** Run `npx next build` — expect clean build with zero `as unknown as` in production code.

// turbo
6. **Verify:** Run `npm test` — confirm 239/239 still pass.

---

## EPIC 4: Domain Logic Polish

### Task 4.1: Biologically Accurate Pedigree Validation

**Problem:** In `src/app/actions/provenance.ts`, the `savePedigree()` function (line 174) accepts `sireId` and `damId` without validating the gender of the linked horses. A user can:
- Assign a Mare as a Sire
- Assign a Stallion as a Dam
- Assign a horse as its own parent

The `assigned_gender` field exists on `user_horses` and is already populated by the edit form.

**Steps:**

1. **In `src/app/actions/provenance.ts` → `savePedigree()`**, add validation **before** the existing upsert logic (before line 199 `const pedigreeData = {`):

   ```ts
   // ── Gender validation for linked parents ──
   if (data.sireId) {
     if (data.sireId === data.horseId) {
       return { success: false, error: "A horse cannot be its own Sire." };
     }
     const { data: sireHorse } = await supabase
       .from("user_horses")
       .select("assigned_gender")
       .eq("id", data.sireId)
       .single();
     
     if (sireHorse?.assigned_gender) {
       const femaleGenders = ["Mare", "Filly"];
       if (femaleGenders.includes(sireHorse.assigned_gender)) {
         return { success: false, error: `A ${sireHorse.assigned_gender} cannot be assigned as a Sire.` };
       }
     }
   }
   
   if (data.damId) {
     if (data.damId === data.horseId) {
       return { success: false, error: "A horse cannot be its own Dam." };
     }
     const { data: damHorse } = await supabase
       .from("user_horses")
       .select("assigned_gender")
       .eq("id", data.damId)
       .single();
     
     if (damHorse?.assigned_gender) {
       const maleGenders = ["Stallion", "Gelding", "Colt"];
       if (maleGenders.includes(damHorse.assigned_gender)) {
         return { success: false, error: `A ${damHorse.assigned_gender} cannot be assigned as a Dam.` };
       }
     }
   }
   
   // Also prevent sire === dam
   if (data.sireId && data.damId && data.sireId === data.damId) {
     return { success: false, error: "Sire and Dam cannot be the same horse." };
   }
   ```

2. **Add a unit test** in `src/app/actions/__tests__/provenance.test.ts` covering:
   - ✅ Valid pedigree saves correctly
   - ❌ Mare as Sire → rejected with descriptive error
   - ❌ Stallion as Dam → rejected with descriptive error
   - ❌ Horse as its own parent → rejected
   - ❌ Same horse as both Sire and Dam → rejected
   - ✅ Horse with no `assigned_gender` → allowed (no gender means no validation)

// turbo
3. **Verify:** Run `npm test` — confirm all tests pass including new pedigree validation tests.

---

## Post-Sprint Verification

// turbo
1. Run `npm test` — expect all tests passing (239 + new pedigree tests).
// turbo
2. Run `npx next build` — expect clean production build.
3. Stage, commit, and push:
   ```bash
   git add -A
   git commit -m "V39: Production hardening — edge middleware, Suspense streaming, generated types, pedigree validation

   - EPIC 1: Renamed proxy.ts → middleware.ts with correct export name
   - EPIC 2: Removed force-dynamic from 35 pages, added Suspense streaming to dashboard + community
   - EPIC 3: Generated Supabase types, injected Database generic, removed unsafe type casts
   - EPIC 4: Added gender validation on pedigree sire/dam assignment"
   git push origin main
   ```

---

## Risk Assessment

| Epic | Risk | Mitigation |
|------|------|------------|
| 1 - Middleware | Low | Straightforward rename. Build verification catches issues. |
| 2 - force-dynamic | Low | Removing `force-dynamic` has no functional effect when `cookies()` is called (auto-dynamic). |
| 2 - Suspense | Medium | Component extraction must preserve all data flow. Test thoroughly. |
| 3 - Generated types | Medium-High | May surface hidden type mismatches. Fix incrementally. Build must pass. |
| 4 - Pedigree | Low | Additive validation only. Existing tests unaffected. |
