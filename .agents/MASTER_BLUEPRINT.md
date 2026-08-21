# 📜 MASTER BLUEPRINT — Model Horse Hub

> **This is the Single Source of Truth for all architectural rules.**
> Every workflow and every agent session MUST read this file first.
> Last updated: 2026-08-21 — **the launch release**. The site was rebuilt end to end into five
> rooms and deployed; migrations 165–173 and 175 are applied in prod. All nine v1 feature-flag
> fallbacks were deleted in the same pass (see "Phase 0" below), so the flag names you will find
> in older docs and commit messages no longer exist in the code.

**Reading order for new sessions:**
1. Read THIS file (Iron Laws + guardrails + the five-room site map)
2. Read `MASTER_SUPABASE.md` (schema reference)
3. Read `../docs/README.md` (documentation index — routes, actions, design language)
4. Read `workflows/dev-nextsteps.md` (active task queue)

`workflows/onboard.md` and the other workflow files predate the launch release; treat their
metrics and flag lists as history, and trust these two MASTER files plus `docs/` instead.

---

## 🏛️ Project Iron Laws

These are the **non-negotiable architectural principles** that govern every database migration, server action, and UI component. They were forged during the Grand Unification (V6–V10) and hardened through 170 production migrations (numbered 001–175).

1. **Zero Data Loss Migrations** — Every schema change MUST include a robust PL/pgSQL data migration script. We move existing production data *before* we drop old tables.

2. **Exclusive Arcs** — When linking a universal table (e.g., `posts`, `media_attachments`) to specific entities (horses, groups, events), use multiple nullable Foreign Keys combined with a Postgres `CHECK (num_nonnulls(...) <= 1)` constraint to ensure strict referential integrity.

3. **Event Sourcing (Single Source of Truth)** — If data exists in a primary domain table (e.g., `show_records`, `horse_transfers`), it must **never** be manually duplicated into a UI timeline table. UI timelines must be driven by PostgreSQL `VIEWS` (e.g., `v_horse_hoofprint`).

4. **Vercel Payload Compliance** — File payloads must NEVER pass through Next.js Server Actions. Direct-to-storage via the Supabase browser client is mandatory for all media.

5. **Atomic Mutations** — Counters (likes, replies) and complex state transitions must use transactional Postgres RPCs with `FOR UPDATE` row locks (e.g., `make_offer_atomic`, `respond_to_offer_atomic`, `toggle_post_like`).

6. **RLS InitPlan Pattern** — All RLS policies MUST use `(SELECT auth.uid())` instead of bare `auth.uid()` to prevent per-row function evaluation. Every `SECURITY DEFINER` function must include `SET search_path = ''` with fully qualified `public.table_name` references. The `pg_trgm` extension lives in the `extensions` schema (not `public`).

