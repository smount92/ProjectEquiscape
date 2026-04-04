# V43 Community Commenting Surface Audit

> **Audited:** 2026-04-04
> **Constraint:** Documentation only — no code was modified
> **Auditor:** AI Agent (post-onboard, post-MASTER read)

---

## Audit Matrix

| # | Surface | Component | Data Source | Avatar? | Threading? | Horse Embeds? | Warm Palette? | Mobile OK? | Consistency (1-10) |
|---|---------|-----------|-------------|---------|------------|---------------|---------------|------------|---------------------|
| 1 | **Groups** | `UniversalFeed` via `GroupDetailClient` | `posts` table (`group_id`) | ❌ No | ⚠️ 1-level flat (`ml-6 border-l-2`) | ⚠️ Regex UUID card only — no name/photo | ❌ 21 cold violations | ✅ Yes | 4 |
| 2 | **Global Feed** | `UniversalFeed` | `posts` table (`globalFeed`) | ❌ No | ⚠️ 1-level flat | ⚠️ Regex UUID card only | ❌ Same 21 violations | ✅ Yes | 4 |
| 3 | **Event Comments** | `UniversalFeed` | `posts` table (`event_id`) | ❌ No | ⚠️ 1-level flat | ⚠️ Regex UUID card only | ❌ Same 21 violations | ✅ Yes | 4 |
| 4 | **Public Passport Comments** | `UniversalFeed` | `posts` table (`horse_id`) | ❌ No | ⚠️ 1-level flat | ⚠️ Regex UUID card only | ❌ Same 21 violations | ✅ Yes | 4 |
| 5 | **Art Studio** | `CommissionTimeline` | `commission_updates` table | ❌ No avatar circle | ❌ No (flat timeline) — domain-appropriate | ❌ No | ❌ 19 cold violations | ✅ Yes | 5 |
| 6 | **Horse Passport (Hoofprint)** | `HoofprintTimeline` | `v_horse_hoofprint` VIEW | N/A (records, not social) | N/A | N/A | ⚠️ 10 cold violations (uses `bg-stone-50`, `border-stone-200`) | ✅ Yes | 7 |
| 7 | **Inbox / DMs** | `ChatThread` | `messages` table | ❌ No avatar — just bubble styling | N/A (chat, not threads) | ❌ No horse context cards | ⚠️ 9 cold violations | ✅ Yes | 6 |
| 8 | **Catalog Suggestions** | `SuggestionCommentThread` | `catalog_suggestion_comments` table | ❌ No | ❌ Flat list, no threading | ❌ No | ⚠️ 10 cold violations, also uses `input` CSS class (legacy) | ⚠️ Untested | 3 |
| 9 | **Help ID** | `HelpIdDetailClient` | `id_suggestions` table | ❌ No | ❌ Flat suggestions, no conversation | ❌ No | ⚠️ 8 cold violations (`bg-white`, `border-stone-200`) | ✅ Yes | 5 |
| 10 | **Admin Replies** | `AdminReplyForm` | `contact_messages` table | N/A (admin-only tool) | N/A (single reply) | N/A | ⚠️ Uses `bg-stone-100`, `text-stone-500`, legacy CSS classes | ✅ Yes | 6 |

### Summary Scores

| Metric | Value |
|--------|-------|
| Surfaces with avatars | **0 of 10** |
| Surfaces with threading | **4 of 10** (all shallow 1-level) |
| Surfaces with horse embeds | **4 of 10** (all regex-based, no rich preview) |
| Surfaces violating warm palette | **10 of 10** |
| Average consistency score | **4.8 / 10** |

---

## Key Findings

### 1. Zero Avatars in UniversalFeed (Critical — affects 4 surfaces)

The `PostCard` inner component (line 292–541 of `UniversalFeed.tsx`) renders author identity as:

```tsx
<Link href={`/profile/${encodeURIComponent(post.authorAlias)}`}
      className="truncate text-sm font-semibold max-w-[200px]">
    @{post.authorAlias}
</Link>
```

**No `<img>` or avatar circle.** The `Post` TypeScript interface (in `posts.ts`, line 17–36) does not include `authorAvatarUrl`. The `getPosts()` server action (line 337–457) only selects `users!posts_author_id_fkey(alias_name)` — no `avatar_url` field is fetched.

**Impact:** Groups feed, Global feed, Event comments, and Horse Passport comments all show plain text `@alias` with zero visual identity. This makes conversation threads feel impersonal and makes it hard to visually scan who said what.

