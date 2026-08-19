# The MHH Championship Series — Program Design (2026-08)

The complete design for MHH-sanctioned photo showing: scoring, qualification, titles, the annual Championship, and the season calendar. Synthesized from three sources: the model-horse hobby's own traditions (MEPSA's pyramid, NAN's card economy, the critique culture), a mechanisms study of nine serious competitive communities (AKC, ARBA, CFA/TICA, AQHA/4-H, Golden Demon/MMSI, IPMS, Pokémon/MTG organized play, NACQJ/AOS, PSA/FIAP), and the platform machinery already built (cards, season points, callbacks, critiques, class rooms).

**The thesis:** every serious competitive community independently converged on the same six mechanisms — wins weighted by competition depth, titles requiring diversity, two-layer judging (standards floor + comparative crown), caps on countable results, endless post-title ladders, and self-calibrating thresholds. The model-horse hobby has *none* of these formalized online. MHH can be the first — and because the whole loop (entry → judging → results → cards → standings → titles → provenance) lives on one platform, it can be *automatic*, which no paper-based org can match.

---

## 0. The Three Ledgers (the architecture everything else hangs on)

Model horses are bought and sold constantly, so "who owns an achievement" must be settled first. The surveyed systems split cleanly: object achievements travel with the object (ARBA legs follow the rabbit; AOS awards attach to the plant forever); skill achievements stay with the person (TCG points, PSA distinctions); and AQHA's amateur division scores the *pair* to stop people buying glory. We adopt all three:

| Ledger | Attached to | Contains | On sale of the horse |
|---|---|---|---|
| **Model ledger** | the horse (travels via Hoofprint) | wins, legs, titles (CH/GC), standards certificates | travels with the horse — a titled model IS worth more, and the provenance proves it |
| **Exhibitor ledger** | the person (permanent) | lifetime distinctions (Star tiers), judge accreditation, season awards won | never moves — your skill record is yours forever |
| **Pair ledger** | (horse × owner-on-entry) | season points, championship qualification | frozen — a mid-season buyer starts a fresh pair; the seller keeps the season record they earned |

The platform already does most of this: cards follow the horse (migration 120 trigger), season points attribute to the owner-on-entry ([points.ts](../src/lib/shows/points.ts)), and Hoofprint is the permanent record. The pair ledger formalizes what points.ts half-does today.

---

## 1. Scoring (Season Points v2)

### The scale — "first place is worth the class"
Replace the flat 7/5/4/3/2/1 with the AQHA-shaped, entries-scaled table — the most explainable depth-weighted system in the study:

- **1st place = number of live entries in the class, capped at 10.** Each place below is one less, through 6th, floor 1.
  - Class of 3: 1st=3, 2nd=2, 3rd=1.
  - Class of 8: 1st=8, 2nd=7 … 6th=3.
  - Class of 25: 1st=10 (cap), 2nd=9 … 6th=5.
