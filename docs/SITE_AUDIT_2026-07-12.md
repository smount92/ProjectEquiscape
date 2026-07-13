# Whole-Site Audit — 2026-07-12

**Method:** five parallel review agents (security, performance/SEO, UX/anon-funnel, code-health/tech-debt, strategy/product) over the full repo, plus two claims verified empirically by the lead. Read-only findings; evidence is `file:line` or route.

**How to use this doc:** findings are grouped by priority tier and given stable IDs. Each has severity, evidence, impact, and fix. The **Status** field tracks progress — update it as items are done. Start at the top of 🔴; it is ordered by (impact × ease).

---

## Status snapshot — updated 2026-07-12 (end of session)

*This snapshot is authoritative for current state. The inline **Status** fields in the detailed findings below predate deployment and may lag — trust this section.*

### ✅ Shipped & deployed since this audit (all live on `main` / modelhorsehub.com)
- **Security batch 1 (migration 133 applied + live):** SEC-1 (PII columns revoked), SEC-2 (DEFINER RPCs check `auth.uid()`), SEC-3 (notification/nudge spoofing closed), SEC-4 (search-filter sanitized), plus the two sweep sinks SEC-2b (`createActivityEvent`) and SEC-3b (`createNotification` moved server-only).
- **Anon funnel:** FUNNEL-1 (login/signup honor `redirectTo`), FUNNEL-2 (query string preserved through login), FUNNEL-3 (message-seller routes to `/community/[id]` + **two-way reference↔passport links**), FUNNEL-4 (anon passport [mig 135], anon profile [= PROD-3], anon show-page aliases [mig 136], robots/sitemap reconciled), FUNNEL-5 (signup CTA in anon header).
- **Catalog:** community stats column — owner / want / for-sale counts (mig 134); collectors chip hidden when zero.
- **Reference:** photos deep-link to their passports (mig 137 adds `horse_id`).
- **Analytics (PROD-1, partial):** `sign_up` + `want_click` GA events live.
- **UX polish:** "Want List" naming/icons unified (🔖 bookmark = want list, ❤️ heart = favorite); duplicate-photo double-submit fixed; passport ledger-card dark-mode contrast fixed.
- Migrations **134 / 135 / 136 / 137** applied; DB types regenerated.

### 📌 Newly actionable — do next / don't lose
- **`NEXT_PUBLIC_WANTED_NUDGE=1` is SET in Vercel (2026-07-12).** It's a `NEXT_PUBLIC_` var (read in `wishlist.ts:49`), so it's inlined at **build time** — the demand nudge goes live on the **next rebuild/deploy**, not the moment the var was saved. Trigger a redeploy to activate it.
- **Mark `sign_up` + `want_click` as conversions** (Key Events) in the GA4 UI — the events fire but aren't flagged as conversions yet.

### 📌 Still outstanding (detail below)
- **Security:** SEC-5 (`search_path` hardening), SEC-6 (money-flow atomicity RPCs — deferred), SEC-7 (drop `NEXT_PUBLIC_ADMIN_EMAIL`).
- **Funnel:** `/photo/[slug]` anon view (last FUNNEL-4 piece); FUNNEL-6 (transfer/parked strands); FUNNEL-7 (built-but-unreachable features).
- **Perf/SEO:** PERF-1 (`generateStaticParams` for reference), PERF-2 (`/market` rewrite), PERF-3 (`next/image`), PERF-4/5/6/8/9/10, PERF-7 (add public passport/show URLs to sitemap).
- **Product:** PROD-1 remaining GA events (`add_horse`, `list_for_sale`, `message_seller`, `checkout_start`, `show_entry`, `export`); PROD-2 (delete 3 dead live-Stripe endpoints); PROD-4 (export completeness); PROD-5/7 (share previews/badges); PROD-6 (weekly liveness); PROD-8 (misc).
- **Tech debt:** DEBT-1..8 (test coverage, `HorseForm` extraction, show-engine cutover, UI consistency, legacy-table drop, gen-types CI guard, resilience).
- **Design (added 2026-07-12, full-site sweep):** DESIGN-1..8 — one MAJOR page (`/settings` body), `transition-colors-*` corruption exact lines, night-unsafe chip sweep (~15 shared components), `bg-white` cards, emoji→lucide, `/upgrade` gradients call, `SHOWRING_V2` flag flip retires the worst legacy surface free. See 🟣 tier below.

---

## 0. Two corrected diagnoses (read first — they change the plan)

