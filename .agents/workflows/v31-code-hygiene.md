---
description: V31 Code Hygiene Sprint — requireAuth() helper, CSS Module extraction, page file splitting, Supabase type generation, inline style migration. Incremental cleanup with test gates at every phase.
---

# V31: Code Hygiene Sprint

> **Context:** Audit found 5 critical efficiency issues: auth boilerplate (127 copies), globals.css monolith (9,300 lines), 3 monster page files (50KB+), 33 unsafe type casts, and 461 inline styles. This sprint addresses them incrementally with full test verification at every phase.
>
> **Scope:** 6 phases, ~25 tasks. Each phase is independently committable.
>
> **Golden Rule:** Every phase ends with `npm run test:unit` + `npx next build`. If either fails, fix before proceeding. Husky pre-commit will enforce test passage on every commit.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> 1. Run `npm run test:unit` after EVERY file modification. All 132+ tests must pass.
> 2. Run `npx next build` at the end of each phase. Build must succeed.
> 3. Commit after each phase with a descriptive message.
> 4. Do NOT change function signatures or return types — only internal refactors.
> 5. Do NOT rename exported functions — downstream imports must stay stable.
> 6. If a test fails after your change, you broke something. Revert and investigate.
> 7. Push to git only after ALL tests pass AND build succeeds.

---

## Pre-flight

Verify everything is clean before starting:

```
cd c:\Project Equispace\model-horse-hub && npm run test:unit
```

```
cd c:\Project Equispace\model-horse-hub && npx next build 2>&1
```

```
cd c:\Project Equispace\model-horse-hub && git status --short
```

All tests must pass. Build must succeed. Working tree should be clean.

---

# ═══════════════════════════════════════
# PHASE 1: `requireAuth()` Helper
# Saves ~380 lines, unifies auth pattern
# ═══════════════════════════════════════

## Task 1.1: Create the Auth Helper

Create `src/lib/auth.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthError extends Error {
    constructor(message = "Not authenticated.") {
        super(message);
        this.name = "AuthError";
    }
}

/**
 * Require an authenticated user. Returns Supabase client + user.
 * Throws AuthError if not authenticated — callers must catch and return their error format.
 * 
 * Usage:
 *   const { supabase, user } = await requireAuth();
 */
export async function requireAuth(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string };
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AuthError();
    return { supabase, user };
}

/**
 * Get Supabase client + optional user (for pages that work both authenticated and anonymous).
 * Never throws.
 */
export async function optionalAuth(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string } | null;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
}
```

Run tests to verify passive creation doesn't break anything:
```
npm run test:unit
```

---

## Task 1.2: Write Tests for `requireAuth()`

Create `src/lib/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve({
        auth: { getUser: mockGetUser },
    })),
}));

import { requireAuth, optionalAuth, AuthError } from "@/lib/auth";

describe("requireAuth", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns supabase + user when authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com" } } });
        const result = await requireAuth();
        expect(result.user.id).toBe("user-1");
        expect(result.supabase).toBeDefined();
    });

    it("throws AuthError when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        await expect(requireAuth()).rejects.toThrow(AuthError);
    });
});

describe("optionalAuth", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns user when authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
        const result = await optionalAuth();
        expect(result.user?.id).toBe("user-1");
    });

    it("returns null user when anonymous", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const result = await optionalAuth();
        expect(result.user).toBeNull();
        expect(result.supabase).toBeDefined();
    });
});
```

Run tests:
```
npm run test:unit
```

---

## Task 1.3: Migrate First 5 Action Files (Smallest First)

Migrate these files to use `requireAuth()`. Start with the smallest to validate the pattern:

**Files (in order):** `likes.ts`, `wishlist.ts`, `blocks.ts`, `contact.ts`, `follows.ts`

**Migration pattern:**

```typescript
// BEFORE (in every function):
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { success: false, error: "Not authenticated." };

// AFTER:
import { requireAuth } from "@/lib/auth";

// In each function:
try {
    const { supabase, user } = await requireAuth();
    // ... rest of function body (unchanged)
} catch {
    return { success: false, error: "Not authenticated." };
}
```

> **IMPORTANT:** Do NOT change the return type. Wrap the function body in try/catch so the external behavior is identical. The catch block returns the same error format the function already uses.

> **For functions that return arrays** (like getters that return `[]` on auth failure):
> ```typescript
> try {
>     const { supabase, user } = await requireAuth();
>     // ...
> } catch {
>     return [];
> }
> ```

