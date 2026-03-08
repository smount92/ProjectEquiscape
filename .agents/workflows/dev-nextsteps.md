---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-08
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

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# ✅ COMPLETED OPTIONS (10, 11, 12)
# ═══════════════════════════════════════

## ✅ Option 10: Beta Feedback Round 1 — DONE
## ✅ Option 11: Beta Feedback Round 2 (Avatar, Reference, Text Posts) — DONE
## ✅ Option 12: Supabase Advisor Fixes (SA-1 through SA-4) — DONE

---

# ═══════════════════════════════════════
# OPTION 13: POLISH SPRINT — Mobile, Password Flow, Pagination, Admin Suggestions
# ═══════════════════════════════════════

> **Scope:** 4 focused tasks (B through E from status report)
> **Goal:** Make the product feel complete and robust before the next round of beta testers

---

# 🔴 Priority: Critical

## ✅ Task PS-1: Mobile UI Polish — DONE

**Why:** Wife tested on mobile and flagged responsive issues. The CSS has zero `@media` queries — all responsiveness comes from flexible layouts and CSS variables. This works for simple pages but breaks on complex layouts like grids, the header nav, and multi-column forms.

**Time:** 2-3 hours

### What to audit and fix:

**1. Header Navigation (mobile hamburger)**

**File:** `src/components/Header.tsx` + `src/app/globals.css`

Check if the hamburger menu:
- ✅ Opens and closes properly
- ✅ Has sufficient tap target size (44px minimum)
- ⚠️ All nav links are reachable without scrolling
- ⚠️ Close button is easy to tap

**2. Dashboard Grid**

**File:** `src/app/dashboard/page.tsx`

The dashboard likely uses CSS grid or flex for the stable overview + horse cards. On mobile:
- Cards should stack vertically (1 column)
- The "Stable Overview" analytics widget should be full-width
- Collection folders horizontal scroll should work on touch

Add to `globals.css`:

```css
/* ===== Responsive Breakpoints ===== */
@media (max-width: 768px) {
    /* Page containers */
    .page-container {
        padding: var(--space-md);
    }

    /* Dashboard grid → single column */
    .stable-grid,
    .show-ring-grid,
    .discover-grid {
        grid-template-columns: 1fr;
    }

    /* Hero sections — reduce spacing */
    .community-hero {
        padding: var(--space-lg) var(--space-md);
    }

    .community-hero h1 {
        font-size: var(--font-size-xl);
    }

    /* Stats row */
    .community-stats {
        flex-wrap: wrap;
        gap: var(--space-sm);
    }

    /* Feed compose bar */
    .feed-compose-bar {
        padding: var(--space-sm);
    }

    /* Form layouts */
    .form-row {
        flex-direction: column;
    }

    /* Hide desktop-only elements */
    .desktop-only {
        display: none !important;
    }
}

@media (max-width: 480px) {
    /* Very small screens */
    .page-container {
        padding: var(--space-sm);
    }

    .community-hero h1 {
        font-size: var(--font-size-lg);
    }

    /* Cards should be full-width without side padding */
    .card {
        border-radius: var(--radius-md);
    }

    /* Buttons should be full-width */
    .btn-group {
        flex-direction: column;
    }

    .btn-group .btn {
        width: 100%;
    }
}
```

**3. Add Horse Form (multi-step wizard)**

This is the most complex mobile layout. Check:
- Step indicators should wrap or scroll horizontally
- Photo upload zones should be full-width
- The reference search dropdown should be usable on small screens
- Form buttons should be large enough for touch (44px min height)

**4. Passport Page**

The community passport page has a complex layout. Check:
- Photo gallery should scroll horizontally on mobile
- Horse details should stack vertically
- Action buttons (share, favorite) should be easily tappable

**5. Show Ring Grid**

**File:** `src/app/community/page.tsx`

The Show Ring uses a grid for horse cards. On mobile:
- Should be single-column
- Cards should show the essential info without truncation
- Filter/sort controls should be accessible