- **MYTH: "the global `<Header>` forces every page dynamic."** FALSE. `Header.tsx` is a client component; the build's `prerender-manifest.json` shows `/`, `/about`, etc. are statically prerendered *with* the Header. Reference pages are **static-eligible** — the correct caching lever is `generateStaticParams` (see PERF-1), not the `unstable_cache` data-cache workaround already shipped in `reference-pages.ts` (that's fine to keep, just not the primary fix). The reference page file comment (`reference/[maker]/[slug]/page.tsx`) still asserts the myth — correct it when touching PERF-1.
- **MYTH: "`proxy.ts` is dead code / the auth middleware doesn't run."** FALSE. `proxy.ts` is the **Next.js 16 renamed-middleware convention** (middleware → proxy). Verified in prod: the dynamic `?redirectTo=<path>` capture — which ONLY `proxy.ts:92` performs — fires on `/dashboard`, `/settings`, `/inbox`, `/notifications`; and the `publicPaths` allowlist works (`/reference`, `/catalog`, `/market` return 200 for anon). The local `.next/server/middleware-manifest.json` being empty is a stale/renamed-manifest artifact, not proof. **However** the downstream symptom IS real (see FUNNEL-1): `loginAction` ignores that `redirectTo`, so the return-trip is broken.

## 0b. What's genuinely solid (do not disturb)
`financial_vault` RLS is airtight (owner-only EXISTS, no anon path). `transactions.ts` + `commerce/stateMachine.ts` are a hardening model (zod, requireAuth, party/status gates, justified admin-client downgrades) — gap is atomicity (SEC-6), not authz. Money core is tested; `lib/shows/` has 15 test files. The reference-page anon stack is correctly built: cookie-less `createAnonClient`, aggregate-only `SECURITY DEFINER` RPCs (`get_catalog_listings`, `get_catalog_reference_photos` w/ opt-out, counts, market) with `SET search_path=''`, `unstable_cache`, canonical+OG. Type safety strong (10 `any` in all `src`). a11y largely healthy (alt text, focus rings paired, aria-labels, responsive tables). No broken internal links.

---

## 🔴 SECURITY — fix first (SEC-1/2/3 before anything else; SEC-3 gates the Wanted-nudge flip)