**Existing infrastructure:** A `UserAvatar.tsx` component **already exists** at `src/components/UserAvatar.tsx` (23 lines). It's currently only imported by `DiscoverGrid.tsx`. It renders a circle with either the avatar image or a single-character fallback. However:
- It uses cold palette (`bg-[rgb(245 245 244)]`, `text-stone-500`) — needs warm migration
- It uses inline `style={{ width, height, fontSize }}` — should use Tailwind size classes
- No hash-based fallback color (all fallbacks are the same grey)

### 2. Flat Threading — No "Replying to" Context (Medium — affects 4 surfaces)

Replies render via `PostCard` (line 484–538) as:

```tsx
<div className="mt-2 ml-6 border-l-2 border-stone-200 pl-4">
    {replies.map((r) => (
        <div key={r.id} className="mb-2 flex items-start justify-between">
            <Link ...>@{r.authorAlias}</Link>
            <span className="text-stone-500 ml-1 text-xs">{timeAgo(r.createdAt)}</span>
            <RichText content={r.content} />
        </div>
    ))}
    {/* Reply composer */}
    <div className="mt-2 flex gap-2">
        <Input ... placeholder="Reply…" />
        <button ...>Reply</button>
    </div>
</div>
```

**Issues:**
- All replies are flat siblings — no nesting, no "replying to @user" context
- No collapsed "Show X more replies" for long threads (all replies render at once)
- Reply cap is 100 globally across all visible posts (from `getPosts`, line 407) — adequate but fragile for viral threads
- Reply composer has no avatar circle for the current user
- No visual distinction between different reply authors (all look identical)

### 3. Horse Embed Is Regex-Based — No Rich Preview (Low — affects 4 surfaces)

Lines 432–453 of `UniversalFeed.tsx`:

```tsx
{/\/community\/[0-9a-f]{8}-/.test(post.content) &&
    (() => {
        const match = post.content.match(
            /\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
        );
        if (!match) return null;
        const horseId = match[1];
        return (
            <Link href={`/community/${horseId}`}
                  className="mt-2 block rounded-lg border border-stone-200 bg-white p-4 ...">
                <div className="flex items-center gap-2 font-semibold text-stone-900">
                    🐴 View Horse Passport
                </div>
                <p className="mt-1 text-sm text-stone-500">
                    Click to view this model on Model Horse Hub
                </p>
                <span className="mt-1 block text-xs text-stone-500">
                    modelhorsehub.com/community/{horseId.slice(0, 8)}…
                </span>
            </Link>
        );
    })()}
```

**Issues:**
- Only triggers on raw UUID URL in post content — no `@horse` or `#horse` mention syntax
- Shows generic "View Horse Passport" text — no horse name, no thumbnail, no trade status
- Uses cold palette (`bg-white`, `border-stone-200`, `text-stone-900`, `text-stone-500`)
- Contrast with how Twitter/Facebook render rich link previews with image + title + description

**The right approach** would be a `HorseEmbedCard` component that fetches the horse's `custom_name`, primary thumbnail, and `trade_status` to render a rich, contextual preview card.

### 4. CommissionTimeline Is a Separate System (Architecture — DO NOT MERGE)

`CommissionTimeline.tsx` (460 lines) uses:
- **Data source:** `commission_updates` table (not `posts`)
- **Update types:** `wip_photo`, `status_change`, `message`, `revision_request`, `approval`, `milestone`
- **Features:** Photo upload, status transitions, artist/client role differentiation, privacy toggles
- **Domain logic:** Status state machine (`requested → accepted → in_progress → review → completed → shipping → delivered`)

**This is architecturally correct.** Commissions have domain-specific needs (WIP photos, status transitions, client approvals) that don't map to generic post/reply threading. **Do NOT merge into the universal system.** Polish in-place instead:
- Add `UserAvatar` to update entries (currently shows `@{update.authorAlias}` as text, line 400)
- Migrate 19 cold palette violations to warm tokens
- The existing file uses `var(--color-border)` and `var(--color-bg-white)` in some places (lines 215, 434) — legacy CSS variables that should be replaced with Tailwind warm tokens

### 5. ChatThread Is a Separate System (Architecture — DO NOT MERGE)

`ChatThread.tsx` (267 lines) uses:
- **Data source:** `messages` table + `conversations` table
- **Features:** Real-time via Supabase Realtime channel (`chat-{conversationId}`), optimistic updates, typing indicator layout, risky payment detection (`RISKY_PAYMENT_REGEX`), date separators
- **Styling:** Chat bubbles with sender/receiver distinction (emerald gradient for "me", neutral for "them")

