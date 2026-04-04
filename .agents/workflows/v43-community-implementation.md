---
description: V43 Community Experience Implementation — Shared primitives for avatar, threading, horse embeds, and warm palette across all 10 commenting surfaces. Domain boundaries respected.
---

# V43 Task 2 — Community Experience Implementation (Shared Primitives)

> **MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.
> **Prerequisite:** `.agents/docs/community-commenting-audit.md` must exist (Task 1 audit approved).
> **Architecture:** Extract small, composable UI primitives. Each domain surface imports what it needs — NO monolithic replacement component.

// turbo-all

---

## Architectural Principle: Shared Primitives, Separate Surfaces

```
┌──────────────────────────────────────────────────────────┐
│               SHARED PRIMITIVES (new files)               │
│                                                           │
│  UserAvatar.tsx    — Consistent avatar circle + fallback  │
│  PostHeader.tsx    — Avatar + alias + timestamp + badges  │
│  ThreadConnector   — Visual indentation + connecting line │
│  HorseEmbedCard.tsx — Rich horse preview (name + photo)  │
│  ReactionBar.tsx   — Like + hobby-specific reactions      │
│  ReplyComposer.tsx — Inline reply with avatar + preview  │
└─────────────────────────┬────────────────────────────────┘
                          │ imported by
         ┌────────────────┼──────────────────┐
         │                │                  │
    UniversalFeed    CommissionTimeline   ChatThread
    (posts table)    (commission_updates) (messages)
    ┌─────────┐      ┌──────────┐        ┌──────────┐
    │ Groups  │      │Art Studio│        │   DMs    │
    │ Feed    │      └──────────┘        └──────────┘
    │ Events  │      SuggestionComment   AdminReply
    │Passports│      ┌──────────┐        ┌──────────┐
    │Profiles │      │ Catalog  │        │  Admin   │
    └─────────┘      └──────────┘        └──────────┘
```

**Rule:** Each surface keeps its own data model and domain logic. Primitives provide ONLY visual consistency.

---

## Phase 1: Build Shared Primitives (~2 days)

### 1.1 Create `src/components/social/UserAvatar.tsx`

A single, reusable avatar component used by every social surface.

```tsx
"use client";

interface UserAvatarProps {
    /** Signed avatar URL (from getSignedImageUrl or direct) */
    src: string | null;
    /** Username for fallback initial */
    alias: string;
    /** Size variant */
    size?: "xs" | "sm" | "md" | "lg";
    /** Optional link wrapper — wraps avatar in a Link to profile */
    href?: string;
    /** Show online indicator dot */
    showOnline?: boolean;
}
```

**Implementation details:**
- Sizes: `xs` = 24px (reply), `sm` = 32px (post), `md` = 40px (detail), `lg` = 56px (profile)
- Fallback: Extract first character of alias, render in colored circle using hash-based color
- Color generation: `hsl(alias.charCodeAt(0) * 137 % 360, 45%, 65%)` — deterministic per user
- Use warm parchment border: `border border-[#E0D5C1]` (not stone)
- Rounded full: `rounded-full overflow-hidden`
- If `href` provided, wrap entire avatar in `<Link>`
- Image uses `loading="lazy"` and `referrerPolicy="no-referrer"`
- On error: fall back to initial (handle broken signed URLs gracefully)

**Warm palette:**
- Border: `border-[#E0D5C1]`
- Fallback bg: calculated from alias hash
- Fallback text: `text-white font-semibold`

### 1.2 Create `src/components/social/PostHeader.tsx`

Consistent header used above every post, reply, comment, and timeline entry.

```tsx
interface PostHeaderProps {
    /** Author avatar URL */
    avatarUrl: string | null;
    /** Author alias (without @) */
    alias: string;
    /** ISO timestamp string */
    createdAt: string;
    /** Was the post edited? */
    isEdited?: boolean;
    /** Optional verification badge (for show records, admin, etc.) */
    badge?: "verified" | "admin" | "moderator" | "artist" | null;
    /** Link to the post detail page (e.g., /feed/[id]) */
    permalink?: string;
    /** Optional right-side action slot (edit, delete buttons) */
    actions?: React.ReactNode;
    /** Avatar size */
    avatarSize?: "xs" | "sm" | "md";
}
```