### Testing approach:

After making CSS changes, use Chrome DevTools device emulation:
- iPhone SE (375px) — smallest common screen
- iPhone 14 (390px) — most popular
- iPad Mini (768px) — tablet breakpoint

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-2: Forgot Password End-to-End Verification — DONE

**Why:** The user created an account and verified email but hasn't tested forgot password. The `forgotPasswordAction` uses `NEXT_PUBLIC_SITE_URL` for the redirect URL — if this wasn't set in Vercel, the reset link would point to `localhost:3000`.

**Time:** 30-60 minutes

### What to verify:

**1. Check `NEXT_PUBLIC_SITE_URL` in Vercel**

The `forgotPasswordAction` (line 126) uses:
```typescript
redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/reset-password`,
```

**Verify:** In Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_SITE_URL` must be set to `https://modelhorsehub.com`
- If missing, the reset email link will contain `http://localhost:3000` and be broken

**2. Check Supabase Redirect URL Allowlist**

In Supabase Dashboard → Authentication → URL Configuration:
- "Site URL" should be `https://modelhorsehub.com`
- "Redirect URLs" should include:
  - `https://modelhorsehub.com/**`
  - `http://localhost:3000/**` (for local dev)

If `https://modelhorsehub.com/auth/reset-password` is NOT in the redirect allowlist, Supabase will reject the redirect and the password reset will silently fail.

**3. Test the flow**

After verifying the above:
1. Go to `https://modelhorsehub.com/forgot-password`
2. Enter your email
3. Check your inbox for the reset email
4. Click the link — should open at `https://modelhorsehub.com/auth/reset-password`
5. Enter a new password
6. Should redirect to `/dashboard` after success

**4. Handle edge cases**

**File:** `src/app/auth/reset-password/page.tsx`

The reset password page currently uses `createClient()` (browser client) to call `supabase.auth.updateUser({ password })`. This requires the user's session to already be valid (set by the magic link in the email).

Potential issue: If the auth callback route doesn't properly handle the password reset token exchange, the user won't have a valid session on the reset page.

Check that `src/app/auth/callback/route.ts` handles the `type=recovery` exchange:

```typescript
// Should handle: ?code=xxx (auth code exchange)
// The code exchange sets the session, enabling updateUser
```

**5. If the flow doesn't work**, the fix is usually:

- Add `https://modelhorsehub.com` to Supabase redirect URLs
- Set `NEXT_PUBLIC_SITE_URL` in Vercel
- Ensure the auth callback route handles recovery codes

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## ✅ Task PS-3: Pagination — Feed, Show Ring, Discover — DONE

**Why:** All list pages use fixed `limit()` values with no way to load more. As the user base grows, the first 50 items will be all users see.

**Time:** 3-4 hours

### Architecture: Cursor-based pagination

Since the feed, Show Ring, and Discover pages are Server Components, we'll use **cursor-based pagination with a "Load More" button** that fetches the next page via a Client Component wrapper.

### Step 1: Add pagination to activity feed

**File:** `src/app/actions/activity.ts`

Modify `getActivityFeed` to accept an optional cursor:

```typescript
export async function getActivityFeed(
    limit: number = 30,
    cursor?: string // ISO date string of the last item's created_at
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
    const supabase = await createClient();

    let query = supabase
        .from("activity_events")
        .select("id, actor_id, event_type, horse_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit + 1); // Fetch one extra to detect if there's more

    if (cursor) {
        query = query.lt("created_at", cursor);
    }

    const { data: events } = await query;
    const items = (events ?? []) as /* existing type */[];

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].created_at : null;

    // ... rest of batch fetching logic stays the same, but uses pageItems ...

    return { items: mappedItems, nextCursor };
}
```

Do the same for `getFollowingFeed`.

### Step 2: Create LoadMoreFeed client component

