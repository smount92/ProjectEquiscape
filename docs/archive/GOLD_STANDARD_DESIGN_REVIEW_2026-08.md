# Gold-Standard Design Review — Is It Architected Right for the Mission? (2026-08-14)

Different question from the adversarial audits ([Part 1](ADVERSARIAL_AUDIT_2026-08-14.md), [Part 2](ADVERSARIAL_AUDIT_2026-08-14_PART2.md)): those judged the code against the intent. This judges the intent itself — are the systems *designed* correctly to be the gold standard for the hobby?

Grounded in three sources: the founding mission docs (`Foundational documents/` — "the definitive Digital Registry," "modernize live showing," judge's tablet, QR tags, show binder), the as-built architecture (eight audits), and a fresh ground-truth research brief on how the hobby actually shows (MEPSA, NAN/NAMHSA, FB album shows, live show culture, digital predecessors — sources cited in the research section at bottom of this doc's companion transcript; key facts inlined below).

---

## The one-paragraph verdict

**The data architecture is mostly right. The experience architecture is wrong.** The schemas mirror the hobby's real ontology with surprising fidelity — proxy showing is first-class, leg numbers are per-show, cards transfer with the horse exactly like NAN cards, divisions→classes→placings→records→cards is the real pipeline. What's wrong is that the platform *renders lists where the hobby has rituals*. A photo show is not 40 photos in a grid — and the deeper diagnosis is that the grid treats the **show** as the atomic unit when the hobby's atomic unit is the **class**. Fixing this is mostly presentation-layer rework plus about five missing domain objects — not a schema rebuild. That's the good news hiding in "I don't care about extensive rework": you don't need to re-engineer the foundation; you need to build the right rooms on top of it.

---

## What the hobby actually is (research anchors)