**This is architecturally correct.** DMs have fundamentally different UX from comment threads — they're private, real-time, and have different privacy/security concerns. **Do NOT merge into the universal system.** Polish in-place instead:
- Add `UserAvatar` next to each non-"me" message bubble (currently no avatar — just bubbles)
- Migrate 9 cold palette violations to warm tokens
- Consider adding horse context cards when a conversation is about a specific horse (the `conversations` table already has a `horse_id` FK)

### 6. SuggestionCommentThread Has Significant Issues (Medium — 1 surface)

`SuggestionCommentThread.tsx` (121 lines):
- **Uses `catalog_suggestion_comments` table** — separate from `posts` table
- **CSS issues:** Uses legacy `input` class (line 90: `className="input border-stone-200-textarea..."`) — not shadcn `<Textarea>`
- **Questionable class names:** `border-stone-200-author`, `border-stone-200-time`, `border-stone-200-delete`, etc. (lines 69–82) — these appear to be malformed Tailwind classes that probably render as no-ops. The actual styling likely comes from `globals.css` class definitions or results in unstyled elements.
- **No avatars**, no threading, no likes
- 10 cold palette violations

**Recommendation:** This is a good candidate for migration to `posts` with a catalog suggestion context (or at minimum, refactored to use shared social primitives).

### 7. HoofprintTimeline Is NOT a Comment System (No Changes Needed)

`HoofprintTimeline.tsx` (265 lines):
- **Data source:** `v_horse_hoofprint` regular VIEW (UNION ALL across 6 tables)
- **Purpose:** Provenance timeline — shows acquisition, show results, condition changes, transfers, custom notes
- **Not social:** No likes, no replies, no user-to-user conversation
- Uses Framer Motion for stagger animations (best-in-class among these components)

**This is correct as-is.** The only improvement would be warm palette migration (10 cold violations) and the ownership chain section (line 142: `bg-stone-50 border-[rgb(245 245 244)]`).

### 8. Help ID Suggestions Are Upvote-Based (Minor polish only)

`HelpIdDetailClient.tsx` (240 lines):
- **Data source:** `id_suggestions` table
- **Features:** Upvoting, accept/reject by owner, "Add to Stable" action on accepted
- **No avatars**, no conversation threading
- 8 cold palette violations
- Uses `help-id-suggestion-card` CSS class from `globals.css`

**Recommendation:** Low priority. The upvote system is the right UX for "identify this model" — it's not a conversation. Polish the card styling and add avatars next to suggester names.

### 9. AdminReplyForm Is Admin-Only (Minimal changes)

`AdminReplyForm.tsx` (165 lines):
- **Data source:** `contact_messages` table
- **Purpose:** Admin responds to public contact form submissions via email (Resend)
- Uses legacy CSS classes (`admin-reply-form`, `admin-reply-status`)
- Button uses `rounded-full` — inconsistent with platform `rounded-md` standard

**Recommendation:** Lowest priority. Only admin-facing. Migrate cold palette and legacy CSS when touched.

### 10. RichText and LikeToggle Assessment

**`RichText.tsx` (51 lines):**
- Renders `@mention` links via regex split — functional
- Uses `react-markdown` + `remark-gfm` for markdown support
- **Issue:** `className="text-forest underline break-words"` on the wrapper div — this makes ALL text forest-green and underlined, which is incorrect for post content. Should only apply `underline` to actual links, not all text.
- Uses `var(--color-accent)` for mention link color — legacy CSS variable

**`LikeToggle.tsx` (45 lines):**
- Clean implementation with optimistic updates via `useTransition`
- Has WCAG touch target (`min-h-[44px]` on mobile, `sm:min-h-0` on desktop)
- Heart pop animation (`animate-[heart-pop_0.3s_ease-out]`)
- Uses `var(--color-surface-hover)` and `var(--color-accent)` — legacy CSS variables
- **Generally good** — needs warm palette migration only

---

## Cold Palette Violation Census

