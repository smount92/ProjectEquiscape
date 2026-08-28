# Four Features, Thought Through — 2026-08-27

Critical plans for the four candidate features, examined per user type and
against the real system. Nothing here is built; this is the thinking Stephen
asked for before any of it is.

Personas used throughout: **the Googler** (anonymous, 57% mobile, lands on a
reference page), **the Casual Collector** (small stable, lurks more than posts),
**the Serious Collector** (big stable, grails, congas, curator-adjacent),
**the Seller** (For Sale statuses, deal rooms), **the Artist** (sculpts, sells
editions, cares about attribution), **the Show Host** (Amanda; clubs, regions),
and **the Owners** (moderation load, cost, liability, growth).

Recommended build order: **Mold Timelines → Model Finder → Conga Registry →
Verify This Resin.** Rationale at the end.

---

## 1. Mold Timelines — build first (~1 session)

**What.** Mold reference pages render every release chronologically — year,
color, model number — as the mold's biography. Pure display over data we
already hold (`parent_id`, `release_year_start`).

**Per persona.** The Googler gets a visibly richer landing page (the pages
Google already sends people to). The Casual Collector sees their one horse in
its family context. The Serious Collector gets the mold-history lore the hobby
genuinely loves. Curators get an error-spotting surface — year gaps and
duplicate releases become *visible* and flow into the suggestion pipeline.
Owners get near-zero moderation surface and no new infrastructure.

**System fit.** No schema, no cron, no RLS. Renders inside the existing
ISR-cached reference pages. Missing years render honestly as an "undated"
shelf. Molds with 100+ releases group by decade.

**What could go wrong.** Duplicate rows become visible — that is a feature
(drives curation), but expect a bump in suggestions. Sparse pre-1990 dates.

**Decisions needed.** None blocking.

---

## 2. Model Finder — build second (~2–3 sessions)