**Implementation details:**
- Renders: `[Avatar] @alias · 3h ago (edited) [badge] ... [actions]`
- Alias links to `/profile/{alias}`
- Timestamp uses relative time (Just now, 3m, 2h, 3d, then "Apr 3")
- `(edited)` shown when `isEdited` is true
- Badge renders as small colored pill: 🛡️ Verified, ⭐ Admin, 🎨 Artist
- Warm palette: `text-[#2D2318]` for alias, `text-[#8B7D6B]` for timestamp
- Mobile: all elements `flex-wrap` so they don't overflow at 390px

### 1.3 Create `src/components/social/HorseEmbedCard.tsx`

Rich inline preview when a horse is referenced in a post.

```tsx
interface HorseEmbedCardProps {
    /** Horse UUID */
    horseId: string;
    /** Pre-fetched data (optional — if not provided, shows loading skeleton) */
    horseName?: string;
    /** Catalog reference name (e.g., "Breyer Ruffian") */
    refName?: string;
    /** Signed thumbnail URL */
    thumbnailUrl?: string | null;
    /** Trade status badge */
    tradeStatus?: string;
}
```

**Implementation details:**
- Compact card: thumbnail (80×80 rounded) + horse name + ref name + trade status badge
- Links to `/community/{horseId}`
- Warm palette: `bg-[#FEFCF8] border border-[#E0D5C1] rounded-lg`
- Hover: subtle lift with `hover:shadow-md transition-shadow`
- Skeleton loader while data loads (use shadcn `<Skeleton>`)
- If no thumbnail: show 🐴 emoji in a warm circle

**Server action needed:** `getHorseEmbedData(horseId)` in `src/app/actions/posts.ts`
```ts
export async function getHorseEmbedData(horseId: string): Promise<{
    name: string; refName: string | null; thumbnailUrl: string | null; tradeStatus: string;
} | null>
```
- Fetches `custom_name`, `catalog_items.title`, `catalog_items.maker`, `trade_status`
- Gets signed URL for primary thumbnail from `horse_images`
- Returns `null` if horse doesn't exist or isn't public
- Cache-safe: this is a read-only public lookup

### 1.4 Create `src/components/social/ReactionBar.tsx`

Consistent like/reaction strip used on posts and timeline entries.

```tsx
interface ReactionBarProps {
    /** Current like state */
    isLiked: boolean;
    /** Current like count */
    likeCount: number;
    /** Toggle callback */
    onToggle: () => Promise<{ success: boolean }>;
    /** Reply toggle callback + count */
    replyCount?: number;
    onReplyToggle?: () => void;
    /** Is reply section currently open? */
    isReplyOpen?: boolean;
    /** Layout variant */
    variant?: "full" | "compact";
}
```

**Implementation details:**
- Replaces inline like/reply buttons currently in `PostCard`
- Heart icon with count (optimistic toggle, uses existing `togglePostLike`)
- Reply button with count and chevron (▼/▲)
- Warm palette: heart uses `text-rose-500`, buttons use `text-[#8B7D6B] hover:text-[#2D2318]`
- Touch targets: `min-h-[44px]` on mobile, normal on desktop
- `compact` variant for tight spaces (commission timeline, suggestion threads)
- Uses `useTransition` for non-blocking server action calls

### 1.5 Create `src/components/social/ReplyComposer.tsx`

Inline reply input with avatar context.

```tsx
interface ReplyComposerProps {
    /** Current user's avatar URL */
    currentUserAvatar: string | null;
    /** Current user's alias */
    currentUserAlias: string;
    /** Callback when reply is submitted */
    onSubmit: (content: string) => Promise<void>;
    /** Placeholder text */
    placeholder?: string;
    /** Max character length */
    maxLength?: number;
    /** Optional "replying to @user" context */
    replyingTo?: string | null;
}
```

**Implementation details:**
- Layout: `[Avatar(xs)] [Input] [Send Button]`
- Shows "Replying to @user" pill above input when `replyingTo` is set
- Send button: forest green, disabled when empty
- Character counter shown when >80% of maxLength
- Uses shadcn `<Input>` for consistency
- Warm palette: input bg `bg-[#FEFCF8]`, border `border-[#E0D5C1]`
- Submit on Enter (Shift+Enter for newline in textarea variant)

### 1.6 Create `src/components/social/index.ts`

Barrel export for clean imports:

```ts
export { default as UserAvatar } from "./UserAvatar";
export { default as PostHeader } from "./PostHeader";
export { default as HorseEmbedCard } from "./HorseEmbedCard";
export { default as ReactionBar } from "./ReactionBar";
export { default as ReplyComposer } from "./ReplyComposer";
```