After each file, run:
```
npm run test:unit
```

---

## Task 1.4: Migrate Next 10 Action Files

**Files:** `ratings.ts`, `mentions.ts`, `social.ts`, `suggestions.ts`, `collections.ts`, `moderation.ts`, `notifications.ts`, `admin.ts`, `messaging.ts`, `settings.ts`

Same pattern as 1.3. Run `npm run test:unit` after each file.

---

## Task 1.5: Migrate Remaining Action Files

**Files:** `provenance.ts`, `horse.ts`, `horse-events.ts`, `help-id.ts`, `market.ts`, `activity.ts`, `posts.ts`, `hoofprint.ts`, `parked-export.ts`, `shows.ts`, `transactions.ts`, `art-studio.ts`, `events.ts`, `competition.ts`, `groups.ts`

> **Note:** Some functions in these files use `optionalAuth()` (anonymous-safe getters like `getEvents()`). Use `optionalAuth()` for those, `requireAuth()` for write operations.

> **Also note:** Some files import `createClient` for uses OTHER than auth (e.g., creating a deferred client inside `after()`). Keep those imports — only remove the auth-related `createClient` imports when ALL auth uses are migrated.

Run `npm run test:unit` after each file.

---

## Task 1.6: Remove Unused createClient Imports

After migrating all files, scan for `createClient` imports that are no longer needed:

```
Select-String -Path "src\app\actions\*.ts" -Pattern 'import.*createClient.*from.*supabase/server'
```

For each file where `createClient` is ONLY used for auth (not for deferred clients inside `after()`), remove the import.

Run tests + build:
```
npm run test:unit
npx next build 2>&1
```

## Phase 1 Commit

```
git add -A && git commit -m "refactor: requireAuth() helper — eliminate 127 copies of auth boilerplate across 36 action files"
```

---

# ═══════════════════════════════════════
# PHASE 2: CSS Module Extraction
# Target: globals.css from 9,300 → ~5,000 lines
# ═══════════════════════════════════════

## Task 2.1: Identify the 5 Largest Extractable CSS Blocks

Open `globals.css` and identify the 5 largest blocks with their approximate line counts. Look for section comment headers like `/* === SECTION NAME === */`.

> **Do NOT extract:** `.btn-*`, `.form-*`, `.card`, `.page-container`, `.animate-*` — these are shared utilities used everywhere.
>
> **DO extract:** Page-specific styles that are only used by one component or page.

List the blocks with line ranges and which component owns them.

---

## Task 2.2: Extract Block 1 (Largest)

1. Create `ComponentName.module.css` alongside the component
2. Copy the CSS rules into the module
3. Rename class selectors to camelCase (CSS modules convention): `.show-card` → `.showCard`
4. In the component: `import styles from "./ComponentName.module.css"`
5. Replace `className="show-card"` with `className={styles.showCard}`
6. Delete the extracted CSS from `globals.css`

Run tests + build:
```
npm run test:unit && npx next build 2>&1
```

---

## Task 2.3: Extract Block 2

Same pattern as 2.2. Run tests + build after.

---

## Task 2.4: Extract Block 3

Same pattern as 2.2. Run tests + build after.

---

## Task 2.5: Extract Blocks 4 and 5

Same pattern. Run tests + build after.

---

## Task 2.6: Verify Final globals.css Line Count

```powershell
(Get-Content src\app\globals.css | Measure-Object -Line).Lines
```

Should be under 6,000. Report the reduction.

## Phase 2 Commit

```
git add -A && git commit -m "refactor: extract 5 CSS blocks to modules — globals.css down from 9,300 to ~Xk lines"
```

---

# ═══════════════════════════════════════
# PHASE 3: Split Monster Page Files
# ═══════════════════════════════════════

## Task 3.1: Split `add-horse/page.tsx` (1,236 lines)

The add-horse page has several natural sections. Extract them into focused components:

1. **View the file** to identify the natural boundaries (photo upload section, reference search section, form fields sections)
2. Create separate component files in `src/app/add-horse/`:
   - `PhotoUploadSection.tsx` — the LSQ photo slots and extra details dropzone
   - `HorseDetailsForm.tsx` — the form fields (name, finish, condition, etc.)
   - Keep the orchestration logic in `page.tsx`
3. Pass state down via props. Lift shared state to `page.tsx`.

> **Test gate:** Run `npm run test:unit && npx next build 2>&1` after extracting each component.
> The page should render and behave identically — this is a pure restructuring.

