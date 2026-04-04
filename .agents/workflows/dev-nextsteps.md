---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-04-03 (V42 NAMHSA sprint added)
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
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Check recent git history for context:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -10
```

---

# ═══════════════════════════════════════
# COMPLETED SPRINTS (archived)
# ═══════════════════════════════════════

## ✅ Options 10-12: Beta feedback rounds + Supabase advisor fixes — DONE
## ✅ Option 13 (PS-1 through PS-5): Polish Sprint — Mobile, Password, Pagination, Admin — DONE
## ✅ V16: Integrity Sprint — batch import, Blue Book pipeline, SEO, serverless safety — DONE
## ✅ V17: Hobby-Native UX — binder view, bulk ops, rapid intake, photo reorder, privacy — DONE
## ✅ V18: Pro Dashboard & UI glow-up — DONE
## ✅ V19: Group Enrichment — files/docs, admin panel, pinned posts — DONE
## ✅ V20: CSS Architecture Maturity — module extraction — DONE
## ✅ V21: Feed Quality — watermarking, no-photo-no-feed — DONE
## ✅ V22: Commerce Engine — safe-trade state machine — DONE
## ✅ V23: Deep Polish — commerce escape hatches, Blue Book finish split, crypto PIN — DONE
## ✅ V24: Trust & Scale — verified provenance, Blue Book resin blanks, commerce rug-pull lock — DONE
## ✅ V25: Launch Readiness — WebSocket fix, Art Studio link, expired transfer unpark, expert-judged shows — DONE
## ✅ V26: Masterclass Sprint — 15 directives across data integrity, infra, commerce, UX — DONE
## ✅ V27: QA Sprint — 13 fixes, SEO, legal pages, footer, DM context cards — DONE
## ✅ Header Priority+ Navigation — progressive collapse nav for desktop — DONE
## ✅ Reference Link Bug Fix — finish type dropdown was resetting catalog_id — DONE
## ✅ Delete Modal Portal — createPortal to document.body for viewport centering — DONE
## ✅ V34: Show Polish & Realism Sprint — entry preview, smart class browser, results podium, personalized notifications, show history widget, expert judging precedence, cron auto-transition, host override, enriched show records, judge notes — DONE
## ✅ V34/P4: Playwright E2E Show Tests — 16 tests (9 pass, 7 graceful skip), .env.local loading, show listing / detail / entry form / podium / override / mobile / auth guard — DONE
## ✅ Judge Notes Fix — wired judge notes textarea through to show_records.judge_notes (was UI-only, never persisted) — DONE
## ✅ Notification Deep-Links — added link_url column (migration 096), all notifications now click through to referenced item instead of actor profile — DONE
## ✅ V39: Production Hardening Sprint — edge security, perf, pedigree validation, type safety — DONE
## ✅ Tailwind CSS v4 Migration — eliminated all CSS Modules, extracted page CSS, reduced globals.css to ~2,220 lines — DONE
## ✅ Open Beta Hardening (Phase 1) — soft-delete, atomic commerce RPCs, fuzzy search, trusted sellers, observability — DONE
## ✅ V40: Monetization Sprint — Stripe integration, freemium tier, upgrade page, Stablemaster AI, Blue Book PRO, Photo Suite+ — DONE
## ✅ UI Overhaul Part 1 — shadcn/ui + Framer Motion installed, all form-input/form-select replaced with shadcn primitives (48 files), globals.css cleaned — DONE
## ✅ UI Overhaul Part 2 — 12 createPortal modals migrated to shadcn Dialog, PhotoLightbox retained as exception — DONE
## ✅ UI Overhaul Part 3 — Tactile grids (Polaroid cards), Framer Motion stagger animations, badge color overhaul — DONE
## ✅ UI Overhaul Part 4 — DOM Flattening ("Quiet Luxury") — nested boxes eliminated, color palette standardized, tables cleaned — DONE
## ✅ Layout Unification Part 1 — Design system docs created, 4 layout archetype components built (Explorer, Scrapbook, CommandCenter, Focus) — DONE
## ✅ Layout Unification Part 2 — 55+ pages migrated to layout archetypes, only root landing page + chat excluded (intentional) — DONE
## ✅ Cozy Scrapbook Token Migration — 143+ legacy RGBA/semantic tokens purged across 80+ files, 4 batch regex passes, all `bg-card`/`border-edge`/`text-ink`/`text-muted` replaced with `stone` palette — DONE (2026-03-28)
## ✅ Bug Tracker Sprint — Financial Vault navigation (step dots clickable), CSV export filename fix, contrast regression, live/photo show entry differentiation, ShowEntryForm garbled classNames — DONE (2026-03-28)
## ✅ Show Tags PDF Sprint — ShowTags.tsx @react-pdf/renderer component, /api/export/show-tags route, exhibitor numbering system (migration 103-104), QR code generation, Pro tier gating, host vs entrant tag printing — DONE (2026-03-31)
## ✅ Digital County Fair Epic (5 Phases) — per-class entry caps, blind voting, NAMHSA templates, class-first entry flow, visual judging (ribbon stamping), ShowResultsView unified component, Live Show Packer rebrand — DONE (2026-04-01)
## ✅ AI/Data/Copyright Policy — AiDataPolicySection.tsx component added to /about, /privacy, /faq pages. Full transparency on no AI training, ethical data gathering, where AI is used — DONE (2026-04-01)

---

# ═══════════════════════════════════════
# CURRENT QUEUE
# ═══════════════════════════════════════

# 🔴 Priority: Critical

## ✅ Task C-1: V43 Community Experience Deep Dive — DONE (2026-04-04)

**Audit:** `.agents/docs/community-commenting-audit.md` (Task 1 output)
**Workflows (execute in order):**
1. ✅ `.agents/workflows/v43-community-audit.md` — Systematic audit of all 10 commenting surfaces — **DONE (2026-04-04)**
2. ✅ `.agents/workflows/v43-community-implementation.md` — Shared primitives + surface upgrades — **DONE (2026-04-04)**
**Architecture:** 5 shared primitives in `src/components/social/`:
- ✅ `UserAvatar` — consistent avatar circle with hash-based fallback color
- ✅ `PostHeader` — avatar + alias + timestamp + badge + actions slot
- ✅ `HorseEmbedCard` — rich horse preview (name + thumbnail + trade status)
- ✅ `ReactionBar` — like + reply toggle (warm palette, optimistic updates)
- ✅ `ReplyComposer` — inline reply with avatar + "replying to" context
**Key constraint:** Domain boundaries respected:
- ✅ `UniversalFeed` → imports ALL 5 primitives (fixes Groups, Feed, Events, Passports, Profiles)
- ✅ `SuggestionCommentThread` → rewritten with `PostHeader` + `ReplyComposer`
- ✅ `HelpIdDetailClient` → added `UserAvatar` + warm palette migration
- ✅ `RichText` → fixed global underline bug, removed legacy CSS variable
- ✅ `LikeToggle` → migrated to warm palette tokens
- `CommissionTimeline` → deferred (needs targeted polish only)
- `ChatThread` → deferred (needs targeted polish only)
- `HoofprintTimeline` → NOT a comment system, no changes needed
**Data model:** `authorAvatarUrl` added to `Post` type + query layer via `users.avatar_url`
**New server action:** `getHorseEmbedData` for rich horse embed cards
**Post type updated:** `authorAvatarUrl` added throughout `getPosts()` response chain
**Status:** ✅ IMPLEMENTATION COMPLETE (2026-04-04) — 2 commits, 0 errors, 245 tests pass

---

## ✅ Task C-0.5: V42 NAMHSA Partnership Sprint — ALL EPICS COMPLETE (2026-04-03)

**Planning Doc:** `.agents/docs/v41_master-doc-consolidation.md` (section: NAMHSA Readiness)
**Audit:** `.agents/docs/namhsa-alignment-audit.md` (Task 1 output — 19 ✅, 4 polish, 6 gaps)
**Pitch Deck:** `.agents/docs/namhsa-pitch-deck-summary.md` (VP meeting one-pager)
**Workflows (execute in order):**
1. ✅ `.agents/workflows/v42-namhsa-audit.md` — Gap analysis complete (2026-04-03)
2. ✅ `.agents/workflows/v42-namhsa-features.md` — 5 feature epics + pitch summary planned (2026-04-03)
**Epic execution order:** ✅ Public Results → ✅ Platform-Verified Records → ✅ NAN Card Polish → ✅ Regions → ✅ Judge COI
**Status:** ✅ ALL 5 EPICS COMPLETE. Feature freeze lifted. Ready for NAMHSA VP pitch.
**Constraint:** ~~🔒 FEATURE FREEZE~~ → Lifted (2026-04-03)
**Deadline:** 6 weeks from 2026-04-03 (NAMHSA VP meeting)

---

## ✅ Task C-0: V41 Master Documentation Consolidation — DONE (2026-04-03)

**Planning Doc:** `.agents/docs/v41_master-doc-consolidation.md`
**Results:**
1. ✅ `MASTER_BLUEPRINT.md` — Iron Laws, guardrails, tech decisions, agent protocol, NAMHSA checklist — **DONE**
2. ✅ `MASTER_SUPABASE.md` — 61 tables, 30+ RPCs, RLS patterns, Mermaid ER, live metrics from Supabase CLI — **DONE**
3. ✅ Archive strategy — 81 completed workflows + 9 docs moved to `.agents/archive/2026-Q1/` (91→10 workflows, 20→11 docs) — **DONE**
**Constraint:** 🔒 NO CODE CHANGES — only `.md` files modified
**Post-sprint state:** `.agents/` now has 2 MASTER files + 10 active workflows + 11 active docs

---

## ~~Task C-1: Warm Parchment Aesthetic Restoration~~ ✅ DONE

**Workflow:** `.agents/workflows/warm-parchment-restoration.md`
**Status:** ✅ COMPLETE — warm tokens (#F4EFE6, #FEFCF8, #2D2318, #E0D5C1) deployed in globals.css @theme + :root + shadcn variables
**Verified:** Color tokens, shadows, typography, header/footer all warm parchment

# 🟡 Priority: Medium

## Task M-0: Scale & Revenue Epic (6 workflows)

**Workflows:**
- ✅ `.agents/workflows/065-pro-asset-pipeline.md` — Zero-cost thumbnails, tier-gated quality — **DONE (2026-03-28)**
- ✅ `.agents/workflows/066-sentry-observability.md` — Error tracking, silent catch audit — **DONE (2026-03-28)**
- ✅ `.agents/workflows/067-pwa-offline-stable.md` — Offline Barn Mode for live shows — **DONE (2026-03-28)**
- ✅ `.agents/workflows/068-realtime-engine.md` — Replace polling with Supabase Realtime push — **DONE (2026-03-29)**
- ✅ `.agents/workflows/069-monetization-core.md` — Promoted listings, ISO bounties, à la carte PDFs, Studio Pro — **DONE (2026-03-29)**
- ✅ `.agents/workflows/070-monetization-expansion.md` — eBay affiliates, printable show tags — **DONE (2026-03-29)**
**Status:** 6/6 complete — 🎉 M-0 MILESTONE COMPLETE

---

## ~~Task M-1: Open Beta Hardening~~ ✅ DONE

**Workflow:** `.agents/workflows/open-beta-hardening.md`
**Status:** ✅ ALL 6 TASKS COMPLETE
- ✅ Task 1: Tombstone soft-delete (migration 098)
- ✅ Task 2: Atomic commerce RPCs (migration 099)
- ✅ Task 3: Visibility-aware polling (NotificationBell)
- ✅ Task 4: Server-side fuzzy search (migration 100)
- ✅ Task 5: Escrow liability UX — disclaimer checkbox + "External Payment" labels
- ✅ Task 6: Silent catch block audit — all replaced with logger.error()

---

## ~~Task M-2: Landing Page Refresh~~ ✅ DONE
 
**Status:** ✅ COMPLETE — replaced stale "Coming Soon" with "Already Live" (Groups, PWA, AI Stablemaster), added Pro tier teaser with feature grid, transparency banner with honest data-gathering disclosure, updated show copy for NAMHSA/ribbon judging, upgraded CTAs — **DONE (2026-04-01)**

---

# 🟢 Priority: Nice-to-Have

## Task N-0: Digital County Fair UX Epic (5 phases)

**Workflows:**
- ✅ `.agents/workflows/v35-county-fair-phase1.md` — Fairness & Entry Limits (3-per-class, blind voting) — **DONE (2026-04-01)**
- ✅ `.agents/workflows/v35-county-fair-phase2.md` — 1-Click NAMHSA Show Templates — **DONE (2026-04-01)**
- ✅ `.agents/workflows/v35-county-fair-phase3.md` — Class-First Reverse Entry Flow — **DONE (2026-04-01)**
- ✅ `.agents/workflows/v35-county-fair-phase4.md` — Visual Judging Interface (ribbon stamping) — **DONE (2026-04-01)**
- ✅ `.agents/workflows/v35-county-fair-phase5.md` — Live Show Packer Rebrand — **DONE (2026-04-01)**
**Status:** 5/5 complete — 🎉 N-0 MILESTONE COMPLETE

---

## ✅ Task N-0.5: Mobile UX "Smart Path" Epic (4 phases) — DONE (2026-04-02)

**Workflows:**
- ✅ `.agents/workflows/071-mobile-qa-automation.md` — Playwright 4-device overflow matrix (60 tests) — **DONE (2026-04-02)**
- ✅ `.agents/workflows/072-mobile-viewport-globals.md` — overflow-x-hidden, dvh units, iOS Safari zoom fix — **DONE (2026-04-02)**
- ✅ `.agents/workflows/073-mobile-macro-layouts.md` — 22 grid collapses, 3 table scroll wrappers — **DONE (2026-04-02)**
- ✅ `.agents/workflows/074-mobile-components-touch.md` — Dialog 90dvh containment, flex-wrap (12 fixes), word-break, WCAG 44px touch targets — **DONE (2026-04-02)**
**Status:** 4/4 complete — 🎉 N-0.5 MILESTONE COMPLETE
**Metrics:** 60/60 device tests pass (Desktop Chrome, Mobile Safari, Mobile Chrome, iPad), 245 unit tests pass, zero bare grid-cols-2 or 100vh remaining

---

## ✅ Task N-0.6: Data Integrity & Header UX Sprint — DONE (2026-04-02)

**Migrations:**
- ✅ Migration 106: `discover_users_view` — added `total_horse_count` column for all non-deleted horses
- ✅ Migration 107: Fixed `public_horse_count` to use `visibility = 'public'` instead of stale `is_public` boolean
- ✅ Migration 108: `SECURITY DEFINER` counting functions (`count_user_horses_total`, `count_user_horses_public`) — bypass RLS for accurate Discover/Profile counts
- ✅ Migration 109: Visibility drift sync — `UPDATE` existing rows, `trg_sync_visibility` trigger keeps `is_public` and `visibility` in sync bidirectionally, RLS policy switched to `visibility = 'public'`

**Code Changes:**
- ✅ Discover page — shows total stable count, sorting by total, Discover grid updated
- ✅ Profile page — total horse count via `getAdminClient()` (bypasses RLS), shows "X models (Y public)"
- ✅ Groups — member count computed from `group_memberships` (was using stale denormalized `member_count` column)
- ✅ Header avatar — `getHeaderData()` now resolves Supabase storage paths to signed URLs
- ✅ Header auth — `onAuthStateChange` calls `router.refresh()` to force server component re-evaluation
- ✅ Header mobile — desktop nav hidden below `md`, logo shortened to "MHH", hamburger shows notification badge
- ✅ Main layout — `min-h-[calc(100dvh-var(--header-height))]` on `<main>`

---

## ✅ Task N-0.7: Open Beta Hardening & Scale Refactor (3 epics) — DONE (2026-04-03)

**Workflows:**
- ✅ `.agents/workflows/075-realtime-audit.md` — Consolidated 3 Realtime channels into global `NotificationProvider`, removed per-component remount subscriptions — **DONE (2026-04-03)**
- ✅ `.agents/workflows/076-search-rpc-enforcement.md` — Replaced PostgREST `.or(ilike)` scans with `search_catalog_fuzzy` RPC (pg_trgm GIN index), migration 110 — **DONE (2026-04-03)**
- ✅ `.agents/workflows/077-rsc-pagination.md` — Profile page `.range(0,23)`, `loadMoreProfileHorses` server action, `ProfileLoadMore` client component, reply cap 100 — **DONE (2026-04-03)**
**Status:** 3/3 complete — 🎉 N-0.7 MILESTONE COMPLETE
**Metrics:** 245 unit tests pass, migration count now 110, 2 global Realtime channels (was 3 per-component), catalog search <50ms (was 517ms), profile RSC capped at 24 horses (was unbounded)

---

## Task N-1: globals.css Continued Cleanup

**Why:** `globals.css` is ~1,750 lines. Many class-based styles (`.show-record-*`, `.settings-toggle`, `.filter-*`, `.profile-hero`, `.collection-hero`) could be replaced with Tailwind utility classes as their consuming components are touched.
**Approach:** Remove classes organically as layout unification converts pages. Verify each class has zero consumers before deletion.

---

## ✅ Task N-2: Performance Audit — DONE (lazy-loaded @react-pdf/renderer 1.5MB, clean bundle, no slow queries)

**Why:** With 70 migrations and growing data, query performance on pages like `/dashboard` and `/feed` should be monitored.

**How:**
1. Run Lighthouse on key pages
2. Check Supabase dashboard for slow queries
3. Consider adding database indexes for frequent query patterns

---

## ✅ Task N-3: Accessibility Audit — DONE (strong WCAG 2.1 AA coverage, 50+ aria-labels, 40+ aria-hidden, Simple Mode)

**Why:** Color contrast, keyboard navigation, and screen reader support should be verified for WCAG 2.1 AA compliance.

**How:**
1. Run axe-core or Lighthouse accessibility audit
2. Fix high-impact issues (missing alt text, low contrast, missing ARIA labels)
3. Test keyboard-only navigation through the add-horse flow

---

# ═══════════════════════════════════════
# SIGN-OFF CHECKLIST
# ═══════════════════════════════════════

After completing a batch, verify:

- [ ] All targeted tasks marked ✅
- [ ] `npx next build` passes cleanly
- [ ] Changes committed with descriptive message
- [ ] This file updated and committed alongside code changes

Final build check:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Push:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "chore: update dev-nextsteps with completed tasks" && git push
```