7. **Zod at Every Action Boundary** — Every new Server Action validates its input with a `zod` schema BEFORE touching `requireAuth()` or the database. The order is fixed: **zod parse → `requireAuth()` → explicit ownership/role check → RLS-first write** (admin client only with a code comment justifying why RLS can't do the job). Live in the rebuilt domains (`shows`, `groups`, `stable`, `showring`, `commerce`, `deals`, `studio`, `forms`, `external-shows` — see each `src/lib/<domain>/schemas.ts`) and required for all new action files; it has still not been retrofitted onto every pre-rebuild action (`horse.ts`, `market.ts`, `posts.ts` — don't assume it's there).

8. **Ship Dark, Then Delete the Fallback** — User-visible rebuilds of live surfaces ship dark behind a `NEXT_PUBLIC_*` env flag, never as a direct cutover. Ritual: build behind the flag → preview locally via `.env.local` → owner approves the look → flip the flag in Vercel + redeploy → **and then, once the owner is confident, a follow-up PR deletes the flag and the old branch**. That last step is not optional. The nine v1 flags accumulated into nine live fallback code paths that nobody was testing; Phase 0 of the launch release deleted all of them (see below). A flag is a temporary scaffold with an expiry date, not a permanent configuration surface.

9. **Feature-Detect the Schema, Not the Flag** — Migrations are hand-pasted by the owner, so app code can be deployed against a database that does not have the new columns yet. Read and write paths for a new migration probe for it once per process and degrade rather than throw: a cheap `select` per capability, memoised behind a 60-second TTL so a running instance picks up the paste within a minute instead of needing a redeploy. Missing column is PostgREST `42703`; missing table is `42P01`. Reference implementations: `src/lib/deals/columnSupport.ts`, `src/lib/studio/columnSupport.ts`, `src/lib/feed/columnSupport.ts`, `src/lib/metrics/db.ts`. See `docs/guides/adding-a-feature.md`.

10. **`src/lib/<domain>/` Pure, Tested Domain Libraries** — Business logic for a rebuilt domain (state machines, eligibility/entry rules, card issuance, results export, filter-param parsing, callback-ladder math, deal vocabulary, commission pipeline) lives in a pure, framework-free `src/lib/<domain>/` module with real unit test coverage — NOT inline in the Server Action or the component. Actions stay thin: validate → call the lib → write. New domains follow the same split rather than growing 1,000-line action files (the way `horse.ts`/`market.ts` did pre-rebuild).

---

## ⚙️ Tech Decisions (Current as of the August 2026 launch release)

| Decision | Status | Notes |
|----------|--------|-------|
| Tailwind CSS v4 + `@theme` tokens | ✅ Official | Vanilla CSS hybrid is acceptable debt in `globals.css` |
| shadcn/ui (Radix UI primitives) | ✅ Official | 11 primitives installed — use for ALL form inputs |
| Framer Motion | ✅ Official | Spring physics, stagger reveals, `whileTap`/`whileHover` |
| Supabase (PostgreSQL + RLS) | ✅ Official | Pro plan, Realtime via global `NotificationProvider` |
| Next.js App Router (RSC) | ✅ Official | v16.1, Turbopack, `after()` for deferred tasks |
| Stripe Checkout Sessions | ✅ Official | Subscription + a-la-carte, webhook at `/api/webhooks/stripe` |
| "Leather at the landmarks, parchment for the work" | ✅ Official | Leather/brass/ledger materials on chrome & landmark surfaces, warm parchment on work surfaces, Lamplight dark mode. Supersedes the earlier "Cozy Scrapbook" framing — see `docs/guides/design-system.md`. Token system, not literal hex: use the semantic leather/ledger/brass tokens, never hardcode the old palette values |
| Sentry + Vercel Web Analytics | ✅ Official | `@sentry/nextjs` wraps `next.config.ts`; Vercel Web Analytics (first-party, cookieless) sits in `layout.tsx` alongside GA, and object metrics fill the gap it can't (see below) |
| Serwist PWA | ✅ Official | `@serwist/next`, `src/app/sw.ts` → `public/sw.js`; offline barn mode for live shows |
| `experimental.cpus: 6` in `next.config.ts` | ✅ Official — do not remove | Vercel's Turbo build machine has 30 cores → 29 static-gen workers, and every prebuilt `/reference` page hits Supabase several times. 29 at once stampedes the connection pool, queues past the 60s per-page cap, and **fails the build**. Six build the same pages comfortably |
| zod at every action boundary | ✅ Official | See Iron Law 7. Retrofit the pre-rebuild actions opportunistically |
| Ship dark, then delete the fallback | ✅ Official | See Iron Law 8. Only four `NEXT_PUBLIC_*` flags remain (table below) |
| Feature-detect the schema | ✅ Official | See Iron Law 9. `*/columnSupport.ts`, 60s TTL |
| `src/lib/<domain>/` pure tested libs | ✅ Official | See Iron Law 10. `shows`, `groups`, `stable`, `showring`, `commerce`, `deals`, `studio`, `forms`, `feed`, `metrics`, `market`, `members`, `catalog`, `external-shows` |
| Cold palette (`bg-white`, `bg-stone-50`) | ❌ Banned | Use warm semantic tokens — see `docs/guides/design-system.md`. Known violations remain on some public marketing pages (About/FAQ) pending a design-pass cleanup — don't copy them as precedent |
| Inline `style={{...}}` for layout | ❌ Banned | Use Tailwind classes exclusively |
| `createPortal` for modals | ❌ Banned | Use `<Dialog>` from shadcn/ui (exception: `PhotoLightbox.tsx`) |
| CSS Modules (`.module.css`) | ❌ Banned | Migrated to Tailwind v4 — do not reintroduce |
| Silent `catch {}` blocks | ❌ Banned | Use `logger.error()` from `@/lib/logger` |
| `Math.random()` for security | ❌ Banned | Use `crypto.randomInt()` for PINs and tokens |

---

## 🏠 The Five Rooms — site map

The site is five rooms and nothing else. `src/components/Header.tsx` enforces this with a hard
`Math.min(visibleCount, 5)` — the bar shows exactly these five at any width, and the
ResizeObserver may only shrink it *below* five on narrow viewports, never grow past. Everything
else lives under **More**.

| # | Room | Route | Notes |
|---|------|-------|-------|
| 1 | **Stable** | `/dashboard` | Your herd. Faceted filtering + saved views (`stable_saved_views`), condition ledger, `/stable/deleted` restore |
| 2 | **Shows** | `/shows` | Competition. Host console, ring console, results, cards |
| 3 | **Market** | `/market` | The marketplace front door — provenance listing cards, filters, anon browse |
| 4 | **The Paddock** | `/feed` | The community room — one stream, Show Ring door, PaddockRail |
| 5 | **Registry** | `/catalog` | The reference catalog. `/catalog` is called "Registry" in all copy |

**Under More** (in order): Art Studio (`/studio/dashboard` or `/studio/setup`), Show Ring
(`/community`), Barns (`/community/groups`), Events (`/community/events`), Help ID
(`/community/help-id`), Members (`/discover`).

> **Naming — the code and the copy disagree on purpose.** `/catalog` is "Registry", `/feed` is
> "The Paddock", `/community` is the "Show Ring" (which lives *inside* the Paddock), `groups` are
> "Barns", `/discover` is "Members". Routes and table names were not renamed; only the words the
> user reads changed. When you write copy, use the room name. When you write code, use the route.
>
> Two known gaps in `Header.tsx`: the **mobile hamburger** is a hand-written flat list of 16
> links that ignores the five/More split entirely, and the **logged-out desktop nav** is its own
> three-item list (Shows, Registry, About). Adding to `NAV_LINKS` does not reach either.

---

## 🧹 Phase 0 — the nine flags are gone

The launch release deleted every v1 feature-flag fallback and its dead branch:
`GROUPS_FORUM`, `CATALOG_V2`, `REFERENCE_PAGES`, `SHOWS_V2`, `SHOWRING_V2`, `STABLE_V2`,
`SHOWS_V4`, `SHOW_PAGE_V3`, `PASSPORT_V2`. The rebuilt path is now the only path. If you find
one of those names in a doc, a comment, or a commit message, it is history.

Two survivals worth knowing:
- **`NEXT_PUBLIC_REFERENCE_PAGES` still exists**, but only as an SEO kill-switch: it gates
  whether reference URLs are emitted and whether `/reference` is listed in `sitemap.ts`
  (`src/lib/catalog/referenceUrl.ts`). It is ON in prod. The pages themselves are not gated.
- **`LegacyShowPage` is still in the tree.** It is not a flag path — it is the fallback renderer
  for legacy `events`-engine shows, chosen by data, not configuration. Keep it.

### The four flags that remain

| Flag | Gate | State | What it does |
|---|---|---|---|
| `NEXT_PUBLIC_FORM_ENGINE` | `formEngineEnabled()` — `src/lib/forms/flag.ts` | **DARK** | The rebuilt AddHorse/QuickAdd/EditHorse engines. The legacy forms are what every member sees today |
| `NEXT_PUBLIC_SHOW_STANDINGS` | `showStandingsEnabled()` — `src/lib/shows/flags.ts` | **DARK** | `/standings` (404s when off) and the links pointing at it |
| `NEXT_PUBLIC_REFERENCE_PAGES` | inline — `src/lib/catalog/referenceUrl.ts` | ON in prod | SEO kill-switch (see above) |
| `NEXT_PUBLIC_WANTED_NUDGE` | inline — `src/app/actions/wishlist.ts` | OFF | Notifies owners of a catalog item when someone wants one |

All four are opt-in on the literal string `"1"`, and all four are readable live in the admin
console (Ops tab → env/flags panel, `getEnvFlagStatus()`). **There is no `src/lib/flags.ts`** —
the two gate helpers live beside their domains.

> Do not document a dark feature as live. The form engine and standings are built and merged;
> members cannot see either.

---

## 🏗️ The Systems

Each follows the same shape: a first-class schema domain (see `MASTER_SUPABASE.md`), a pure
tested `src/lib/<domain>/` library, and zod-at-boundary Server Actions.

- **The Paddock** (`/feed`, actions `posts.ts` → `getFeedStream`, lib `src/lib/feed/`) — one
  stream over `posts`: global posts, public-horse comments, public-barn posts and show-results
  announcements, with legacy `activity_events` interleaved read-only. Everyone/Following
  toggle. Structured mentions (longest-alias matching in `mentionMatch.ts`, `MentionTextarea`
  autocomplete, `RichText` `knownAliases`). Per-post Public/Followers visibility (migration
  166). Admin pinning via `setFeedPostPinned` — pinned posts are held atop the first page. The
  Show Ring door with its preview strip, and `PaddockRail` (My Barns / Upcoming / Rooms).
- **Shows** (actions `shows-v2.ts`, `shows-v2-ring.ts`, `shows-v4.ts`, lib `src/lib/shows/`) —
  `shows` → `show_divisions` → `show_sections` → `show_classes` → `show_class_entries`, with
  `show_placings`/`show_callbacks` and `qualification_cards` for the earn-and-verify loop
  (`/cards/[code]`). Two modes (`live` leg-tag showing, `online` photo judging), community-vote
  or expert judging, a documented state machine (`src/lib/shows/stateMachine.ts`),
  NAMHSA-format export (`resultsExport.ts`), and an offline-tolerant ring console with a retry
  queue (`retryQueue.ts`). **The legacy `events` photo-show engine is still live** — see the
  Events note below.
- **Barns** (actions `groups.ts` + `groups-forum.ts`, lib `src/lib/groups/`) — groups rebuilt
  with data preserved. `is_private` + `barn_join_requests` (167), the Notice Board central,
  `BarnMembersPanel` and the "At the Gate" queue. Routes at `/community/groups/*` with
  `/community/barns/*` aliases.
- **Events** (actions `events.ts`) — repositioned as **Facebook-style pages for happenings
  outside MHH**: RSVP, attendees, discussion, photos. Creating `live_show` / `photo_show` events
  was **removed and is server-guarded**; migration 168 widened the type CHECK for the new kinds.
  Existing legacy shows still render (via `LegacyShowPage`) and `competition.ts` + the Show
  Packer still serve real entrants — that cluster is KEEP, not cruft.
- **Market** (actions `market.ts`, `marketPublicRecord.ts`, lib `src/lib/market/`) — `/market`
  is the marketplace front door: provenance listing cards where the passport *is* the listing
  page, filters, blocked sellers excluded. The Blue Book moved to `/market/guide`;
  `/market/reports` is the purchase ledger. Anon browse runs through the `get_market_listings`
  RPC (169) with a service-role fallback, and anon record quick-look through
  `marketPublicRecord.ts`.
- **Art Studio** (actions `art-studio.ts`, lib `src/lib/studio/`) — rebuilt on researched
  commission practice (`docs/studio/COMMISSION_RESEARCH.md`). Pipeline
  `requested → quoted → accepted → in_progress → awaiting_approval → completed → delivered`
  (state machine in `pipeline.ts`), 8 structured terms fields, the receipts wall
  (`v_artist_finished_horses` — finished horses **with their ribbons**), a business dashboard,
  and vault integration (`commission_cost`, `customization_logs` surfaced). Free tier = 3 active
  commissions, Studio Pro unlimited, enforced in `sendQuote` and on the `accept` transition.
- **The Deal Room** (actions `deals.ts`, lib `src/lib/deals/`) — `conversation_participants`
  fixes the buyer_id-means-clicker role bug and carries unread/mute/archive; `messages.kind` +
  `payload` give a mixed transcript; contract boxes (7 types, both-sign freeze) live in
  `conversations.deal_terms`; `payment_installments` is the time-payment ledger (**the
  headline** — the parties author their own terms); counter-offers via
  `deal_offer_move_atomic`; the evidence pack at `/inbox/[id]/record` (PDF + plain text).
  Unified deal vocabulary in `src/lib/deals/vocabulary.ts` — 8 stages (`talking`, `proposed`,
  `agreed`, `paying`, `fulfilling`, `settled`, `closed`, `disputed`), parties A/B from
  `transactions`. **Plain DMs are unchanged and remain first-class** — the deal room is what a
  thread grows into, not what every thread is.
- **Members** (`/discover`, lib `src/lib/members/directory.ts`) — server-side directory: search,
  three sorts (including an activity proxy), batched counts from `discover_users_view`, which
  since 169 excludes suspended members.
- **Object metrics** (lib `src/lib/metrics/`, `<ViewBeacon>` → `/api/beacon/view`) — see the
  privacy rule below.
- **Form engine** (lib `src/lib/forms/`) — **DARK.** A registry of 40 `FieldSpec`s
  (`registry.ts`) derives `assetFields` and one zod schema, feeding the AddHorse/QuickAdd/
  EditHorse engines and server-action validation (log-only for missing-required during soak).
  Condition grades now apply to tack and props. The legacy forms stay intact until soak ends.

---

## 🔒 Live User-Data Guardrails (NON-NEGOTIABLE)

> **75+ registered users with financial and provenance data. This section is absolute.**

### Protected Tables (require human review for ANY schema change):
- `user_horses` — model inventory (900+ rows)
- `financial_vault` — purchase prices, estimated values (PRIVATE)
- `show_records` — competition history, provenance
- `transactions` — commerce state machine (offers, payments)
- `horse_images` — Supabase Storage — public `horse-images` bucket (CDN-cacheable, no signed URLs), private `chat-attachments` bucket (signed URLs for DM photos). `short_slug` column (Migration 112) for friendly `/photo/[slug]` share URLs
- `events` / `event_entries` — legacy photo-show engine (KEEP — still serves real entrants; see the Shows v2 architecture section above)
- `shows` / `show_class_entries` / `show_placings` / `qualification_cards` — Shows v2 domain: live competition results and bearer-token cards that transfer with the horse on sale
- `users` — profiles, auth, tier metadata
- `horse_ownership_history` — transfer provenance chain
- `conversations` / `messages` / `conversation_participants` / `payment_installments` — the Deal Room. The transcript is evidence: non-`chat` message kinds are trigger-immutable, and a confirmed installment is final
- `commissions` — the agreement freezes at acceptance (price, terms snapshot, timestamp)
- `object_view_daily` / `site_activity_daily` / `object_view_scratch` — metrics (see the privacy rule below)

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

5. Watermarking is **on by default (opt-out)**: respect the `watermark_photos` boolean on the users table, and apply the user's `watermark_text` when set (blank ⇒ default `© @alias — ModelHorseHub`)

6. **Metrics track objects, never people.** `object_view_daily` has no viewer column, by
   construction — "what did member X look at" is a question the schema cannot answer. The
   per-viewer marker needed to compute `unique_viewers` is a salted daily hash
   (`METRICS_VIEWER_SALT` + the UTC date) that lives in `object_view_scratch` and is purged of
   every past-day row on the 06:00 cron. Do not add a viewer column, do not lengthen the
   scratch retention, and do not make view counts public — the seller sees "👁 N views this
   week" on their own stable page only, because public counts turn a hobby into a scoreboard.

---

## 💰 Commerce Rulings (owner-ratified, August 2026)

These are settled product decisions, not open questions. Document them where they are relevant;
do not build against the opposite assumption.

1. **The platform NEVER holds money.** No escrow, not now and not as a roadmap item. Payment is
   arranged and settled between the parties. Any older doc promising escrow is wrong.
2. **No selling fees.** Show-entry fees are a maybe, someday. Nothing else.
3. **We are the record, not the referee.** When a deal goes wrong the platform produces the
   evidence pack (`/inbox/[id]/record`) and stops there. It does not adjudicate, reverse, or
   punish on the strength of one side's account.
4. **Time-payment tracking is the headline feature** of the Deal Room — the parties author their
   own terms, and `payment_installments` records what they agreed and what has been marked
   sent/confirmed.
5. **Condition grades apply to non-model assets** (tack, props) — approved.

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
- [x] Friendly Photo URLs — Migration 112 deployed, `/photo/[slug]` route live with OG/Twitter preview cards, share integration in lightbox