- **The class is the contest.** MEPSA's classlist grammar is stable and canonical: divisions by finish × scale (OF Plastic / OF China / Artist Resin / Custom; Traditional→Micro Mini), sections by gender / breed / color / collectibility+workmanship / performance, governed by a Breed Directory. One photo enters up to 4 sections at once — the photo *back* is the entry form.
- **Critiques are the teaching mechanism.** MEPSA's Novice series exists specifically so judges write private critiques; novice live divisions are prized because "the judge will explain their placings." The quilt-judging world (NACQJ) sets the ceiling: a written evaluation for *every* entry, grounded in stated standards, "not personal opinion."
- **Qualification is a currency, and today it's irreplaceable paper.** NAN cards: 2 per open class, bearer instruments, transfer with the horse on sale, invalid if the showholder never files results, dead if lost. Exhibitors self-track MEPSA qualifications. This is the hobby's most explicit trust problem — and your cards system already mirrors the semantics.
- **Judging standards are already written.** The IMEHA/MEPSA Performance Guidebook has per-class rubrics (gaits scored 1–7, tack legality, enumerated faults). Judges work to this level of specificity; "judges who haven't kept up" is a named community complaint.
- **Documentation is a hobby institution.** Breed docs (blurb + reference photo) and performance docs travel with entries as paper cards; factual errors are fatal (a judge DQ'd herself for a wrong-direction dressage test).
- **Cadence is ritual.** Monthly qualifiers → annual championship (MEPSA); upload 1st–15th, results ~23rd (CWS). Predictable seasons with a pyramid are the engagement structure the hobby already loves.
- **Why people leave:** photography arms race gatekeeps the model competition; cost escalation; clique perception; judging subjectivity; record fragility (paper cards, judges' mailboxes, volunteer follow-through).
- **Every digital predecessor converged on the same core:** the horse is the persistent entity, entered once, shown many times (OMHPS, PonyBytes — which Breyer chose to partner with rather than build, ModelHorses.com, AKC secretary software). You already have this — it's your registry.
- **Institutional fragility is the norm:** MH$P went 15 years without a redesign and relaunched only after ransomware; IMEHA died and MEPSA had to adopt its guidebook. Durable archives, export, and succession-friendly administration are *trust features* in this hobby.

---

## System by system: is the design right?

### 1. SHOWS — design is wrong; the rework you already suspect ★ the flagship

**As built:** all three page generations (legacy grid, v2 gallery, v3 album wall) share the same shape: masthead → CTA → one flat photo surface for the whole show → program accordion → results table. The class is a filter chip. Judging is invisible until a results dump. Critiques are written into a void. An entry is `horse + photo + leg number` — nothing else.

**Why it's wrong for the mission:** the charter promises to "modernize showing," and every ritual that makes showing *showing* — the class lineup, the judge's card, the ribbon moment, the critique, the championship callback, the qualification card — either isn't rendered or isn't in the model. The grid is what you build when you think of a photo show as a photo contest. The hobby thinks of it as **a horse show that happens to be conducted by photograph**.

**Gold-standard design — "The class is the room":**

1. **Class pages, not photo walls.** Each class gets its own scene: the lineup (entries side by side with leg numbers — comparable, like a ring), each entry's documentation card, the class's rubric ("what the judge looks for" — from the guidebook), and after judging: the ribbon rail (1st–6th with rosette styling), the judge's critique under each entry, and the congrats thread. The show page becomes the *program*: a navigable schedule of class-rooms, not a wall. (The v3 "album" instinct was right that photos should lead; it kept the wrong unit.)
2. **Judging as cadence, not a dump.** Classes already have a status machine (scheduled → called → judging → placed) — it's just never surfaced to spectators. Publish class results *rolling*, as the judge finishes each one: "Ring 1 — Now judging: Class 12 · Just placed: Class 11." A judged online show becomes multi-day theater instead of one notification. (Schema: needs only a per-class `results_published_at`; the states exist.)
3. **The entry is a dossier, not a photo.** Add the charter's own "digital show binder": a reusable **Documentation object** (breed blurb + reference photo; performance explanation) that attaches to entries and travels with the horse across shows. Judges see it with the entry, exactly like the paper card culture. This is a real ontology gap — the only major one in the shows schema.
4. **Critique per entry, not per placing.** Today critiques can only attach to placed entries (max 6/class). Move critique to the entry level, make it structured (model faults vs *photo* faults — directly answering the photography-arms-race complaint), and let hosts declare a **Novice division** where critiques are guaranteed. This is the single highest culture-fit feature the platform could ship: it converts the hobby's teaching mechanism from a favor into a product.
5. **Multi-section entry in one motion.** MEPSA lets one photo enter gender + breed + color + workmanship by writing four class numbers on the back. The current flow is one dialog per class. Design the entry flow as "enter this horse across the classlist" — pick horse, pick photo, tick the sections it belongs in, attach documentation, done.
6. **Ship the classlist grammar as canonical templates.** ClasslistBuilder exists but every host rebuilds the wheel. Ship MEPSA-shaped classlists (divisions × sections, breed directory groupings) as one-click templates with host overrides. Do the same for rubrics: surface the IMEHA/MEPSA guidebook criteria *inside the judge's view* per class — this answers "judging subjectivity" with a shared, citable baseline and makes new judges viable (judge scarcity is a named showholder pain).
7. **The season pyramid.** Standings and points exist; cards exist. What's missing is the *shape of the year*: monthly qualifiers → an annual MHH Championship where qualified horses enter (your cards already know who qualified — automating the "exhibitors track their own qualifications" burden MEPSA explicitly leaves on showers). This is the retention architecture, and it's assembly, not construction.
8. **Conflict-of-interest, automated.** NAMHSA's integrity rules (judges can't judge their own creations, recent ownership, relatives; showholders can't enter their own qualifying divisions) are enforceable automatically because the platform *knows* maker, owner, and judge per entry. No adjacent platform ever needed this; it's a differentiator only this domain rewards.
9. **Fun formats are first-class, not lesser.** Luck shows (random draws — pure social ritual), themed monthly shows, Zippo-style fixed-variable classes (everyone shows the same mold so only skill differs). Cheap to build on the same rails, and they're the low-stakes on-ramp for the intimidated newcomer.
10. **Live shows: finish the charter's original vision.** RingConsole, planner, and the callback ladder already exist and target a genuinely uncontested vacuum ("no live-show software exists anywhere" — your own strategy doc). The AKC-secretary lesson: if the judge places classes in-app at the ring (phone/tablet), then results filing, card issuance, championship tallies, and the public archive all fall out *for free* — the exact post-show chore that burns showholders. Add the charter's QR/printable leg tags and the paper bridge is closed.

**Verdict: rework.** Keep the domain layer (states, entries, placings, cards, standings — genuinely well-engineered). Rebuild the presentation around the class, add Documentation + per-entry Critique + per-class reveal + season wrapper. This is the flagship project after Summerween.

### 2. REGISTRY / COLLECTION — design is right; deepen, don't rework

The hobby's digital precedents all converge on "the horse is the persistent entity" — and that's already your architecture (passport, hoofprint, enter-once-show-many). Design-level additions:

1. **Community verification IS the identification system.** *(Revised 2026-08-14: the AI identification project is dead — the community rejected AI near the hobby, which supersedes the charter's success criterion #1.)* The replacement is better culture-fit anyway: mold ID, breed plausibility, and collectibility rarity are crowd-knowledge domains (identifyyourbreyer culture). An owner claim + N community confirmations → "community verified" grade on a record, iNaturalist-style. This gives the hobby's experts a productive status role (answering clique-iness) and makes identification a *social* feature instead of a rejected-tech feature. Implications of the AI retirement: sunset the Gemini mold-ID endpoint; rework the Stablemaster monthly report as a deterministic stats digest (no LLM) — which also cleanly resolves the vault→Gemini legal finding from Part 2; simplify the AI data-policy copy accordingly.
2. **The external qualification ledger** (user-requested: "OMEQ tracking" — likely one of the online-show qualification programs; the general form covers NAN, MEPSA, OMHPS, OMEQ, and whatever comes next). MEPSA explicitly makes exhibitors self-track their qualifications; NAN cards are irreplaceable paper. Let a horse's passport carry qualifications earned *anywhere*: org, show, class, placing, date, optional photo of the physical card as evidence — stored on the existing `show_records` `self_reported` tier, upgradeable via community verification (#1). This is the definitive-registry move: become the ledger for the whole hobby's paper, not just MHH-native cards.
3. **Surface the story, not just the fields.** The passport is already the best-designed object on the site. The registry's differentiator vs a spreadsheet is *narrative*: show career, provenance chain, artist credit, LSP status. (Blocked today by the genesis bug and blank anon hoofprint — audit items; fixing those is what makes this design real.)

**Verdict: keep.** Fix the audit items, add community verification + the external ledger. No rework. (Add-horse front door reverts to the reference search, which is already good.)

### 3. TRUST / PROVENANCE — design is right and genuinely novel; execution is the gap

The card system already mirrors NAN semantics precisely (transfer with horse, one-use, verify page) — and the research confirms this solves the hobby's most explicitly felt trust problem (irreplaceable paper, results-dependent validity, self-tracked qualifications). Design-level additions to reach gold standard:

1. **Results-filing verification, digitized.** NAN invalidates every card from a show whose results were never filed. Your platform gets this for free — cards are *born* from filed results. Say so on the verify page ("issued from published results of X, judged by Y") — that provenance line is the moat.
2. **Season cutoffs + the championship redemption loop** (see Shows #7) — cards should be *for* something on-platform.
3. **The physical bridge:** printable card + QR (charter's original QR instinct) so digital cards live in show binders and sales photos the way paper cards do today.
4. **LSP as a first-class market status.** "Live Show Proven" is existing sales vocabulary — a listing badge backed by linked platform records turns folklore into verifiable claim, and ties market → registry → shows into one loop.
5. All the forgeability fixes from the audits (verified-artist whitelist, review minting, record deletion, genesis) are *prerequisites* — a gold-standard trust layer that can be forged is worse than none.

**Verdict: keep, and lean in harder.** This is the most defensible system on the platform.

### 4. SOCIAL — design is wrong-shaped; replace the clone with the hobby's own social forms

As built: a generic follow-feed clone (two of them). The research says the hobby's actual social forms are: **the comment thread under an entry** (FB album shows), **the congrats moment** (placings), **the swap-meet/showhall mingle** (live shows are equally shopping and friendship), and **mentorship** (novice tracks, critiques). None of these are follow-graphs.

Gold-standard shape (extends Part 1's conclusion with research backing):
1. Activity-around-objects: threads live on horses, classes, and shows — never in a free-floating feed. The feed is a *digest* of object activity ("Around the Barn").
2. **Every placing is a social moment**: ribbon reveal → congrats thread → shareable card (PlacingCelebration already exists — it's the right instinct, make it the pattern).
3. **Participation rewards, not just ribbons** (Art Fight lesson): showing streaks, critique-writing credit, verification contributions, "first show" badges — non-zero-sum status so non-winners stay. (Achievements system already exists as the substrate.)
4. Mentorship as a feature: novice flag + ask-a-judge threads + the glossary/learn track already built. The "cliques" complaint is answered by structured on-ramps, not by more feed.

**Verdict: rework the shape (already planned in Part 1 Wave D), with the show as the social anchor. Cut the second feed, don't polish it.**

### 5. MARKET — design is right; the mission constraint is the design

"No financial middleman" (charter) + the volunteer economy ($1–10 entry fees, coupons, satin ribbons) means the market's job is *information and safety*, not transactions: Blue Book as public good, Safe-Trade as escort, LSP/provenance as listing substance. That's what's built. Two design notes:
1. The pay-for-placement surfaces (boost/promote) are off-culture for this hobby, not just broken — the audits said delete; the research seconds it. Monetize Pro *conveniences* and absorb *showholder overheads* (the strategy's free-hosting instinct is exactly right); never entrant-side stakes or trust.
2. **Institutional durability is a market feature**: MH$P's ransomware relaunch is the cautionary tale. Data export (built), public archives (partially built), succession-friendly show administration (not built — a show/host handover path) — these are why a 30-year hobbyist would move their records here.

**Verdict: keep. The restraint is the design.**

### 6. PLATFORM / EXPERIENCE ARCHITECTURE — one product, one grammar

The cohesion audit already catalogued the symptoms (3 show engines, 2 nav vocabularies, orphaned calendar). The design-level cure is a **noun architecture**: the site has exactly five rooms — **Stable** (yours), **Registry** (the reference), **Show Grounds** (all showing: calendar, shows, standings, results — one roof ending the shows/events/calendar three-way split), **Market**, **Commons** (community). Every route, nav label, and coined term maps to one room; the glossary defines all of them. Simple Mode (charter's accessibility promise — the hobby skews older) stays a first-class citizen and gets applied to the show experience (big type, linear flows, obvious buttons).

---

## What this means concretely

**Keep (genuinely well-architected):** shows domain schema, cards/provenance model, registry/passport, Safe-Trade + Blue Book, notification plumbing, the leather design language, Simple Mode, catalog/reference architecture.

**Rework (design-level):**
1. **Shows presentation**: class-as-room pages, rolling class reveals, program-shaped show page. *(The flagship.)*
2. **Entry model**: multi-section entry flow + Documentation object.
3. **Critique model**: per-entry, structured, novice-guaranteed.
4. **Season architecture**: qualifier → championship pyramid wrapping the existing cards/standings.
5. **Social shape**: object threads + digest; delete the follow-feed generation.
6. **Add-horse front door**: AI-first identification.

**New objects needed (the honest ontology gaps):** Documentation, Rubric (class-type criteria), Season/Series, Novice track, Community Verification, External Qualification record, COI rule engine. Seven objects — that's the entire schema delta for the gold standard. *(AI identification: removed — community rejected it.)*

**Sequencing (revised 2026-08-14 — owner decision: rework the show NOW; only 4 entrants, contacted individually):**
1. **Shows v4 immediately**, replacing all three generations before Summerween runs at scale. This flips the safety math from Part 2's plan: instead of patching v2 (sticky scratch, ban, RLS triggers, voidCard as bolt-ons), the safety architecture is *designed into* v4's domain layer from the start — barred-entrant and suspension as native concepts, entry-domain rules enforced in DB triggers from day one, card revocation in the card model, per-entry critique replacing the placing-note. Summerween becomes v4's pilot: migrate or re-enter the 4 existing entries by hand, and if dates slip, slipping a community show a week is cheaper than shipping the wrong architecture twice.
2. **Still do now, independent of v4** (site-wide, unaffected by the shows rework): Sentry wiring, password-reset URL, legal/copy truth pass, review-forgery closure, bucket limits, RPC revokes, the 404 fix, GA consent.
3. Then: season pyramid → community verification + external qualification ledger → social reshape. Each step independently shippable, each making the previous one more valuable.

The mission fit, restated: the charter says *registry* first — and the registry is right. What makes it the *definitive* registry is that show records flow into it automatically, cards prove them, provenance carries them across owners, and the community verifies them. Every rework above is in service of that one loop. The grid was never the product; the record is.