| Component | `bg-white` | `bg-stone-50/100` | `border-stone-200` | `text-stone-*` | Legacy `var()` | Total |
|-----------|------------|---------------------|---------------------|----------------|----------------|-------|
| `UniversalFeed.tsx` | 3 | 2 | 9 | 7 | 0 | **21** |
| `CommissionTimeline.tsx` | 4 | 0 | 6 | 5 | 4 | **19** |
| `HoofprintTimeline.tsx` | 1 | 3 | 2 | 3 | 1 | **10** |
| `ChatThread.tsx` | 0 | 3 | 3 | 3 | 0 | **9** |
| `SuggestionCommentThread.tsx` | 0 | 0 | 8 | 0 | 2 | **10** |
| `HelpIdDetailClient.tsx` | 3 | 1 | 3 | 4 | 0 | **11** |
| `AdminReplyForm.tsx` | 0 | 2 | 2 | 2 | 0 | **6** |
| `LikeToggle.tsx` | 0 | 0 | 0 | 1 | 2 | **3** |
| `RichText.tsx` | 0 | 0 | 0 | 0 | 1 | **1** |
| `UserAvatar.tsx` | 0 | 1 | 0 | 1 | 0 | **2** |
| **TOTAL** | **11** | **12** | **33** | **26** | **10** | **92** |

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│ src/components/social/ (NEW shared primitives directory) │
│                                                         │
│ ├── UserAvatar.tsx     — refactored: hash-based fallback│
│ │                        color, warm palette, size props │
│ ├── PostHeader.tsx     — avatar + alias link + timestamp│
│ │                        + badge slot + actions dropdown │
│ ├── HorseEmbedCard.tsx — rich horse preview: name,      │
│ │                        thumbnail, trade status badge   │
│ ├── ReactionBar.tsx    — like toggle + reply count       │
│ │                        toggle (warm palette)           │
│ └── ReplyComposer.tsx  — inline reply: current user      │
│                          avatar + textarea + "replying   │
│                          to @user" context label         │
└───────────────────────┬─────────────────────────────────┘
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
┌────────────┐  ┌────────────────┐  ┌────────────────────┐
│ UniversalFeed │  │CommissionTimeline│  │ ChatThread         │
│ (REFACTOR)    │  │ (POLISH IN-PLACE)│  │ (POLISH IN-PLACE)  │
│               │  │                  │  │                    │
│ Imports ALL 5 │  │ Imports:         │  │ Imports:           │
│ primitives    │  │ - UserAvatar     │  │ - UserAvatar only  │
│               │  │ - PostHeader     │  │                    │
│ Fixes:        │  │                  │  │ Fixes:             │
│ - Avatars     │  │ Keeps:           │  │ - Avatar on other  │
│ - Threading   │  │ - commission_    │  │   user's bubbles   │
│ - Horse embed │  │   updates table  │  │ - Horse context    │
│ - Warm palette│  │ - Domain state   │  │   card if horse_id │
│               │  │   machine        │  │ - Warm palette     │
│ Used by:      │  │ - WIP photos     │  │                    │
│ - Groups      │  │                  │  │ Keeps:             │
│ - Feed        │  │ Fixes:           │  │ - messages table   │
│ - Events      │  │ - Warm palette   │  │ - Realtime channel │
│ - Passports   │  │                  │  │ - Payment warning  │
└────────────┘  └────────────────┘  └────────────────────┘

