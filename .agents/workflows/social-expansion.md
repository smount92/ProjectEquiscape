---
description: Implement the Social Expansion — 9 features across 4 phases that transform Model Horse Hub into a social community platform
---

# Social Expansion — Implementation Workflow

> **Plan:** `06_social_expansion_plan.md` (in brain artifacts)
> **Scope:** 4 phases, 9 features, ~4 migrations, ~12 new components, ~4 new pages
> **Approach:** Each phase is a commit boundary. Complete one phase fully before moving to the next.

## Prerequisites
- User-to-User Ratings must be complete and committed
- Read the full plan first: `06_social_expansion_plan.md`
- Read developer conventions: `02_developer_conventions.md`

---

# ═══════════════════════════════════════
# PHASE 1: Quick Wins & Polish
# ═══════════════════════════════════════

> **Features:** Show Ring Filters, User Discovery, Horse of the Week
> **Effort:** Low-Medium
> **Commit message:** `feat: Social Expansion Phase 1 - Show Ring Filters, User Discovery, Horse of the Week`

## Step 1.0: Read the Plan

Read the full Social Expansion plan to understand context:

```
View: 06_social_expansion_plan.md (in brain artifacts directory)
```

Read the developer conventions:

```
View: 02_developer_conventions.md (in brain artifacts from conversation 2a3da000)
```

---

## Step 1.1: Database Migration (Phase 1)

Create `supabase/migrations/013_social_expansion_p1.sql`:

```sql
-- ============================================================
-- Migration 013: Social Expansion Phase 1 — Featured Horses
-- ============================================================

CREATE TABLE IF NOT EXISTS featured_horses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE featured_horses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured horses"
  ON featured_horses FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_featured_horses_date ON featured_horses (featured_at DESC);
CREATE INDEX idx_featured_horses_active ON featured_horses (expires_at) WHERE expires_at IS NULL OR expires_at > now();
```

Apply via Supabase SQL Editor.

---

## Step 1.2: TypeScript Types (Phase 1)

Update `src/lib/types/database.ts`:

1. Add `FeaturedHorse` interface:
```typescript
export interface FeaturedHorse {
  id: string;
  horse_id: string;
  title: string;
  description: string | null;
  featured_at: string;
  expires_at: string | null;
  created_by: string;
}
```

2. Add to `Database` interface:
```typescript
featured_horses: {
  Row: FeaturedHorse;
  Insert: Omit<FeaturedHorse, "id" | "featured_at"> & { id?: string; featured_at?: string };
  Update: Partial<Omit<FeaturedHorse, "id">>;
  Relationships: [];
};
```

---

## Step 1.3: Show Ring Filters

Create `src/components/ShowRingFilters.tsx`:
- Filter pills for finish type: All | OF | Custom | Artist Resin
- Dropdown for trade status: All | For Sale | Open to Offers
- Dropdown for manufacturer (extracted from data): All | Breyer | Peter Stone | etc.
- Sort selector: Newest | Oldest | Most Favorited

Modify `src/components/ShowRingGrid.tsx`:
- Import and render `ShowRingFilters` below the search bar
- Add filter state management (`useState<FilterState>`)
- Extend the `useMemo` filtering logic to apply structured filters IN ADDITION to text search
- Extract unique manufacturers from `communityCards` data to pass as options

Add CSS to `src/app/globals.css`:
- `.showring-filters` — flex container with gap and wrap
- `.filter-pill` — interactive pill button (transparent bg, border, hover glow)
- `.filter-pill-active` — highlighted active state (primary color bg)
- `.filter-dropdown` — styled select matching existing form inputs
- Responsive: stack filters vertically on mobile

---

## Step 1.4: User Discovery Page

Create `src/app/discover/page.tsx`:
- Server Component with metadata: `{ title: "Discover Collectors — Model Horse Hub" }`
- Query all users from `users` table
- Count public horses per user from `user_horses` WHERE `is_public = true`
- Fetch rating summaries per user from `user_ratings`
- Filter to only show users with at least 1 public horse
- Render as a grid of collector cards
- Import `RatingBadge` for each card
- Import a search bar component for client-side alias filtering

Create `src/components/CollectorCard.tsx` (or render inline):
- Avatar placeholder (SVG icon matching existing profile pattern)
- Alias name (linked to profile)
- Public model count
- Rating badge
- Member since date

