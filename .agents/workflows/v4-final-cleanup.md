---
description: Final V2/V3 cleanup — N+1 aliasMap eradication across 7 action files and dead code removal. All FKs already deployed (migration 037). Server-side Show Ring search already done.
---

# V4 Final Cleanup — N+1 Eradication & Dead Code

> **Pre-requisite:** Migrations through 037 applied (FKs exist).
> **Build must be clean before starting.**
> **Estimated Effort:** ~2-3 hours

// turbo-all

---

## Task 1: Delete Dead `addHorseAction`

**File:** `src/app/actions/horse.ts`

Delete the entire `addHorseAction` function (starts around line 52, ~135 lines). It's been replaced by `createHorseRecord()` + `finalizeHorseImages()` and is no longer imported anywhere.

**Verify:** `npx next build` passes.

---

## Task 2: N+1 aliasMap Eradication

For each file below, the pattern is the same:
1. **Remove** the secondary query against `users` and the `aliasMap` construction
2. **Add** a PostgREST join in the primary `.select()` statement
3. **Update** the mapping to read from the nested join object

### Important Context

Migration 037 added FKs for: `activity_events.actor_id`, `notifications.actor_id`, `user_ratings.reviewer_id`, `horse_timeline.user_id`, `show_entries.user_id`.

Migration 031 already had FKs for: `groups.created_by`, `group_posts.user_id`, `group_post_replies.user_id`, `events.created_by`.

**The join syntax to use depends on the FK:**
- Named FK: `users!activity_events_actor_id_users_fkey(alias_name)` 
- Or shorthand if there's only ONE FK to `users` on the column: `users!actor_id(alias_name)`
- For tables that had the FK from creation (groups, events), the constraint name is the Postgres default: `tablename_colname_fkey`

**⚠️ CRITICAL:** `actor_id` can be NULL on some tables (notifications, activity_events). For nullable FKs, use a LEFT join approach. PostgREST returns `null` for the nested object when the FK is null — this is exactly what we want. Do NOT use `users!inner(...)` for nullable columns, as that would exclude rows where `actor_id IS NULL`.

---

### 2A: `src/app/actions/hoofprint.ts` — `getHoofprint()`

**Current (lines 48-71):** Fetches timeline, then does separate aliasMap query.

**Change the `.select()` on line 50:**
```typescript
// BEFORE
.select("id, event_type, title, description, event_date, metadata, is_public, created_at, user_id")

// AFTER  
.select("id, event_type, title, description, event_date, metadata, is_public, created_at, user_id, users!user_id(alias_name)")
```

**Delete the aliasMap block (lines 60-71).**

**Update the mapping (line 82):**
```typescript
// BEFORE
userAlias: aliasMap.get(e.user_id) || "Unknown",

// AFTER
userAlias: (e as any).users?.alias_name || "Unknown",
```

Update the type cast to include the joined field:
```typescript
const events = (rawTimeline ?? []) as {
    id: string; event_type: string; title: string; description: string | null;
    event_date: string | null; metadata: Record<string, unknown>; is_public: boolean;
    created_at: string; user_id: string;
    users: { alias_name: string } | null;
}[];
```

Then mapping becomes: `userAlias: e.users?.alias_name || "Unknown",`

**Verify:** `npx next build`

---

### 2B: `src/app/actions/shows.ts` — `getShowEntries()`

**Current (lines 114-151):** Fetches entries, then aliasMap for user_ids.

**Change the `.select()` on line 116:**
```typescript
// BEFORE
.select("id, horse_id, user_id, votes, created_at")

// AFTER
.select("id, horse_id, user_id, votes, created_at, users!user_id(alias_name)")
```

**Delete the aliasMap block (lines 141-151).**

**Update the type cast (line 120) to include the join:**
```typescript
const entryList = (rawEntries ?? []) as {
    id: string; horse_id: string; user_id: string; votes: number; created_at: string;
    users: { alias_name: string } | null;
}[];
```

**Update the mapping (line 191):**
```typescript
// BEFORE
ownerAlias: aliasMap.get(e.user_id) || "Unknown",

// AFTER
ownerAlias: e.users?.alias_name || "Unknown",
```

**Verify:** `npx next build`

---

### 2C: `src/app/actions/notifications.ts` — `getNotifications()`

**Current (lines 48-79):** Fetches notifications, then aliasMap for actor_ids.

**Note:** `actor_id` is NULLABLE — do NOT use `!inner`.

**Change the `.select()` on line 50:**
```typescript
// BEFORE
.select("id, type, content, actor_id, horse_id, conversation_id, is_read, created_at")

// AFTER
.select("id, type, content, actor_id, horse_id, conversation_id, is_read, created_at, users!actor_id(alias_name)")
```

**Delete the aliasMap block (lines 68-79).**

**Update the type cast (line 55) to include the join:**
```typescript
const notifs = (rawNotifs ?? []) as {
    id: string; type: string; content: string | null;
    actor_id: string | null; horse_id: string | null;
    conversation_id: string | null; is_read: boolean; created_at: string;
    users: { alias_name: string } | null;
}[];
```