---

## Task 3.2: Split `events/[id]/manage/page.tsx` (~850 lines)

This page already has 3 tabs. Extract each tab's content to its own component:

1. `ManageDetailsTab.tsx` — the event details editing form
2. `ManageClassesTab.tsx` — the division/class tree builder
3. `ManageJudgesTab.tsx` — the judge assignment panel with autocomplete

Keep tab switching and shared state (eventId, loadData) in `page.tsx`.

> **Test gate:** `npm run test:unit && npx next build 2>&1`

---

## Task 3.3: Split `stable/[id]/edit/page.tsx` (~800 lines)

Same approach as add-horse. Extract:

1. `EditPhotoSection.tsx` — photo management (existing + upload + delete)
2. `EditDetailsForm.tsx` — form fields

> **Test gate:** `npm run test:unit && npx next build 2>&1`

---

## Phase 3 Commit

```
git add -A && git commit -m "refactor: split 3 monster page files into focused components — add-horse, manage-event, edit-horse"
```

---

# ═══════════════════════════════════════
# PHASE 4: Supabase Type Generation
# Eliminates 33 unsafe `as Record<string, unknown>` casts
# ═══════════════════════════════════════

## Task 4.1: Generate Supabase Types

If the user has the Supabase CLI configured with their project:

```
npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types/supabase-generated.ts
```

If not available, skip this task. The user will need to set up the Supabase CLI with their project credentials first.

> **Alternative (manual):** If Supabase CLI isn't configured, create strict row types manually for the 5 most-queried tables: `user_horses`, `users`, `events`, `show_records`, `catalog_items`.

---

## Task 4.2: Create Type-Safe Query Helpers

Create `src/lib/supabase/queries.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
// Import generated types if available
// import type { Database } from "@/lib/types/supabase-generated";

/**
 * Typed helper: get user's horses with catalog join.
 * Replaces 54× .from("user_horses") across codebase.
 */
export function queryUserHorses(supabase: SupabaseClient, userId: string) {
    return supabase
        .from("user_horses")
        .select("*")
        .eq("owner_id", userId);
}

/**
 * Typed helper: get user profile by ID.
 * Replaces 40× .from("users").select("alias_name").eq("id", ...) across codebase.
 */
export function queryUserProfile(supabase: SupabaseClient, userId: string) {
    return supabase
        .from("users")
        .select("id, alias_name, avatar_url, bio, full_name")
        .eq("id", userId)
        .single();
}
```

> This is extracted incrementally — start with helpers for the 3 most repeated query patterns, then expand.

---

## Task 4.3: Replace 5 Worst Cast Offenders

Find the 5 action files with the most `as Record<string, unknown>` casts. Replace those casts with proper types from the generated types or manual interfaces.

After each file:
```
npm run test:unit
```

---

## Phase 4 Commit

```
git add -A && git commit -m "refactor: Supabase type generation + typed query helpers — eliminate unsafe Record casts"
```

---

# ═══════════════════════════════════════
# PHASE 5: Split Large Action Files
# ═══════════════════════════════════════

## Task 5.1: Split `groups.ts` (796 lines)

Create a `src/app/actions/groups/` directory:

```
groups/index.ts       — re-exports everything (preserves import paths)
groups/crud.ts        — createGroup, updateGroup, deleteGroup, getGroups, getGroup
groups/members.ts     — joinGroup, leaveGroup, removeMember, transferAdmin
groups/files.ts       — uploadGroupFile, getGroupFiles, deleteGroupFile
groups/posts.ts       — group post-related actions (if any in groups.ts)
```

The `index.ts` re-exports everything so existing imports don't break:

```typescript
// src/app/actions/groups/index.ts
export { createGroup, updateGroup, deleteGroup, getGroups, getGroup } from "./crud";
export { joinGroup, leaveGroup, removeMember, transferAdmin } from "./members";
export { uploadGroupFile, getGroupFiles, deleteGroupFile } from "./files";
```

> **CRITICAL:** Existing imports like `import { createGroup } from "@/app/actions/groups"` must continue to work. The barrel re-export ensures this.

Run: `npm run test:unit && npx next build 2>&1`

---

## Task 5.2: Split `events.ts` (733 lines)

Already has natural sections marked with comment headers:

```
events/index.ts       — re-exports
events/crud.ts        — createEvent, updateEvent, deleteEvent, getEvent, getEvents
events/judges.ts      — addEventJudge, removeEventJudge, getEventJudges, searchUsers
events/comments.ts    — addEventComment, deleteEventComment, getEventComments
events/photos.ts      — addEventPhoto, getEventPhotos, deleteEventPhoto
events/rsvp.ts        — rsvpEvent, getUpcomingEvents, getEventAttendees
```

Run: `npm run test:unit && npx next build 2>&1`

---

## Task 5.3: Split `competition.ts` (774 lines)

```
competition/index.ts      — re-exports
competition/divisions.ts  — createDivision, updateDivision, deleteDivision, reorderDivisions, copyDivisionsFromEvent
competition/classes.ts    — createClass, updateClass, deleteClass, reorderClasses, getEventDivisions
competition/entries.ts    — submitEntry, withdrawEntry, getClassEntries
competition/judging.ts    — saveExpertPlacings, getExpertPlacings
```

Run: `npm run test:unit && npx next build 2>&1`

---

## Phase 5 Commit

```
git add -A && git commit -m "refactor: split groups.ts, events.ts, competition.ts into focused modules with barrel re-exports"
```

---

# ═══════════════════════════════════════
# PHASE 6: Structured Logger + Console Cleanup
# ═══════════════════════════════════════

## Task 6.1: Create Structured Logger

Create `src/lib/logger.ts`:

```typescript
type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, context: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${context}]`;
    
    switch (level) {
        case "error":
            console.error(`${prefix} ${message}`, data ?? "");
            break;
        case "warn":
            console.warn(`${prefix} ${message}`, data ?? "");
            break;
        default:
            if (process.env.NODE_ENV !== "production") {
                console.log(`${prefix} ${message}`, data ?? "");
            }
    }
}

export const logger = {
    info: (ctx: string, msg: string, data?: unknown) => log("info", ctx, msg, data),
    warn: (ctx: string, msg: string, data?: unknown) => log("warn", ctx, msg, data),
    error: (ctx: string, msg: string, data?: unknown) => log("error", ctx, msg, data),
};
```

---

## Task 6.2: Replace 12 console.* Calls

Replace the 12 `console.error/warn/log` calls found in server actions with the structured logger:

```typescript
// BEFORE:
console.error("[Activity] Failed to log event");

// AFTER:
import { logger } from "@/lib/logger";
logger.error("Activity", "Failed to log event");
```

**Files to update:** `activity.ts`, `admin.ts`, `contact.ts`, `horse-events.ts`, `horse.ts`, `messaging.ts`, `notifications.ts`, `settings.ts`, `transactions.ts`, `wishlist.ts`

After all replacements:
```
npm run test:unit
```

---

## Phase 6 Commit

```
git add -A && git commit -m "refactor: structured logger replaces raw console calls in 10 action files"
```

---

# ═══════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════

## Task: Full Verification Suite

### 1. Run complete test suite
```
npm run test:unit
```
All 132+ tests must pass.

### 2. Run build
```
npx next build 2>&1
```
Must succeed with zero errors.

### 3. Verify line counts improved

```powershell
# globals.css
(Get-Content src\app\globals.css | Measure-Object -Line).Lines

# Total LoC
$total = 0; Get-ChildItem src -Recurse -Include "*.ts","*.tsx" | Where-Object { $_.Name -notmatch "\.(test|spec|d)\.ts$" } | ForEach-Object { try { $total += (Get-Content $_.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines } catch {} }; Write-Output "Total LoC: $total"

# Auth boilerplate count (should be near zero)
Select-String -Path "src\app\actions\*.ts" -Pattern "const \{ data: \{ user \} \}" | Measure-Object | Select-Object Count

# Unsafe casts (should be reduced)
Select-String -Path "src\app\actions\*.ts" -Pattern "as Record<string, unknown>" | Measure-Object | Select-Object Count
```

### 4. Push all changes
```
git push
```

---

# Expected Outcomes

| Metric | Before | After |
|--------|-------:|------:|
| globals.css lines | 9,304 | **~5,000** |
| Auth boilerplate copies | 127 | **0** |
| Largest page file | 1,236 lines | **~400** |
| Unsafe `Record<>` casts | 33 | **~10** |
| `console.*` in actions | 12 | **0** (→ logger) |
| Largest action file | 796 lines | **~300** |
| Test count | 132 | **136+** (new auth tests) |

> **Total estimated savings:** ~4,500 lines removed/restructured from globals.css, ~380 lines of auth boilerplate eliminated, 3 page files decomposed into 9 focused components, 3 action files split into 15 focused modules. Zero behavior changes.
