---
description: V43 Community Experience Audit — Systematic review of all 10 commenting surfaces for consistency, avatar presence, threading, and mobile quality.
---

# V43 Task 1 — Community Commenting Surface Audit

> **MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.
> **Constraint:** This task produces ONLY documentation (`.md` file). No code changes.

// turbo-all

---

## Step 1: Read Source Material

Read every component listed below in full. For each one, document the specific issues:

```
View file: src\components\UniversalFeed.tsx              ← 543 lines — Posts + replies for groups, feed, events, passports
View file: src\components\GroupDetailClient.tsx           ← 100 lines — Group tabs (Feed/Files/Registry)
View file: src\components\CommissionTimeline.tsx          ← 460 lines — Art Studio WIP timeline (NOT posts-based)
View file: src\components\HoofprintTimeline.tsx           ← Horse provenance timeline (VIEW-based, not comments)
View file: src\components\ChatThread.tsx                  ← DM messaging (separate system — messages table)
View file: src\components\SuggestionCommentThread.tsx     ← Catalog suggestion comments
View file: src\components\AdminReplyForm.tsx              ← Admin contact message replies
View file: src\components\RichText.tsx                    ← @mention parser used in UniversalFeed
View file: src\components\LikeToggle.tsx                  ← Like button used in UniversalFeed
View file: src\app\actions\posts.ts                       ← Post CRUD + reply + like actions
```

---

## Step 2: Create `.agents/docs/community-commenting-audit.md`

### Audit Matrix

For each of the 10 surfaces, document:

| Surface | Component | Data Source | Avatar? | Threading? | Horse Embeds? | Mobile OK? | Consistency (1-10) |
|---------|-----------|-------------|---------|------------|---------------|------------|---------------------|
| **Groups** | `UniversalFeed` via `GroupDetailClient` | `posts` table (group_id) | ❌ No | ⚠️ 1-level, flat | ⚠️ Regex-based UUID link card only | ✅ Yes | ? |
| **Global Feed** | `UniversalFeed` | `posts` table (globalFeed) | ❌ No | ⚠️ 1-level, flat | ⚠️ Regex-based UUID link card | ✅ Yes | ? |
| **Art Studio** | `CommissionTimeline` | `commission_updates` table | ❌ No | ❌ No (flat timeline) | ❌ No | ✅ | ? |
| **Horse Passport** | `HoofprintTimeline` | `v_horse_hoofprint` VIEW | N/A (records, not comments) | N/A | N/A | ✅ | ? |
| **Public Passport** | `UniversalFeed` | `posts` (horse_id) | ❌ No | ⚠️ 1-level | ❌ No | ✅ | ? |
| **Events** | `UniversalFeed` | `posts` (event_id) | ❌ No | ⚠️ 1-level | ❌ No | ✅ | ? |
| **Inbox / DMs** | `ChatThread` | `messages` table | ❌ Likely no | N/A (chat, not threads) | ❌ No | ✅ | ? |
| **Catalog Suggestions** | `SuggestionCommentThread` | Custom comment system | ❌ No | ❌ No | ❌ No | ? | ? |
| **Help ID** | Custom inline | `id_suggestions` table | ❌ No | ❌ No | ❌ No | ? | ? |
| **Admin Replies** | `AdminReplyForm` | `contact_messages` table | N/A (admin-only) | N/A | N/A | ✅ | ? |

After reading each file, fill in the `?` fields with actual scores. Use your judgment.

### Key Findings to Document

Based on the codebase audit, document these known issues:

**1. Zero avatars in UniversalFeed (Critical)**
The `PostCard` component in `UniversalFeed.tsx` (line 360-398) renders `@{post.authorAlias}` as plain text. There is no `<img>` for the author's avatar. The `Post` type (from `posts.ts`) does not include `authorAvatarUrl`. This means:
- Groups feed: no avatars
- Global feed: no avatars
- Event comments: no avatars
- Horse passport comments: no avatars

**2. Flat threading (Medium)**
Replies render in a left-indented block (`ml-6 border-l-2`, line 486) with no nesting. All replies are siblings. No "replying to @user" context. No collapsed "Show X more replies" for long threads.

**3. Horse embed is regex-based (Low)**
Lines 432-453: The horse embed only triggers when the post content contains a raw UUID URL (`/community/[uuid]`). It renders a generic "View Horse Passport" card with no horse name, photo, or metadata. Compare this to how Twitter/Facebook show rich previews.

**4. CommissionTimeline is a separate system**
`CommissionTimeline.tsx` uses `commission_updates` table, not `posts`. It has its own update types (wip_photo, message, milestone), photo upload, and status transitions. This is architecturally correct — commissions have domain-specific needs. **Do NOT merge this into the universal system.** Polish in-place instead.

**5. ChatThread is a separate system**
DMs use `messages` table with `conversations`. This is also architecturally correct — DMs have different privacy, typing indicators, and read receipts. **Do NOT merge into the universal system.**

**6. Warm parchment tokens not applied**
`UniversalFeed` still uses cold palette (`bg-white`, `bg-stone-50`, `border-stone-200`, `text-stone-600`) banned by the design system. Needs migration to warm tokens.

### Recommended Architecture

```
┌─────────────────────────────┐
│ RichCommentThread.tsx (NEW) │  ← Avatar + threading + horse embeds + warm palette
│ Used by: Groups, Feed,     │
│ Events, Passports, Profiles│
└──────────────┬──────────────┘
               │ Wraps
┌──────────────▼──────────────┐
│ UniversalFeed.tsx (REFACTOR)│  ← Becomes thin wrapper: composer + RichCommentThread
└─────────────────────────────┘

┌─────────────────────────────┐
│ CommissionTimeline.tsx       │  ← Keep separate, add avatars + photo polish
│ (domain-specific — no merge)│
└─────────────────────────────┘

┌─────────────────────────────┐
│ ChatThread.tsx               │  ← Keep separate, add avatars + horse embed cards
│ (DM-specific — no merge)    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ SuggestionCommentThread.tsx  │  ← Migrate to RichCommentThread (posts table)
│ (currently custom — merge)   │
└─────────────────────────────┘
```

---

## Step 3: Self-Verification

- [ ] All 10 surfaces documented with accurate data
- [ ] Consistency scores filled in for every surface
- [ ] Architecture recommendation explains what merges and what stays separate
- [ ] Cold palette violations identified
- [ ] No code was modified

---

## 🛑 HUMAN VERIFICATION GATE 🛑

Present the completed audit for human review before proceeding to implementation tasks.
