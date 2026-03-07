---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-07
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.

// turbo-all

## How to Use This Workflow

1. Read this entire file to understand pending tasks
2. Start with 🔴 Critical items first, then 🟡 Medium, then 🟢 Nice-to-Have
3. Each task has clear instructions — follow them exactly
4. After completing a task, mark it ✅ in this file
5. Run `npm run build` after each task to verify nothing broke
6. Commit with a descriptive message after completing a batch of related tasks

---

## Pre-flight

Before starting any work, read the developer conventions:

```
Look for 02_developer_conventions.md in any brain artifacts directory under C:\Users\MTG Test\.gemini\antigravity\brain\
```

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 1: LAUNCH PREP — Polish & UX
# ═══════════════════════════════════════

# 🔴 Priority: High (Launch Blockers)

## Task LP-1: Mobile Navigation — Hamburger Menu

**Problem:** The header has 9+ nav items (Stable, Show Ring, Discover, Feed, Shows, Wishlist, Inbox, Bell, Admin). On mobile screens (<768px) these overflow and clip. There's no hamburger menu, no mobile nav collapse, and no `.header-nav` CSS class at all.

**What to build:**

1. **Modify `src/components/Header.tsx`:**
   - Add state: `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
   - Add a hamburger button (3 lines SVG) visible only at `max-width: 768px`
   - Wrap nav links in a container that collapses on mobile
   - When hamburger is clicked, toggle a `.header-nav-open` class
   - Close menu when a link is clicked
   - Close menu when clicking outside (optional, nice to have)

2. **Add CSS to `src/app/globals.css`:**

```css
/* ── Header Nav ── */
.header-nav {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.header-nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  font-size: calc(var(--font-size-sm) * var(--font-scale));
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  white-space: nowrap;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.header-nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-glass-hover);
}

/* ── Hamburger button (hidden on desktop) ── */
.header-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.header-hamburger:hover {
  color: var(--color-text-primary);
  border-color: var(--color-accent-primary);
}

/* ── Mobile breakpoint ── */
@media (max-width: 768px) {
  .header-hamburger {
    display: flex;
  }

  .header-nav {
    display: none;
    position: absolute;
    top: var(--header-height);
    left: 0;
    right: 0;
    flex-direction: column;
    padding: var(--space-md) var(--space-lg);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(12px);
    box-shadow: var(--shadow-lg);
    z-index: 99;
  }

  .header-nav-open {
    display: flex;
  }

  .header-nav-link {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    font-size: calc(var(--font-size-base) * var(--font-scale));
  }

  .header-logo span:not(.header-logo-icon) {
    display: none;
  }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task LP-2: Global Loading States — `loading.tsx` Files

**Problem:** Zero `loading.tsx` files exist in the entire app. When navigating between pages, users see a blank white flash instead of a skeleton/spinner. This is the #1 "feels broken" signal.

**What to build:**

Create `src/app/loading.tsx` (root-level loading boundary):

```tsx
export default function Loading() {
  return (
    <div className="page-container loading-page">
      <div className="loading-skeleton">
        <div className="skeleton-hero" />
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    </div>
  );
}
```

Add CSS to `src/app/globals.css`:
```css
/* ── Loading Skeletons ── */
.loading-page {
  min-height: 60vh;
}

.skeleton-hero {
  height: 140px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-bg-card) 25%, var(--color-border) 50%, var(--color-bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  margin-bottom: var(--space-xl);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-lg);
}

.skeleton-card {
  height: 220px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--color-bg-card) 25%, var(--color-border) 50%, var(--color-bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

Note: The `shimmer` keyframe animation already exists in globals.css (line ~621). Don't duplicate it.

Also create route-specific loading files for the heaviest pages:
- `src/app/community/loading.tsx`
- `src/app/dashboard/loading.tsx`
- `src/app/discover/loading.tsx`
- `src/app/feed/loading.tsx`
- `src/app/shows/loading.tsx`

These can all use the same skeleton component. Either import a shared `LoadingSkeleton` or duplicate the simple markup.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task LP-3: Error Boundary — `error.tsx` and `not-found.tsx`

**Problem:** No error boundaries exist. If a server action fails or a page throws, users see Next.js's raw error page (ugly in production).

**What to build:**

Create `src/app/error.tsx`:
```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-container">
      <div className="card shelf-empty animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div className="shelf-empty-icon">⚠️</div>
        <h2>Something Went Wrong</h2>
        <p>An unexpected error occurred. Please try again.</p>
        <button className="btn btn-primary" onClick={reset}>
          Try Again
        </button>
      </div>
    </div>
  );
}
```

Create `src/app/not-found.tsx`:
```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-container">
      <div className="card shelf-empty animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div className="shelf-empty-icon">🔍</div>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Back to Stable
        </Link>
      </div>
    </div>
  );
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task LP-4: Landing Page Refresh — Showcase Social Features

