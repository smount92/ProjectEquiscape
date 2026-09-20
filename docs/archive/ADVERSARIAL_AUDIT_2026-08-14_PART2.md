# Adversarial Audit Part 2 — Full System-by-System + Site-Wide Synthesis (2026-08-14)

Companion to [ADVERSARIAL_AUDIT_2026-08-14.md](ADVERSARIAL_AUDIT_2026-08-14.md) (Part 1: shows, collection, social). This part covers the remaining five areas — **market/commerce, identity/onboarding, trust/provenance, platform/infrastructure, cohesion/content** — and ends with the unified site-wide plan, which **supersedes Part 1's wave plan** (absorbing its items).

Analysis only; nothing changed. Context anchors unchanged: Summerween entries close **Sep 1**, judging ends **Sep 6**; migrations end at 147.

---

## AREA 4 — Market & commerce

### Major
- **M1. Studio Pro silently downgrades to "pro" on first renewal.** The webhook's `customer.subscription.updated` branch guards supporter subs but not studio — any sub event overwrites tier to `"pro"` (`webhooks/stripe/route.ts:126-203`). A $10/mo subscriber becomes a $5-tier user while still being charged $10. Root cause: `checkout/studio-pro` stamps `metadata.type` on the *session*, not `subscription_data.metadata` (supporter does it right).
- **M2. Studio Pro gates nothing server-side.** Zero tier checks in `art-studio.ts` or any `studio/**` page — every advertised feature (portfolio, commission queue, WIP portal) is free to any authed user. The $10 purchase confers no enforced entitlement.
- **M3. No single source of tier truth.** `getUserTier()` is typed `"pro"|"free"`; studio users pass `=== "free"` gates but FAIL `=== "pro"` gates — they're denied the Pro insurance market-value stamping they're promised ("Everything in MHH Pro included"). Fix: real union + `isPro()` helper, route every gate through it.
- **M4. "Community Trusted" badge can never be awarded.** `mv_trusted_sellers` joins `horse_transfers.status='completed'` but the CHECK constraint only allows `pending/claimed/expired/cancelled` and every RPC writes `'claimed'` (`101_trusted_sellers.sql:22-24` vs `018_hoofprint.sql:180`). Cron-maintained, UI-wired, permanently empty. **One-word fix.**
- **M5. Three live Stripe checkouts charge for effects nothing consumes** — promote ($2.99), boost-ISO ($1.99), insurance-report ($1.99, doubly pointless: the PDF is free). PROD-2 said wire-or-delete; still purchasable.

### Moderate
- **D1.** `completeTransaction` is dead code (no callers) — its "immediate Blue Book refresh" and achievement hooks never run; marketplace completion happens via a direct admin UPDATE in `claimParkedHorse` that skips both. Blue Book only moves on the daily cron.
- **D2.** Webhook user lookup = `listUsers({perPage:1000})` + find — silently drops tier changes past 1000 users. Fix: stamp user id in subscription metadata (supporter pattern).
- **D3.** No billing-portal route exists ("cancel from your Stripe billing portal" is unreachable in-app); `past_due` users are downgraded instantly, contradicting "features stay active until end of billing period."
- **D4.** `verifyFundsAndRelease` / `cancelTransaction` remain multi-statement non-atomic (roadmap-owed atomic RPCs still unbuilt); competing-offer auto-cancel is a JS loop.
- **D5.** `claimParkedHorse` mints a duplicate completed txn row per sale (a `parked_sale` insert *and* completion of the `marketplace_sale` row) — null-price today so no double-count, but latent.
- **D6.** No Blue Book anti-collusion — two cooperating accounts can mint arbitrary "sales" that move medians on thin data.
- **D7.** `/market` search loads the entire price view and paginates in JS (PERF-2 unfixed).

### Minor
OfferCard renders every terminal state as "❌ Offer Declined"; no rate limit on makeOffer/markPaymentSent (pattern exists elsewhere); upgrade page shows Studio subscribers "Free"; webhook logs successes at ERROR level; no refund/dispute webhook handling.

### Verified solid
Webhook signature verification; atomic offer/respond RPCs (identity-bound, revoked, search_path-pinned); vault cleared on claim; Pro gating genuinely server-side; rug-pull locks on delete/status-change during active transactions; zod at every boundary; supporter-tier webhook routing is the correct template.

---

## AREA 5 — Identity & onboarding

