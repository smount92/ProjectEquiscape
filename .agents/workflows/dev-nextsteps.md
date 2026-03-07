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

# 🔴 Priority: High

## Task A: Wire Activity Events into Missing Actions

**Problem:** Activity feed events only fire for favorites and comments. Follows, ratings, show records, and pedigrees are invisible in the feed.

**Files to modify:**

### A1. `src/app/actions/ratings.ts` — Add activity event on rating

Add import at top:
```typescript
import { createActivityEvent } from "@/app/actions/activity";
```

After the `createNotification` call in `leaveRating` (around line 49), add:
```typescript
createActivityEvent({
    actorId: user.id,
    eventType: "rating",
    metadata: { stars: data.stars, targetAlias: alias },
});
```

### A2. `src/app/actions/follows.ts` — Add activity event on follow

Add import at top:
```typescript
import { createActivityEvent } from "@/app/actions/activity";
```

After the `createNotification` call in `toggleFollow` (around line 60), add:
```typescript
createActivityEvent({
    actorId: user.id,
    eventType: "follow",
    targetId: targetUserId,
    metadata: { targetAlias: alias },
});
```

### A3. `src/app/actions/provenance.ts` — Add activity event on show record

Add import at top:
```typescript
import { createActivityEvent } from "@/app/actions/activity";
```

After successful insert in `addShowRecord`, add:
```typescript
createActivityEvent({
    actorId: user.id,
    eventType: "show_record",
    horseId: data.horseId,
    metadata: { showName: data.showName, placing: data.placing || null },
});
```

### A4. Update `src/components/ActivityFeed.tsx` — Handle new event types

Verify the `ActivityFeed` component correctly renders the new event types (`rating`, `follow`, `show_record`). Check if there's a switch/map for event type icons and labels. If needed, add:
- `rating` → "⭐ left a rating"
- `follow` → "👥 followed"
- `show_record` → "🏆 added a show record for"

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task B: Build Collection Showcases UI

**Problem:** Migration 016 added `is_public` column to `user_collections`, but there's no UI to toggle it or view public collections.

### B1. Add toggle to collection creation/editing

Find where collections are created or edited (likely in the dashboard or a modal). Add an `is_public` boolean toggle (checkbox or switch) that maps to the `is_public` column.

Check these files for collection management UI:
- `src/app/dashboard/page.tsx` — May have collection creation
- `src/components/` — Look for any collection-related components

### B2. Show public collections on profile page

**File:** `src/app/profile/[alias_name]/page.tsx`

Query public collections for this user:
```typescript
const { data: publicCollections } = await supabase
    .from("user_collections")
    .select("id, name")
    .eq("user_id", profileUser.id)
    .eq("is_public", true);
```

Display them as a row of pills/badges linking to the collection view:
```tsx
{publicCollections && publicCollections.length > 0 && (
    <div className="profile-collections">
        <h3>📁 Public Collections</h3>
        {publicCollections.map((col) => (
            <Link key={col.id} href={`/stable/collection/${col.id}`} className="collection-pill">
                {col.name}
            </Link>
        ))}
    </div>
)}
```

Note: The existing `/stable/collection/[id]` route already exists — verify it works for non-owner access (RLS may need checking).

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## Task C: Optimize Discover Page N+1 Queries

**Problem:** The Discover page calls `getUserRatingSummary()` serially for each user — one DB round-trip per user.

**File:** `src/app/discover/page.tsx`

**Fix:** Replace the N+1 loop with a single batch query:

```typescript
// Instead of:
// for (const u of activeUsers) { await getUserRatingSummary(u.id); }

// Do:
const activeUserIds = activeUsers.map((u) => u.id);
const { data: allRatings } = await supabase
    .from("user_ratings")
    .select("reviewed_id, stars")
    .in("reviewed_id", activeUserIds);

const ratingMap = new Map<string, { sum: number; count: number }>();
(allRatings ?? []).forEach((r: { reviewed_id: string; stars: number }) => {
    const existing = ratingMap.get(r.reviewed_id) || { sum: 0, count: 0 };
    existing.sum += r.stars;
    existing.count += 1;
    ratingMap.set(r.reviewed_id, existing);
});

// Then in the render, use:
// const rating = ratingMap.get(u.id);
// average = rating ? Math.round((rating.sum / rating.count) * 10) / 10 : 0;
```

Remove the `getUserRatingSummary` import if no longer needed.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task D: Add "New Horse" Activity Event

**Problem:** When a user makes a horse public (during add or edit), no activity event is created. New horses should appear in the feed.

**Files to check:** `src/app/add-horse/page.tsx` and `src/app/stable/[id]/edit/page.tsx`

Look for where `is_public: true` is set during insert/update. After the successful insert/update, add:
```typescript
if (isPublic) {
    const { createActivityEvent } = await import("@/app/actions/activity");
    createActivityEvent({
        actorId: user.id,
        eventType: "new_horse",
        horseId: insertedHorseId,
        metadata: { horseName: customName, finishType },
    });
}
```

Note: The add-horse and edit pages may be client components with server actions. In that case, create a new server action like `notifyHorsePublic(horseId)` that does the activity event creation.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟢 Priority: Nice-to-Have

## Task E: Add `/discover` and `/feed` and `/shows` to Middleware Public Paths

**Problem:** These routes require auth (which is correct), but they should be explicitly documented in the middleware's public paths config if we ever want to make them viewable without login.

**Status:** Currently fine — all social features require login. Skip this task unless the decision changes.

---

## Task F: Documentation Update

After all tasks above are done, update the architecture docs:

1. Copy `00_master_architecture.md` from a previous brain directory and update:
   - Add 7 new tables to the database schema section
   - Add all new components (~12) to the component list
   - Add new routes: `/discover`, `/feed`, `/shows`, `/shows/[id]`, `/notifications`
   - Add new action files: `activity.ts`, `follows.ts`, `notifications.ts`, `shows.ts`
   - Mark "Social Expansion" as DONE

2. Update `03_future_roadmap.md` in the current conversation's brain directory:
   - Mark all 4 phases as DONE
   - Note Collection Showcases as partial (schema + toggle, pending full gallery)

### Commit:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m \"fix: wire missing activity events + collection showcase UI + discover optimization\" 2>&1"
```

---

# 📝 Completed Tasks

<!-- Move completed tasks here with their completion date -->
<!-- Example:
## ✅ Task X: Description (completed 2026-03-07)
-->
