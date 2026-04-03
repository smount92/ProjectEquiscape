---
description: V41 Master Documentation Consolidation — Task 1 of 3. Create MASTER_BLUEPRINT.md with Iron Laws, guardrails, and agent protocol.
---

# V41 Task 1 — Create `MASTER_BLUEPRINT.md`

> **MANDATORY:** Read `.agents/docs/v41_master-doc-consolidation.md` first. This workflow implements Task 1 of the V41 Master Documentation Consolidation sprint.
> **Constraint:** This sprint touches ONLY `.md` files in `.agents/`. Do NOT modify any `.tsx`, `.ts`, `package.json`, or create new migration files.

// turbo-all

---

## Step 1: Read Source Documents

Before writing anything, read these files in full to extract the content:

```
View file: .agents\docs\Grand_Unification_Plan.md        ← Iron Laws (lines 8-13)
View file: .agents\workflows\onboard.md                  ← Tech stack, conventions, database patterns
View file: .agents\docs\Open_Beta_Plan.md                ← NAMHSA context
View file: .agents\docs\Phase6_master_blueprint.md       ← Recent architectural decisions
```

---

## Step 2: Create `.agents/MASTER_BLUEPRINT.md`

Create the file at `.agents/MASTER_BLUEPRINT.md` (NOT in `docs/` or `workflows/` — it lives at the root of `.agents/`).

The file must contain these **exact sections** in this order:

### Section 1: Header & Purpose

```markdown
# 📜 MASTER BLUEPRINT — Model Horse Hub

> **This is the Single Source of Truth for all architectural rules.**
> Every workflow and every agent session MUST read this file first.
> Last updated: [today's date]

**Reading order for new sessions:**
1. Read THIS file (Iron Laws + guardrails)
2. Read `MASTER_SUPABASE.md` (schema reference)
3. Read `workflows/onboard.md` (current state snapshot — metrics, file counts)
4. Read `workflows/dev-nextsteps.md` (active task queue)
```

### Section 2: Project Iron Laws

Extract the 5 Iron Laws from `Grand_Unification_Plan.md` lines 8-13. Present them numbered and verbatim:

1. **Zero Data Loss Migrations** — Every schema change MUST include a PL/pgSQL data migration script. Move existing production data BEFORE dropping old tables.
2. **Exclusive Arcs** — Universal tables (`posts`, `media_attachments`) use multiple nullable FKs with `CHECK (num_nonnulls(...) <= 1)` for strict referential integrity.
3. **Event Sourcing** — If data exists in a domain table (`show_records`, `horse_transfers`), it must NEVER be manually duplicated. UI timelines are driven by PostgreSQL VIEWS (e.g., `v_horse_hoofprint`).
4. **Vercel Payload Compliance** — File payloads must NEVER pass through Server Actions. Direct-to-storage via the Supabase browser client is mandatory for all media.
5. **Atomic Mutations** — Counters and state transitions must use transactional RPCs with `FOR UPDATE` row locks (e.g., `make_offer_atomic`, `toggle_post_like`).

Then add a 6th law discovered through production experience:

6. **RLS InitPlan Pattern** — All RLS policies MUST use `(SELECT auth.uid())` instead of bare `auth.uid()` to prevent per-row function evaluation. Every `SECURITY DEFINER` function must include `SET search_path = ''` with fully qualified `public.table_name` references.

### Section 3: Tech Decisions (Current as of V41)

Document these decisions as settled:

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

### Section 4: Live User-Data Guardrails

> **This section is NON-NEGOTIABLE. 75+ real users with financial and provenance data.**

Write this section exactly:

```markdown
## 🔒 Live User-Data Guardrails (NON-NEGOTIABLE)

### Protected Tables (require human review for ANY schema change):
- `user_horses` — model inventory (900+ rows)
- `financial_vault` — purchase prices, estimated values (PRIVATE)
- `show_records` — competition history, provenance
- `transactions` — commerce state machine (offers, payments)
- `horse_images` — storage references (private signed URLs)
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
```

### Section 5: Agent Execution Protocol

```markdown
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
```

### Section 6: NAMHSA Readiness Notes

```markdown
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

### Must Verify Before Pitch:
- [ ] Show host can create event → add divisions → add classes → open entries → judge → close → results display
- [ ] Show tags PDF generates correctly for all entry types
- [ ] Mobile experience is polished for show judges and exhibitors
- [ ] Performance: show pages load in <1s for events with 100+ entries

### Nice-to-Have for Pitch:
- [ ] Ring conflict detection and resolution UI
- [ ] Multi-judge scoring aggregation
- [ ] Public show results page (shareable URL)
```

---

## Step 3: Self-Verification

After creating the file, verify:

1. **File exists at:** `.agents/MASTER_BLUEPRINT.md` (not in `docs/` or `workflows/`)
2. **All 6 sections are present:** Header, Iron Laws, Tech Decisions, Guardrails, Agent Protocol, NAMHSA
3. **Iron Laws match Grand Unification Plan** verbatim (plus the 6th RLS law)
4. **No code was modified** — only `.md` file created
5. **Run:** `cmd /c "npx next build 2>&1"` — confirm 0 errors (should be trivially green since we only added a .md file)

---

## 🛑 HUMAN VERIFICATION GATE 🛑

Present the completed `MASTER_BLUEPRINT.md` for human review. Wait for approval before proceeding to V41 Task 2.