### Phase 1 Validation Checklist
- [ ] All 5 primitives render correctly in isolation
- [ ] All use warm parchment palette (no cold tokens)
- [ ] All have mobile-safe touch targets (`min-h-[44px]`)
- [ ] `UserAvatar` fallback works when avatar URL is null or broken
- [ ] `HorseEmbedCard` shows skeleton then resolves
- [ ] `PostHeader` wraps cleanly at 390px viewport
- [ ] `ReactionBar` optimistic toggle works
- [ ] Build passes: `cmd /c "npx next build 2>&1"`

---

## Phase 2: Upgrade UniversalFeed (Fixes 5 Surfaces) (~2 days)

### 2.1 Add `authorAvatarUrl` to `Post` type

**File:** `src/app/actions/posts.ts`

The `Post` interface currently lacks avatar data. Add:

```ts
export interface Post {
    // ... existing fields ...
    authorAvatarUrl: string | null; // NEW — from users.avatar_url
}
```

Update `getPosts()` query to join `users.avatar_url`:

```ts
// Current select:
.select("id, author_id, content, parent_id, likes_count, replies_count, is_pinned, created_at, updated_at, users!posts_author_id_fkey(alias_name)")

// Updated select:
.select("id, author_id, content, parent_id, likes_count, replies_count, is_pinned, created_at, updated_at, users!posts_author_id_fkey(alias_name, avatar_url)")
```

Map `avatar_url` to `authorAvatarUrl` in the response mapper. If the avatar is a Supabase storage path (not a full URL), generate a signed URL using the existing `getSignedImageUrl` pattern.

### 2.2 Refactor `PostCard` in `UniversalFeed.tsx`

Replace the current flat header (lines 360-398) with the shared primitives:

**Before (current):**
```tsx
<div className="flex flex-wrap items-center justify-between gap-1">
    <Link href={`/profile/${post.authorAlias}`} className="truncate text-sm font-semibold">
        @{post.authorAlias}
    </Link>
    <div className="flex items-center gap-2">
        <Link href={`/feed/${post.id}`} className="text-stone-500 text-xs">
            {timeAgo(post.createdAt)}
        </Link>
        {/* edit/delete buttons */}
    </div>
</div>
```

**After (with primitives):**
```tsx
import { UserAvatar, PostHeader, ReactionBar, ReplyComposer, HorseEmbedCard } from "@/components/social";

<PostHeader
    avatarUrl={post.authorAvatarUrl}
    alias={post.authorAlias}
    createdAt={post.createdAt}
    isEdited={!!post.updatedAt && post.updatedAt !== post.createdAt}
    permalink={`/feed/${post.id}`}
    actions={post.authorId === currentUserId ? (
        <>
            <button onClick={() => setIsEditing(!isEditing)} disabled={isPending}>✏️</button>
            <button onClick={handleDelete} disabled={isPending}>🗑️</button>
        </>
    ) : undefined}
/>
```

### 2.3 Upgrade horse embed detection (lines 432-453)

Replace the current regex card with `HorseEmbedCard`:

**Current:** Generic "View Horse Passport" card with no horse data
**New:** Detect UUID in content → call `getHorseEmbedData()` → render `HorseEmbedCard` with actual horse name, thumbnail, and ref name

Use a small client-side effect to lazily fetch embed data:
```tsx
const [horseEmbed, setHorseEmbed] = useState<{...} | null>(null);
useEffect(() => {
    const match = post.content.match(/\/community\/([0-9a-f-]{36})/i);
    if (match) {
        getHorseEmbedData(match[1]).then(setHorseEmbed);
    }
}, [post.content]);
```

### 2.4 Upgrade reply section (lines 484-539)

Replace the reply section with primitives:

- Each reply gets `PostHeader` (with `avatarSize="xs"`)
- Reply composer becomes `ReplyComposer` component
- Like/reply buttons become `ReactionBar`
- Threading visual: keep `ml-6 border-l-2` but use warm color `border-[#E0D5C1]`
- Add "Show X more replies" collapse when >3 replies (show first 2 + collapse toggle)

### 2.5 Fix warm parchment palette

Replace all cold tokens in `UniversalFeed.tsx`:

| Cold (banned) | Warm (use this) |
|--------------|-----------------|
| `bg-white` | `bg-[#FEFCF8]` |
| `bg-stone-50` | `bg-[#F4EFE6]` |
| `border-stone-200` | `border-[#E0D5C1]` |
| `text-stone-900` | `text-[#2D2318]` |
| `text-stone-600` | `text-[#8B7D6B]` |
| `text-stone-500` | `text-[#8B7D6B]` |
| `hover:bg-stone-50` | `hover:bg-[#F4EFE6]` |

### 2.6 Pass `currentUserAvatar` through the component tree

`UniversalFeed` needs the current user's avatar URL for the composer and reply inputs. Add to props:

```tsx
interface UniversalFeedProps {
    // ... existing ...
    currentUserAvatar?: string | null; // NEW
}
```

Update all 5 calling pages to pass this:
1. `src/app/community/groups/[slug]/page.tsx`
2. `src/app/feed/page.tsx`
3. `src/app/community/events/[id]/page.tsx`
4. `src/app/community/[id]/page.tsx`
5. `src/app/shows/[id]/page.tsx`

Each of these already fetches the current user — just add the avatar URL to the data they pass.

### Phase 2 Validation Checklist
- [ ] Every post in Groups, Feed, Events, Passports, and Profiles shows author avatar
- [ ] Every reply shows a smaller avatar
- [ ] Horse UUID links show rich embed with name + thumbnail
- [ ] All cold palette tokens replaced with warm parchment
- [ ] Reply threading uses warm connector line
- [ ] Long reply threads collapse to "Show X more"
- [ ] Composer shows current user's avatar
- [ ] Build passes clean

---

## Phase 3: Polish Domain-Specific Surfaces (~1.5 days)

### 3.1 CommissionTimeline — Add avatars (keep separate architecture)

**File:** `src/components/CommissionTimeline.tsx`

**DO NOT** merge into UniversalFeed. This uses `commission_updates` table with domain-specific types (wip_photo, milestone, status_change).

**Changes:**
1. Import `UserAvatar` and `PostHeader` from `@/components/social`
2. Replace the current author display (line 400: `@{update.authorAlias}`) with `PostHeader`:
   ```tsx
   <PostHeader
       avatarUrl={update.authorAvatarUrl}  // Need to add to CommissionUpdate type
       alias={update.authorAlias}
       createdAt={update.createdAt}
       badge={update.isArtist ? "artist" : null}
       avatarSize="sm"
   />
   ```
3. Add `authorAvatarUrl` to the `CommissionUpdate` type in `src/app/actions/art-studio.ts`
4. Update the query to join `users.avatar_url`
5. Fix warm palette: Replace `bg-white border-stone-200` with `bg-[#FEFCF8] border-[#E0D5C1]`

### 3.2 ChatThread — Add avatars (keep separate architecture)

**File:** `src/components/ChatThread.tsx`

**DO NOT** merge into UniversalFeed. DMs use `messages` table with different privacy model.

**Changes:**
1. Import `UserAvatar` from `@/components/social`
2. Add avatar next to each message bubble
3. Layout: avatar on left for other user, avatar on right for current user (chat bubble pattern)
4. The ChatThread likely already has user data from the conversation — just surface the avatar
5. Fix warm palette if cold tokens present

### 3.3 SuggestionCommentThread — Adopt shared primitives

**File:** `src/components/SuggestionCommentThread.tsx`

This component is simple enough to refactor to use shared primitives:

1. Import `UserAvatar`, `PostHeader`, `ReplyComposer` from `@/components/social`
2. Replace inline author display with `PostHeader`
3. Replace inline reply input with `ReplyComposer`
4. Fix warm palette

### 3.4 AdminReplyForm — Minimal touch

**File:** `src/components/AdminReplyForm.tsx`

This is admin-only (not user-facing). Minimal changes:
1. Import `UserAvatar` — show admin avatar on replies
2. Fix warm palette if needed
3. No threading needed (admin replies are flat)

### 3.5 HoofprintTimeline — Not a comment system (skip)

`HoofprintTimeline.tsx` renders provenance data from `v_horse_hoofprint` VIEW. It's a timeline of records (shows, transfers, condition changes), not a comment system. **No changes needed for this sprint.**

If we later want to add a "comment on timeline event" feature, that would be a new `posts` context (e.g., `show_record_id` FK) — a separate epic.

### Phase 3 Validation Checklist
- [ ] CommissionTimeline shows author avatars
- [ ] CommissionTimeline uses warm palette
- [ ] ChatThread shows avatars in bubble layout
- [ ] SuggestionCommentThread uses PostHeader + ReplyComposer
- [ ] AdminReplyForm shows admin avatar
- [ ] HoofprintTimeline unchanged (verified no regression)
- [ ] Build passes clean

