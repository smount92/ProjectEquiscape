# 📜 MASTER BLUEPRINT — Model Horse Hub

> **This is the Single Source of Truth for all architectural rules.**
> Every workflow and every agent session MUST read this file first.
> Last updated: 2026-04-07 (V43.5 + Friendly Photo URLs workflow)

**Reading order for new sessions:**
1. Read THIS file (Iron Laws + guardrails)
2. Read `MASTER_SUPABASE.md` (schema reference)
3. Read `workflows/onboard.md` (current state snapshot — metrics, file counts)
4. Read `workflows/dev-nextsteps.md` (active task queue)

---

## 🏛️ Project Iron Laws

These are the **non-negotiable architectural principles** that govern every database migration, server action, and UI component. They were forged during the Grand Unification (V6–V10) and hardened through 111 production migrations.

1. **Zero Data Loss Migrations** — Every schema change MUST include a robust PL/pgSQL data migration script. We move existing production data *before* we drop old tables.

2. **Exclusive Arcs** — When linking a universal table (e.g., `posts`, `media_attachments`) to specific entities (horses, groups, events), use multiple nullable Foreign Keys combined with a Postgres `CHECK (num_nonnulls(...) <= 1)` constraint to ensure strict referential integrity.

3. **Event Sourcing (Single Source of Truth)** — If data exists in a primary domain table (e.g., `show_records`, `horse_transfers`), it must **never** be manually duplicated into a UI timeline table. UI timelines must be driven by PostgreSQL `VIEWS` (e.g., `v_horse_hoofprint`).

4. **Vercel Payload Compliance** — File payloads must NEVER pass through Next.js Server Actions. Direct-to-storage via the Supabase browser client is mandatory for all media.

5. **Atomic Mutations** — Counters (likes, replies) and complex state transitions must use transactional Postgres RPCs with `FOR UPDATE` row locks (e.g., `make_offer_atomic`, `respond_to_offer_atomic`, `toggle_post_like`).

6. **RLS InitPlan Pattern** — All RLS policies MUST use `(SELECT auth.uid())` instead of bare `auth.uid()` to prevent per-row function evaluation. Every `SECURITY DEFINER` function must include `SET search_path = ''` with fully qualified `public.table_name` references. The `pg_trgm` extension lives in the `extensions` schema (not `public`).

---

## ⚙️ Tech Decisions (Current as of V41)

| Decision | Status | Notes |
|----------|--------|-------|
| Tailwind CSS v4 + `@theme` tokens | ✅ Official | Vanilla CSS hybrid is acceptable debt in `globals.css` |
| shadcn/ui (Radix UI primitives) | ✅ Official | 11 primitives installed — use for ALL form inputs |
| Framer Motion | ✅ Official | Spring physics, stagger reveals, `whileTap`/`whileHover` |
| Supabase (PostgreSQL + RLS) | ✅ Official | Pro plan, Realtime via global `NotificationProvider` |
| Next.js App Router (RSC) | ✅ Official | v16.1, Turbopack, `after()` for deferred tasks |
| Stripe Checkout Sessions | ✅ Official | Subscription + a-la-carte, webhook at `/api/webhooks/stripe` |
| "Cozy Scrapbook" Warm Parchment | ✅ Official | `bg-[#F4EFE6]` bg, `bg-[#FEFCF8]` cards, Hunter Green `#2C5545` accent |
| Cold palette (`bg-white`, `bg-stone-50`) | ❌ Banned | Use warm semantic tokens — see `docs/guides/design-system.md` |
| Inline `style={{...}}` for layout | ❌ Banned | Use Tailwind classes exclusively |
| `createPortal` for modals | ❌ Banned | Use `<Dialog>` from shadcn/ui (exception: `PhotoLightbox.tsx`) |
| CSS Modules (`.module.css`) | ❌ Banned | Migrated to Tailwind v4 — do not reintroduce |
| Silent `catch {}` blocks | ❌ Banned | Use `logger.error()` from `@/lib/logger` |
| `Math.random()` for security | ❌ Banned | Use `crypto.randomInt()` for PINs and tokens |

---

## 🔒 Live User-Data Guardrails (NON-NEGOTIABLE)

> **75+ registered users with financial and provenance data. This section is absolute.**

### Protected Tables (require human review for ANY schema change):
- `user_horses` — model inventory (900+ rows)
- `financial_vault` — purchase prices, estimated values (PRIVATE)
- `show_records` — competition history, provenance
- `transactions` — commerce state machine (offers, payments)
- `horse_images` — Supabase Storage — public `horse-images` bucket (CDN-cacheable, no signed URLs), private `chat-attachments` bucket (signed URLs for DM photos)
- `events` / `event_entries` — competition engine
- `users` — profiles, auth, tier metadata
- `horse_ownership_history` — transfer provenance chain

### Rules:
1. Any Server Action or API route touching protected tables MUST:
   - Use atomic RPCs or Server Actions with an RLS verification comment
   - Call `requireAuth()` from `@/lib/auth` (NOT raw `getUser()`)
   - Use `logger.error()` for failures (NEVER silent `catch {}`)
   - Be wrapped in `after()` for background tasks (serverless safety)