> **⚙️ SECURITY BATCH 1 — ✅ DEPLOYED 2026-07-12 — migration 133 applied in Supabase + merged to `main`.** SEC-1/2/3/4 are FIXED in code + migration `133_security_hardening.sql`. Full vitest green (1076 tests), tsc + eslint clean on all touched files, migration adversarially reviewed. **Done:** migration 133 pasted + run in Supabase, types regenerated, branch merged + deployed. A background sweep found two more instances of the same "forgeable-identity server action" class, now also fixed: **SEC-2b `createActivityEvent`** (activity.ts — added `session.uid == actorId` guard; all callers are session-ful) and **SEC-3b `createNotification`** (moved out of the `"use server"` `notifications.ts` to server-only `src/lib/notifications/createNotification.ts` so it's no longer client-callable — it's invoked by session-less crons so it cannot gate on `auth.uid()`). 133 is applied, so `NEXT_PUBLIC_WANTED_NUDGE` is now UNBLOCKED — flip it to `1` in Vercel when ready (closes SEC-3's demand-nudge spam).

### SEC-1 — [HIGH] Every user's email + legal name readable by any logged-in user — **Status: FIXED (133 §A + insurance reads → admin client)**
- **What:** `users` SELECT policy is `TO authenticated USING (true)` with no column-level security; table holds `email` + `full_name`. RLS is row-level only → "select any row" = "select every column." Schema comment falsely claims `full_name` is private.
- **Evidence:** `supabase/migrations/001_initial_schema.sql:40-49`; `022_performance_hardening.sql:19-23`; no column `REVOKE` exists anywhere.
- **Impact:** Any free signup can run `supabase.from('users').select('email, full_name')` from the browser and dump all users' real names + emails. Amplifies SEC-2 (resolve any seller UUID).
- **Fix:** New migration: `REVOKE SELECT (email, full_name) ON public.users FROM authenticated, anon;` **PREREQ — check no feature reads these columns for the current/other user via the table** (getProfile reads `user.email` from auth.users, not the table — good; grep for `.select(` on users incl. email/full_name and for `full_name`). If the owner needs their own private cols, add an owner-scoped RPC/path. Column privileges compose with RLS.

### SEC-2 — [HIGH] Commerce/social SECURITY DEFINER RPCs trust caller-supplied identity — **Status: FIXED (133 §B — auth.uid() checks + REVOKE PUBLIC)**
- **What:** DEFINER RPCs granted to `authenticated` (+ PUBLIC default) take an identity param and never compare it to `auth.uid()`; directly callable via `supabase.rpc(...)`, bypassing the entire action layer (requireAuth/zod/state machine).
- **Evidence:** `099_commerce_locks.sql:10-116` (`make_offer_atomic` trusts `p_buyer_id`; `respond_to_offer_atomic` guards only that the *claimed* seller matches the row, not the caller); `092_supabase_linter_fixes.sql:316` `vote_for_entry(p_user_id)`, `:633` `toggle_post_like(p_post_id,p_user_id)`, `:652` `add_post_reply(p_parent_id,p_author_id,…)`. Correct templates that DO check: `soft_delete_account` (`092:355`), `batch_import_horses` (`056:25`).
- **Impact:** Buyer force-accepts own offer w/o seller consent (moves horse to pending_payment); creates offers attributed to a victim (locks them out); forges posts/replies/likes/show-votes as any user (DEFINER bypasses INSERT RLS).
- **Fix:** In each function add `IF (SELECT auth.uid()) IS DISTINCT FROM p_<identity> THEN RAISE EXCEPTION 'Unauthorized'; END IF;` (or drop the param, use `auth.uid()` internally). `REVOKE EXECUTE … FROM anon, PUBLIC`. Money/schema → adversarial review before merge.

### SEC-3 — [HIGH] Notification-spoofing + Wanted-nudge spam (gates the WANTED_NUDGE flip) — **Status: FIXED (133 §C + mentions/horse-events server-only/auth; +SEC-2b/3b sinks)**
- **What (3 parts):**
  1. `notify_catalog_owners_of_demand` (migration 130) doesn't validate `p_wanter_id` vs `auth.uid()` and only 30-day dedupes → a script iterating ~11k catalog ids nudges every owner of every model.
  2. `parseAndNotifyMentions(content, actorId, actorAlias, …)` — no `requireAuth`, caller controls actor id/alias, admin-inserts notifications → forged "@Model Horse Hub Admin mentioned you" phishing at scale.
  3. `notifyHorsePublic`/`checkWishlistMatches` — caller controls `userId`/`content`, admin-inserts `wishlist_match` notifications; no auth.
- **Evidence:** `supabase/migrations/130_reference_wanted_rpcs.sql:40-97`; `src/app/actions/mentions.ts:10-53`; `src/app/actions/horse-events.ts:12,51-87` (callers pass client state: `add-horse/page.tsx:567`, `stable/[id]/edit/page.tsx:673`).
- **Fix:** (1) Add `auth.uid() = p_wanter_id` check + `check_rate_limit` in the RPC (migration). (2/3) Add `requireAuth()` to the two action files and derive actor/`userId` from the session; never accept identity from the caller.
- **NOTE:** Do NOT set `NEXT_PUBLIC_WANTED_NUDGE=1` in Vercel until part (1) is fixed.

### SEC-4 — [HIGH/MED] PostgREST `.or()`/ilike filter injection from raw search input — **Status: FIXED (shared src/lib/utils/search.ts + market/community/groups; +unit test)**
- **What:** User search text interpolated straight into `.or(\`col.ilike.%${q}%,…\`)`; `,()%*` break out of the term.
- **Evidence:** `market.ts:119`, `stable.ts:166`, `showring.ts:132`, `groups.ts:179`, `community.ts:69`. (The `.or()` calls keyed on server-derived UUIDs in transactions/messaging are safe.)
- **Impact:** RLS still guards row access so no direct breach today, but anon-reachable on `/market`; widens filters / errors (DoS-ish); fragile if the idiom is copied onto a weaker-RLS table.
- **Fix:** Shared `sanitizeSearch()` stripping `,()%*\` before interpolation (or use the typed `.ilike()` / `.textSearch()` builders). ~1h, +regression test.

### SEC-5 — [MED] `SET search_path` missing/wrong on some DEFINER functions — **Status: TODO**
- **Evidence:** `108_rls_safe_horse_counting.sql:12-40` (`count_user_horses_total`/`_public`: no search_path, unqualified `user_horses`); `099_commerce_locks.sql:75,116` uses `= public` not `= ''`. 22/39 definer-defining migrations omit it overall (mostly older: 023/034/035/036/050/055/056).
- **Fix:** `CREATE OR REPLACE` with `SET search_path=''` + `public.`-qualified names via additive migrations. Defense-in-depth; low real exploitability on managed Supabase.

### SEC-6 — [MED] Money flows non-atomic (documented) — **Status: KNOWN/DEFERRED**
- **Evidence:** `docs/NEXT_SYSTEMS_ROADMAP.md:12-13,27`; `transactions.ts:855-879` (park-then-update), `:731-750` (JS-loop competing-offer cancel), `:906-958` (3-step cancel).
- **Fix:** Ship the owed `cancel_transaction_atomic`/`verify_funds_atomic` single-transaction RPCs; fold competing-offer + stale-offer (S2) sweep in.

### SEC-7 — [LOW] `NEXT_PUBLIC_ADMIN_EMAIL` in client bundle — **Status: TODO**
- **Evidence:** `.env.local:10`. Not an authz bypass (server uses non-public `ADMIN_EMAIL`), but hands attackers the one account whose compromise = full admin. Fix: drop the `NEXT_PUBLIC_` copy; gate admin UI via a server-returned boolean.

---

## 🟠 ANON FUNNEL — MOVE 1's payoff leaks here (do after security)

### FUNNEL-1 — [CRITICAL] Login/signup discard `redirectTo` — return-trip broken — **Status: FIXED (branch; hidden input + open-redirect guard; verified)**
- **What:** `proxy.ts:92` sets `?redirectTo=<path>` (and it runs — see §0), but `loginAction` hard-redirects to `/dashboard` and never reads it; login/signup pages take no param.
- **Evidence:** `src/app/auth/actions.ts:33`; `app/login/page.tsx`; only other setter is `upgrade/page.tsx:92` (hardcoded).
- **Fix:** Make `loginAction`/signup read `redirectTo` and redirect back. Unblocks the whole funnel.

### FUNNEL-2 — [CRITICAL] "Add to your stable" lets anon fill the 1,700-line form then fails at submit — **Status: FIXED (proxy already guards the route; real gap was query-string loss)**
> **Correction:** `proxy.ts` DOES gate `/add-horse` for anon (not in `publicPaths`) — anon never actually reaches the form. The real bug was `proxy.ts:92` capturing only `pathname` in `redirectTo`, dropping `?catalog=<id>`, so the round-trip lost the pre-selection. Fixed by preserving `pathname + search`. Verified: `/add-horse?catalog=X` → login → `redirectTo=/add-horse?catalog=X`.
- **Evidence:** CTA `reference/[maker]/[slug]/page.tsx` → `/add-horse?catalog=X`; `add-horse/page.tsx` has no mount guard, only a submit-time `throw new Error("You must be logged in.")` (~:459); no localStorage/beforeunload draft.
- **Fix:** Guard on mount → `/login?redirectTo=/add-horse?catalog=X` (needs FUNNEL-1); ideally persist form to localStorage + restore post-login.

### FUNNEL-3 — [CRITICAL] "Message seller" is a dead CTA for everyone — **Status: FIXED (branch feat/anon-funnel; reference listing → /community/[id]; verified)**
- **Evidence:** listing card → `/stable/${horseId}` (`reference/[maker]/[slug]/page.tsx` ~:289); but `stable/[id]/page.tsx:105-107` is owner-only (`notFound()` for non-owner) and `:74-75` redirects anon to login. Real message affordance (`MessageSellerButton`) is on `/community/[id]` + `/profile/[alias]`.
- **Fix:** Point the listing link to `/community/${horseId}`; make that page anon-viewable with the message action gated behind login+returnTo.

### FUNNEL-4 — [CRITICAL] Indexed public pages render "@unknown" or bounce anon to /login — **Status: DEPLOYED — only `/photo/[slug]` remains**
> **Done + verified live (logged out):** `/community/[id]` passport (AnonPassport + `get_public_passport` RPC, migration 135) and `/profile/[alias]` (AnonProfile, service-role public-scoped reads) are now anon-viewable with real aliases; robots/sitemap reconciled (`/feed` `/discover` `/studio` → disallow). **Shipped since:** `/shows/[id]` anon aliases now resolve via the `get_public_aliases` DEFINER RPC (migration 136). **Still TODO:** only `/photo/[slug]` remains proxy-walled for anon.
- **What:** (a) v2 public show `shows/[id]` resolves aliases with the *cookie* client → anon gets `@unknown` (host/entrants/champions) on an indexed, force-dynamic, OG-tagged page. Legacy did it right via `getAdminClient()` (`shows.ts:1107`); v2 regressed it (`shows-v2.ts:1347`, `PublicShowV2Page.tsx:83`, choke point `lib/shows/queries.ts:66 getAliases`). (b) robots/sitemap advertise `/community`, `/discover`, `/feed`, `/profile/*`, `/shows`, `/studio` as crawlable but each self-redirects anon (`profile/[alias]:54-56`, `community/page.tsx:283-285`, discover, feed, shows browse). (c) `/photo/[slug]` 404s for anon (`photo/[slug]/page.tsx:47`).
- **Fix:** Route anon alias lookups through an anon-granted DEFINER RPC / admin client (single choke point `getAliases`); drop the redirect on genuinely public pages (render read-only) OR remove them from sitemap/robots. Reconcile robots+sitemap with actual anon-accessibility.

### FUNNEL-5 — [HIGH] No "Create Free Account" CTA in the persistent chrome — **Status: FIXED (branch; primary signup CTA in anon header; verified)**
- **Evidence:** anon `Header.tsx:731-739` shows only Log In; full nav gated behind `{user && …}`; Footer links to anon-bouncing routes, no signup link. Strong CTAs exist only on `page.tsx:57,537` (home). Good pattern to copy: `WantButton.tsx:32-38`, `catalog/[id]:125-133`.
- **Fix:** Add "Create Free Account" to the anon header + a signup nudge on reference pages; surface a few anon-safe nav links.

### FUNNEL-6 — [HIGH] Transfer/parked flows can strand a claim code or parked horse — **Status: TODO**
- **Evidence:** `TransferModal.tsx:28,64-68` (`transferId` never set → Cancel is a no-op; `generateTransferCode` returns only `{success,code}`, `hoofprint.ts:288-331`; `getMyPendingTransfers` `:427` rendered nowhere); `OfferCard.tsx:236-256` (no seller cancel/dispute in `funds_verified` though `cancelTransaction` supports it, `transactions.ts:906-973`).
- **Fix:** Return/track `transferId`, surface pending transfers with working revoke; render seller Cancel/Dispute in `funds_verified`.

### FUNNEL-7 — [MED] Fully-built-but-unreachable features — **Status: TODO**
- **Evidence:** Transfer History never renders (`TransferHistorySection.tsx:9-15` — `<details>` no `open`, `<summary class="hidden">`); `/catalog/[id]` has no add-to-stable CTA (only Suggest-Edit/eBay) so browse→add dead-ends; onboarding `getting-started` linked only from Footer, post-confirm/login dump to `/dashboard` (`auth/callback/route.ts:8,18`).
- **Fix:** Unhide Transfer History; add-to-stable CTA on `/catalog/[id]`; route first-timers to getting-started.

---

## 🟡 SEO / PERFORMANCE

- **PERF-1 — [HIGH] Reference pages not prebuilt — Status: TODO.** No `generateStaticParams` anywhere; pages are on-demand only. Add it (prebuild top-N makers, ISR tail) → truly static/cached HTML. Delete the wrong "Header forces dynamic" comment. (`reference/[maker]/[slug]/page.tsx`.)
- **PERF-2 — [HIGH] `/market` fetches whole table, O(N×M) JS merge, 1000-row cap, in-memory pagination — Status: TODO.** `market.ts:75-176` (no LIMIT on RPC `:92`; `.in("id",…)` `:113` hits the cap; nested loop `:136-157`; slice `:160-173`). Public/crawlable → slow + silently wrong past 1000 priced items. Rewrite as one paginated SQL/RPC + `unstable_cache`.
- **PERF-3 — [HIGH] Zero image optimization — Status: TODO.** 0 `next/image`, empty `next.config.ts` (no `images.remotePatterns`), 59 raw `<img>` in 41 files incl. reference LCP hero (`ReferencePhotoGallery.tsx:36`) + Header logo/avatar. Add remotePatterns for Supabase host; migrate SEO galleries to `next/image` w/ dims + `priority` on hero. Web Vitals = ranking.
- **PERF-4 — [MED] `/discover` unbounded `select("*")` + 1000 cap — Status: TODO.** `discover/page.tsx:23-26,42,69` — paginate + resolve avatars for visible page only.
- **PERF-5 — [MED] Weak/missing metadata — Status: TODO.** `shows/[id]:22-25` ships one static title for every show; no metadata on market/`reference`/`reference/[maker]`. Add `generateMetadata` (title/desc/canonical/OG) per public show + market.
- **PERF-6 — [MED] No JSON-LD on the 11k reference pages — Status: TODO.** Emit `Product` + `Offer`/`AggregateOffer` (price/median/collectors already rendered); `Event` on public shows; `ItemList` on market.
- **PERF-7 — [MED] robots/sitemap advertise anon-redirecting pages — Status: TODO** (see FUNNEL-4). Also add public `community/[id]` horses + public v2 `shows/[id]` to sitemap (paged pattern already at `sitemap.ts:146-154`).
- **PERF-8 — [MED] `shows/[id]` force-dynamic though public — Status: TODO.** `shows/[id]/page.tsx:20` — drop it, render via cookieless reads + ISR.
- **PERF-9 — [LOW] Market MV cron cadence/comment mismatch — Status: TODO.** `vercel.json:4-5` = daily (`0 6 * * *`) but `refresh-market/route.ts:3` comment claims 6h. Align comment (or bump). Also no `unstable_cache` on public `/market` + `/discover` reads.
- **PERF-10 — [MED] className-corruption visual bug — Status: TODO.** `transition-colors-icon/-title/-maker` + full card classes on inner spans (looks like a botched global find/replace) render `/market`, Events, legacy Shows as nested boxes: `market/page.tsx:119-139`, `EventBrowser.tsx`, `shows/page.tsx:149-206`. Sweep the `transition-colors-<word>` signature.

---

## 🟢 PRODUCT / STRATEGY — cheap high-leverage

- **PROD-1 — [HIGH] GA fires zero conversion events — Status: PARTIAL — `sign_up` + `want_click` deployed 2026-07-12.** Added `src/lib/analytics.ts` `track()` helper (client-only, no-ops w/o gtag, respects the `ga-disable` opt-out) + wired 2 core events: `sign_up` (signup success) and `want_click` (WantButton, both anon+auth, w/ catalog_id). Verified in preview (gtag captured). **Remaining:** `add_horse`, `list_for_sale`, `message_seller`, `checkout_start`, `show_entry`, `export`; then mark all as conversions in the GA UI. (WantButton anon CTA also gained `redirectTo` here — completes FUNNEL-1 for the want path.)
- **PROD-2 — [HIGH] Three dead live-Stripe endpoints — Status: TODO.** Boost ISO $1.99 / Promote $2.99 / one-off Insurance $1.99: no UI caller, nothing reads what they write (`is_boosted_until`/`is_promoted_until` written-only; `purchased_reports` never queried; insurance PDF already free at `/api/insurance-report`). Delete routes + webhook branches + columns + `purchased_reports` (migration) OR wire consumption. Don't leave `sk_live` endpoints half-shipped. Callers confirmed only for `/api/checkout` + `/api/checkout/studio-pro`.
- **PROD-3 — [HIGH] MOVE 6 seller profile login-walled — Status: TODO** (= FUNNEL-4b for `/profile`). `profile/[alias_name]/page.tsx:54` `redirect("/login")` — kills "paste your reputation in a FB thread." Give it an anon read path (DEFINER alias/rating lookup), mirror reference-page pattern.
- **PROD-4 — [MED] Data export breaks its About-page promise — Status: TODO.** `about/page.tsx:135-140` promises "every horse, every Hoofprint record, every qualification card"; `api/export/route.ts:27-96` returns horses+vault only. Add Hoofprint + cards to the export (best) or soften copy.
- **PROD-5 — [MED] "Hoofprint-verified" FB-listing share badge absent — Status: TODO** (MOVE 5, ~1 day). Add a copy-block on the owner's horse page (verified line + public URL + one-tap copy). Only current string is in `CertificateOfAuthenticity.tsx:213`.
- **PROD-6 — [MED] No liveness cadence — Status: TODO.** No weekly-show automation / "this week" surface (crons: refresh-market, transition-shows, monthly Pro stablemaster-agent). Auto-create a recurring weekly virtual show or a "Show of the Week"/"New this week" strip.
- **PROD-7 — [MED] Share-preview gaps (MOVE 5) — Status: TODO.** `/cards/[code]` has no `generateMetadata`/OG (bare-link preview); public horse OG uses raw `horse_images.image_url` (may be private → imageless preview); no branded `next/og` cards. Add card metadata; verify bucket URLs are crawler-fetchable.
- **PROD-8 — [LOW] Misc — Status: TODO.** Continuity statement is a section in `/about`, not a footer-linked `/continuity` page; Footer has no FB/IG links (no social presence — MOVE 5). "🔒 Members" lock on the reference Blue Book points at fully-public `/market` (cosmetic — enforce or drop). Estate report (MOVE 8) absent (insurance covers core).

---

## 🟣 DESIGN — Leather Edition consistency (sweep added 2026-07-12, four parallel reviewers over all 78 routes + imported components)

**Headline:** the redesign held up far better than feared. Landmark coverage is complete — every route has either `PageMasthead`, a layout `brass-heading`, or a deliberate bespoke leather hero. The whole shows-v2 stack (host console, judge queue, ring console, announcer board, `/cards/[code]`), dashboard ledger, catalog suite, profile, privacy/terms are token-clean. Exactly **one page is MAJOR** (`/settings` body). The rest of the drift is **night-unsafe raw-palette status chips concentrated in ~15 shared components**, a handful of `bg-white` cards, scattered raw hex, and emoji-in-headings. Calibration rule used: emoji passed as a masthead `icon` prop = house style, fine; emoji inside `<h1>/<h2>/<h3>` or tab labels = drift (per `/about`/`/faq` precedent). 🔖/❤️ and rubber-stamp/parchment fixed-ink surfaces are deliberate, not drift.

### DESIGN-1 — [HIGH] `/settings` body is the one MAJOR page — **Status: TODO**
- Shell is compliant (PageMasthead compact :169, ledger-card surfaces) but the interior drifted: emoji section headers ×6 (`👤` :177, `🔒` :408, `🔔` :480, `📊` :507, `💎` :543, `⚠️` :562); night-unsafe `border-stone-300` + `hover:border-emerald-700` (:181, :191, :235); token-bypassing `bg-gradient-to-r from-amber-500 to-orange-500` subscription CTA (:552); hand-rolled raw `<button>` at :190/:387 (Security section already uses shadcn Button :460 — copy it). `settings-toggle` class buttons are deliberate, keep.

### DESIGN-2 — [HIGH, live visual bug] `transition-colors-<word>` className corruption (= PERF-10, exact lines) — **Status: TODO**
- `market/page.tsx` :127 `-icon`, :130 `-info`, :131 `-title`, :134 `-maker`, :145 `-prices`, :158 `-footer` · `components/EventBrowser.tsx` :97 `-date`, :105 `-body`, :108 `-name`, :112/:116 `-meta`, :123 `-actions` · `components/CsvImport.tsx` :588/:603 `-text` (newly found). `LegacyShowPage.tsx` is CLEAN (audit's earlier "legacy Shows" attribution was wrong). Mechanical fix: restore `transition-colors` + move the stray suffix word back to its element.

### DESIGN-3 — [MED] Night-unsafe raw-palette status chips/banners in shared components — **Status: TODO**
Light pastel bg + dark same-hue text; under Lamplight the tokens flip but these don't → glowing light cards on a dark page. Tokenize to `bg-success/10 text-success`-style equivalents (or a shared chip variant):
- `ChatThread.tsx` :330 (`border-amber-300 bg-amber-50 text-[#f59e0b]`), :355 (`bg-red-500/600`)
- `UniversalFeed.tsx` :274 (red error banner), :387/:394 (amber pinned)
- `EventBrowser.tsx` :126 (emerald + `#22c55e`), :132 (amber + `#f59e0b`)
- `CsvImport.tsx` :410 (red banner), :528–534 (emerald badges)
- `MatchmakerMatches.tsx` :53/:79, `WishlistSearch.tsx` :195/:231/:262, `WishlistRemoveButton.tsx` :24 (all emerald/`#22c55e`/red hex)
- `CommissionTimeline.tsx` :233/:339/:418, `RatingForm.tsx` :102/:157/:160, `LinkHorseToCommission.tsx` :50, `CommissionRequestForm.tsx` :154
- `ShowStringManager.tsx` :210/:371/:385/:461/:609/:771 (red/purple/gray + hex timeline blocks)
- `SuggestNewEntryForm.tsx` :278 (red banner) · `catalog/[id]/page.tsx` :138/:140 (raw-blue eBay link) · `community/events/[id]/page.tsx` :127/:139/:141/:349 (violet/amber + hex) · `catalog/suggestions/[id]/page.tsx` :245 (`decoration-red-400/50`) · `studio/[slug]/request/page.tsx` :76 · `studio/setup/page.tsx` :439/:444 (`text-[#ef4444]`/`text-[#22c55e]`)
- `auth-code-error/page.tsx` :18 nit (`text-white` on bg-forest)

### DESIGN-4 — [MED] Duplicated raw-palette STATUS_STYLES map in studio — **Status: TODO**
- `studio/commission/[id]/page.tsx` :13–23 and `studio/my-commissions/page.tsx` :13–22 carry the same 8-status map on raw `bg-*-500/20 text-*-600` (only `review` is tokenized `bg-studio/20`). Extract one shared, tokenized map.

### DESIGN-5 — [LOW, trivial] `bg-white` cards — **Status: TODO**
- `error.tsx` :8, `not-found.tsx` :7, `studio/my-commissions/page.tsx` :95 → `bg-card`.

### DESIGN-6 — [MED, needs design call] Emoji → lucide in headings — **Status: TODO (judgment)**
Beyond DESIGN-1: `inbox/page.tsx` :183 title + :190/:203 buttons (weakest landmark — also the only list page with no leather band); `feed/page.tsx` :43 title + :54/:61 tabs; `events/[id]/manage` :434 h1 + tab/action emoji (also **confirm()×3** :237/:276/:328 + ~12 raw buttons — worst single file for DEBT-5); `help-id/page.tsx` :105/:156 h2s; `admin/page.tsx` :87/:112–122 metric emoji + hand-rolled svg shield :91; `catalog/[id]` :148, `suggestions/[id]` :297/:316 h3s; studio suite fieldset legends + 🟢🟡🔴 status glyphs (systemic convention — decide once).

### DESIGN-7 — [OPEN DESIGN CALL] `/upgrade` tier treatment — **Status: awaiting owner/wife decision (known open item)**
Full inventory: Pro card :161–166 + Studio Pro :196–201 gradients/badges/labels; success banner :113–116, cancelled banner :122–123, current-plan label :130, Active badge :185; `UpgradeButton.tsx` :40/:52, `StudioProButton.tsx` :39/:51. ~14 raw utilities, all night-unsafe (pastel-on-dark). Free card + FAQ cards already tokenized. Decision: keep premium gradients (add night variants) vs map to `tier-gold`/`studio`.

### DESIGN-8 — [DECISION] Legacy surfaces: fix or let cutover delete them — **Status: TODO (cheap flag flip available)**
- **`SHOWRING_V2` is still not set in prod Vercel** → `/community` serves v1 `ShowRingGrid.tsx`, the single heaviest raw-palette file (:45 OF-chip, :292 `bg-amber-400`, :307 `bg-blue-500`, :319, :388). v2 (`components/showring/`) greps fully clean. Flipping the flag (after owner preview sign-off) retires the worst drift surface for free — don't hand-fix v1 first.
- `LegacyShowPage.tsx` 6 amber night-unsafe lines (:133/:183/:188/:202/:207/:257) — dies with DEBT-4 cutover; only fix if cutover stays far out.

### Cross-cutting (feeds DEBT-5)
42 `alert()`/`confirm()` across 23 files (hotspots: GroupFiles ×6, add-horse ×4, ChatThread ×3, GroupAdminPanel ×3, events-manage ×3) — replace with a shared shadcn confirm dialog. ~190 decorative emoji across 60+ files (many deliberate). Non-design bug found in passing: `feed/[id]/page.tsx` :75 `max-w-[640]` missing unit.

### Suggested batching (deploy discipline: one push)
1. **Mechanical batch** (no decisions): DESIGN-2 + DESIGN-5 + DESIGN-4 + DESIGN-3 sweep — all verifiable by eye in Lamplight + vitest/tsc.
2. **Judgment batch**: DESIGN-1 settings body + DESIGN-6 worst headings (inbox, feed, admin, events-manage).
3. **Owner calls**: DESIGN-7 gradients; DESIGN-8 SHOWRING_V2 flip; legacy fix-vs-wait.

---

## ⚪ TECH DEBT — bigger bets (track, not urgent)

- **DEBT-1 — Test coverage:** ~90 mutations across `competition.ts`(19)/`events.ts`(16)/`groups.ts`(15)/`art-studio.ts`(14)/`parked-export.ts`(11)/`posts.ts`(8)/`messaging.ts`(6) have zero unit tests. Start with `competition.ts` + `parked-export.ts` (escrow-adjacent, real-world-show results). 1,001 tests today cover the money core well.
- **DEBT-2 — zod at boundaries:** only 6/44 action modules validate inputs; 38 destructure raw client objects into DB writes. Add incrementally; the `notifyHorsePublic` client-`userId` hole (SEC-3) is the acute case.
- **DEBT-3 — Mega-form duplication:** `add-horse/page.tsx` (1,734) + `stable/[id]/edit/page.tsx` (1,642) share 803 identical lines. Extract shared `HorseForm` (zero-visual-change refactor; add form tests first — neither is tested).
- **DEBT-4 — Two show engines:** legacy `shows.ts` (1,280, imported by 5 live modules) vs `shows-v2.ts` (2,527, flag SHOWS_V2). Blocked on a data migration to cut over; track as milestone.
- **DEBT-5 — UI consistency:** 209 raw `<button>` (80 files) vs shadcn Button; 6 parallel toast systems + 18 `alert()` + 22 `confirm()`; `EmptyState.tsx` has 0 importers. Codemod starting with Header + funnel components.
- **DEBT-6 — Legacy catalog tables** (`reference_molds`/`reference_releases`/`artist_resins`) have 0 code refs — safe DROP migration after confirming no BI dependency.
- **DEBT-7 — gen-types workflow risk:** hand-pasted migrations + remote codegen can silently clobber interim/hand-patched types. Add a CI "gen-types produces no diff" check. Currently in sync.
- **DEBT-8 — Resilience:** section `error.tsx` only at root; `/market` renders blank via `<Suspense fallback={null}>`; mega-forms have no autosave (mobile tab-eviction wipes input).

---

## Deploy discipline (owner preference, 2026-07-12)
Owner wants to **minimize Vercel deployments** — test locally (tsc, vitest, exercise flows) and **batch changes into as few pushes as possible**. Migrations are FILES the owner applies in the Supabase SQL editor (no deploy needed for the DB part). Bundle related fixes per push.

---

*Companion docs: `docs/OPERATOR_PLAYBOOK.md` (the 8 MOVES), `docs/NEXT_SYSTEMS_ROADMAP.md`, `docs/MOVE1_REFERENCE_AND_WANTED.md`, `.agents/MASTER_SUPABASE.md` / `MASTER_BLUEPRINT.md`.*