Modify `src/components/Header.tsx`:
- Add `👥 Discover` nav link between Show Ring and Wishlist

Add `/discover` to middleware public paths if needed (or keep authenticated — recommend authenticated since RLS requires auth).

Add CSS: `.discover-grid`, `.discover-card`, `.discover-card-avatar`, `.discover-card-alias`, `.discover-card-stats`

---

## Step 1.5: Horse of the Week

Add `featureHorse` action to `src/app/actions/admin.ts`:
- Service Role insert into `featured_horses`
- Validate horse exists and is public

Modify `src/app/community/page.tsx`:
- Query `featured_horses` for most recent non-expired entry
- If found, fetch the horse details + signed image URL
- Render `FeaturedHorseCard` above the Show Ring grid

Create `src/components/FeaturedHorseCard.tsx`:
- Hero card with large image, title, description
- Link to the horse's passport
- Gold gradient border or shimmer effect

Modify `src/app/admin/page.tsx`:
- Add "Feature a Horse" section with horse ID input, title, description, optional expiry
- Submit calls `featureHorse` action

---

## Step 1.6: Verify & Commit Phase 1

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

Test:
1. Show Ring filters toggle and combine correctly
2. Discover page lists active collectors
3. Featured horse appears at top of Show Ring

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Social Expansion Phase 1 - Show Ring Filters, User Discovery, Horse of the Week"
```

---

# ═══════════════════════════════════════
# PHASE 2: Engagement Infrastructure
# ═══════════════════════════════════════

> **Features:** Notification Center, Transaction Completion Flow
> **Effort:** Medium
> **Commit message:** `feat: Social Expansion Phase 2 - Notification Center and Transaction Flow`

## Step 2.1: Database Migration (Phase 2)

Create `supabase/migrations/014_social_expansion_p2.sql` with:
- `notifications` table (full schema from plan)
- `ALTER TABLE conversations ADD COLUMN transaction_status`

Apply via Supabase SQL Editor.

## Step 2.2: TypeScript Types

Add `Notification` interface to `database.ts`.
Add `notification` table entry to `Database` interface.
Update `ConversationRow` types to include `transaction_status`.

## Step 2.3: Notification Server Actions

Create `src/app/actions/notifications.ts`:
- `getUnreadNotificationCount()` — for header bell
- `getNotifications(limit?)` — paginated list
- `markNotificationRead(id)` — single mark
- `markAllNotificationsRead()` — bulk mark
- `clearNotifications()` — delete all

Create internal helper (Service Role) for triggering notifications from other actions:
- `createNotification(userId, type, actorId, content, horseId?, conversationId?)` — used by other actions

## Step 2.4: Notification Triggers

Modify existing server actions to create notifications on success:
- `src/app/actions/social.ts` → `toggleFavorite`: notify horse owner on favorite
- `src/app/actions/social.ts` → `addComment`: notify horse owner on comment
- `src/app/actions/ratings.ts` → `leaveRating`: notify rated user
- `src/app/actions/admin.ts` → `featureHorse`: notify horse owner

Each trigger uses Service Role + fire-and-forget (try/catch, never fail the primary action).

## Step 2.5: NotificationBell Component

Create `src/components/NotificationBell.tsx`:
- Bell SVG icon with red badge (unread count)
- Client-side polling every 30 seconds (same pattern as header unread inbox count)
- Click navigates to `/notifications`

Modify `src/components/Header.tsx`:
- Add `NotificationBell` between Inbox and the nav links

## Step 2.6: Notifications Page

Create `src/app/notifications/page.tsx`:
- Server Component listing all notifications
- "Mark All Read" button
- Each notification links to relevant page

Create `src/components/NotificationList.tsx`:
- Renders notification items with icon, content, time, read/unread state
- Click marks as read and navigates

## Step 2.7: Transaction Flow

Add `markTransactionComplete` to `src/app/actions/messaging.ts`.

Create `src/components/TransactionActions.tsx`:
- "✅ Mark as Complete" button (both parties can mark)
- After completion: shows badge + "Rate this transaction" CTA

Modify `src/app/inbox/[id]/page.tsx`:
- Query `transaction_status` on the conversation
- Render `TransactionActions` above the rating section

Modify `src/app/profile/[alias_name]/page.tsx`:
- Count completed transactions for this user
- Display "X transactions completed" stat

## Step 2.8: Verify & Commit Phase 2

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Social Expansion Phase 2 - Notification Center and Transaction Flow"
```

