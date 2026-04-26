---
description: "V44 Visual QA Phase 4 — Text Sections & Typography. Audit passports, timelines, posts, bios, and event descriptions for font-weight consistency, line-height, heading hierarchy, and overflow-wrap."
---

# V44 Visual QA — Phase 4: Text Sections & Typography

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Every text-heavy page has consistent typography, proper heading hierarchy, and handles long content gracefully (no overflow, no orphaned words, no invisible text).
> **Prerequisite:** Phase 3 complete.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 4.1: Stable Detail (Passport) — `src/app/stable/[id]/page.tsx`

1. **Heading hierarchy:** Single `<h1>` for horse name, `<h2>` for sections (Show Bio, Vault, etc.)
2. **Long model names:** Test with "Breyer Traditional Series — Ideal American Quarter Horse Stallion (Special Run)" — must wrap, not overflow
3. **Reference link badge:** Text readable, link clickable
4. **Public notes:** `overflow-wrap: break-word` to prevent long URLs from breaking layout
5. **Condition grade badge:** Contrast against card background
6. **Simple Mode:** All text scales properly at 130%, no overlapping sections

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.2: Community Detail (Public Passport) — `src/app/community/[id]/page.tsx`

Same checks as 4.1, plus:
1. Owner info section readable (avatar + name + follow button)
2. Comment section typography consistent with post text
3. Favorite/share buttons don't overlap text on mobile
4. Photo gallery caption text readable

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.3: Hoofprint Timeline — `src/components/HoofprintTimeline.tsx`

1. Timeline line/dots visible on parchment
2. Event labels readable at all sizes
3. Date formatting consistent
4. Long event descriptions wrap properly
5. Timeline doesn't create horizontal overflow on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.4: Profile Page — `src/app/profile/[alias_name]/page.tsx`

1. Display name + bio text hierarchy clear
2. Bio text handles long unbroken strings (URLs, hashtags)
3. Badge display section wraps on mobile
4. Stats row (models, followers, etc.) readable on mobile
5. ProfileLoadMore cards maintain typography consistency

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.5: Feed Posts — `src/app/feed/page.tsx` + `src/app/feed/[id]/page.tsx`

1. Post content text has adequate line-height (`leading-relaxed`)
2. Mentions (@username) styled distinctly from body text
3. Horse embed cards have consistent typography with surrounding text
4. Timestamps readable (not too faint)
5. Comment thread indentation clear on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.6: Event Detail — `src/app/community/events/[id]/page.tsx`

1. Event title as `<h1>`, section headers as `<h2>`
2. Date/time display formatted and readable
3. Description text handles markdown/rich content
4. Entry list text doesn't truncate
5. NAMHSA badge and sanctioning info visible

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.7: Group Detail — `src/app/community/groups/[slug]/page.tsx`

1. Group name + description hierarchy
2. Member list names truncate gracefully (ellipsis, not clip)
3. Post content in group feed consistent with main feed

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.8: Static/Legal Pages — About, FAQ, Terms, Privacy, Getting Started

Batch audit:
```
src/app/about/page.tsx
src/app/faq/page.tsx
src/app/terms/page.tsx
src/app/privacy/page.tsx
src/app/getting-started/page.tsx
```

1. Heading hierarchy (`<h1>` → `<h2>` → `<h3>`) correct on each
2. Body text readable (not too wide — max-width ~72ch)
3. Lists properly indented
4. Links distinguishable from body text (underlined or colored)
5. No cold palette remnants

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.9: Upgrade Page — `src/app/upgrade/page.tsx`

1. Tier comparison cards have consistent typography
2. Price text prominent and readable
3. Feature lists properly aligned
4. CTA buttons have adequate contrast

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.10: Notifications — `src/app/notifications/page.tsx`

1. Notification text truncates gracefully
2. Unread vs read visual distinction adequate
3. Timestamps formatted consistently
4. Action links (if any) distinguishable from body

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 4.11: Studio Pages — Landing, Dashboard, Profile, Commission

Batch audit:
```
src/app/studio/page.tsx
src/app/studio/dashboard/page.tsx
src/app/studio/[slug]/page.tsx
src/app/studio/commission/[id]/page.tsx
src/app/studio/my-commissions/page.tsx
```

1. Artist bio/description text has adequate line-height
2. Commission status badges readable
3. WIP update timeline text consistent
4. Portfolio section typography matches community cards

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 4.12: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 4 — typography audit, heading hierarchy + overflow-wrap + line-height across all text surfaces"
```

---

## ✅ DONE Protocol

- [ ] Every page has a single `<h1>` with proper heading hierarchy
- [ ] Long content (names, URLs, descriptions) wraps gracefully everywhere
- [ ] `line-height` adequate in Simple Mode (no overlapping text)
- [ ] Timestamps, badges, and metadata text all have ≥ 4.5:1 contrast
- [ ] Build passes, committed

**Next:** Run `/v44-visual-qa-phase5-modals-lightboxes`