**Problem:** The landing page (`src/app/page.tsx`) only mentions 3 features: AI Mold Detection, Financial Vault, and Show Ring. It's missing the social features that are now the app's biggest differentiator: Activity Feed, Photo Shows, Follows, Ratings, Notifications.

**What to modify:**

**File:** `src/app/page.tsx`

1. Add 3 more feature cards to the features grid (6 total):
   - **Social Community** — "Follow collectors, browse activity feeds, and discover stables. A thriving community of model horse enthusiasts."
   - **Virtual Photo Shows** — "Enter your models in community photo shows. Vote for favorites and compete for glory."
   - **Trusted Marketplace** — "Buy, sell, and trade with confidence. User ratings, transaction tracking, and direct messaging."

2. Update the meta description to mention social features.

3. Consider updating the stats section with more compelling numbers (these could be dynamic later):
   - e.g., "7,000+ Reference Releases" instead of "Unlimited Models"

4. Update the `features-grid` CSS to accommodate 6 cards (it currently does 3). Change grid columns:
```css
.features-grid {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium (Launch Polish)

## Task LP-5: Onboarding — Post-Signup Redirect & Welcome

**Problem:** After signup, users land on the dashboard with no guidance. There's no "Add your first horse" CTA or getting-started experience.

**What to build:**

**Modify `src/app/dashboard/page.tsx`:**

If the user has 0 horses, show a welcome card instead of (or above) the the regular dashboard:

```tsx
{horses.length === 0 && (
  <div className="welcome-card card animate-fade-in-up">
    <h2>👋 Welcome to Model Horse Hub!</h2>
    <p>Let's get started by adding your first model to your digital stable.</p>
    <div className="welcome-steps">
      <div className="welcome-step">
        <span className="welcome-step-number">1</span>
        <span>📸 Add your first horse with photos</span>
      </div>
      <div className="welcome-step">
        <span className="welcome-step-number">2</span>
        <span>🏆 Make it public for the Show Ring</span>
      </div>
      <div className="welcome-step">
        <span className="welcome-step-number">3</span>
        <span>👥 Discover and follow other collectors</span>
      </div>
    </div>
    <Link href="/add-horse" className="btn btn-primary btn-lg">
      🐴 Add Your First Horse
    </Link>
  </div>
)}
```

Add CSS for `.welcome-card`, `.welcome-steps`, `.welcome-step`, `.welcome-step-number` using existing design tokens and glassmorphism patterns.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task LP-6: Mobile Polish Pass — Key Pages

**Problem:** While basic media queries exist, several newer pages may not have mobile-specific styles.

**Pages to check and fix (render each at 375px width):**

1. **Show Ring (`/community`)** — Filter pills may overflow
2. **Activity Feed (`/feed`)** — Tab bar needs horizontal scroll or wrap
3. **Discover (`/discover`)** — Cards may need full-width on mobile
4. **Photo Shows (`/shows/[id]`)** — Entry form and vote buttons
5. **Notifications (`/notifications`)** — Notification list items
6. **Profile (`/profile/[alias]`)** — Follow button + stats may overlap

For each page, ensure:
- Content doesn't overflow horizontally
- Text is readable (not clipped or tiny)
- Buttons are tap-target sized (min 44x44px)
- Cards stack vertically on narrow screens

**Quick CSS patterns to apply where needed:**
```css
@media (max-width: 640px) {
  .feed-tabs { flex-wrap: wrap; gap: var(--space-xs); }
  .showring-filters { flex-direction: column; }
  .profile-hero-stats { flex-direction: column; gap: var(--space-sm); }
  .profile-follow-stats { flex-direction: column; }
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task LP-7: Commit Launch Prep Batch

After all LP tasks above are complete:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m \"polish: Launch prep - mobile nav, loading states, error boundaries, landing page refresh\" 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 2: TECHNICAL HARDENING
# ═══════════════════════════════════════

# 🟡 Priority: Medium (Technical Debt)

## Task TH-1: Migrate from `middleware.ts` to `proxy.ts`

**Problem:** The build warns: `The "middleware" file convention is deprecated. Please use "proxy" instead.` Next.js 16 wants `proxy.ts`.

**What to do:**

1. Read the Next.js docs for the proxy convention:
   - Check: https://nextjs.org/docs/messages/middleware-to-proxy
   - Understand what changed between middleware and proxy

2. Rename `src/middleware.ts` to `src/proxy.ts` (or the correct new location)

3. Adapt the code to the new API if needed. The current middleware does:
   - Creates a Supabase server client
   - Checks auth state via `supabase.auth.getUser()`
   - Redirects unauthenticated users away from protected routes
   - Passes through cookie management

4. Test that auth protection still works after migration.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Build should no longer show the middleware deprecation warning.

---

## Task TH-2: TypeScript Type Audit

**Problem:** The `database.ts` types file grew fast across multiple agents. Column names may not match between the migration SQL and the TypeScript interfaces.

**What to verify:**

1. Open `src/lib/types/database.ts`
2. For each interface, cross-reference against the matching migration SQL file:

| Interface | Migration File | Key Columns to Verify |
|---|---|---|
| `UserRating` | `012_user_ratings.sql` | `reviewer_id`, `reviewed_id`, `stars` (not `rater_id`/`rating`) |
| `FeaturedHorse` | `013_social_expansion_p1.sql` | All columns |
| `Notification` | `014_social_expansion_p2.sql` | `actor_id`, `horse_id`, `conversation_id` |
| `UserFollow` | `015_social_expansion_p3.sql` | `follower_id`, `following_id` |
| `ActivityEvent` | `015_social_expansion_p3.sql` | `actor_id`, `event_type`, `horse_id`, `target_id`, `metadata` |
| `PhotoShow` | `016_social_expansion_p4.sql` | `status` values match CHECK constraint |
| `ShowEntry` | `016_social_expansion_p4.sql` | `show_id`, `horse_id`, `user_id`, `votes` |
| `ShowVote` | `016_social_expansion_p4.sql` | `entry_id`, `user_id` |

3. Fix any mismatches by updating the TypeScript interface to match the actual SQL column names.

4. Verify the `Database` interface mapping has correct `Row`, `Insert`, and `Update` types for each table.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx tsc --noEmit 2>&1"
```

---

## Task TH-3: Circular Import Check

**Problem:** Server action files import from each other (`social.ts` → `notifications.ts`, `follows.ts` → `notifications.ts`, `ratings.ts` → `notifications.ts`). This creates potential circular dependency chains.

**What to verify:**

1. Map all imports between action files:
   - `social.ts` → imports from `notifications.ts`, `activity.ts`
   - `follows.ts` → imports from `notifications.ts`, `activity.ts`
   - `ratings.ts` → imports from `notifications.ts`, `activity.ts`
   - `notifications.ts` → imports from nothing external (base module)
   - `activity.ts` → imports from nothing external (base module)

2. Confirm `notifications.ts` and `activity.ts` do NOT import from any other action file. They should be leaf modules.

3. If any circular dependencies exist, break them by:
   - Moving shared utilities to a separate `lib/` module
   - Using dynamic imports (`const { fn } = await import(...)`) for non-critical paths

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task TH-4: Commit Technical Hardening Batch

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m \"chore: Technical hardening - proxy migration, type audit, import cleanup\" 2>&1"
```

---

# 🟢 Priority: Nice-to-Have

## Task TH-5: Add Basic Automated Test

**Problem:** Zero test files exist. Even one smoke test provides a safety net.

**What to build:**

1. Check if a test runner is configured (check `package.json` for `jest`, `vitest`, or similar)
2. If not, add `vitest` as a dev dependency:
   ```
   cd c:\Project Equispace\model-horse-hub && cmd /c "npm install -D vitest 2>&1"
   ```
3. Create `src/__tests__/smoke.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";

   describe("Smoke test", () => {
     it("should pass", () => {
       expect(1 + 1).toBe(2);
     });
   });
   ```
4. Add `"test": "vitest run"` to package.json scripts
5. Run: `npm test`

This is just the foundation — real tests can be added later.

---

# 📝 Completed Tasks

## ✅ Task A: Wire Activity Events into Missing Actions (completed 2026-03-07)
Wired `createActivityEvent` into ratings.ts, follows.ts, provenance.ts. Added `show_record` event type to ActivityFeed component.

## ✅ Task B: Build Collection Showcases UI (completed 2026-03-07)
Added `is_public` checkbox to CollectionPicker creation modal. Added public collection pills to profile pages with CSS.

## ✅ Task C: Optimize Discover Page N+1 Queries (completed 2026-03-07)
Replaced serial `getUserRatingSummary()` loop with single batch query to `user_ratings` table. Removed unused import.

## ✅ Task D: Add "New Horse" Activity Event (completed 2026-03-07)
Created `notifyHorsePublic` server action in `horse-events.ts`. Wired into both add-horse and edit-horse pages.

## ⏭️ Task E: Middleware Public Paths (skipped — not needed)

## ✅ Task F: Documentation + Commit (completed 2026-03-07)
Committed and pushed as `fix: wire missing activity events + collection showcase UI + discover optimization`.

## ✅ LP-1: Mobile Navigation — Hamburger Menu (completed 2026-03-07)
Added `mobileMenuOpen` state and hamburger button to Header.tsx. Nav collapses to full-width slide-down menu on mobile (<768px). Auto-closes on link click and outside click. CSS with backdrop blur and glassmorphism.

## ✅ LP-2: Global Loading States (completed 2026-03-07)
Created root `loading.tsx` with shimmer skeleton (hero + 6-card grid). Added route-specific loading files for community, dashboard, discover, feed, and shows via re-exports. Added `@keyframes shimmer` and skeleton CSS.

## ✅ LP-3: Error Boundary + Not Found (completed 2026-03-07)
Created `error.tsx` (client component with retry button) and `not-found.tsx` (branded 404 with back-to-stable link).

## ✅ LP-4: Landing Page Refresh (completed 2026-03-07)
Added 3 new feature cards (Social Community, Virtual Photo Shows, Trusted Marketplace) for 6 total. Updated meta description, hero subheadline, stats section (added "7,000+ Reference Releases"). Changed grid to `auto-fit minmax(300px, 1fr)`.

## ✅ LP-5: Onboarding Welcome Card (completed 2026-03-07)
Added welcome card to dashboard for users with 0 horses. Includes 3-step getting started guide and "Add Your First Horse" CTA. Added glassmorphism CSS with numbered step indicators.

## ✅ LP-6: Mobile Polish Pass (completed 2026-03-07)
Added `@media (max-width: 640px)` rules for feed-tabs, profile-hero-stats, profile-follow-stats, discover-grid, notification-item, and stats-inner.

## ✅ LP-7: Commit Launch Prep (completed 2026-03-07)
Committed and pushed as `polish: Launch prep - mobile nav, loading states, error boundaries, landing page refresh`.

## ✅ TH-1: Migrate middleware.ts → proxy.ts (completed 2026-03-07)
Renamed file and export function per Next.js 16 convention. Deprecation warning eliminated from build output.

## ✅ TH-2: TypeScript Type Audit (completed 2026-03-07)
Cross-referenced all 8 social/expansion interfaces against migration SQL. Found and fixed missing `is_public` field on `UserCollection` interface and its Insert type.

## ✅ TH-3: Circular Import Check (completed 2026-03-07)
Verified `notifications.ts` and `activity.ts` are leaf modules. All import arrows point one-way — no circular dependencies.

## ✅ TH-4: Commit Technical Hardening (completed 2026-03-07)
Committed and pushed as `chore: Technical hardening - proxy migration, type audit, import cleanup`.

## ✅ TH-5: Add Basic Automated Test (completed 2026-03-07)
Installed vitest, created `src/__tests__/smoke.test.ts`, added `"test": "vitest run"` script. Test passes in 938ms.
