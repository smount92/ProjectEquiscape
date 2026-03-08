---
description: Fix critical security and architecture issues identified in the project audit. Run this before scaling beyond trusted beta testers.
---

# Audit Fix Workflow — Security & Architecture Hardening

> **Source:** [Project Audit](file:///C:/Users/MTG%20Test/.gemini/antigravity/brain/3e679c33-518f-4174-a7e2-c40c985bfce8/project_audit.md)
> **Priority:** Must-do before public launch. Items ordered by severity.
> **Convention:** Mark items ✅ when done. Run build after each task.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 1: CRITICAL SECURITY FIXES
# ═══════════════════════════════════════

## Task AF-1: Sanitize Search Input — Fix SQL/PostgREST Injection

**Severity:** 🔴 HIGH
**Audit Finding:** #1

**Problem:** User search queries are interpolated directly into PostgREST `.or()` filter strings without sanitization. A crafted query could inject PostgREST operators and leak data.

**File:** `src/app/actions/reference.ts`

**Current code (lines 45, 57, 71):**
```typescript
.or(`mold_name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
```

**Fix:** Add a sanitizer function at the top of the file and apply it to all queries:

```typescript
/**
 * Sanitize a search query for safe use in PostgREST .or() filters.
 * Strips characters that could be used to inject filter operators.
 */
function sanitizeSearchQuery(raw: string): string {
    // Remove PostgREST special characters: commas (filter separator),
    // parentheses (grouping), periods (operator separator), and percent
    // signs (already added by our ilike pattern).
    // Keep alphanumeric, spaces, hyphens, apostrophes (for names like "O'Brien").
    return raw.replace(/[,().%\\]/g, "").trim();
}
```

Then in `searchReferencesAction`, replace:
```typescript
const q = query.trim();
```
with:
```typescript
const q = sanitizeSearchQuery(query);
if (!q) return tab === "mold" ? { molds: [], releases: [] } : { resins: [] };
```

**Also apply to:** Any other `.or()` or `.ilike()` calls that interpolate user input. Check these files:
- `src/app/actions/reference.ts` — main search ✅
- `src/app/actions/wishlist.ts` — check for search
- `src/app/actions/shows.ts` — check for search

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-2: Whitelist Fields in updateHorseAction — Prevent Column Injection

**Severity:** 🔴 HIGH
**Audit Finding:** #2

**Problem:** `updateHorseAction` receives a JSON string from the client, parses it with `JSON.parse`, and passes it directly to Supabase `.update()`. A malicious client could modify `owner_id`, `id`, or any other column.

**File:** `src/app/actions/horse.ts` — `updateHorseAction` function (line ~208)

**Current code:**
```typescript
const horseUpdate = horseUpdateStr ? JSON.parse(horseUpdateStr) : null;
// ...
const { error: updErr } = await supabase.from("user_horses").update(horseUpdate)...
```

**Fix:** Add a whitelist filter after the parse:

```typescript
const HORSE_UPDATE_ALLOWED_FIELDS = [
    'custom_name',
    'sculptor',
    'finishing_artist',
    'finish_type',
    'condition_grade',
    'is_public',
    'trade_status',
    'listing_price',
    'marketplace_notes',
    'collection_id',
    'reference_mold_id',
    'artist_resin_id',
    'release_id',
    'life_stage',
    'edition_number',
    'edition_size',
];

// In updateHorseAction, after JSON.parse:
const rawUpdate = horseUpdateStr ? JSON.parse(horseUpdateStr) : null;
const horseUpdate = rawUpdate
    ? Object.fromEntries(
        Object.entries(rawUpdate).filter(([key]) => HORSE_UPDATE_ALLOWED_FIELDS.includes(key))
    )
    : null;
```

**Also whitelist vault fields:**
```typescript
const VAULT_ALLOWED_FIELDS = [
    'purchase_price',
    'purchase_date',
    'estimated_current_value',
    'insurance_notes',
    'horse_id',
];

const rawVault = vaultDataStr ? JSON.parse(vaultDataStr) : null;
const vaultData = rawVault
    ? Object.fromEntries(
        Object.entries(rawVault).filter(([key]) => VAULT_ALLOWED_FIELDS.includes(key))
    )
    : null;
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-3: Create Middleware — Session Refresh + Route Protection

**Severity:** 🔴 MEDIUM-HIGH
**Audit Finding:** #7

**Problem:** No `middleware.ts` exists. Supabase auth tokens can expire between page loads, and there's no centralized route protection.

**File:** `src/middleware.ts` (NEW FILE — create at the `src/` root)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Do NOT use supabase.auth.getSession() — it reads from
    // cookies without validation. Use getUser() to verify with the server.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;

    // ── Public routes (no auth required) ──
    const publicRoutes = [
        "/",
        "/about",
        "/contact",
        "/login",
        "/signup",
        "/forgot-password",
        "/getting-started",
        "/auth/callback",
        "/auth/auth-code-error",
        "/auth/reset-password",
    ];

    const isPublicRoute = publicRoutes.includes(path);
    const isPublicDynamic =
        path.startsWith("/community") ||
        path.startsWith("/profile/") ||
        path.startsWith("/discover") ||
        path.startsWith("/api/");

    // ── Redirect unauthenticated users from protected routes ──
    if (!user && !isPublicRoute && !isPublicDynamic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirectTo", path);
        return NextResponse.redirect(url);
    }

    // ── Redirect authenticated users away from auth pages ──
    if (user && (path === "/login" || path === "/signup")) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico (favicon)
         * - Public assets (.svg, .png, .jpg, etc.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
```

**After creating this file:**
- Test login flow: visit `/dashboard` while logged out → should redirect to `/login`
- Test logged-in flow: visit `/login` while logged in → should redirect to `/dashboard`
- Test public pages: `/about`, `/contact`, `/community` should always work
- Test auth callback: `/auth/callback` must remain accessible

**⚠️ IMPORTANT:** The middleware refreshes the session on every request. This prevents the "expired token" race condition that could cause mysterious logouts.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-4: Centralize Admin Client + Fix Admin Email Leak

**Severity:** 🟡 MEDIUM
**Audit Finding:** #3, #8

**Problem:** (A) Admin email is exposed to the client via `NEXT_PUBLIC_ADMIN_EMAIL`. (B) 12 places create ad-hoc admin Supabase clients.

### Part A: Create shared admin client

**File:** `src/lib/supabase/admin.ts` (NEW FILE)

```typescript
import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Get a Supabase admin client (Service Role).
 * Only for use in server actions — NEVER import in client components.
 */
export function getAdminClient() {
    if (!adminClient) {
        adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return adminClient;
}
```

Then find-and-replace all instances of:
```typescript
const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

With:
```typescript
import { getAdminClient } from "@/lib/supabase/admin";
// ...
const supabaseAdmin = getAdminClient();
```

**Files to update (12 instances):**
- `src/app/actions/activity.ts` (1)
- `src/app/actions/admin.ts` (1)
- `src/app/actions/hoofprint.ts` (1)
- `src/app/actions/horse-events.ts` (1)
- `src/app/actions/messaging.ts` (1)
- `src/app/actions/notifications.ts` (1)
- `src/app/actions/shows.ts` (6 — consolidate the repeated calls)

### Part B: Remove `NEXT_PUBLIC_ADMIN_EMAIL` from Header

**File:** `src/components/Header.tsx`

The admin link in the header currently uses `process.env.NEXT_PUBLIC_ADMIN_EMAIL` (line 19). This leaks the admin email into the client JS bundle.

**Fix:** Replace the client-side email check with a server action:

**File:** `src/app/actions/header.ts` — add:
```typescript
export async function checkIsAdmin(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
}
```

If `checkIsAdmin` already exists in `header.ts`, make sure it doesn't reference `NEXT_PUBLIC_ADMIN_EMAIL`.

Then in Header.tsx, call `checkIsAdmin()` from the `useEffect` instead of reading `process.env.NEXT_PUBLIC_ADMIN_EMAIL` directly.

After this change, remove `NEXT_PUBLIC_ADMIN_EMAIL` from `.env.local` and Vercel — only `ADMIN_EMAIL` (server-only) should exist.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 2: ARCHITECTURE HARDENING
# ═══════════════════════════════════════

## Task AF-5: Add Basic Rate Limiting to Contact Form

**Severity:** 🟡 MEDIUM
**Audit Finding:** #4

**Problem:** The contact form can be spammed without limit.

**Simple approach (no Redis needed):** Use an in-memory rate limiter in the server action.

**File:** `src/app/actions/contact.ts`

Add at the top of the file:
```typescript
// Simple in-memory rate limiter (resets on deploy / server restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;      // max requests
const RATE_LIMIT_WINDOW = 60_000; // per 60 seconds

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true; // allowed
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false; // rate limited
    }

    entry.count++;
    return true;
}
```

In the `submitContactForm` function (or whatever it's called), add:
```typescript
// Rate limit by IP or email
const rateLimitKey = email?.toLowerCase() || "anonymous";
if (!checkRateLimit(rateLimitKey)) {
    return { success: false, error: "Too many messages. Please try again in a minute." };
}
```

**Also apply to:**
- `src/app/actions/suggestions.ts` — `submitSuggestion` (limit per user ID)
- `src/app/auth/actions.ts` — login/signup (limit per email)

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-6: Add Input Validation Utility

**Severity:** 🟡 MEDIUM
**Audit Finding:** #14

**Problem:** Server actions blindly cast FormData values with `as string`, which can produce `"null"` strings.

**File:** `src/lib/utils/validation.ts` (NEW FILE)

```typescript
/**
 * Safely extract a required string field from FormData.
 * Returns null if missing, empty, or literally "null".
 */
export function getRequiredString(formData: FormData, key: string): string | null {
    const val = formData.get(key);
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") return null;
    return str;
}

/**
 * Safely extract an optional string field from FormData.
 */
export function getOptionalString(formData: FormData, key: string): string | null {
    const val = formData.get(key);
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") return null;
    return str;
}

/**
 * Safely extract a numeric field from FormData.
 */
export function getOptionalNumber(formData: FormData, key: string): number | null {
    const str = getOptionalString(formData, key);
    if (!str) return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

/**
 * Safely extract a boolean field from FormData.
 */
export function getBoolean(formData: FormData, key: string, defaultValue = false): boolean {
    const val = formData.get(key);
    if (val === null) return defaultValue;
    return String(val) === "true";
}
```

Then gradually replace `as string` casts in server actions with these helpers. Start with `addHorseAction` and `updateHorseAction` since they handle the most fields.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-7: Add Database Indexes on Hot Paths

**Severity:** 🟡 MEDIUM
**Audit Finding:** #18

**File:** `supabase/migrations/021_indexes_and_constraints.sql` (NEW FILE)

```sql
-- ============================================================
-- Migration 021: Performance Indexes + Business Constraints
-- ============================================================

-- ── Hot path indexes ──
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_id
    ON activity_events(actor_id);

CREATE INDEX IF NOT EXISTS idx_activity_events_created_at
    ON activity_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id
    ON user_follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_following_id
    ON user_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_horse_images_horse_id
    ON horse_images(horse_id);

CREATE INDEX IF NOT EXISTS idx_user_horses_public
    ON user_horses(is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_user_horses_owner
    ON user_horses(owner_id);

CREATE INDEX IF NOT EXISTS idx_favorites_horse_id
    ON user_favorites(horse_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id
    ON user_favorites(user_id);

-- ── Business logic constraints ──
ALTER TABLE user_horses
    ADD CONSTRAINT check_edition_number_positive
    CHECK (edition_number IS NULL OR edition_number > 0);

ALTER TABLE user_horses
    ADD CONSTRAINT check_edition_size_positive
    CHECK (edition_size IS NULL OR edition_size > 0);

ALTER TABLE user_horses
    ADD CONSTRAINT check_edition_consistency
    CHECK (edition_number IS NULL OR edition_size IS NULL OR edition_number <= edition_size);

ALTER TABLE user_horses
    ADD CONSTRAINT check_listing_price_positive
    CHECK (listing_price IS NULL OR listing_price > 0);
```

**⚠️ STOP HERE** — This migration must be run in the Supabase SQL Editor. Do NOT proceed until the user confirms success.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-8: Add Error Boundary Component

**Severity:** 🟢 LOW
**Audit Finding:** #22

**File:** `src/app/error.tsx` (NEW FILE) — Next.js App Router error boundary

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[ErrorBoundary]", error);
    }, [error]);

    return (
        <div className="page-container" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
            <h1 style={{ marginBottom: "var(--space-lg)" }}>
                <span className="text-gradient">Something went wrong</span>
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-xl)" }}>
                An unexpected error occurred. Please try again.
            </p>
            <button className="btn btn-primary" onClick={reset}>
                Try Again
            </button>
        </div>
    );
}
```

Also create `src/app/not-found.tsx` if it doesn't exist:

```tsx
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="page-container" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
            <h1 style={{ marginBottom: "var(--space-lg)" }}>
                <span className="text-gradient">404 — Page Not Found</span>
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-xl)" }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link href="/" className="btn btn-primary">
                Go Home
            </Link>
        </div>
    );
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# PHASE 3: DEPLOYMENT CLEANUP
# ═══════════════════════════════════════

