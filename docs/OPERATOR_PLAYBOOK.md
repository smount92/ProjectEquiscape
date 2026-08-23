# Model Horse Hub — Operator's Playbook

**Purpose:** self-contained execution guide. Everything needed to run the
growth strategy and work on this codebase WITHOUT re-researching. Written
for any operator — human or AI assistant — picking up a task cold.
**Written:** July 2026. **Revised August 21, 2026** for the launch
release. Re-verify facts marked (verify) if it's now 2027+.

---

## PART 1 — CONTEXT YOU MUST KNOW (do not re-research)

### The product
Model Horse Hub (modelhorsehub.com, repo `model-horse-hub`, Vercel +
Supabase). ~100 users, ~1,800 cataloged horses. Owner: smount92 (+ wife
as design lead). Design language: "leather at the landmarks, parchment
for the work" (leather/brass/ledger materials, Lamplight dark mode).

**The site is FIVE ROOMS** — Stable · Shows · Market · The Paddock ·
Registry — and the nav bar holds exactly those at any width. Everything
else (Art Studio, Show Ring, Barns, Events, Help ID, Members) is under
More. Use the room names in any copy you write: `/catalog` is the
*Registry*, `/feed` is *The Paddock*, groups are *Barns*, `/discover` is
*Members*.

BUILT AND LIVE:
- **Stable** — faceted filtering + saved views, condition ledger,
  Recently Deleted with restore, Hoofprint provenance (permanent
  per-horse history), financial vault.
- **Shows** — photo AND live show hosting, still unique in the hobby:
  classlist builder w/ NAMHSA template, entry flow with proxy handlers,
  blind entry galleries, community voting, judge queue, live ring console
  with leg-tag placing recorder + champion callback ladder + offline
  retry, results → trophy cases, NAMHSA-format CSV export, titles and
  career ledgers. Qualification cards auto-transfer with the horse on sale
  + public `/cards/[code]` verification.
- **Market** — provenance-first listing cards where the passport *is* the
  listing page; browsable logged-out; Blue Book at `/market/guide`.
- **The Deal Room** — a DM thread that grows into a deal: offers and
  counter-offers, contract boxes both parties sign, an **installment
  ledger for time payments** (the headline), and an evidence pack at
  `/inbox/[id]/record`. Plain DMs are unchanged.
- **The Paddock** — one community stream with structured @mentions,
  per-post Public/Followers visibility, admin pinning, and the door to
  the Show Ring.
- **Barns** — notice board, private barns with a join-request queue,
  shared files.
- **Art Studio** — rebuilt on researched commission practice: structured
  comparable terms, a real quote→work→approval→delivery pipeline, and a
  receipts wall of finished horses shown with the ribbons they won.
- **Members**, **Events** (for happenings outside MHH), CSV import, PWA,
  Stripe tiers, an admin console (Part 4), and object metrics.

### ⚠️ Commerce rulings (owner, August 2026) — these settle old questions
1. **The platform NEVER holds money.** No escrow — not now, not planned.
   Any older doc or copy promising escrow is wrong; do not revive it.
2. **No selling fees.** Show-entry fees are a maybe, someday. Nothing
   else.
3. **We are the record, not the referee.** A dispute produces the
   evidence pack. The platform does not adjudicate.
4. **Time-payment tracking is the differentiator** — the parties author
   their own terms; we record what they agreed.
5. Trust features are never paywalled.

### The hobby (research-verified July 2026)
- Community lives in **Facebook B/S/T groups** (7+ major ones; sizes
  unknowable — login walls). Model Horse Blab (forum): restored Jan 2025
  after ~2 dark years, ~7,000 members. Discord minor. Active TikTok/YT
  maker scene. BreyerFest ≈35,000 attendees each July.
- **The hobby was burned twice:** Blab's multi-year outage; MH$P (sales
  hub since 1996) hit by ransomware March 2024, rebranded Model Horse
  Connection (classifieds-only, no payment handling, ~$10-25/yr).
