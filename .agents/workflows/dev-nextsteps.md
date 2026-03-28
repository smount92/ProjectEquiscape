---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-28
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

---

# ═══════════════════════════════════════
# CURRENT QUEUE
# ═══════════════════════════════════════

# 🔴 Priority: Critical

## Task C-1: Warm Parchment Aesthetic Restoration

**Workflow:** `.agents/workflows/warm-parchment-restoration.md`
**Status:** Not started
**Scope:** Restore warm parchment color tokens, shadows, typography, header/footer styling. Pure color/font changes — no DOM restructuring.

# 🟡 Priority: Medium

## Task M-0: Scale & Revenue Epic (6 workflows)

**Workflows:**
- ✅ `.agents/workflows/065-pro-asset-pipeline.md` — Zero-cost thumbnails, tier-gated quality — **DONE (2026-03-28)**
- ✅ `.agents/workflows/066-sentry-observability.md` — Error tracking, silent catch audit — **DONE (2026-03-28)**
- `.agents/workflows/067-pwa-offline-stable.md` — Offline Barn Mode for live shows
- `.agents/workflows/068-realtime-engine.md` — Replace polling with Supabase Realtime push
- `.agents/workflows/069-monetization-core.md` — Promoted listings, ISO bounties, à la carte PDFs, Studio Pro
- `.agents/workflows/070-monetization-expansion.md` — eBay affiliates, printable show tags
**Status:** 2/6 complete (065, 066 done)

---

## Task M-1: Open Beta Hardening (Remaining)

**Workflow:** `.agents/workflows/open-beta-hardening.md`
**Status:** Phase 1 substantially complete; some items remain (visibility-aware polling, payment disclaimers)
**Scope:** NotificationBell polling optimization, liability UX, remaining observability gaps

---

## Task M-2: Landing Page Refresh

**Why:** The landing page (`src/app/page.tsx`) needs updated imagery and value proposition now that the platform has grown to include Stripe billing, AI features, and 10,500+ catalog items.

---

# 🟢 Priority: Nice-to-Have

## Task N-1: globals.css Continued Cleanup

**Why:** `globals.css` is ~2,220 lines. Many class-based styles (`.show-record-*`, `.settings-toggle`, `.filter-*`, `.profile-hero`, `.collection-hero`) could be replaced with Tailwind utility classes as their consuming components are touched.
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