**File:** `src/components/LoadMoreFeed.tsx` (NEW)

```tsx
"use client";

import { useState, useTransition } from "react";
import { getActivityFeed, getFollowingFeed } from "@/app/actions/activity";
import ActivityFeed from "./ActivityFeed";

interface LoadMoreFeedProps {
    initialItems: FeedItemData[];
    initialCursor: string | null;
    feedType: "global" | "following";
}

export default function LoadMoreFeed({
    initialItems,
    initialCursor,
    feedType,
}: LoadMoreFeedProps) {
    const [items, setItems] = useState(initialItems);
    const [cursor, setCursor] = useState(initialCursor);
    const [isPending, startTransition] = useTransition();

    const loadMore = () => {
        if (!cursor) return;
        startTransition(async () => {
            const fetcher = feedType === "following" ? getFollowingFeed : getActivityFeed;
            const { items: newItems, nextCursor } = await fetcher(30, cursor);
            setItems((prev) => [...prev, ...newItems]);
            setCursor(nextCursor);
        });
    };

    return (
        <>
            <ActivityFeed items={items} />
            {cursor && (
                <div style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                    <button
                        className="btn btn-secondary"
                        onClick={loadMore}
                        disabled={isPending}
                    >
                        {isPending ? "Loading…" : "Load More"}
                    </button>
                </div>
            )}
        </>
    );
}
```

### Step 3: Update feed page

**File:** `src/app/feed/page.tsx`

Replace the direct `<ActivityFeed>` with `<LoadMoreFeed>`:

```tsx
const { items: feedItems, nextCursor } = activeTab === "following"
    ? await getFollowingFeed(30)
    : await getActivityFeed(30);

// ...
<LoadMoreFeed
    initialItems={feedItems}
    initialCursor={nextCursor}
    feedType={activeTab}
/>
```

### Step 4: Add pagination to Show Ring

**File:** `src/app/community/page.tsx`

Similar pattern — the current query fetches ALL public horses. Add:

```typescript
const PAGE_SIZE = 24;
// ... query with .range(0, PAGE_SIZE - 1) or .limit(PAGE_SIZE + 1)
```

Create a `LoadMoreShowRing` client component that calls a `getShowRingPage(cursor)` server action.

### Step 5: Add pagination to Discover

**File:** `src/app/discover/page.tsx`

The Discover page fetches ALL users, then filters client-side to "active" users. This is fine for <100 users but will break at scale. For now, it's acceptable — add pagination later when there are 50+ active users.

### CSS for Load More button:

```css
/* ===== Load More ===== */
.load-more-container {
    text-align: center;
    padding: var(--space-xl) 0;
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## ✅ Task PS-4: Admin Suggestions Panel — DONE

**Why:** Users can submit database suggestions (new molds, releases, resins) via the intake form. The server actions `getPendingSuggestions()` and `reviewSuggestion()` already exist but there's no admin UI to view and manage them.

**Time:** 2-3 hours

### Step 1: Add suggestions section to admin page

**File:** `src/app/admin/page.tsx`

Import the suggestion actions:

```typescript
import { getPendingSuggestions } from "@/app/actions/suggestions";
```

In the `AdminPage` function, fetch suggestions:

```typescript
const suggestions = await getPendingSuggestions();
```

Add a new section after the existing admin sections:

```tsx
{/* ═══ Database Suggestions ═══ */}
<section className="admin-section animate-fade-in-up">
    <h2>
        📋 <span className="text-gradient">Database Suggestions</span>
        {suggestions.length > 0 && (
            <span className="community-own-badge" style={{ marginLeft: "8px" }}>
                {suggestions.length} pending
            </span>
        )}
    </h2>

    {suggestions.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
            No pending suggestions. Users can submit new entries from the Add Horse form.
        </p>
    ) : (
        <div className="admin-suggestions-list">
            {suggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} />
            ))}
        </div>
    )}