- **NAMHSA** (the shows governing body) runs qualification on physical
  cards; their own site admits ~1/3 of submitted NAN cards are
  invalid/expired/misfilled; cards are irreplaceable; transfer-on-sale is
  handwritten. No tech partner. Public cost pressure on NAN 2026.
- **Nobody has ever offered escrow in this hobby** (verified absence) —
  and per the ruling above, MHH will not either. The anxiety is real
  (scam fear is encoded in group rules; "NO Pre-Sales Allowed" is in a
  major group's NAME, and PayPal friends-&-family pressure is the
  documented scam vector), but our answer is **the record, not the
  vault**: an immutable transcript, terms both parties signed, a payment
  ledger, and an evidence pack either side can produce.
- Competitors are single-purpose volunteer projects: OMHPS (photo shows),
  MYMHDB (inventory), breyervalueguide.com (paid, ~6,700 values),
  identifyyourbreyer.com (static ID), ModelHorses.com (legacy registry —
  watch it). NO live-show software exists anywhere.
- Proven playbooks from comparable niches: Discogs/TCGplayer/Reverb (free
  SEO-public database + price data first, marketplace second; sales
  history = uncopyable moat), PSA Registry/Ravelry/MyFigureCollection
  (collection tracking = retention + lock-in), Ravelry/Whatnot (court
  power users, give them income/status), StockX/TCGplayer (trust
  infrastructure beats eBay), Letterboxd/Untappd (2-person teams win when
  the log→collection→friends loop compounds). Ravelry's FB-exodus driver
  was structured-data UTILITY, not "a better forum." Cautionary: Discogs'
  2023 fee hike caused community revolt — never squeeze the community.

### House engineering rules (from 200+ commits of precedent)
1. **Small branches → merge to main** (main auto-deploys prod via Vercel).
   Husky pre-commit runs the full vitest suite (155 test files, keep
   green). Check exit codes DIRECTLY — never pipe test output through
   grep.
2. **Ship dark behind an env flag, THEN DELETE THE FLAG**
   (`NEXT_PUBLIC_<X>=1`): preview locally in `.env.local`, owner approves,
   set in Vercel + redeploy — and once the owner is confident, a
   follow-up PR removes the flag *and its fallback branch*. That last
   step is not optional; nine v1 flags accumulated into nine untested
   fallback paths before Phase 0 deleted them all.
   **Do not trust a hand-kept flag list here** — this one named four when
   there were more than twice that. Derive it:
   `grep -rhoE "NEXT_PUBLIC_[A-Z_]+" src/ | sort -u`. Behaviour flags at
   the time of writing were `NEXT_PUBLIC_FORM_ENGINE`,
   `NEXT_PUBLIC_SHOW_STANDINGS`, `NEXT_PUBLIC_WANTED_NUDGE`,
   `NEXT_PUBLIC_PAYPAL_BILLING`, `NEXT_PUBLIC_PREPAID_TERMS`,
   `NEXT_PUBLIC_EBAY_COMPS`, `NEXT_PUBLIC_GROUPS_FORUM` and
   `NEXT_PUBLIC_REFERENCE_PAGES` (an SEO kill-switch, ON) — the rest of
   the matches are config, not switches. Live state is in the admin
   console's Ops tab, which is authoritative over any doc.
3. **Migrations are FILES ONLY** (`supabase/migrations/NNN_*.sql`,
   additive, re-runnable, RLS in the house `(SELECT auth.uid())` idiom,
   SET search_path on functions). THE OWNER pastes them into the Supabase
   SQL editor personally. **DERIVE the next number, never read it from a
   doc** — `ls supabase/migrations | sort -n | tail -1`, then add one.
   This line previously named a fixed number and was nine migrations out
   of date within days; an agent trusting it would have written over an
   applied migration. Note 174 is a deliberate gap, so the highest file
   is authoritative rather than the count. After apply:
   `npm run gen-types`, replace any interim types.
   Two traps that have bitten: a guard trigger must return early when
   `auth.uid() IS NULL` or the migration's own backfill trips it, and
   never edit migration SQL with a plain-string `String.replace()` — JS
   turns `$$` into `$` and destroys the dollar quotes.