---

## Phase 4: Engagement & Polish (~1 day)

### 4.1 Pinned post gold accent

In `UniversalFeed.tsx`, when `post.isPinned` is true:
```tsx
<div className={`${post.isPinned ? "border-l-4 border-amber-400 bg-amber-50/30 pl-4" : ""}`}>
    {post.isPinned && (
        <span className="mb-1 text-xs font-semibold text-amber-600 uppercase tracking-wider">📌 Pinned</span>
    )}
    <PostHeader ... />
</div>
```

### 4.2 "Replying to @user" preview

When a user clicks Reply under a specific reply (not the root post), show a contextual preview:
```tsx
<ReplyComposer
    replyingTo={targetAuthorAlias}
    placeholder={`Reply to @${targetAuthorAlias}…`}
    ...
/>
```

### 4.3 Reply collapse

When a post has >3 replies, show first 2 + expandable:
```tsx
{replies.length > 3 && !showAllReplies ? (
    <>
        {replies.slice(0, 2).map(r => <ReplyCard key={r.id} ... />)}
        <button onClick={() => setShowAllReplies(true)} className="...">
            Show {replies.length - 2} more replies
        </button>
    </>
) : (
    replies.map(r => <ReplyCard key={r.id} ... />)
)}
```

### 4.4 Mobile audit

Test all 5 UniversalFeed surfaces + CommissionTimeline + ChatThread at 390px:
- Avatars don't overflow
- PostHeader wraps cleanly (alias on one line, timestamp below)
- Reply composer is usable with thumb
- Horse embed cards stack vertically
- Touch targets are ≥44px

### Phase 4 Validation Checklist
- [ ] Pinned posts have gold accent + 📌 badge
- [ ] "Replying to @user" shows context
- [ ] Long threads collapse to "Show X more"
- [ ] All touch targets ≥44px at 390px viewport
- [ ] No horizontal overflow on any surface

---

## Phase 5: Final Verification (~0.5 day)

### 5.1 Cross-surface consistency check

Visit every surface and verify visual consistency:

| # | Surface | Route | Primitive | Expected |
|---|---------|-------|-----------|----------|
| 1 | Groups | `/community/groups/[slug]` | Full (`PostHeader` + `ReactionBar` + `ReplyComposer` + `HorseEmbedCard`) | ✅ |
| 2 | Global Feed | `/feed` | Full | ✅ |
| 3 | Events | `/community/events/[id]` | Full | ✅ |
| 4 | Passport Comments | `/community/[id]` | Full | ✅ |
| 5 | Profile Posts | `/profile/[alias]` (if applicable) | Full | ✅ |
| 6 | Art Studio | `/studio/commission/[id]` | `PostHeader` + `UserAvatar` | ✅ |
| 7 | DMs | `/inbox/[id]` | `UserAvatar` | ✅ |
| 8 | Catalog Suggestions | `/catalog/suggestions/[id]` | `PostHeader` + `ReplyComposer` | ✅ |
| 9 | Admin Replies | Admin panel | `UserAvatar` | ✅ |
| 10 | Hoofprint Timeline | `/stable/[id]` | N/A (not a comment system) | ✅ Skip |

### 5.2 Build + test gate

```powershell
cmd /c "npx next build 2>&1"
npm run test:unit
```

Both must pass clean.

### 5.3 Update documentation

After implementation:
1. **`onboard.md`** — Add `src/components/social/` to the component inventory (6 new primitives)
2. **`dev-nextsteps.md`** — Mark V43 Task C-1 as ✅ DONE with date and metrics
3. **`MASTER_BLUEPRINT.md`** — Add to Tech Decisions: "Social primitives in `src/components/social/` — all commenting surfaces must use these shared components"

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Before marking V43 complete, verify these pass:**

1. Navigate to a group → avatars visible on all posts and replies
2. Post a message containing a horse link → rich embed shows horse name + photo
3. Navigate to Art Studio commission → author avatars visible on timeline
4. Open a DM → avatars visible on message bubbles
5. Check at 390px viewport → no overflow, no squished elements
6. Visual warmth: no cold whites or stone grays — everything warm parchment

**Build must pass:** `cmd /c "npx next build 2>&1"` — 0 errors

Await human input: "V43 Community Experience Verified. Mark complete."