**What.** Want lists × the eBay sweep. When a listing appears for a model on
your want list, you get an alert — with MHH marketplace listings for the same
model shown FIRST, and the asking-median for context ("$45 — below the $70
median"). eBay links are EPN affiliate links; the feature pays for itself.

**Per persona.**
- *Casual:* set-and-forget delight. Weekly digest by default — never a stream.
- *Serious:* the grail-hunting tool. Edge over eBay saved searches = catalog
  precision (customs/bodies/lots already refused) + price context. Wants
  price thresholds ("only under $X").
- *Seller:* the critical tension — an alert that exports demand to eBay hurts
  our marketplace. Resolution: the alert checks `trade_status='For Sale'`
  horses linked to that catalog entry and surfaces them ABOVE eBay results.
  The feature becomes marketplace demand-routing, not demand export.
- *Artist:* honest limitation — resins mostly lack model numbers, so eBay
  matching can't reach them. The want list shows a matchability badge
  ("eBay watch active" vs "not matchable") so nobody waits for an alert that
  can't come.
- *Googler:* reference pages gain "get alerted when one lists" — a signup
  driver on our highest-traffic pages.
- *Owners:* API budget fine — a daily mini-sweep of (wanted ∩ matchable) via
  the existing `?ids=` mechanism is a few hundred calls. Wrong-match flags
  already suppress a model's signals and therefore its alerts.

**System fit.** Wishlists with `catalog_id` exist; the sweep, matcher, flags,
EPN URLs, notification system, and per-category notification prefs all exist.
New primitives: seen-listing ids per catalog item (dedupe, one small table),
a daily wanted-only cron, digest assembly, one notification pref toggle.

**What could go wrong.** Stale listings (daily sweep for wanted models + "as
of" honesty); alert fatigue (digest default, per-item mute); asking-vs-worth
confusion (median context line on every alert, never the word "worth").

**Decisions needed.** Free/Pro split — proposal: weekly digest free for
everyone; daily alerts + price thresholds as Pro perks (a *convenience*
paywall, not a trust paywall). Existing want-list holders: default to weekly
digest with a one-time announcement and easy off, or strict opt-in?

---

## 3. Conga Registry — build third (~2–3 sessions, after Timelines)

**What.** Completion tracking per mold: "You own 9 of the 41 releases
catalogued on this mold," a visual shelf, opt-in leaderboards, and one-click
"add the missing ones to your want list" — which feeds the Model Finder.

**Per persona.**
- *Casual:* progress framing, never deficiency. Unlinked horses prompt "3
  horses aren't linked yet — link them and they count," which converts the
  linking chore into a game (exactly the data-quality behavior we want).
- *Serious:* congas are a real hobby practice; this is the PSA Set Registry
  model that makes collectors live on a site. Variation-level disputes go to
  the suggestion pipeline, where curators already arbitrate.
- *Seller:* a "40 of 41" conga is a broadcast WTB signal; near-complete
  collectors are motivated buyers routed through want lists.
- *Googler:* public leaderboards and share cards are fresh, unique content on
  mold pages — and share cards travel into the Facebook groups that are half
  our referral traffic.
- *Show Host:* optional future — conga classes at shows.
- *Owners:* the support risk is denominator disputes ("I own one that isn't
  catalogued"). Wording is the defense: always "of N catalogued," never
  "complete." Disputes route to suggestions. Privacy: leaderboards are
  **opt-in**, and public counts derive from public horses only — counts leak
  holdings, so nobody appears anywhere without choosing to.

**System fit.** Computed from `user_horses.catalog_id` × the `parent_id`
graph; aggregate counts via the established SECURITY DEFINER pattern
(`get_catalog_stats` mould); the opt-in toggle joins the existing privacy
prefs section; the shelf renders on the mold pages Timelines builds.
Mold-linked (coarse) horses count as "1 unspecified release" with a nudge to
refine — historic coarse links become refinement prompts.

**What could go wrong.** Catalog denominators (dups/missing releases) —
mitigated by wording + the curation loop; privacy leakage via counts —
mitigated by opt-in + public-horses-only; gamification pressure — mitigated
by framing (journey, not scoreboard; leaderboard is one tab, not the page).

**Decisions needed.** Leaderboard identity = alias, opt-in (proposed). Your
own private % uses all your horses; public displays use public horses only
(proposed). Share-card cosmetics as a Pro perk; tracking itself free
(proposed — it drives data quality, we want everyone in).

---

## 4. Verify This Resin — build fourth (~3–5 sessions + trust care)

**What.** An opt-in public edition registry for artist resins: "Edition 12 of
25, registered, documented chain of 2 transfers since 2019," with
artist-confirmed edition sizes. **Verdict-free by design**: the registry
states facts; it never declares anything fake, and absence of registration
means nothing.

**Per persona.**
- *Serious/high-end:* the pre-purchase check the expensive end of the hobby
  has never had; registering boosts resale credibility.
- *Artist:* the linchpin. Requires a missing primitive — **verified artist
  accounts** linked to catalog identity — which also unlocks artist bios and
  the SEO artist-page work (shared foundation, double payoff). Artists
  confirm edition sizes; their incentive is protecting their own editions
  from recasts.
- *Seller:* registered provenance = premium listings on OUR marketplace.
- *Googler:* registry pages add trust-flavored SEO on artist/resin names.
- *Owners:* the liability caution is real — a registry that implies "fake"
  invites defamation-adjacent drama. V1 has no user-facing fake-flagging at
  all; disputes are facts-vs-facts and route to existing moderation. Artist
  verification is manual at first (vouching, like MHI's curatorship).

**System fit.** `edition_number`/`edition_size` exist on horses; Hoofprint
transfer chains exist; visibility gates exist. New: an edition-registration
table (insert-as-self RLS, public read of registered rows — the 196 flag
pattern), redacted chain rendering (years + count; alias display opt-in),
and the artist-verification workflow.

**What could go wrong.** Cold start (seed with our own resins; empty registry
pages on niche resins are acceptable); drama (verdict-free language,
moderation routing); artist verification friction (manual, slow, fine).

**Decisions needed.** Fully opt-in per horse (proposed). Verified artists can
annotate their entries ("run was 25") in v1 (proposed). Always free — this is
a trust feature and the trust rule applies (proposed, non-negotiable-ish).

---

## The flywheel

Timelines give molds a face → the Conga shelf lives on that face → a conga
gap becomes a one-click want → the Model Finder hunts it (MHH listings first,
eBay second, price context always) → the purchase lands in a stable → the
horse links to the catalog → the conga ticks up → the share card lands in a
Facebook group → a Googler arrives on a reference page that now shows a
timeline, a registry, and live prices. Every loop passes through the
suggestion pipeline (data quality) and the reference pages (SEO).

## Sequencing and why

| Order | Feature | Effort | New infra | Revenue | Risk |
|---|---|---|---|---|---|
| 1 | Mold Timelines | ~1 session | none | SEO | lowest |
| 2 | Model Finder | 2–3 sessions | 1 table + mini-cron | EPN per alert | staleness, fatigue |
| 3 | Conga Registry | 2–3 sessions | aggregates + prefs | indirect (Pro cards) | denominators, privacy |
| 4 | Verify This Resin | 3–5 sessions | registry + artist verify | indirect (market trust) | drama, cold start |

Timelines first because it is one session and scaffolds the Conga UI.
Finder second because both pipes already run and it earns from day one.
Conga third because it stands on Timelines and feeds Finder. Verify last
because its prerequisite (artist accounts) deserves its own careful session
and its trust surface deserves the most patience.

## What we deliberately will not build

- Sold-price scraping (eBay ToS; the EPN account funds the site).
- Fake/recast verdicts, by us or by users (facts only; liability).
- Auto-linking horses to catalog entries (coarse data poisons congas).
- Public collection valuations (theft risk; values stay owner-private).