- **Classes with fewer than 2 distinct exhibitors score 0** (you can't earn points beating only yourself).
- **Championship bonuses** stay: section champion +3, division champion +5, grand champion +10 — but the grand bonus only pays at shows with ≥15 total live entries from ≥5 exhibitors (a grand at an empty show shouldn't outscore a hard-fought class win).

Why this and not the alternatives: CFA's decay ladder (95/90/85%) is finer-grained but unexplainable at a glance; TICA's deflator punishes without a visible rule; ARBA's hard void is too harsh at our class sizes *for points* (we use it for cards instead, below). "First is worth the class size" can be taught in one sentence and felt as fair in one glance.

**Implementation:** points.ts was deliberately built as a retunable lookup with computed-on-read standings — the scale change re-scores all history for free. Only delta: `StandingsInput` needs per-class live-entry and distinct-exhibitor counts.

### The cap — best 30 results
**Only a pair's best 30 class results per season count** toward standings (championship bonuses always count). This is the Pokémon Best-Finish-Limit / CFA best-100-rings mechanism, and at online-entry prices it's the single most important rule in the program: without it, season awards measure free time, not quality. Thirty ≈ full success at two shows a month with room to spare — active exhibitors never feel it; grinders can't outrun it. Recalibrate annually (see §6).

---

## 2. Qualification (Cards v2 — the "leg" system)

Cards already exist with exactly NAN's semantics (1st/2nd in a qualifying class, one card per horse per class, travels with the horse, one-use, publicly verifiable, May 1–Apr 30 show year). The upgrade is **validity gates**, ARBA's canonical anti-inflation mechanism:

- **A card is only minted if the class had ≥3 live entries from ≥2 distinct exhibitors.** (ARBA uses 5-and-3; our current median class is far smaller — start at 3-and-2 for Season 1 and recalibrate annually toward 5-and-3 as volume grows. AKC's announced-annual-recalibration precedent makes this legitimate rather than rug-pulling.)
- **Major cards:** a card from a class of **≥6 entries from ≥4 exhibitors** is flagged a *major* — displayed distinctly on the card and passport. Season 1 requires no majors anywhere; Season 2 introduces "at least one major" into title requirements (the AKC majors principle, phased in only when the data supports it).
- Cards remain earned only in **MHH Sanctioned** shows (the `is_mhh_qualifying` flag, formalized in §5).

**What this fixes about the status quo:** the hobby's open secret is NAN cards minted in 2-horse classes. MHH cards will carry their class size and exhibitor count *on the card* — a card that says "1st of 14, 9 exhibitors — MAJOR" is simply worth more than paper, and everyone can see why.

---

## 3. Titles (the ladders)

### Model titles (travel with the horse, minted onto Hoofprint)
- **MHH Champion (CH):** 3 cards on the same horse, earned at **3 different shows** under **≥2 different judges**, at least 1 in the horse's declared primary axis (halter/performance/etc.). Pure ARBA-shape. Permanent; renders on the passport masthead and travels on sale.
- **MHH Grand Champion (GC):** CH + either a placing at the annual Championship **or** 3 additional *major* cards. (Season 1: Championship-placing route only, since majors phase in later.)
- **Register of Merit (ROM):** 30 lifetime season points in a single division axis. **Superior:** 75. Fixed-threshold mid-ladder goals (AQHA-shape) reachable by steady quality without ever being #1 — the retention layer for the middle of the pack.
- **Standards certificates (Championship only, AOS-shape):** panel-scored 100-point judging at the annual Championship awards permanent, any-number-can-earn certificates: **Honors 75+ · Merit 80+ · Excellence 90+**. A model can carry "MHH Excellence 2027" forever regardless of who else entered that year — the anti-discouragement crown jewel: your model competes against the standard, not the field.

### Exhibitor distinctions (permanent, person-attached, PSA/FIAP-shape)
Breadth-gated so no single model, show, or judge can carry you:
- **MHH Star:** 15 placings (top-6) in sanctioned shows, from **≥6 different models** across **≥5 different shows**.
- **Star 2:** 36 placings, ≥12 models, ≥10 shows, ≥3 judges. **Star 3:** 75, ≥20, ≥20, ≥5. (One level per season maximum — FIAP's rate limit.)
- **Rookie of the Year:** highest season points among exhibitors whose first-ever entry was that season.
- **Judge's ladder:** Apprentice (co-judge 1 sanctioned show) → Judge (3 shows judged + 50 critiques written) → Senior Judge (10 shows, 250 critiques, eligible for Championship panels). Critique counts are already recorded per-entry — the accreditation is computable, NACQJ-shaped without the seven years.

---

## 4. The Championship (and the season calendar)

### Cadence
- **Monthly:** 1–2 community-hosted **MHH Sanctioned qualifiers** (the MEPSA/CWS rhythm the hobby already loves). MHH's role: sanctioning, the calendar, and white-glove host support — not hosting everything itself.
- **Quarterly:** one **MHH Open** — themed, unsanctioned-pressure fun formats (luck shows, Zippo-style same-mold challenges, novice-only divisions with guaranteed critiques). The on-ramp events; Summerween retroactively counts as the first.
- **Annually, June:** **The MHH International Championship.** Season closes Apr 30 (the existing show year); entries open in May; judging through June; results as rolling class-by-class reveals (v4 machinery) across a finale week.

### Championship format
- **Entry = card redemption.** One card redeemed per championship class entered (the `redeemed` status already modeled in cards.ts finally gets its purpose); the horse must hold a card in the matching axis. Qualification is *automatic* — the site knows who's eligible, the killer feature no paper org can offer. A limited **Buy-In division** (MEPSA precedent) lets unqualified horses enter a separate non-title division so nobody's shut out of the party.
- **Judging: both layers.** A panel of 3 (Senior Judges preferred) **scores every entry 0–100 against the published rubric** (z-score normalized across panelists — the Pacific Bonsai fix for hard/easy graders), which yields the standards certificates; comparative placings (Top Ten per class, NAN tradition) and the champion ladder come from the same scores. **Every entry receives a written critique** — the NACQJ ceiling, and the single clearest "this is a serious show" signal money can't fake. Judges for the Championship are compensated (NAN pays $100/day; fund from Pro revenue or a modest championship entry fee — the one place a fee fits the volunteer economy, because it pays judges, not the platform).
- **Sweeps rule (Championship only):** champion and reserve of a class must be different exhibitors; max 3 counted Top-Ten slots per exhibitor per class (IPMS-shape). Regular sanctioned shows keep normal hobby rules.
- **Blind throughout**, reveals at results — already the platform default.

### The rubric (published, v1 — community review before adoption)
Halter classes, 100 points: **Breed type & conformation 40 · Condition & finish 30 · Photography & presentation 20 · Realism of turnout/footing 10** — with the model/photo split maintained in critiques (photography skill must never silently decide a model contest; capping presentation at 20 makes the ceiling explicit). Performance classes swap the first axis for **Setup accuracy & tack 40** per the IMEHA guidebook, which MHH should host as the shared judging standard (as MEPSA preserved it).

---

## 5. MHH Sanctioning (what "approved" means)

A show may fly the **MHH Sanctioned** banner (and mint cards/points) if:
1. Host is approved (Season 1: manual approval by MHH; later: completed the judge/host ladder's first rung).
2. Classlist published before entries open; entries open ≥2 weeks.
3. Judged on-platform (this IS the results-filing requirement — automatic, instant, permanent; NAMHSA's 30-day rule becomes 0 seconds).
4. Blind browsing on; critiques encouraged (required for the host's shows to count toward their judge ladder).
5. **COI enforced automatically:** a judge's own horses cannot enter classes they judge (the platform knows maker, owner, and judge — enforceable in `validateEntry`, the differentiator no paper org has).
6. Minimum viability: results only count (points/cards) per the class gates in §§1–2 — a sanctioned show with tiny classes still runs, its tiny classes just don't mint.

---

## 6. Annual recalibration (the self-tuning clause)

Published as part of the rules, AKC-precedent: **each May, MHH re-derives the numeric thresholds from the previous season's actual data** — card gates target roughly the 40th percentile of class sizes, major gates the top ~20%, the best-N cap at ~2 active shows/month, title thresholds at ~12–18 months of active good showing. Numbers move; the percentile targets don't. This is how the program survives growing from 100 users to 1,000 without either dead titles nobody can earn or confetti titles everyone earns.

---

## 7. Season 1 (2026–27) bootstrap

Already underway — the show year started May 1, 2026, and Summerween is in it.
- **Now–Sep:** adopt scoring v2 + card gates (they only affect future minting); light the standings page (`NEXT_PUBLIC_SHOW_STANDINGS`) with the new scale; publish the program rules as a site page (the rules ARE marketing).
- **Oct–Apr:** recruit 4–6 community hosts for monthly sanctioned qualifiers (the strategy doc's white-glove onboarding — each host delivers their entrants); Winter Classic open in January.
- **May 2027:** season closes Apr 30; first **MHH International Championship** entries in May, judged in June. Soft thresholds (2 cards to enter, no majors), stated plainly as Season 1 calibration.
- **First-season titles:** CH is earnable in-season (3 cards/3 shows/2 judges is reachable by Nov–Dec with monthly shows) — the first MHH Champions should exist *before* the Championship, so the finale has named contenders.

## 8. Build map (in order)

1. **Scoring v2** — points.ts retune + class-size/exhibitor-count inputs + best-30 cap. *(Small; pure functions + one action change.)*
2. **Card gates + major flag** — cardIssuance validity checks + class-size/exhibitors stamped onto the card + verify-page display. *(Small-medium; one migration for the two card columns.)*
3. **Standings launch** — flip the flag, new scale copy, `/standings` into the Show Grounds nav. *(Tiny.)*
4. **Titles engine** — `horse_titles` + `exhibitor_distinctions` tables, computed grants (nightly cron reusing the standings reads), Hoofprint events, passport/profile display. *(Medium.)*
5. **COI rule** — judge-can't-enter-own-judged-class in validateEntry + policy. *(Small.)*
6. **Championship mode** — card redemption at entry, panel scoring (3 judges × 100-pt + z-normalization), standards certificates, Top Ten. *(The big one; needed by May 2027, not now.)*
7. **Rules page + calendar integration + host application form.** *(Copy + small forms.)*

---

*Sources: hobby-practice brief (MEPSA, NAMHSA/NAN, CWS, IMEHA, live-show culture) and the competitive-systems mechanisms brief (AKC, ARBA, CFA, TICA, AQHA/APHA, 4-H Danish, Golden Demon, MMSI, IPMS, Pokémon OP, MTG PPC, NACQJ, AOS, Pacific Bonsai Expo, PSA, FIAP) — full citations in the research transcripts, 2026-08.*
