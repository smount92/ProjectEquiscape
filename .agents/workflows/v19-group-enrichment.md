---
description: V19 Group Enrichment — Group Files/Docs, Admin Moderation Panel, Pinned Posts, Sub-Channels. Completes v17 Blueprint Epic 5. 3 tasks across schema, server actions, and UI.
---

# V19: Group Enrichment

> **Master Blueprint:** `docs/v17_master_blueprint.md` — Epic 5
> **Pre-requisites:** V18 Pro Dashboard UI/UX Overhaul complete.
> **Goal:** Transform Groups from a simple chat feed into functional community hubs with documents, moderation, and organization.
> **Scope:** 3 features (Group Files, Admin Tools, Sub-Channels) + 1 polish item (Pinned Posts UI).

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. Run `npx next build` after every task
> 4. Group Registries already exist (`GroupRegistry.tsx`) — don't duplicate that work.

---

## Existing Infrastructure (Do Not Rebuild)

| Table | Key Columns | Status |
|---|---|---|
| `groups` | `id, name, slug, group_type, visibility, created_by` | ✅ Exists (031) |
| `group_memberships` | `group_id, user_id, role` (owner/admin/moderator/judge/member) | ✅ Exists (031) |
| `posts` (universal) | `id, group_id, is_pinned, author_id, content` | ✅ Exists (042) |
| `group_registries` + `registry_entries` | from V17 | ✅ Exists (057) |

| Server Action | Location | Status |
|---|---|---|
| `getGroup(slug)` → returns `memberRole` | `groups.ts:116` | ✅ Exists |
| `joinGroup(groupId)` | `groups.ts:237` | ✅ Exists |
| `leaveGroup(groupId)` | `groups.ts:268` | ✅ Exists |
| `createPost({ groupId, ... })` | `posts.ts:31` | ✅ Exists |
| `deletePost(postId)` | `posts.ts:113` | ✅ Exists |

| RLS | Status |
|---|---|
| Admins/mods can delete any group post | ✅ Policy exists (031:169-179) |
| Only owner/admin can update group settings | ✅ Policy exists (031:131-138) |

---

## Task 1 — Group Files & Documents

**Goal:** Admin/mods can upload PDFs and documents to a group. Members can view/download them.

### Step 1: Migration (`058_group_enrichment.sql`)

```sql
-- ══════════════════════════════════════════════════════════════
-- TASK 1: GROUP FILES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name   TEXT NOT NULL,
    file_url    TEXT NOT NULL,        -- Supabase Storage path
    file_size   INTEGER,              -- bytes
    file_type   TEXT DEFAULT 'pdf',   -- pdf, image, doc, etc.
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE group_files ENABLE ROW LEVEL SECURITY;

-- Members can view group files
CREATE POLICY "group_files_select" ON group_files
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_files.group_id
        AND gm.user_id = (SELECT auth.uid())
    ));

-- Only admin/owner/moderator can insert files
CREATE POLICY "group_files_insert" ON group_files
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = uploaded_by
        AND EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_files.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin', 'moderator')
        )
    );

-- Only admin/owner can delete files
CREATE POLICY "group_files_delete" ON group_files
    FOR DELETE TO authenticated
    USING (
        (SELECT auth.uid()) = uploaded_by
        OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_files.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    );

CREATE INDEX idx_group_files_group ON group_files(group_id, created_at DESC);
```

### Step 2: Supabase Storage bucket

Create a `group-files` storage bucket (or reuse existing). Files should be stored at:
`group-files/{group_id}/{uuid}-{filename}`

### Step 3: Server actions

**File:** `src/app/actions/groups.ts` — add at the bottom:

```typescript
// ── Group Files ──

export interface GroupFile {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    fileType: string;
    description: string | null;
    uploadedBy: string;
    uploaderAlias: string;
    createdAt: string;
}

export async function getGroupFiles(groupId: string): Promise<GroupFile[]>
// Query group_files joined with users for alias, ordered by created_at DESC

export async function uploadGroupFile(
    groupId: string,
    filePath: string,      // already uploaded to storage
    fileName: string,
    fileSize: number,
    description?: string
): Promise<{ success: boolean; error?: string }>
// Verify user is admin/owner/mod, insert into group_files

export async function deleteGroupFile(
    fileId: string
): Promise<{ success: boolean; error?: string }>
// Verify ownership or admin role, delete from table + storage
```

### Step 4: UI — Files Tab

**File:** `src/components/GroupFiles.tsx`