</section>
```

### Step 2: Create SuggestionCard client component

**File:** `src/components/SuggestionCard.tsx` (NEW)

```tsx
"use client";

import { useState } from "react";
import { reviewSuggestion } from "@/app/actions/suggestions";
import { useRouter } from "next/navigation";

interface Suggestion {
    id: string;
    suggestion_type: "mold" | "release" | "resin";
    name: string;
    details: string | null;
    submitted_by: string;
    status: string;
    created_at: string;
}

export default function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
    const [adminNotes, setAdminNotes] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [handled, setHandled] = useState(false);
    const router = useRouter();

    const handleReview = async (status: "approved" | "rejected") => {
        setIsProcessing(true);
        await reviewSuggestion(suggestion.id, status, adminNotes || undefined);
        setHandled(true);
        setIsProcessing(false);
        router.refresh();
    };

    if (handled) {
        return (
            <div className="card" style={{ opacity: 0.5, padding: "var(--space-md)" }}>
                ✅ Handled
            </div>
        );
    }

    const typeEmoji = suggestion.suggestion_type === "mold" ? "🐴"
        : suggestion.suggestion_type === "resin" ? "🎨" : "📋";

    return (
        <div className="card" style={{ padding: "var(--space-md)", marginBottom: "var(--space-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)" }}>
                        {typeEmoji} {suggestion.suggestion_type.toUpperCase()} · {new Date(suggestion.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: "var(--font-size-md)", fontWeight: 600, marginBottom: "var(--space-xs)" }}>
                        {suggestion.name}
                    </div>
                    {suggestion.details && (
                        <div style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)" }}>
                            {suggestion.details}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: "var(--space-md)" }}>
                <input
                    className="form-input"
                    placeholder="Admin notes (optional)"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    style={{ marginBottom: "var(--space-sm)" }}
                />
                <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleReview("approved")}
                        disabled={isProcessing}
                    >
                        ✅ Approve
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleReview("rejected")}
                        disabled={isProcessing}
                    >
                        ❌ Reject
                    </button>
                </div>
            </div>
        </div>
    );
}
```

### Step 3: Fetch submitter alias for context

**File:** `src/app/actions/suggestions.ts`

Update `getPendingSuggestions` to join with users table:

```typescript
export async function getPendingSuggestions() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("database_suggestions")
        .select("*, users!submitted_by(alias_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return data || [];
}
```

Then in the SuggestionCard, show who submitted it.

### Step 4: Optional — Notification when suggestion is reviewed

When a suggestion is approved or rejected, the user who submitted it should get a notification. Add to `reviewSuggestion`:

```typescript
// After updating the suggestion status:
import { getAdminClient } from "@/lib/supabase/admin";

// Create a notification for the submitter
const supabaseAdmin = getAdminClient();
await supabaseAdmin.from("notifications").insert({
    user_id: suggestion.submitted_by,
    type: "suggestion_reviewed",
    title: `Your ${suggestion.suggestion_type} suggestion was ${status}`,
    body: adminNotes || null,
});
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task PS-5: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "polish: mobile responsive, pagination, admin suggestions, pwd reset" 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```

---

# ═══════════════════════════════════════
# CHECKLIST — SIGN-OFF
# ═══════════════════════════════════════

After completing all tasks, verify:

- [ ] PS-1: Mobile responsive breakpoints added (768px, 480px)
- [ ] PS-1: Header nav, dashboard, Show Ring, feed tested on mobile
- [ ] PS-2: NEXT_PUBLIC_SITE_URL verified in Vercel
- [ ] PS-2: Supabase redirect URLs include modelhorsehub.com
- [ ] PS-2: Forgot password flow tested end-to-end
- [ ] PS-3: Feed pagination with "Load More" working
- [ ] PS-3: Show Ring pagination with "Load More" working
- [ ] PS-4: Admin suggestions panel with approve/reject
- [ ] PS-5: All changes committed and pushed

Final build check:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```