**Update the mapping (line 85):**
```typescript
// BEFORE
actorAlias: n.actor_id ? aliasMap.get(n.actor_id) || null : null,

// AFTER
actorAlias: n.users?.alias_name || null,
```

**Verify:** `npx next build`

---

### 2D: `src/app/actions/ratings.ts` — `getUserRatingSummary()`

**Current (lines 100-129):** Fetches ratings, then aliasMap for reviewer_ids.

**Change the `.select()` on line 102:**
```typescript
// BEFORE
.select("id, stars, review_text, created_at, reviewer_id")

// AFTER
.select("id, stars, review_text, created_at, reviewer_id, users!reviewer_id(alias_name)")
```

**Delete the aliasMap block (lines 118-129).**

**Update the type cast (line 106):**
```typescript
const ratings = (rawRatings ?? []) as {
    id: string; stars: number; review_text: string | null;
    created_at: string; reviewer_id: string;
    users: { alias_name: string } | null;
}[];
```

**Update the mapping (line 141):**
```typescript
// BEFORE
reviewerAlias: aliasMap.get(r.reviewer_id) ?? "Unknown",

// AFTER
reviewerAlias: r.users?.alias_name || "Unknown",
```

**Verify:** `npx next build`

---

### 2E: `src/app/actions/activity.ts` — `getActivityFeed()` and `getFollowingFeed()`

This file has **2 aliasMap patterns** but they're trickier: the primary query is on `activity_events` which already has a FK to `users` via `actor_id`.

**For `getActivityFeed()` (line 79):**
```typescript
// BEFORE
.select("id, actor_id, event_type, horse_id, metadata, created_at")

// AFTER
.select("id, actor_id, event_type, horse_id, metadata, created_at, users!actor_id(alias_name)")
```

**Delete the aliasMap block (lines 103-114).**

**Update the type cast (line 89) to include join:**
```typescript
const allItems = (events ?? []) as {
    id: string; actor_id: string; event_type: string;
    horse_id: string | null; metadata: Record<string, unknown> | null;
    created_at: string;
    users: { alias_name: string } | null;
}[];
```

**Update mapping (line 156):**
```typescript
actorAlias: e.users?.alias_name || "Unknown",
```

**Repeat the same pattern for `getFollowingFeed()` (line 195).**

Same `.select()` change, delete aliasMap block (lines 220-229), update type cast, update mapping (line 271).

**Verify:** `npx next build`

---

### 2F: `src/app/actions/events.ts` — `getEventsForPage()` or equivalent

**Find the function that uses aliasMap (around line 136).** The FK exists: `events.created_by REFERENCES users(id)` from migration 031.

**Change the `.select()` to add the join:**
```typescript
// Add to the select: users!created_by(alias_name)
```

**Delete the aliasMap block (lines 136-137 and secondary query).**

**Update mapping:**
```typescript
creatorAlias: e.users?.alias_name || "Unknown",
```

Where `e.users` comes from the join on `created_by`. **If PostgREST needs the FK constraint name** because there are multiple FKs from `events` to `users`, use: `users!events_created_by_fkey(alias_name)`.

**Verify:** `npx next build`

---

### 2G: `src/app/actions/groups.ts` — 3 aliasMap patterns

This file has the most complex aliasMap usage (lines 208-209, 405-406, 436). Three separate functions.

**Pattern 1 (~line 208):** Group listing — `created_by` join
```typescript
// Add to group query select: users!created_by(alias_name)
// Delete aliasMap construction  
// Map: creatorAlias: g.users?.alias_name || "Unknown"
```

**Pattern 2 (~line 405):** Group posts — `user_id` join
```typescript
// Add to group_posts query select: users!user_id(alias_name)
// Delete aliasMap construction
// Map: userAlias: p.users?.alias_name || "Unknown"
```

**Pattern 3 (~line 436):** Post replies — `user_id` join
```typescript
// Add to group_post_replies query select: users!user_id(alias_name)
// Delete replyUsers aliasMap construction
// Map: userAlias: r.users?.alias_name || "Unknown"
```

**Verify:** `npx next build`

---

## Completion Checklist

After all tasks:

- [ ] `npx next build` — 0 TypeScript errors
- [ ] Dead `addHorseAction` removed from `horse.ts`
- [ ] aliasMap eliminated from `hoofprint.ts`
- [ ] aliasMap eliminated from `shows.ts`
- [ ] aliasMap eliminated from `notifications.ts`
- [ ] aliasMap eliminated from `ratings.ts`
- [ ] aliasMap eliminated from `activity.ts` (both functions)
- [ ] aliasMap eliminated from `events.ts`
- [ ] aliasMap eliminated from `groups.ts` (all 3 patterns)
- [ ] `grep -r "aliasMap" src/app/actions/` returns 0 results

**After this workflow completes, the V2/V3 refactor sprints are fully done. Feature freeze can be lifted.**
