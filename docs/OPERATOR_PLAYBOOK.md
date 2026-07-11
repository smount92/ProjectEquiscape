# Model Horse Hub — Operator's Playbook

**Purpose:** self-contained execution guide. Everything needed to run the
growth strategy and work on this codebase WITHOUT re-researching. Written
for any operator — human or AI assistant — picking up a task cold.
**Written:** July 2026. Re-verify facts marked (verify) if it's now 2027+.

---

## PART 1 — CONTEXT YOU MUST KNOW (do not re-research)

### The product
Model Horse Hub (modelhorsehub.com, repo `model-horse-hub`, Vercel +
Supabase). ~100 users, ~1,800 cataloged horses. Owner: smount92 (+ wife
as design lead). Features ALREADY BUILT AND LIVE: digital stable with
faceted filtering + saved views; Hoofprint provenance (permanent
per-horse history); Safe-Trade escrow marketplace (hardened, state-machine
guarded); Blue Book price data; photo AND live show hosting (unique in the
hobby: classlist builder w/ NAMHSA template, entry flow with proxy
handlers, blind entry galleries, community voting, judge queue, live ring
console with leg-tag placing recorder + champion callback ladder + offline
retry, results → trophy cases, NAMHSA-format CSV export); qualification
cards that auto-transfer with the horse on sale + public /cards/[code]
verification; forum-style groups ("notice board"); DMs; art studio;
CSV import; PWA; Stripe Pro tier. Design language: "leather at the
landmarks, parchment for the work" (leather/brass/ledger materials,
Lamplight dark mode).

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
- **Nobody has ever offered escrow in this hobby** (verified absence).
  Scam anxiety is encoded in group rules ("NO Pre-Sales Allowed" is in a
  major group's NAME). PayPal friends-&-family pressure is the documented
  scam vector.
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

### House engineering rules (from 130+ commits of precedent)
1. **Small branches → merge to main** (main auto-deploys prod via Vercel).
   Husky pre-commit runs the full vitest suite (~1,031 tests, keep green).
   Check exit codes DIRECTLY — never pipe test output through grep.
2. **User-visible rebuilds ship dark behind env flags**
   (`NEXT_PUBLIC_<X>=1`): preview locally in `.env.local`, owner approves,
   then set in Vercel + redeploy. Live flags: SHOWS_V2, GROUPS_FORUM,
   STABLE_V2, SHOWRING_V2.
3. **Migrations are FILES ONLY** (`supabase/migrations/NNN_*.sql`,
   additive, RLS in the house `(SELECT auth.uid())` idiom, SET search_path
   on functions). THE OWNER pastes them into the Supabase SQL editor
   personally. Next number: check the folder (124+ as of this writing).
   After apply: `npm run gen-types`, replace any interim types.
4. **New code standard:** zod at every action boundary → requireAuth →
   explicit ownership/role checks → RLS-first (admin client only with a
   justification comment); pure tested domain libs in `src/lib/<domain>/`;
   shadcn primitives + design tokens ONLY (no raw hex, no bg-white/*,
   text on leather uses the --leather-text ramp — dark-on-leather is
   invisible in day mode); Simple Mode + Lamplight must both work.
5. **Money/schema changes get adversarial review before merge.**
6. Agents build in a git worktree, never the owner's checkout; push
   branches, never main (the main session merges after review).

### Known follow-ups (check before starting adjacent work)
Commerce: 5 documented atomicity holes (need cancel/verify atomic RPCs —
migration), review-item S2 (stale competing offers after ownership
change), manual two-account buy-flow test still owed. Site-wide: anon
users see "Unknown" aliases on public pages (RLS on users reads); 18→
partially-consolidated bespoke toasts; ~208 raw <button>s; add-horse/edit
mega-form duplication (~1,700 lines each, shared HorseForm wanted); zod
missing outside the 5 rebuilt domains; zero tests in events/art-studio/
messaging/competition/posts/market; legacy photo-show engine deletable
only AFTER a data migration moves old shows into v2; competition.ts/
packer cluster is NOT dead (serves real-world-show entrants — keep).

---

## PART 2 — THE GROWTH MOVES (recipes)

Audience priority: **showholders → high-value sellers (resins) → casual
collectors.** Do moves in order unless the owner says otherwise.

### MOVE 1 — Public reference database + Blue Book pages (SEO wedge)
WHY: Discogs/TCGplayer won their niches with free indexed catalog pages;
"what's my Breyer worth" has no good answer on the open web; MHH has
10,500+ releases and real sales data but ~1 indexed page.
STEPS:
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

### MOVE 6 — Portable reputation + escrow marketing
1. Public per-seller reference page: completed Safe-Trades, reviews,
   member-since — linkable in any FB thread.
2. Copy angle everywhere: "the only place in the hobby with real escrow.
   No friends-&-family roulette." (Verified: literally nobody else has
   it.)
3. Target resin sellers first (highest anxiety, highest value).

### MOVE 7 — Presence & liveness
1. Play Store TWA wrapper of the PWA (PWABuilder), Apple later.
2. Weekly recurring virtual photo show (owner-run until showholders take
   over) — a 100-user site must never look asleep.
3. BreyerFest every July = the annual acquisition festival: "catalog your
   haul tonight" campaign, virtual show that weekend.

### MOVE 8 — Pro monetization spine
Estate/insurance PDF reports, packet PDFs, multi-ring, Stripe fee
collection for shows. Converts existing users; does NOT acquire. Never
paywall: hosting a basic show, browsing, cataloging, the reference pages.

---

## PART 3 — STANDING RULES FOR ANY OPERATOR

- The owner approves: design changes (with wife), anything touching
  money, migrations, prod flag flips, external comms. Draft, don't send.
- Mock → approve → build. Never ship a look the design lead hasn't seen.
- Zero-visual-change refactors need no design approval but DO need the
  test suite.
- When a user reports a bug: diagnose with file:line evidence before
  fixing; check whether the same pattern exists elsewhere and sweep it.
- Update docs/SHOWS_V2_TESTING.md-style checklists when shipping flows
  that only humans can verify.
- The community is small and burned-out on platform failures: every
  outage, data loss, or paywall surprise costs trust we cannot buy back.
  When in doubt, choose boring reliability.