A "use client" component rendered in the group detail page. Shows a list of uploaded files with:
- File name + icon (📄 PDF, 🖼️ Image, 📎 Other)
- Description (if any)
- Uploaded by @alias, 3 days ago
- Download button (opens signed URL)
- Delete button (admin/owner only)
- Upload button (admin/owner/mod only) — opens a file picker, uploads to storage, then calls `uploadGroupFile`

**File:** `src/app/community/groups/[slug]/page.tsx`

Add a tab system or section divider:
```tsx
{/* Tabs: Feed | Files | Registry */}
<div className="group-tabs">
    <button className={activeTab === "feed" ? "active" : ""}>💬 Feed</button>
    <button className={activeTab === "files" ? "active" : ""}>📁 Files</button>
    <button className={activeTab === "registry" ? "active" : ""}>📋 Registry</button>
</div>
```

---

## Task 2 — Admin Moderation Panel

**Goal:** Group owners/admins get a management interface to handle members, moderate posts, and pin announcements.

### Step 1: Server actions

**File:** `src/app/actions/groups.ts`

```typescript
// ── Member Management ──

export interface GroupMember {
    userId: string;
    alias: string;
    role: string;
    joinedAt: string;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]>
// List all members with roles, ordered by role priority then joined_at

export async function updateMemberRole(
    groupId: string,
    targetUserId: string,
    newRole: 'admin' | 'moderator' | 'member'
): Promise<{ success: boolean; error?: string }>
// Only owner can promote/demote. Cannot change own role. Cannot set to 'owner'.

export async function removeMember(
    groupId: string,
    targetUserId: string
): Promise<{ success: boolean; error?: string }>
// Owner/admin can remove members. Cannot remove yourself (use leaveGroup).
// Cannot remove someone of equal or higher role.

export async function togglePinPost(
    postId: string
): Promise<{ success: boolean; error?: string }>
// Toggle is_pinned on the post. Must be admin/owner/moderator of the post's group.
```

### Step 2: RLS for member removal

The existing `membership_delete_self` policy only allows users to delete their OWN membership. We need to allow admins/owners to remove others:

```sql
-- In migration 058:
CREATE POLICY "membership_delete_admin" ON group_memberships
    FOR DELETE TO authenticated
    USING (
        -- Self-removal (existing)
        (SELECT auth.uid()) = user_id
        -- OR admin/owner removing a member
        OR EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = group_memberships.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.role IN ('owner', 'admin')
        )
    );
```

> ⚠️ Drop the old `membership_delete_self` policy before creating this replacement.

### Step 3: UI — Admin Panel

**File:** `src/components/GroupAdminPanel.tsx`

Only visible to users with `memberRole` of `owner` or `admin`.

```
┌────────────────────────────────────────────────────┐
│  ⚙️ Group Admin Panel                              │
│  ──────────────────────────────────────────────────│
│  👥 Members (23)                                   │
│  ──────────────────────────────────────────────────│
│  @StarBreyer     │ Owner   │                       │
│  @ModelMaven     │ Admin   │ [Demote ▾] [Remove]   │
│  @BreyerBabe     │ Member  │ [Promote ▾] [Remove]  │
│  @ResinsRUs      │ Member  │ [Promote ▾] [Remove]  │
│  ──────────────────────────────────────────────────│
│  📌 Pinned Posts                                   │
│  - "Welcome to the group!" — pin/unpin             │
│  ──────────────────────────────────────────────────│
│  🗑️ Manage                                         │
│  [Delete Group] (owner only, confirmation modal)   │
└────────────────────────────────────────────────────┘
```

### Step 4: Pin Posts integration

In `UniversalFeed.tsx` or the group page:
- Pinned posts render at the top with a 📌 badge
- Admins see a "📌 Pin" / "📌 Unpin" button on each post
- Sort pinned posts before regular posts in the feed query

The `posts` table already has `is_pinned` (boolean) — no schema change needed.

---

## Task 3 — Sub-Channels

**Goal:** Groups can organize discussions into channels so the feed doesn't become chaotic.

### Step 1: Schema

The `posts` table (from 042) already has `group_id`. We need a `channel_id`:

```sql
-- In migration 058:

CREATE TABLE IF NOT EXISTS group_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,        -- e.g. "general", "sales", "show-chat"
    slug        TEXT NOT NULL,        -- URL-safe slug
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(group_id, slug)
);

ALTER TABLE group_channels ENABLE ROW LEVEL SECURITY;

-- Members can view channels
CREATE POLICY "channels_select" ON group_channels
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
    ));

-- Only admin/owner can create/delete channels
CREATE POLICY "channels_insert" ON group_channels
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    ));

CREATE POLICY "channels_delete" ON group_channels
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM group_memberships gm
        WHERE gm.group_id = group_channels.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    ));

-- Add channel_id to posts (nullable — null = #general)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES group_channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel_id) WHERE channel_id IS NOT NULL;

-- Auto-create #general channel for all existing groups
INSERT INTO group_channels (group_id, name, slug, sort_order)
SELECT id, 'General', 'general', 0 FROM groups
ON CONFLICT (group_id, slug) DO NOTHING;
```

### Step 2: Server actions

**File:** `src/app/actions/groups.ts`

```typescript
// ── Channels ──

export interface GroupChannel {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
}

export async function getGroupChannels(groupId: string): Promise<GroupChannel[]>
// Ordered by sort_order, then name

export async function createGroupChannel(
    groupId: string,
    name: string,
    description?: string
): Promise<{ success: boolean; channelId?: string; error?: string }>
// Auto-generate slug from name. Verify admin/owner role.

export async function deleteGroupChannel(
    channelId: string
): Promise<{ success: boolean; error?: string }>
// Cannot delete the last channel. Verify admin/owner role.
```

### Step 3: Update `createPost` and `getPosts`

**File:** `src/app/actions/posts.ts`

- `createPost` — add optional `channelId` to the data parameter
- `getPosts` — when `groupId` is provided and `channelId` is specified, filter by it. If not specified, show `#general` (null channel_id).

### Step 4: UI — Channel sidebar in group page

**File:** `src/app/community/groups/[slug]/page.tsx`

```
┌─────────┬───────────────────────────────────────┐
│ CHANNELS│                                       │
│ ─────── │  💬 #general feed posts...             │
│ #general│                                       │
│ #sales  │  [Composer: "Post to #general..."]    │
│ #shows  │                                       │
│ + Add   │                                       │
└─────────┴───────────────────────────────────────┘
```

On mobile, channels render as a horizontal scrollable pill bar above the feed.

### Step 5: CSS

```css
.group-tabs { /* Tab bar for Feed/Files/Registry */ }
.group-channels { /* Sidebar channel list on desktop, pill bar on mobile */ }
.group-channel-link { /* Individual channel button */ }
.group-channel-link.active { /* Selected channel highlight */ }
.group-admin-panel { /* Admin panel card */ }
.group-member-row { /* Member list row with role actions */ }
.pinned-badge { /* 📌 indicator on pinned posts */ }
.group-file-item { /* File row with download/delete */ }
```

---

## Completion Checklist

**Task 1 — Group Files**
- [ ] `group_files` table in migration 058
- [ ] RLS: members read, admin/mod write, admin/owner delete
- [ ] Storage bucket `group-files` (or reuse existing)
- [ ] `getGroupFiles()` server action
- [ ] `uploadGroupFile()` server action
- [ ] `deleteGroupFile()` server action
- [ ] `GroupFiles.tsx` component with upload/download/delete
- [ ] Files tab in group detail page

**Task 2 — Admin Panel**
- [ ] `getGroupMembers()` server action
- [ ] `updateMemberRole()` server action (owner-only promotes)
- [ ] `removeMember()` server action (owner/admin removes)
- [ ] `togglePinPost()` server action
- [ ] Updated RLS for admin member deletion
- [ ] `GroupAdminPanel.tsx` component (role management, remove, pin)
- [ ] Pinned posts rendered at top of group feed with 📌 badge
- [ ] Admin panel only visible to owner/admin

**Task 3 — Sub-Channels**
- [ ] `group_channels` table in migration 058
- [ ] `channel_id` column added to `posts` table
- [ ] Auto-create `#general` for existing groups
- [ ] `getGroupChannels()` server action
- [ ] `createGroupChannel()` server action (admin/owner)
- [ ] `deleteGroupChannel()` server action (admin/owner)
- [ ] `createPost` updated to accept `channelId`
- [ ] `getPosts` filters by `channelId` when provided
- [ ] Channel sidebar/pill bar in group detail page
- [ ] Mobile: horizontal scrollable channel pills

**Build & Verification**
- [ ] `npx next build` — 0 errors after each task
- [ ] Group page shows Feed/Files/Registry tabs
- [ ] File upload + download works (PDF test)
- [ ] Admin panel visible only to owner/admin
- [ ] Member role change persists
- [ ] Pinned posts appear at top of feed
- [ ] Channel filter works — posts scoped to selected channel

**Estimated effort:** ~8-12 hours across 3 tasks