---

# ═══════════════════════════════════════
# PHASE 3: Social Network Core
# ═══════════════════════════════════════

> **Features:** Follow System, Activity Feed
> **Effort:** High
> **Commit message:** `feat: Social Expansion Phase 3 - Follow System and Activity Feed`

## Step 3.1: Database Migration (Phase 3)

Create `supabase/migrations/015_social_expansion_p3.sql` with:
- `user_follows` table (full schema from plan)
- `activity_events` table (full schema from plan)

## Step 3.2: TypeScript Types

Add `UserFollow` and `ActivityEvent` interfaces.
Add both to `Database` interface.

## Step 3.3: Follow System

Add to `src/app/actions/social.ts`:
- `toggleFollow(followingId)` — insert/delete toggle
- `getFollowCounts(userId)` — follower/following counts

Create `src/components/FollowButton.tsx`:
- "Follow" / "Following ✓" toggle (optimistic update)
- Same pattern as `FavoriteButton`

Modify `src/app/profile/[alias_name]/page.tsx`:
- Fetch follow counts + isFollowing status
- Add follower/following counts to hero stats
- Add `FollowButton` (hidden on own profile)

Add notification trigger: when `toggleFollow` succeeds → create `follow` notification.

## Step 3.4: Activity Feed

Create activity event helper in `src/app/actions/social.ts`:
- `createActivityEvent(actorId, eventType, horseId?, targetId?, metadata?)` — Service Role insert

Wire into existing actions (add fire-and-forget calls):
- Making a horse public → `new_horse` event
- `toggleFavorite` → `favorite` event
- `addComment` → `comment` event
- `toggleFollow` → `follow` event
- `addShowRecord` → `show_record` event
- `leaveRating` → `rating` event

Create `src/app/feed/page.tsx`:
- Server Component querying `activity_events` with actor aliases
- "All" / "Following Only" toggle filter
- Paginated (limit 30, load more button)

Create `src/components/ActivityFeed.tsx` + `ActivityFeedItem.tsx`:
- Feed timeline with event icons, actor, action, target, timestamp
- Each item links to the relevant horse/profile

Modify `src/components/Header.tsx`:
- Add "📰 Feed" nav link

Add `/feed` to middleware if needed.

## Step 3.5: Verify & Commit Phase 3

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Social Expansion Phase 3 - Follow System and Activity Feed"
```

---

# ═══════════════════════════════════════
# PHASE 4: Premium Social
# ═══════════════════════════════════════

> **Features:** Collection Showcases, Virtual Photo Shows
> **Effort:** High
> **Commit message:** `feat: Social Expansion Phase 4 - Collection Showcases and Virtual Photo Shows`

## Step 4.1: Database Migration (Phase 4)

Create `supabase/migrations/016_social_expansion_p4.sql` with:
- `ALTER TABLE user_collections ADD COLUMN is_public BOOLEAN`
- `photo_shows` table
- `show_entries` table
- All RLS policies and indexes

## Step 4.2: Collection Showcases

Add `is_public` toggle to collection management.
Create public collection route: `/profile/[alias]/collection/[id]`.
Create `PublicGallery.tsx` component.
Show public collection links on profile pages.

## Step 4.3: Virtual Photo Shows

Create `src/app/shows/page.tsx` — Browse open shows.
Create `src/app/shows/[id]/page.tsx` — Show detail with entries grid.
Create `src/app/actions/shows.ts` — CRUD for shows + entries + voting.
Create `ShowEntryForm.tsx` and `PhotoShowCard.tsx` components.
Add show admin tools to the admin console.

## Step 4.4: Verify & Commit Phase 4

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Social Expansion Phase 4 - Collection Showcases and Virtual Photo Shows"
```

---

# ═══════════════════════════════════════
# FINAL: Documentation Update
# ═══════════════════════════════════════

After ALL phases are complete:

1. Update `00_master_architecture.md`:
   - Add all new tables to database schema
   - Add all new components to project structure
   - Add all new pages/routes
   - Mark "Social Expansion" as complete

2. Update `03_future_roadmap.md`:
   - Mark all 9 features as DONE
   - Add changelog entries for each phase

3. Mark `06_social_expansion_plan.md` as STATUS: COMPLETE