4. **App code must feature-detect the schema.** Because the paste is
   manual, deployed code has to work before *and* after it. Probe once
   per process behind a 60s TTL (`src/lib/*/columnSupport.ts`); absent is
   the safe shape.
5. **New code standard:** zod at every action boundary → requireAuth →
   explicit ownership/role checks → RLS-first (admin client only with a
   justification comment); pure tested domain libs in `src/lib/<domain>/`;
   shadcn primitives + design tokens ONLY (no raw hex, no bg-white/*,
   text on leather uses the --leather-text ramp — dark-on-leather is
   invisible in day mode); Simple Mode + Lamplight must both work, and
   **night paper carries no ruling**.
6. **Money/schema changes get adversarial review before merge.**
7. Agents build in a git worktree, never the owner's checkout; push
   branches, never main (the main session merges after review).
8. **Don't remove `experimental.cpus: 6` from `next.config.ts`.** Vercel's
   build machine otherwise spawns 29 static-gen workers, stampedes the
   Supabase pool, and fails the build.

### Known follow-ups (check before starting adjacent work)
**Closed since July:** anon users seeing "Unknown" aliases (fixed by the
public-alias RPCs); the commerce decline bug and the trade-status CHECK
(172); the buyer/seller role confusion in DMs (173); the permanently
empty trusted-seller view (169); the legacy suggestion queue (a phantom
`reviewed_at` column was the root cause).

**Still open:** manual two-account buy-flow test still owed;
partially-consolidated bespoke toasts; a large number of raw `<button>`s;
add-horse/edit mega-form duplication — the **form engine is built but
dark**, and retiring the legacy forms is what closes this; zod still
missing on the pre-rebuild actions (`horse.ts`, `market.ts`, `posts.ts`);
the legacy photo-show engine is deletable only AFTER a data migration
moves old shows into v2 — `competition.ts` and the Show Packer are NOT
dead (they serve real-world-show entrants; `LegacyShowPage` renders
them). Moderation gap: there is **suspend** (`users.is_suspended`, admin
Members tab) and a per-show **bar** (`show_barred_entrants`), but no
account-level ban.

---

## PART 2 — THE GROWTH MOVES (recipes)

Audience priority: **showholders → high-value sellers (resins) → casual
collectors.** Do moves in order unless the owner says otherwise.

### MOVE 1 — Public reference database + Blue Book pages (SEO wedge) ✅ SHIPPED
WHY: Discogs/TCGplayer won their niches with free indexed catalog pages;
"what's my Breyer worth" has no good answer on the open web; MHH has
10,900+ releases and real sales data but ~1 indexed page.
STATUS: built and live — `/reference`, `/reference/[maker]`,
`/reference/[maker]/[slug]`, sitemap entries, and anon-readable market
data. `NEXT_PUBLIC_REFERENCE_PAGES` remains as an SEO kill-switch over
URL emission and sitemap listing. What's left is the *measurement* half:
watch Search Console for indexing and organic impressions.
ORIGINAL STEPS (kept for the reasoning):
1. Build public route per catalog release: `/reference/[maker]/[slug]`
   (server-rendered, anon-accessible — add subtree to src/proxy.ts public
   paths). Content: photos, specs (maker/scale/mold/years), "N collectors
   have this" count, Blue Book teaser (median/recent-sale range; full
   history = members), CTA "Add to your stable".
2. generateMetadata per page (title "Breyer <name> — value & collector
   info"), OG images, sitemap.xml entries for all releases, robots allow.
3. Internal links: stable/show/market cards link to reference pages.
4. Announce nothing — this move is for Google, not the feed.
DONE WHEN: pages indexed (Search Console), organic impressions trending.
GUARDRAILS: NEVER expose individual owners' vault values; aggregate only.

### MOVE 2 — Showholder recruitment (white-glove)
WHY: no live-show software exists; each showholder delivers 20-50
entrants; power users are the Ravelry play.
STEPS:
1. Owner picks 3-5 respected showholders (photo or live).
2. Personal DM/email template: "I built show-hosting software for our
   hobby — classlists from the NAMHSA structure in one click, entries,
   judging from your phone, results that file themselves. Want to run
   your next show on it? I'll set up your whole classlist for you."
3. Concierge: create their show WITH them (screen share), load template,
   customize classes, add their stewards/judges as staff.
4. During their show: owner on-call; afterwards capture testimonial +
   fix-list.
5. Public results page link goes back to their FB group ("full results
   here") — that link is the acquisition surface.
DONE WHEN: 3 shows run end-to-end by non-owner hosts.

### MOVE 3 — NAN-card companion + NAMHSA pitch
WHY: NAMHSA's own docs admit the paper-card system fails ~1/3 of the
time; MHH already has digital cards + public verification.
STEPS:
1. Ship "log your physical NAN cards" on the horse page: photo of card,
   show/class/year fields, validity self-check hints; public verify-style
   display on the horse's Hoofprint. (New small table; migration ritual.)
2. Market it in sales contexts: "buying a NAN-qualified horse? Ask for
   its MHH card page."
3. THEN the pitch (post-BreyerFest window, board attention high): lead
   with THEIR numbers ("your site reports nearly a third of cards arrive
   invalid — here's the fix, free"), offer results-archive hosting free,
   propose a pilot at 2-3 member shows. Attach the working demo.
   NEVER block product on their timeline; the companion stands alone.

### MOVE 4 — Trust story (one weekend, mostly content)
1. About page: real name, face, why we built this, wife-and-husband team
   (Ravelry precedent — community trusts people, not brands).
2. Data export: "Download my everything" (CSV of horses + records +
   cards, PDFs) in settings — the anti-lock-in signal that paradoxically
   builds lock-in.
3. Continuity statement page: backups, what happens if we get hit like
   MH$P, export anytime. Link it in the footer.

### MOVE 5 — Live inside Facebook (don't fight it)
1. Every horse/show/card/reference page: rich OG preview (photo, name,
   provenance line) — test with FB's sharing debugger.
2. Sellers get a "Hoofprint-verified" line to paste into FB listings with
   their horse-page link.
3. Official MHH Facebook page + Instagram: reshare member content
   (permission-first), announce shows. Zero presence = disqualifying in a
   FB-native hobby.
4. Migration concierge for 2-3 SMALL clubs/breed circles into Groups
   (owner does the setup + invites). Megagroups: not yet.

### MOVE 6 — Portable reputation + "the record" marketing
> ⚠️ **Rewritten August 2026.** This move used to lead with escrow. The
> owner has ruled the platform will never hold money, so that copy is
> retired — do not revive it, in marketing or in product.
1. Public per-seller reference page: completed Safe-Trades, reviews,
   member-since — linkable in any FB thread. (The trusted-seller badge
   works now; the view backing it was broken from migration 101 until
   169, so treat any pre-August impression that "nobody is trusted" as
   stale.)
2. Copy angle: **"Every deal leaves a record."** A thread with signed
   terms, a payment ledger both parties can see, and an evidence pack
   either side can produce — instead of a screenshot argument in a
   Facebook comment thread. And the honest second half: we never touch
   your money, and we don't charge you to sell.
3. Lead with **time payments**. Payment plans are how expensive resins
   actually change hands in this hobby, and they are currently tracked in
   DMs and memory. Nobody else offers a ledger for them.
4. Target resin sellers first (highest anxiety, highest value).

### MOVE 7 — Presence & liveness
1. Play Store TWA wrapper of the PWA (PWABuilder), Apple later.
2. Weekly recurring virtual photo show (owner-run until showholders take
   over) — a 100-user site must never look asleep.
3. BreyerFest every July = the annual acquisition festival: "catalog your
   haul tonight" campaign, virtual show that weekend.

### MOVE 8 — Pro monetization spine
Estate/insurance PDF reports, packet PDFs, multi-ring, Studio Pro.
Converts existing users; does NOT acquire.

**Never paywall:** hosting a basic show, browsing, cataloging, the
reference pages, or **any trust feature** (the evidence pack, condition
grades, provenance, the payment ledger). Precedent: flaws are free.

**Off the table by ruling:** selling fees of any kind, and anything that
requires the platform to hold or move money. Show-entry fee collection is
the one maybe, someday — and only as a convenience for hosts, never as a
cut of a sale.

---

## PART 3 — THE ADMIN CONSOLE (`/admin`)

Auth-gated to `ADMIN_EMAIL`. Layout: a **pulse strip** across the top
(`AdminPulseStrip` — at-a-glance counts, with badges that go alarming
when a queue is backing up), then **ten tabs** (`AdminTabs.tsx`, last
tab remembered):

| Tab | What lives there |
|---|---|
| 📬 **Mailbox** | Contact-form messages; mark read, reply, delete |
| 🚩 **Reports** | User reports — dismiss or action |
| 📚 **Catalog** | Legacy suggestion queue, the **duplicate sweeper**, and catalog merges. Approvals write a `catalog_changelog` row |
| 🗓️ **Calendar** | Community-submitted `external_shows` — approve or reject |
| 🏅 **Sanctioning** | NAMHSA sanctioning requests |
| 📸 **Shows** | Show management + the **overdue shows queue** (with a nudge-the-host action) |
| 👤 **Members** | Member search, and **suspend / unsuspend** (by id or alias) |
| 💡 **Content** | Announcements composer (the site-wide banner), Feature-a-Horse, feed pinning |
| 📈 **Insights** | Object metrics — DAU lines, 7-day totals per type, most-viewed per type with names resolved. Links out to Vercel Analytics for the half it does better |
| 🛠️ **Ops** | Migration probes (which migrations the live DB actually has) and the **env/flags panel** — the live state of all four `NEXT_PUBLIC_*` flags |

Things worth knowing:
- **The legacy suggestion queue used to be jammed.** Root cause was a
  phantom `reviewed_at` column; `resolveLegacySuggestion` now works and
  has a Dismiss path.
- **Insights shows a DAU series and a "7-day member-days" sum, not WAU.**
  A true WAU would require keeping viewer tokens for a week, which the
  privacy rule forbids. The label says what it is rather than passing it
  off.
- **Anon dedupe is IP+UA**, which collapses a household and splits a
  phone. That limitation is stated on `/privacy` rather than implied to
  be exact.
- Announcements are written with the service role after an `ADMIN_EMAIL`
  check — the table deliberately has no write policies.

---

## PART 4 — STANDING RULES FOR ANY OPERATOR

- The owner approves: design changes (with wife), anything touching
  money, migrations, prod flag flips, external comms. Draft, don't send.
- Mock → approve → build. Never ship a look the design lead hasn't seen.
- Zero-visual-change refactors need no design approval but DO need the
  test suite.
- When a user reports a bug: diagnose with file:line evidence before
  fixing; check whether the same pattern exists elsewhere and sweep it.
- Update docs/SHOWS_V2_TESTING.md-style checklists when shipping flows
  that only humans can verify.
- Say the room name, not the route: the *Registry*, *The Paddock*, the
  *Show Ring*, *Barns*, *Members*. Copy that says "the catalog" or "your
  groups" is wrong even though the URL says so.
- Never describe a dark feature as live. The form engine and season
  standings are merged but invisible to members.
- The community is small and burned-out on platform failures: every
  outage, data loss, or paywall surprise costs trust we cannot buy back.
  When in doubt, choose boring reliability.