2. Any migration touching protected tables MUST:
   - Be reviewed by human before `supabase db push`
   - Include a rollback plan or `IF NOT EXISTS` guards
   - Never let AI run `supabase db push` or `supabase migration up` directly

3. URLs must never expose raw UUIDs for public views (use `alias_name` or `slug`)

4. `financial_vault` is NEVER queried on public routes — owner-only via RLS

5. Watermark opt-in: respect `watermark_photos` boolean on users table

---

## 🤖 Agent Execution Protocol

Every workflow file and every new agent session MUST follow this protocol:

### Session Start:
1. Read `MASTER_BLUEPRINT.md` (this file)
2. Read `MASTER_SUPABASE.md` (schema reference)
3. Read `workflows/onboard.md` (current metrics and conventions)
4. Read `workflows/dev-nextsteps.md` (task queue)
5. Ask the human what they'd like to do

### Before Writing Code:
- Verify the change doesn't violate any Iron Law
- Check if a similar pattern already exists in the codebase
- For database changes: write the migration SQL and present for human review FIRST

### After Writing Code:
- Run `cmd /c "npx next build 2>&1"` — must be 0 errors
- Update the workflow file — mark tasks ✅ DONE with date
- Update `onboard.md` metrics if migration count or component count changed
- Update `dev-nextsteps.md` if completing a tracked task

### Workflow File Header (MANDATORY for new workflows):
Every new workflow MUST include this at the top:
> **MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first.
> All Iron Laws and guardrails apply.

---

## 🎯 NAMHSA Pitch Readiness (6-Week Checklist)

### Already Shipped:
- [x] Unified Competition Engine (events, entries, classes, divisions)
- [x] NAMHSA Show Templates (1-click class lists from real NAMHSA divisions)
- [x] Live Show Packer (previously "Show String Planner")
- [x] Blind Voting for Photo Shows
- [x] Class-First Entry Flow
- [x] Visual Judging Interface (ribbon stamping)
- [x] Expert Judge Assignments
- [x] Show Results & Podium Display
- [x] Show Tags PDF (entrant + host printing, QR codes)
- [x] Pro Tier Gating (Stripe Checkout Sessions)
- [x] PWA / Offline Barn Mode for live shows
- [x] Mobile-responsive judging and entry forms
- [x] Public shareable show results page (`/shows/[id]/results`) — no auth required
- [x] Results CSV export in NAMHSA-compatible format (`/api/export/show-results/[eventId]`)
- [x] Platform-Verified trust badges (🛡️ MHH Verified / ✅ Host Verified / 📝 Self-Reported)
- [x] NAN card 4-year expiry validation (NAMHSA rule)
- [x] NAN card CSV export for collectors (`/api/export/nan-cards`)
- [x] NAMHSA region constants (11 regions) in `src/lib/constants/namhsa.ts`
- [x] `sanctioning_body` UI — NAMHSA Sanctioned toggle on show creation + badge on listings
- [x] Judge COI checker (own horse, past ownership 12-month lookback, is-host) — advisory
- [x] Ring conflict detection and resolution UI
- [x] Multi-judge scoring aggregation
- [x] Pitch deck summary doc for VP meeting

### Must Verify Before Pitch:
- [ ] Show host can create event → add divisions → add classes → open entries → judge → close → results display
- [ ] Show tags PDF generates correctly for all entry types
- [ ] Mobile experience is polished for show judges and exhibitors
- [ ] Performance: show pages load in <1s for events with 100+ entries
- [ ] Offline PWA show-string planner works in airplane mode (fairground test).

### V42 Sprint: ✅ COMPLETE (2026-04-03)
- [x] Public shareable show results page (`/shows/[eventId]/results`)
- [x] Results CSV export in NAMHSA-compatible format
- [x] NAN card 4-year expiry validation
- [x] NAN card CSV export for collectors
- [x] NAMHSA region constants (11 regions) on Discover + Groups
- [x] `sanctioning_body` column on `events` table + "NAMHSA Sanctioned" badge
- [x] Judge COI checker (own horse, past ownership, is-host)
- [x] Pitch deck summary doc for VP meeting

### V43/V43.5 Sprint: ✅ COMPLETE (2026-04-04)
- [x] Community Commenting Audit across all 10 surfaces
- [x] 5 shared social primitives (`UserAvatar`, `PostHeader`, `HorseEmbedCard`, `ReactionBar`, `ReplyComposer`)
- [x] Full warm parchment migration across UniversalFeed, SuggestionCommentThread, HelpId, CommissionTimeline, ChatThread
- [x] Avatar prominence + real uploaded profile pictures in all comment surfaces
- [x] Insurance Report bug fixes: deleted horse filter, WebP→PNG conversion, collection count merge
- [x] DM Photo Attachments: `chat-attachments` bucket, inline photo grid, 📎 upload
- [x] Friendly Photo URLs workflow created — awaiting execution (Migration 112 + `/photo/[slug]` route)