┌──────────────────────────┐  ┌────────────────────────────┐
│SuggestionCommentThread   │  │ HoofprintTimeline          │
│(MIGRATE or REFACTOR)     │  │ (NO CHANGES — not social)  │
│                          │  │                            │
│Imports:                  │  │ Only fix:                  │
│- PostHeader              │  │ - Warm palette migration   │
│- ReplyComposer           │  │                            │
│                          │  │ Rationale:                 │
│Fixes:                    │  │ Provenance timeline, not a │
│- Legacy CSS classes      │  │ comment system. Driven by  │
│- shadcn Textarea         │  │ v_horse_hoofprint VIEW.    │
│- Warm palette            │  │ No likes, no replies.      │
└──────────────────────────┘  └────────────────────────────┘
```

### Domain Boundary Rules

| Component | Primitives to Import | Rationale |
|-----------|---------------------|-----------|
| `UniversalFeed` | ALL 5 (`UserAvatar`, `PostHeader`, `HorseEmbedCard`, `ReactionBar`, `ReplyComposer`) | Core social surface — needs full treatment |
| `CommissionTimeline` | `UserAvatar` + `PostHeader` only | Has its own update types, state machine, and photo upload. Only needs identity display. |
| `ChatThread` | `UserAvatar` only | Chat bubbles are a fundamentally different UX. Only add avatar circles beside non-"me" messages. |
| `SuggestionCommentThread` | `PostHeader` + `ReplyComposer` | Needs identity display and proper input. Keep using `catalog_suggestion_comments` table (no migration to `posts` — the voting/approval flow is domain-specific). |
| `HelpIdDetailClient` | `UserAvatar` only | Suggestion cards just need avatar next to suggester name. Upvote system stays as-is. |
| `AdminReplyForm` | None | Admin-only tool. Just warm palette migration. |
| `HoofprintTimeline` | None | Not a social system — provenance records only. Just warm palette migration. |

---

## Implementation Phasing (Recommended)

### Phase 1: Shared Primitives (Est. 2 days)
1. Move existing `UserAvatar.tsx` → `src/components/social/UserAvatar.tsx`
2. Add hash-based fallback color generation (deterministic from alias string)
3. Migrate to warm palette, remove inline `style={{}}` for Tailwind size classes
4. Build `PostHeader.tsx` — composites `UserAvatar` + alias link + timestamp + badge slot + edit/delete actions
5. Build `HorseEmbedCard.tsx` — accepts `horseId`, fetches name + thumbnail + trade status via server action
6. Build `ReactionBar.tsx` — wraps `LikeToggle` + reply count toggle in warm horizontal bar
7. Build `ReplyComposer.tsx` — current user avatar + textarea + "Replying to @user" label

### Phase 2: UniversalFeed Refactor (Est. 2 days)
1. Add `authorAvatarUrl` to `Post` interface and `getPosts()` query
2. Replace `PostCard` header with `PostHeader` primitive
3. Replace inline reply rendering with `ReplyComposer` + threaded display
4. Replace regex horse embed with `HorseEmbedCard`
5. Replace inline like + reply buttons with `ReactionBar`
6. Migrate all 21 cold palette violations to warm tokens

### Phase 3: Secondary Surface Polish (Est. 1.5 days)
1. `CommissionTimeline` — add `UserAvatar` + `PostHeader` to update entries, migrate 19 cold violations
2. `ChatThread` — add `UserAvatar` to non-"me" messages, add horse context card, migrate 9 cold violations
3. `SuggestionCommentThread` — add `PostHeader`, replace legacy `input` class with shadcn `<Textarea>`, fix malformed class names, migrate 10 cold violations

### Phase 4: Palette Sweep (Est. 1 day)
1. `HoofprintTimeline` — migrate 10 cold violations, fix ownership chain `bg-stone-50` → `bg-[#F4EFE6]`
2. `HelpIdDetailClient` — add `UserAvatar` to suggestion cards, migrate 11 cold violations
3. `AdminReplyForm` — migrate 6 cold violations, replace legacy CSS classes
4. `LikeToggle` — replace 3 legacy `var()` references with Tailwind tokens
5. `RichText` — fix `underline` on all text (should only be on links), replace `var(--color-accent)`
6. `UserAvatar` — update existing import in `DiscoverGrid.tsx` to new path

### Phase 5: Verification & Docs (Est. 0.5 day)
1. Full `npx next build` pass
2. Visual verification of all 10 surfaces
3. Update this audit doc → mark all items ✅
4. Update `dev-nextsteps.md` and `onboard.md` metrics
5. Commit

---

## Self-Verification Checklist

- [x] All 10 surfaces documented with accurate data
- [x] Consistency scores filled in for every surface
- [x] Architecture recommendation explains what merges and what stays separate
- [x] Cold palette violations identified and counted (92 total across 10 files)
- [x] No code was modified
- [x] Domain boundaries documented (CommissionTimeline, ChatThread stay separate)
- [x] Existing `UserAvatar.tsx` component discovered and assessed
- [x] `Post` interface and `getPosts()` query gaps identified (missing `authorAvatarUrl`)

---

## 🛑 HUMAN VERIFICATION GATE 🛑

This audit is ready for human review. Key decisions needed before proceeding to implementation:

1. **Confirm the 5-primitive architecture** in `src/components/social/`
2. **Confirm domain boundary rules** — especially that CommissionTimeline and ChatThread stay separate
3. **Confirm phasing** — should we do all 5 phases or prioritize differently?
4. **Confirm `SuggestionCommentThread` approach** — refactor in-place vs. migrate to `posts` table?
5. **Confirm warm palette targets** — `bg-[#F4EFE6]` for backgrounds, `bg-[#FEFCF8]` for cards, `border-edge` for borders, `text-ink` for primary text, `text-muted` for secondary?
