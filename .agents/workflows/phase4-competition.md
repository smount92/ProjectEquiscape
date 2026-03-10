---
description: Phase 4 — Competition Engine & Community. Verified Judge Roles, NAN Tracker, Show String Planner, Groups & Events, PWA/Offline Show Mode.
---

# Phase 4: Competition Engine & Community

> **Goal:** Digitize the paper-based competitive showing world — NAN cards in binders become searchable, transferable digital records. Build group infrastructure for clubs and circuits.
> **Pre-requisites:** Phase 1 ✅, Phase 2 ✅, Phase 3 ✅ must be complete. Build must be clean.

// turbo-all

---

## Feature 4A: Verified Judge Roles & Enhanced Show Records

### Task 4A-1: Database Migration — `030_competition_engine.sql`

Create `supabase/migrations/030_competition_engine.sql`:

```sql
-- ============================================================
-- Migration 030: Competition Engine — Judge Roles, NAN Tracking,
--                Show String Planner, Enhanced Show Records
-- ============================================================

-- ── 1. User Roles ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'judge', 'admin'));

COMMENT ON COLUMN users.role IS 'User role for platform-level permissions. Judges can verify show records.';

-- ── 2. Enhanced Show Records ──
-- Add columns for NAN tracking and verification
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS show_type TEXT DEFAULT 'photo_other'
  CHECK (show_type IN (
    'live_namhsa', 'live_regional', 'photo_mepsa',
    'photo_mhh', 'photo_other', 'virtual_other'
  ));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS total_entries INTEGER;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS nan_card_type TEXT
  CHECK (nan_card_type IN ('green', 'yellow', 'pink', NULL));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS nan_year INTEGER;
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'self_reported'
  CHECK (verification_tier IN ('self_reported', 'host_verified', 'mhh_auto'));
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE show_records ADD COLUMN IF NOT EXISTS judge_critique TEXT;

-- NAN qualification index
CREATE INDEX IF NOT EXISTS idx_show_records_nan
  ON show_records (horse_id, nan_year, nan_card_type)
  WHERE is_nan_qualifying = true;

-- ── 3. Show String Planner ──
CREATE TABLE IF NOT EXISTS show_strings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  show_date   DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE show_strings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own show strings"
  ON show_strings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner creates show strings"
  ON show_strings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner updates own show strings"
  ON show_strings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner deletes own show strings"
  ON show_strings FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS show_string_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_string_id  UUID NOT NULL REFERENCES show_strings(id) ON DELETE CASCADE,
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  class_name      TEXT NOT NULL,
  division        TEXT,
  time_slot       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE show_string_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entries follow show string ownership"
  ON show_string_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner adds entries"
  ON show_string_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner updates entries"
  ON show_string_entries FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Owner deletes entries"
  ON show_string_entries FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM show_strings s
    WHERE s.id = show_string_entries.show_string_id
      AND s.user_id = (SELECT auth.uid())
  ));

CREATE INDEX idx_show_strings_user ON show_strings (user_id);
CREATE INDEX idx_show_string_entries_string ON show_string_entries (show_string_id);
CREATE INDEX idx_show_string_entries_horse ON show_string_entries (horse_id);

-- ── 4. Enhanced Shows (NAN sanctioning + judge critiques) ──
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS judge_critique TEXT;
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS judge_score DECIMAL(5,2);
ALTER TABLE show_entries ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT 'General';
```

**IMPORTANT:** FK references use `users(id)` (public table). Use `(SELECT auth.uid())` in all RLS policies for performance.

**Present SQL to user for approval.**

---

### Task 4A-2: Server Actions — `src/app/actions/competition.ts`

Create `src/app/actions/competition.ts`:

**Actions:**

1. `getNanQualifications(horseId: string)` — Get all NAN-qualifying records for a horse, grouped by year and card type
2. `getNanDashboard()` — Get NAN qualification summary across all user's horses
3. `addShowRecord(data: {...})` — Enhanced version with NAN fields
4. `verifyShowRecord(recordId: string, note?: string)` — Judge/admin only: mark record as `host_verified`
5. `getShowStrings()` — Get all user's show strings
6. `createShowString(data: {...})` — Create a new show string
7. `addShowStringEntry(data: {...})` — Add a horse + class to a show string
8. `removeShowStringEntry(entryId: string)` — Remove entry
9. `convertShowStringToResults(showStringId: string, results: {...}[])` — After show, convert entries into `show_records` with placings + NAN info
10. `detectConflicts(showStringId: string)` — Check for time slot conflicts and duplicate class entries

**Judge verification rules (enforce server-side):**
- Only users with `role = 'judge'` or `role = 'admin'` can set `verification_tier = 'host_verified'`
- Only `mhh_auto` is set by the system when MHH-hosted show results are imported

---

### Task 4A-3: NAN Dashboard Widget — Dashboard Component

Add to the main dashboard:

```
🏆 NAN 2026 Qualification Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7 horses qualified across 12 divisions

🟢 Midnight Dream — Arabian Stallion (Breed), Acrylics Custom (Work.)
🟢 Prairie Rose — QH Mare (Breed), Bay (Color)
🟡 Kronos — Warmblood Stallion (Breed) — needs 1 more for Color
🔴 On the Fritz — No qualifications yet

[📋 View Full NAN Planner]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Green dot = fully qualified in that division
- Yellow dot = partially qualified (has 1+ card but not enough)
- Red dot = no cards yet
- Collapsible by default, expandable

---

### Task 4A-4: Show String Planner Page — `src/app/shows/planner/page.tsx`

- **Route:** `/shows/planner`
- **List view:** All show strings, sorted by date
- **Create new:** Name, date, optional notes
- **Plan view:** Click into a show string to manage entries
  - Drag horses from stable into class slots
  - Set division, time slot, notes per entry
  - **Conflict detection:** Warn if same horse in overlapping time slots or conflicting classes
- **After show mode:** Button toggles to "Enter Results" mode where each entry gets placing + total entries fields
- **Print packing list:** Generate a printable list of horses + classes

---

### Task 4A-5: Enhanced Show Record Display — Passport Integration

On the horse passport (`/community/[id]`), update the show records section:

- Display verification badge:
  - Gray badge = `self_reported`
  - Gold "MHH Verified" badge = `host_verified` or `mhh_auto`
- Group NAN-qualifying results with card type color:
  - 🟢 Green card (Breed)
  - 🟡 Yellow card (Color/Gender)
  - 🩷 Pink card (Performance)
- Show judge critique (expandable)

---

## Feature 4B: Groups & Events

### Task 4B-1: Database Migration — `031_groups_events.sql`

Create `supabase/migrations/031_groups_events.sql`:

```sql
-- ============================================================
-- Migration 031: Groups & Events
-- ============================================================

-- ── Groups ──
CREATE TABLE IF NOT EXISTS groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  group_type      TEXT NOT NULL CHECK (group_type IN (
    'regional_club', 'breed_interest', 'scale_interest',
    'show_circuit', 'artist_collective', 'general'
  )),
  region          TEXT,
  visibility      TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'restricted', 'private')),
  banner_url      TEXT,
  icon_url        TEXT,
  member_count    INTEGER DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Public/restricted groups visible to all; private only to members
CREATE POLICY "groups_select"
  ON groups FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'restricted')
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = groups.id AND gm.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "groups_insert"
  ON groups FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "groups_update"
  ON groups FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
  ));

CREATE INDEX idx_groups_slug ON groups (slug);
CREATE INDEX idx_groups_type ON groups (group_type);

-- ── Group Memberships ──
CREATE TABLE IF NOT EXISTS group_memberships (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'judge', 'member')),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membership_select"
  ON group_memberships FOR SELECT TO authenticated
  USING (true);  -- Anyone can see who's in a public group
CREATE POLICY "membership_insert"
  ON group_memberships FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "membership_delete_self"
  ON group_memberships FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
-- Admin kick handled via admin action with service role

CREATE INDEX idx_group_memberships_user ON group_memberships (user_id);

-- ── Group Posts ──
CREATE TABLE IF NOT EXISTS group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  horse_id    UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  image_urls  TEXT[] DEFAULT '{}',
  is_pinned   BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_posts_select"
  ON group_posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = group_posts.group_id
      AND gm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "group_posts_insert"
  ON group_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "group_posts_delete"
  ON group_posts FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE INDEX idx_group_posts ON group_posts (group_id, created_at DESC);

-- ── Group Post Replies ──
CREATE TABLE IF NOT EXISTS group_post_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_post_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies_select"
  ON group_post_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_posts gp
    JOIN group_memberships gm ON gm.group_id = gp.group_id
    WHERE gp.id = group_post_replies.post_id
      AND gm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "replies_insert"
  ON group_post_replies FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "replies_delete"
  ON group_post_replies FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX idx_group_post_replies ON group_post_replies (post_id, created_at);

-- ── Events ──
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'live_show', 'photo_show', 'swap_meet', 'meetup',
    'breyerfest', 'studio_opening', 'auction', 'workshop', 'other'
  )),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  timezone        TEXT DEFAULT 'America/New_York',
  is_all_day      BOOLEAN DEFAULT false,
  is_virtual      BOOLEAN DEFAULT false,
  location_name   TEXT,
  location_address TEXT,
  region          TEXT,
  virtual_url     TEXT,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  show_id         UUID REFERENCES photo_shows(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  is_official     BOOLEAN DEFAULT false,
  rsvp_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select"
  ON events FOR SELECT TO authenticated
  USING (true);  -- All events are publicly discoverable
CREATE POLICY "events_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "events_update"
  ON events FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = created_by);
CREATE POLICY "events_delete"
  ON events FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = created_by);

CREATE INDEX idx_events_date ON events (starts_at);
CREATE INDEX idx_events_group ON events (group_id) WHERE group_id IS NOT NULL;