## Task AF-9: Fix Environment Variables

**Severity:** 🟡 MEDIUM
**Audit Finding:** #25, #26

### Vercel Dashboard — set these env vars:

1. `NEXT_PUBLIC_SITE_URL` = `https://modelhorsehub.com`
2. `ADMIN_EMAIL` = `<your-admin-email>` (server-only, NOT `NEXT_PUBLIC_`)
3. Remove `NEXT_PUBLIC_ADMIN_EMAIL` if it exists (after AF-4 is done)

### Local `.env.local` — verify these exist:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=<your-admin-email>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task AF-10: Commit & Push All Security Fixes

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "security: audit fixes — input sanitization, field whitelisting, middleware, rate limiting" 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```

---

# ═══════════════════════════════════════
# CHECKLIST — SIGN-OFF
# ═══════════════════════════════════════

After completing all tasks, verify:

- [ ] AF-1: Search queries sanitized
- [ ] AF-2: updateHorseAction fields whitelisted
- [ ] AF-3: middleware.ts created and tested
- [ ] AF-4: Admin client centralized, admin email removed from client bundle
- [ ] AF-5: Contact form rate limited
- [ ] AF-6: Validation utility created
- [ ] AF-7: Database indexes added (run in Supabase SQL Editor)
- [ ] AF-8: Error boundary + 404 page created
- [ ] AF-9: Vercel env vars verified
- [ ] AF-10: All changes committed and pushed

Final build check:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```