### Major
- **M1. Identity RPCs missed the 133 hardening sweep.** `soft_delete_account`, `claim_transfer_atomic`, `claim_parked_horse_atomic` are SECURITY DEFINER with default PUBLIC execute grants and `!=` NULL-fragile guards; the claim RPCs never compare `p_claimant_id` to `auth.uid()` — an authed user can attribute a claim to someone else. Fix: REVOKE + `IS DISTINCT FROM` + identity checks (one migration).
- **M2. Delete-account modal promises hard delete + "[Deleted Collector]"; code tombstones as "[Deleted] <uuid8>", keeps vault/image rows, never removes the avatar file.** (Same copy-vs-code class as Part 1's horse-delete finding, at the account level — and Terms/Privacy/FAQ repeat the false promise; see Area 8.)
- **M3. Deleted accounts 404 for anon but render for logged-in users** — the authed profile path has no `account_status` filter.
- **M4. Alias rename: no history/redirect table.** Every shared `/profile/OldAlias` URL 404s and the old alias is instantly squattable — an impersonation vector for a reputation-driven site.
- **M5. Aliases are case-sensitive** — "Amanda" and "amanda" are distinct accounts and `/profile/amanda` 404s for "Amanda". Fix: citext or `lower()` unique index + lookups.
- **M6. `changePassword` requires no current password** — any live session can silently seize the account (email change is disabled, so password is the only credential).
- **M7. Pending transfer codes have NO surface under the live v2 dashboard flag** — `PendingTransfersSection` (the only view/revoke UI) is v1-dashboard-only; DashboardV2 never renders it.
- **M8. Signup interstitial never shows the entered email; resend is permanently one-shot** — a typo'd address is undetectable and unrecoverable.
- **M9. Getting-started drift ×5** — dead "Show Office" link when the flag is off, Show Ring saved-views promise (Stable-only feature), wrong nav/button labels, universal "vote" copy, feed activity types that don't exist.

### Moderate
Signup promises a real-name field that's never collected + nightly backups no cron performs; dashboard double empty-state with duplicate DOM ids and a CTA pointing at a hidden button; `DashboardToast` dismiss wipes all URL filter state; `/stable` CTA 404s (ShowReadinessPanel); five anon show surfaces pair `login?redirectTo=` with a bare `/signup` link (cookie mechanism rarely fires); no rate limit on password reset; no `List-Unsubscribe` header anywhere and the Pro Stablemaster email ignores notification prefs entirely; auth-ban failure on delete is swallowed (tombstoned but still loginable).

### Verified solid
Open-redirect guards consistent across the auth surface; proxy `getClaims` pattern + full redirectTo capture; password-reset flow works end-to-end (modulo the env-var issue in Area 7); 133 column-level PII revokes; notification default-ON semantics correct and tested; transfer/claim happy path atomic with unambiguous code alphabet. **Settings ledger: every preference toggle has a live reader — no dead settings.** (Narrow: `currency_symbol` applies only to the private vault view.)

---

## AREA 6 — Trust & provenance

**The product's stated moat, and the weakest area audited.** The one artifact that survives scrutiny — platform-issued qualification cards + `/cards/[code]` verify — is excellent. Everything around it is forgeable, dead, or invisible:

### Major
- **F1. "Verified Artist" is owner-forgeable.** `finishing_artist_verified` is in the `HORSE_ALLOWED` edit whitelist (`horse.ts:180`) — any owner can self-set the "✅ Verified via commission delivery" badge. Migration 062's whole purpose was "prevents fake artist attribution."
- **F2. Reviews are forgeable / review-bombable.** `createTransaction` accepts a caller-supplied counterparty and `status:"completed"` with no underlying trade; `leaveReview` accepts any such transaction. Mint a fresh forged txn per review → unlimited fabricated reviews on any user, positive or negative. No rate limit.
- **F3. Provenance genesis is never written.** `initializeHoofprint` inserts the original-owner row on the *user client*, but `horse_ownership_history` has **no INSERT policy** — RLS silently denies, the error is unchecked. Every never-transferred horse has an empty ownership chain; every transferred horse's chain **starts at the second owner** (the claim RPC's "close sender's row" UPDATE matches nothing). The "CarFax" is missing its origin link for every horse on the platform.
- **F4. The public Hoofprint report renders blank for logged-out buyers** — the view and tables are granted `TO authenticated` only, while the page itself is anon-reachable. The exact skeptical-FB-buyer the feature exists for sees an empty provenance report.
- **D1. "Community Trusted" badge unreachable forever** (same root as Area 4 M4).
- **C1. No card revocation.** The `void`/`redeem` state machine and RLS policy exist; no server action calls them. A fraudulent card verifies as "Valid" permanently (compounds Part 1's shows B4).

### Moderate
- **D2.** Owners can delete `platform_generated` show records — curate the trophy case by deleting losses; no tier guard on `deleteShowRecord`.
- **D3.** Card discovery is account/flag-gated: public cards render only on for-sale + passport-v2 passports; a non-for-sale horse's cards are invisible to outsiders.
- **D4.** Condition grade is pure self-attestation rendered with the same visual weight as verified records, adjacent to trust-framed copy.

### Verified solid
Card issuance integrity (RLS requires a real 1st/2nd placing by a real host — hosts cannot fabricate qualifications); anon-safe verify RPC with honest NAMHSA disclaimer; cards-follow-horse trigger; financial-vault privacy genuinely holds (owner-only RLS, cleared on claim, `is_price_public` honored); two-sided transfer consent; verification-tier badges honestly labeled where they render.

**Skeptical-buyer ranking of weakest links:** blank anon Hoofprint → chain missing its origin → the three portable-trust signals are respectively forgeable (artist), forgeable (reviews), and dead (trusted badge) → unrevocable cards.

---

## AREA 7 — Platform & infrastructure

### Major
- **MAJ-1. Unauthenticated service-role export endpoint** — `api/export/show-results/[eventId]` has zero auth and uses the admin client: anon can pull any legacy show's results CSV (aliases, horses, placings) by UUID.
- **MAJ-2. Sentry is mostly dead in production.** No `instrumentation-client.ts` (required under Next 16/Turbopack — `sentry.client.config.ts` never loads), no `onRequestError` export (server render errors uncaptured), `error.tsx` doesn't capture, no source maps. Only ~30 explicit capture sites report. The operator is blind to client crashes on show day.
- **MAJ-3. Password-reset emails likely point at localhost** — `forgotPasswordAction` alone uses `NEXT_PUBLIC_SITE_URL` (unset; fallback `http://localhost:3000`) while everything else uses `NEXT_PUBLIC_APP_URL` with a correct prod fallback. One-line fix + Vercel env check.
- **MAJ-4. PWA offline is dead code** — the page matcher regex can never match (tests against full href, anchored to `^\/`), and `/~offline` is never precached so the fallback can't serve. Image caching works; the "offline at live shows" promise doesn't.
- **MAJ-5. The deploy gate is fictional** — CI's lint step is `next lint` (removed in Next 16) with `continue-on-error`, e2e never runs in CI, and nothing gates the Vercel auto-deploy on CI. Husky is the only real gate.
- **MAJ-6. VERIFY: hourly cron cadence requires Vercel Pro.** On Hobby, `transition-shows` runs ~daily → entry close could slip up to 24h past Sep 1. **Check the Vercel dashboard/invocation logs before the show.**

### Moderate
- `check_rate_limit` RPC is publicly executable — anyone can burn a victim's mold-ID/contact/claim quotas (quota-griefing). REVOKE fix.
- Cron auth accepts `Bearer undefined` when CRON_SECRET is unset (previews); non-constant-time compare.
- Everything the Stripe webhook does is logged at ERROR level, and `logger` is console-only (never reaches Sentry) — real failures drown.
- Deadline-nudge emails are permanently skipped after one partial failure (dedupe keys on the notification row, which is written before the email).
- `horse-images`/`avatars` buckets: no size limit, no MIME allowlist — a hostile signup can upload unbounded storage (the write half of the public-bucket issue; `chat-attachments` shows the correct template).
- next/image configured but abandoned: 2 importers vs 82 raw `<img>` — the single biggest page-weight/egress lever for the traffic spike.
- `supabase_schema_dump.sql` is 1KB of docker error output from April — no drift check exists; advisor exports are 5 months stale and **leaked-password protection appears never enabled** (dashboard toggle, zero code).
- SECURITY DEFINER stragglers in migration 108 lack `search_path` pinning.
- **CSV formula injection in every export** — `escapeCSV` doesn't guard leading `=+-@`; a troll named `=HYPERLINK(...)` lands in the results CSV Amanda shares to FB and executes in Excel.

### Minor
`reference-dictionary` route's `force-static` + cookie client silently degrades caching; Gemini key passed as URL query param; `stablemaster-agent` serial loop with no `maxDuration` (silent truncation); `cleanup_rate_limits` scheduled by nothing; proxy expired-token hard-redirect ("randomly logged out" reports possible mid-judging); env docs omit half the live vars; stale 10.9MB repomix + March architecture report at repo parent mislead any agent that reads them.

### Verified solid
Proxy auth core + full redirectTo; cron endpoints do require the bearer secret; **the rate limiter is genuinely serverless-safe (Postgres-backed, not in-memory)**; Stripe signature verification + supporter-tier isolation exemplary; admin surface fail-closed; chat-attachments/group-files buckets correctly configured; 133 security batch real; hot paths batched (no N+1); exactly one `console.log` in src; show pages `force-dynamic` (no stale-judging risk).

---

## AREA 8 — Cohesion & content

**Headline: the site is not one product** — a beautiful leather shell over three generations of show engine, two nav vocabularies, an orphaned flagship SEO page, and legal pages making materially false claims.

### Information architecture
- `/calendar` — polished, JSON-LD-tuned, self-described "THE landing target" — has **zero inbound links** anywhere.
- Three competing "where do happenings live" surfaces (`/shows`, `/community/events` — whose legacy engine lets users create disconnected "Photo Show" events with their own entry flow — and orphaned `/calendar`).
- Nav item **"Show Ring" (trophy icon) leads to a horse gallery, not shows**; `/shows` gets a camera icon. `/standings` and `/learn` near-orphaned; help pages invisible to logged-in desktop users; `/shows/[id]` resolves to **three different page designs** depending on engine + flag, one of which login-walls anon.
- **The 404 page's only CTA is "Back to Stable" → login wall** — 43 `notFound()` sites all funnel there; zero route-scoped error/not-found files.

### Design system
- Night mode ("Lamplight") is variable-rebinding + a hand-patched allowlist; the Tailwind `dark:` variant is dead code. **~280 raw palette-class usages (all emerald/violet/indigo/purple/cyan + all gradients) render broken at night.** Worst offenders ranked (ExpertJudgingPanel, ShowRingGrid, the landing page itself, BlueBookProCharts…).
- The admin design page documents a system (16 tokens, shadcn) that isn't the leather/ledger/brass system pages actually use; `ui/card` has 2 importers vs 179 inline card-class strings; 37% of buttons bypass `<Button>` (3 parallel button systems); the design-prototype decision ("ledger for working surfaces") shipped only at the landmarks.

### Terminology (top conflicts)
Stable/Digital Stable/Herd/collection (all three on the landing page); "collection" = whole holding AND sub-folder; **desktop nav "Market" vs mobile+footer "Price Guide" vs on-page "The Blue Book"**; alias vs Display Name vs username; "Shows" vs footer "Photo Shows" vs "Show Office"; Ring overloaded ×3; FAQ says premium is "planned" while Pro ships at $5/mo; "Unlisted" defined three different ways; glossary omits every coined term (Digital Stable, Show Ring, Passport, Want List, Stablemaster).

### Content accuracy — the legal-exposure tier (all verified false as written)
1. **"Photos only accessible via time-limited signed URLs, cannot be hotlinked"** — the horse-images bucket has been public-read since migration 078; URLs are permanent.
2. **Account deletion "permanently removes all your data including photos"** — tombstone soft-delete; vault, image rows, storage all retained.
3. **"Even our team cannot access your financial vault, ever"** — the Stablemaster cron reads every Pro user's vault via service role and **POSTs purchase prices + valuations + horse names to Google's Gemini API**; also "cryptographic RLS"/"encrypted at rest" claims are inaccurate.
4. **"AI… does not look at your photographs"** — the opt-in mold-ID endpoint sends user photos to Gemini vision (disclosed only in one privacy subsection); "Enterprise API" claim false (public v1beta endpoint, bare API key).
5. **"Ratings cannot be edited or removed"** — there is a literal Retract Rating button, DB-permitted.
6. **GA loads before consent** (unconditional in layout.tsx), a "decline" is only honored for that session, and no DNT handling exists despite the policy claiming it.
7. Third-party list omits Sentry, Stripe, and eBay affiliate links ("no ads" vs `rel="sponsored"` placements); Terms have zero billing/refund/cancellation language while three paid tiers ship; both policies dated March 14.
8. Plus ~10 stale how-to claims (wrong button names, features in the wrong place, saved-views promise, feed activity types) and: provenance "permanent" claims are DB-deletable (user DELETE grant on `horse_timeline`); in-app Safe-Trade copy implies buyer protection that doesn't exist (content pages have it right — `safety.ts` is the stale side).

### States & duplication
`EmptyState.tsx` is polished and has **zero importers** vs ~40 hand-rolled empties in 3 conventions; the root loading skeleton renders as 1px hairlines (no height); public show page empties are bare text. Duplication inventory: **28 date formatters (0 shared)**, 4 toast systems, 6 share/copy-link implementations, 3 show engines across 50 files, 7 heart-ish buttons, 2 avatar components (one deprecated, both live), 4 pagination strategies.

### Verified solid
Leather identity at the landmarks is real and site-wide (cold-palette purge: zero hits); ExplorerLayout/PageMasthead adoption broad; newest pages (calendar, standings, learn, reference) are the best pages — the craft ceiling is high, the problem is distribution; "Hoofprint" naming is perfectly disciplined (117 uses, zero drift); one Radix dialog primitive; content pages share one (good) voice framework.

---

# SITE-WIDE SYNTHESIS — cohesive, efficient, as intended

## Seven patterns explain almost everything

1. **Half-wired loops.** The dominant failure mode across all 8 areas: producer without consumer or vice versa. Critiques written-never-shown; favorites/comments notify no one (consumers exist!); `getActivityFeed` built-unreachable; `completeTransaction` dead; card void state-machine uncalled; `EmptyState` unimported; boost/promote flags written-never-read; genesis provenance written-but-RLS-blocked. **The site is ~80% built and ~55% wired.** Corollary: many "features to build" are actually 10-line wire-ups.
2. **Copy promises what code doesn't do.** From marketing drift (getting-started, FAQ labels) up to legal exposure (photos, deletion, vault→Gemini, GA consent, ratings permanence). Nobody re-reads the prose when the code changes. Needs a one-time truth pass + a rule: copy changes ship in the same PR as behavior changes.
3. **The trust moat is inverted.** The one artifact built to spec (qualification cards) is excellent; every surrounding signal is forgeable (verified-artist, reviews), dead (trusted badge), invisible to outsiders (hoofprint, cards discovery), or deletable (platform records). The strategy's portable-reputation moat does not currently hold.
4. **"RLS-first" is aspirational.** Real and strong in places (cards, votes, vault, 133 batch), absent in others (show entry domain rules, provenance genesis INSERT, identity RPC grants, `check_rate_limit` grant). Security posture is a patchwork of excellent and missing, with no sweep discipline.
5. **Anon is the acquisition surface and the most broken surface.** Strategy says public pages convert FB visitors; in reality: blank hoofprints, invisible comments/social proof, orphaned calendar, 404→login wall, three show-page designs, login-walled profile. Everything a skeptical outsider touches is the untested path.
6. **N generations of everything, none retired.** 3 show engines, 2 feeds, 3 like systems, 3 button systems, 4 toasts, 28 date formatters, 2 dashboards, 2 reference browsers. Every bug class in this audit appears once per generation. Retirement, not construction, is the efficiency lever.
7. **Operational blindness.** Sentry effectively off, logger console-only, successes logged as errors, CI rotted, no deploy gate, cron cadence unverified, no backup verification. On Sep 1 the operator would learn about failures from users.

## THE MASTER PLAN (supersedes Part 1's waves; Part 1 items absorbed)

### Wave 0 — TODAY, no code (dashboard checks, ~30 min)
1. **Vercel plan / cron cadence** — confirm `transition-shows` actually runs hourly (invocation logs). If Hobby: upgrade or external scheduler. *Blows up Sep 1 if wrong.*
2. **Supabase: enable Leaked Password Protection** (auth toggle, zero code) before stranger signups.
3. **Verify Supabase backups exist** (plan-dependent; public copy claims nightly).
4. **Verify prod values of `NEXT_PUBLIC_SITE_URL`** (password reset) and the 8 feature flags; confirm which surfaces are dark in prod.

### Wave A — Before Sep 1: safety + show blockers (from Part 1, plus new infra)
5. Sticky scratch / per-show bar; minimal `is_suspended`; DB trigger on entries (photo-ownership + deadline); strike-entry + voidCard (now also closes trust C1); `show_id` dedupe one-liner; render judge critiques; report-button on entries + admin v2 visibility; seeded dress rehearsal. *(Part 1 Wave A unchanged.)*
6. **New infra blockers:** fix password-reset URL (one line); wire Sentry properly (`instrumentation-client.ts` + `onRequestError` + capture in `error.tsx`); auth the show-results export route; CRON_SECRET unset-guard; bucket size/MIME limits migration; REVOKE `check_rate_limit` + identity RPCs (`soft_delete_account`, claim RPCs + `IS DISTINCT FROM`); CSV formula-injection guard; fix the 404 page CTA (anon → `/shows` + `/`).
7. **Close the review-forgery hole** (`createTransaction` must not mint completed transactions from thin air) — cheap, and it's the abuse tool trolls would find next.

### Wave B — Before/with the show: funnel + legal truth pass
8. Part 1 Wave B unchanged: reciprocity wiring, show-page comments + anon read, HEIC fix, Unlisted fix, cards OG, disable dead checkouts.
9. **Legal/copy truth pass (half a day, copy-only + 2 small code fixes):** rewrite the six false claims in privacy/terms/FAQ (photos, deletion, vault, AI, ratings, cookies); **decide the vault→Gemini question** — either stop sending vault data to the Stablemaster prompt or disclose + pref-gate it (it currently also ignores notification prefs); make GA consent-gated and persist declines; add billing terms + update "Last updated"; disclose Sentry/Stripe/eBay; fix `safety.ts` buyer-protection copy.
10. **Show-link first-impression fixes:** put `/calendar` in nav/footer; rename "Show Ring" nav or swap icons; patch public show-page empty states + the zero-height loading skeleton; fix the five bare `/signup` links to carry `redirectTo`.

### Wave C — September: trust repair (make the moat real)
11. **Provenance genesis** — DEFINER path or scoped INSERT policy + error check; backfill genesis rows for existing horses (owner + created_at are known).
12. **Anon Hoofprint** — public-horse DEFINER RPCs for timeline + ownership chain (pattern already exists for records/cards).
13. Remove `finishing_artist_verified` from the edit whitelist; tier-guard `deleteShowRecord`; trusted-badge one-word join fix; surface cards on all public passports; per-card `generateMetadata`.
14. **Money correctness:** studio webhook routing (`subscription_data.metadata`) + `isPro()` tier normalization + billing-portal route + webhook lookup by metadata; wire or delete `completeTransaction`.
15. Identity hardening: current-password check on change; alias case-insensitivity + rename history; deleted-account filter on authed profiles; show pending transfers in DashboardV2; show the email on the signup interstitial.

### Wave D — Q4: cohesion & efficiency (retirement over construction)
16. **Retire generations:** legacy show engine (data-migrate + delete, roadmap #6), legacy activity feed (fold into one aggregation-first feed — Part 1 P2), v1 dashboard once v2 has transfer parity, dead code cut list (both parts').
17. **Consolidate the small stuff where bugs breed:** one date-format util (28→1, fixes server-TZ rendering), one toast system (4→1), one share util (6→1), adopt `EmptyState` (~40 call sites), route buttons through `<Button>` on touched files.
18. **Night-mode debt:** replace the patch-allowlist approach — map the ~280 raw palette usages to tokens starting with the worst-10 files; fix the badge-color maps once (they're copy-pasted).
19. **Terminology pass (one PR, mostly strings):** pick canonical names (Stable, Passport, Want List, Price Guide, alias) and sweep; align desktop/mobile nav; add coined terms to the glossary; update the design page to document the leather system.
20. **Performance/egress:** next/image on show gallery, market, reference; paginated market RPC; CI repair (eslint step, e2e, deploy gate); regenerate the schema dump; delete stale root artifacts.

### Standing rules going forward (cheap process, prevents recurrence)
- **Copy ships with code:** any PR that changes behavior greps the content pages for claims it invalidates.
- **Every new RPC gets the 133 treatment** (REVOKE, identity check, search_path) at creation, not in a later sweep.
- **No producer without a consumer:** a feature isn't "done" until the thing that reads/renders/notifies is wired and a test covers the loop.
- **New UI uses the shared primitive** (Button, EmptyState, toast, date util) — consolidation only sticks if drift stops.