-- ── Event RSVPs ──
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'going'
    CHECK (status IN ('going', 'interested', 'not_going')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsvps_select"
  ON event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "rsvps_insert"
  ON event_rsvps FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "rsvps_update"
  ON event_rsvps FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "rsvps_delete"
  ON event_rsvps FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── Link shows to groups ──
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
```

**All FK references use `users(id)` (public table).** Present SQL to user for approval.

---

### Task 4B-2: Server Actions — `src/app/actions/groups.ts` and `src/app/actions/events.ts`

**Groups actions:**
1. `createGroup(data)` — Create group, auto-add creator as `owner`
2. `getGroup(slug)` — Get group by slug with member count
3. `getGroups()` — Browse/search groups
4. `joinGroup(groupId)` — Join a public group (restricted = pending approval)
5. `leaveGroup(groupId)` — Leave group
6. `createGroupPost(groupId, content, horseId?, images?)` — Post in group
7. `getGroupPosts(groupId)` — Get group feed
8. `replyToPost(postId, content)` — Reply to a post
9. `getMyGroups()` — Groups the user belongs to

**Events actions:**
1. `createEvent(data)` — Create event (optionally linked to group)
2. `getEvents(filters?)` — Browse events with date/type/region filters
3. `getEvent(eventId)` — Get single event with RSVP counts
4. `rsvpEvent(eventId, status)` — Set RSVP status
5. `getUpcomingEvents()` — Dashboard widget: next 5 events the user has RSVP'd to

---

### Task 4B-3: Groups Pages

1. **Browse Groups:** `/community/groups` — Grid of group cards, filterable by type/region
2. **Group Detail:** `/community/groups/[slug]` — Banner, description, member list, feed, events, hosted shows
3. **Create Group:** `/community/groups/create` — Form with name, slug, type, visibility, description, banner

---

### Task 4B-4: Events Pages

1. **Event Calendar:** `/community/events` — Calendar view + list view toggle. Filter by type, region, date range
2. **Event Detail:** `/community/events/[id]` — Description, location/virtual link, RSVP button, attendee list
3. **Create Event:** `/community/events/create` — Form with all event fields, optional group link

---

## Feature 4C: Show String Planner UI

### Task 4C-1: Show String Planner — `src/app/shows/planner/page.tsx`

Already covered in Task 4A-4 above.

### Task 4C-2: Results Entry + Auto-Import

After a show:
1. "Enter Results" mode on the show string
2. For each entry: placing, total_entries, NAN card earned (checkbox + type)
3. On save: Creates `show_records` for each entry
4. If the show is an MHH-hosted photo show, auto-import results using `mhh_auto` verification tier

---

## Feature 4D: PWA & Offline Show Mode (Stretch)

> This is a stretch goal. Only implement if time allows.

### Task 4D-1: PWA Setup

1. Install `@serwist/next` and `idb-keyval`
2. Create PWA manifest at `public/manifest.json`
3. Configure service worker via serwist

### Task 4D-2: Offline Show String

1. "Make Available Offline" toggle on show string detail
2. Fetches show string JSON + horse thumbnails → IndexedDB
3. Offline results entry form stores mutations in IndexedDB queue
4. `window.addEventListener('online')` auto-flushes queue to Supabase

---

## Feature 4E: Navigation & CSS

### Task 4E-1: Navigation

- Add "🏛️ Groups" link to header nav
- Add "📅 Events" link to header nav
- Add "🏆 NAN Tracker" link to shows section or user dropdown
- Add "📋 Show Planner" link to shows section

### Task 4E-2: CSS

- Group cards, banners, membership badges
- Event cards, calendar grid, RSVP buttons
- NAN dashboard widget (traffic light colors)
- Show string planner (drag-drop zones, conflict warnings)
- Verification badges (gray = self-reported, gold = verified)
- NAN card type colors (green, yellow, pink)

---

## Verification Checklist

1. `npm run build` — zero errors
2. Run migration 030 + 031 in Supabase
3. Test show record with NAN fields
4. Test NAN dashboard widget
5. Test show string planner creation + entry
6. Test show string → results conversion
7. Test group creation + join + post
8. Test event creation + RSVP
9. Verify RLS: members see group posts, non-members don't (for private groups)
10. Git commit: `feat: Phase 4 — Competition Engine & Community (NAN, Groups, Events)`
11. Push to main

---

## ⚠️ Common Pitfalls

1. **FK references:** Use `users(id)`, not `auth.users(id)`. All table FKs in this migration must follow this rule.
2. **RLS performance:** Use `(SELECT auth.uid())` not `auth.uid()` in all policies.
3. **Group RLS:** Private group posts must NOT be visible to non-members. Test this explicitly.
4. **NAN cards transfer with horse:** When a horse is transferred via Hoofprint, show records (and NAN cards) stay with the horse. This already works because show_records are linked by `horse_id`, and the 027 migration fixed the SELECT policy.
5. **Photo limits on upload only:** Never limit image display count.
6. **revalidatePath:** Call after every mutation.
