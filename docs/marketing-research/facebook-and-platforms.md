# Model Horse Hobby — Facebook & Platform Landscape

Research date: **2026-08-21**. All member counts and activity figures were observed on this date unless otherwise stated.

**Confidence labels:** `[HIGH]` = read directly from an authoritative/primary page. `[MED]` = secondary source, blog/forum anecdote, or older data. `[LOW]` = inference. `[UNVERIFIED]` = could not confirm; stated as an open question.

---

## 0. Method and its limits

- Facebook blocks scripted fetches (curl/mbasic returned HTTP 400). Group data below was read from the **logged-out public "About" panel** of each group via a rendering browser. That panel exposes: exact member count, posts-today, posts-in-last-30-days, creation date, and the **full admin rules text** — even for groups marked "Private". `[HIGH]`
- Because the panel is logged-out, I could **not** read post contents of private groups. Claims about what happens *inside* groups are therefore sourced from the published rules, from public groups, or from secondary sources, and are labelled accordingly.
- Member counts are self-reported by Facebook and include inactive/duplicate accounts. Treat as ceiling, not reach. `[LOW]`
- Reddit blocked both WebFetch and the API from this environment; r/modelhorses could not be sized. **`[UNVERIFIED]`** — see §6.

---

## 1. Facebook — the venue map

All rows observed 2026-08-21.

### 1.1 Sales and trading groups

| Group | Members | Posts today | Posts / 30d | Created | URL |
|---|---|---|---|---|---|
| Breyer Model Horses Buy, Sell, or Trade – NO Pre-Sales Allowed | **28,610** | 49 | 1,819 | 2013-03-02 | https://www.facebook.com/groups/470615649659273/ |
| Model Horse Transaction Board *(reputation, not sales)* | **13,071** | 34 | 1,364 | 2013-09-23 | https://www.facebook.com/groups/modelhorsetransactionboard/ |
| Artist Resin Model Horses For Sale *(public group)* | **10,700** | — | — | — | https://www.facebook.com/groups/ARHorsesForSale/ |
| Model Horse Sale and Trade (NO PRESALES!) | **9,954** | 21 | 789 | 2011-09-23 | https://www.facebook.com/groups/213974611999017/ |
| Rare Model Horse Sales *($250+ floor)* | **9,735** | 7 | 411 | 2019-07-30 | https://www.facebook.com/groups/raremodelhorses/ |
| Model Horses for Sale or Trade *(public group)* | **7,100** | — | — | — | https://www.facebook.com/groups/modelhorsesforsaleortrade/ |
| Stablemates Buy and Sell | **3,748** | 10 | 278 | 2017-08-14 | https://www.facebook.com/groups/706189089576912/ |
| UK/International model horse sales | **1,306** | 3 | 81 | 2016-03-20 | https://www.facebook.com/groups/1125070687533449/ |
| Model Horses For Sale and Trade **-Presales Allowed-** | **394** | 0 | 16 | 2022-11-10 | https://www.facebook.com/groups/678216863696013/ |

`[HIGH]` for every figure — read from each group's About panel.

**Read-through:** the sales layer is concentrated. One group (28.6K members, ~1,800 posts/month) is roughly 3x the next sales group. `[HIGH]`

**The presales signal is the sharpest number in this table.** The group that *permits* presales has **394 members and 16 posts/month**; the two groups that ban presales in their own names have **28,610** and **9,954**. The hobby has voted decisively against speculative/not-in-hand selling. `[HIGH]` for the counts; `[MED]` for the causal read.

### 1.2 Collection / discussion / valuation groups

| Group | Members | Posts today | Posts / 30d | Created | URL |
|---|---|---|---|---|---|
| Breyer Horse Collectors | **22,750** | 64 | 2,361 | 2019-11-05 | https://www.facebook.com/groups/3127414397329405/ |
| What is my Original Finish Breyer Worth? | **11,962** | 5 | 141 | 2015-07-07 | https://www.facebook.com/groups/1606242296318847/ |
| Model Horse Customizers | **10,710** | 10 | 160 | 2015-05-30 | https://www.facebook.com/groups/modelhorsecustomizers/ |
| Artist Resin Model Horse ID & New Releases *(public)* | **2,800** | — | — | — | https://www.facebook.com/groups/114487019259425/ |
| Reference Board For Model Horse Transactions *(reputation)* | **2,648** | 0 | **3** | 2017-05-06 | https://www.facebook.com/groups/298674680560967/ |
| British Model Horse Collectors | **2,020** | 1 | 58 | 2010-07-04 | https://www.facebook.com/groups/120976664613170/ |
| USOMHS (Online Model Horse Show) | **1,723** | 0 | 96 | 2016-11-29 | https://www.facebook.com/groups/USOMHS/ |

`[HIGH]` — all read from About panels.

**Read-through:** *Breyer Horse Collectors* (22.8K, 2,361 posts/month) is the single most active room in the hobby by post volume — and it is a **pure show-and-tell group with no commerce**. Attention and transaction are in different rooms. `[HIGH]`

### 1.3 Groups named but not individually sized

From a 2024 hobbyist survey of selling venues (https://martha.net/2024/09/where-to-sell-model-horses-and-props/) `[MED]`:
Breyers For Sale · Micro Minis Galore….Share, Buy, Sell · Custom Micro Minis · Model Horse Trade Center (https://www.facebook.com/groups/303924689644127/).

Additional group URLs surfaced but not sized `[MED]`: Breyer Model and tack sale and trade (281359718625652) · Breyer & PS Model Sales (1651457648435863) · Breyer Model Horses for Sale/Trade (437927983065737) · Breyer Horses for Sale/Trade (273660009373760) · Model Horses for Sale/Trade (399232456807388) · Model Horse Customizers and Artists (488793457873063) · UK Model Horse Sale Page (109888419163080).

**`[UNVERIFIED]`:** I did not find dedicated large groups for individual *breeds* or *disciplines* as distinct from scale (Stablemate/Micro Mini) and brand (Breyer/Stone/resin). Segmentation in this hobby appears to run on **scale, brand, and finish type** rather than breed. Worth a dedicated pass before relying on it. `[LOW]`

**Regional coverage is thin.** UK groups are ~1.3–2.0K; I found **no** sizeable EU-mainland or Australian *group* (only brand pages: facebook.com/BreyerHorsesUK, facebook.com/breyerhorsesaus). `[MED]`

---

## 2. Group culture and self-promo norms — the marketing constraint

This is the part that most directly governs a launch plan.

### 2.1 The default rule bans exactly what a launch wants to do

Facebook's boilerplate rule — **"No promotions or spam. Give more than you take in this group. Self-promotion, spam and irrelevant links aren't allowed."** — is adopted verbatim by the largest rooms:

- Breyer Model Horses Buy/Sell/Trade (28.6K), rule 3: *"No promotions or spam or items not model related — Self-promotion, spam and irrelevant links aren't allowed."* `[HIGH]`
- Breyer Horse Collectors (22.8K), rule 3: same wording. `[HIGH]`
- Stablemates Buy and Sell (3.7K), rule 3: same wording. `[HIGH]`
- UK/International model horse sales (1.3K), rule 2: same wording. `[HIGH]`

**Implication:** a cold link-drop into the four biggest rooms is against the posted rules in all four. `[HIGH]`

### 2.2 The hardest rule found

**Model Horse Customizers (10.7K), rule 2.3: "No directing members to any outside page, group, or platform."** `[HIGH]`
https://www.facebook.com/groups/modelhorsecustomizers/

This is stricter than the boilerplate — it bans off-platform referral of any kind, not just commercial promotion. Treat this group as **no-link territory**, entered only through members posting their own work.

### 2.3 The explicit permission — a template to look for

**British Model Horse Collectors (2.0K), rule 2: "Commercial Sellers and Artists are welcome to advertise goods, services and websites/FB pages on the group once a month. Please do not spam the group."** `[HIGH]`
https://www.facebook.com/groups/120976664613170/

This is the only group in the sample with a **stated, permitted promo cadence (monthly)**. The lesson generalises: some groups *do* have an advertising lane, and it is discoverable by reading rule text rather than guessing. Building a per-group rules matrix before any outreach is cheap and prevents bans.

### 2.4 What gets you removed vs. welcomed

Consistent across the sample `[HIGH]`:

**Removed / banned:**
- Self-promotion and outside links (§2.1, §2.2).
- **Price shaming** — named as a bannable offence in at least four groups. Breyer Buy/Sell/Trade rule 1 is unusually specific: *"Laugh reactions on sales posts will be considered price shaming, and subject to suspension… No scalping accusations, criticizing big purchases or blind bag feeling, or angry reacts to sales posts."* `[HIGH]`
- **Using someone else's photos.** Model Horse Sale and Trade rule 3: *"You must use YOUR picture of YOUR model! NO 'borrowing' from IDYB, Instagram, or any other website."* `[HIGH]`
- **Presales / not-in-hand listings** in the two largest sales groups. `[HIGH]`
- **Locked or secondary profiles.** Breyer Buy/Sell/Trade rule 6: *"NO LOCKED OR SUB-PROFILES ALLOWED… This is to help weed out scammers."* `[HIGH]`
- **AI-generated content** — now an explicit rule in Breyer Buy/Sell/Trade (rule 7) and the Transaction Board (rule 2). `[HIGH]` This is new-ish norm formation and worth respecting loudly in any launch imagery.
- Off-topic posts, discussion in sales-only groups, unpriced ads.

**Welcomed:**
- Posting your own models, your own work, your own collection.
- Priced, in-hand, own-photo sale posts.
- Value questions — in the one group designated for them (§4.2).
- Reference/lights checks before transacting (§3) — actively *encouraged* by other groups' rules.

**Strategic read `[LOW]`:** the enforcement energy in these groups is aimed at *strangers extracting value* (spam, stolen photos, scammers, link-farmers). It is not aimed at *members contributing*. Any go-to-market that depends on posting links into groups is fighting the ruleset; one that depends on hobbyists sharing their own records/pages is aligned with it.

---

## 3. The "lights" system — the hobby's actual trust infrastructure

The hobby has a real, functioning reputation mechanism. It is a **Facebook group**.

**Model Horse Transaction Board (MHTB)** — 13,071 members, 1,364 posts/month, created 2013-09-23.
https://www.facebook.com/groups/modelhorsetransactionboard/ `[HIGH]`

Members post **red / yellow / green "lights"** about counterparties. The published rules are a surprisingly mature governance document `[HIGH]`:

- **Rule 5:** *"Use red, yellow, or green lights for transactions where money/models change hands… Names are required in all lights or warnings. Details must be provided for negative posts. Screenshots are encouraged."*
- **Rule 4:** first-person only — *"You may only post about your own experiences & you must be a participant… You may not light yourself."* No anonymous or third-party posts.
- **Rule 1:** *"ONE post per transaction per party."*
- **Rule 7:** *"You may not post lights simply in response to someone else leaving lights about you."* (anti-retaliation)
- **Rule 2:** names and light colours **must be typed as words** for screen-reader accessibility.
- **Rule 6:** no contacting people you aren't in a transaction with; no brigading.

The sister/rival board defines the colour semantics precisely — **Reference Board For Model Horse Transactions**, rule 2 `[HIGH]`:
> *"YELLOWS are for transactions that had bumps or issues, but have been resolved overall (refunded, partial refund, repaired…). REDS are for transactions that are NOT resolved, and you've lost a model or money. SCREENSHOTS are required for ALL negative posts."*

**The lights system is load-bearing across the hobby**, cited in *other* groups' rules:
- Stablemates Buy and Sell rule 5: *"look up references and lights on any of the transaction boards."* `[HIGH]`
- Model Horses For Sale and Trade -Presales Allowed- rule 7: *"Look up seller lights."* `[HIGH]`

### 3.1 Why this is the central gap

The hobby's reputation layer has all these defects at once `[HIGH]` unless noted:

1. **Not searchable.** Reputation lives in Facebook post text. Finding a counterparty's history means scrolling/searching a 13K-member group by name — and Facebook group search is poor. `[MED]`
2. **Not structured.** A "light" is a colour word typed into prose. No schema, no aggregate, no score.
3. **Not attached to anything.** Lights live in one group; listings live in *other* groups and on MHC. A buyer looking at a listing sees no reputation at that point of decision.
4. **Membership-gated and private.** MHTB is a Private group — non-members cannot read it at all. Reputation is invisible to exactly the newcomer who most needs it.
5. **Legally fragile and defensive.** MHTB **rule 9**: *"Threatening legal action against moderators or the group itself will results in an immediate, non-negotiable ban. Reporting posts or the group to Facebook (vice the moderators) will also result in a ban."* `[HIGH]` A defamation-exposed volunteer moderation team is a single complaint away from disruption.
6. **Platform-dependent.** It exists at Facebook's pleasure.
7. **Consolidation is fragile too.** The rival Reference Board (2,648 members) is effectively dormant — **3 posts in the last 30 days** vs MHTB's 1,364. `[HIGH]` The hobby has already funnelled into a single point of failure.

**The older, parallel system: MHHR (Model Horse Hobby References)** — https://groups.io/g/ModelHorseHobbyReferences `[HIGH]`
- **2,402 members, 61,540 topics.** Founded in Yahoo Groups in **2002**; migrated to Groups.io in **2019**.
- Settings: *"Posts to this group require approval from the moderators. Subscriptions to this group require approval. **Archive is visible to members only.**"*
- Its own disclaimer invokes CDA §230 and *Batzel v. Smith* — i.e. the operators are explicitly worried about liability for member accusations. `[HIGH]`
- 61,540 topics of transaction history exist and are **invisible to non-members and to search engines**.

---

## 4. Existing platforms and their gaps

### 4.1 MH$P → Model Horse Connection (MHC) — the venue of record

**The rebrand is the single most important platform fact in this research.** MH$P no longer exists under that name.

https://modelhorseconnection.com/ `[HIGH]` — from the site's own welcome message:
> *"Welcome to the new Model Horse Connection, formerly known as the Model Horse Sales Pages, a.k.a. MH$P. It's been 15+ years since the last major site re-design… Unfortunately the **ransomware attack on the old server** prematurely hastened the launch of this site, so many of the new features that I'd hoped to introduce at launch are missing."*
> *"…the rushed rollout of this site means that **THAR WILL BE BUGS!**"*
> — signed *Carrie Sapp, MHC Admin / Owner / Designer / Developer / Server & Cloud Engineer*, who notes she *"work[s] overtime at my day job during the week"* and fixes bugs on weekends.

- Ransomware took MH$P offline around **March 2024**; rebrand followed. `[MED]` (secondary reporting; the attack itself is confirmed primary from the quote above `[HIGH]`)
- Established **1996**; copyright line reads 1996–2026. `[HIGH]`
- `modelhorsesalespages.com` and `modelhorseconnection.com` both currently serve an **expired TLS certificate** — standard fetchers refuse the connection. Observed 2026-08-21. `[HIGH]` A hobbyist on a modern browser sees a full-page security interstitial before the marketplace.
- The homepage still carries a stale maintenance notice dated **"Updated 1/12/2011"** in its markup. `[HIGH]`

**Live marketplace stats, observed 2026-08-21** (self-reported on homepage) `[HIGH]`:
| Metric | Value |
|---|---|
| Shoppers online | 175 |
| Total ads | 9,274 (8,713 gallery + 275 auctions) |
| Aggregate listed value | **$1,959,093** |
| Active vendors | **1,114** |
| Total vendors ever | 31,274 |
| Cumulative views | 84,720,373 |

**Pricing.** Free tier = 10 text ads. The commonly-cited **$10/yr** figure is the *Quarter Horse* tier: *"I pay $10 a year for a Quarter Horse level account, which lets me list up to 50 items at once with two photos each"* — https://martha.net/2024/09/where-to-sell-model-horses-and-props/ `[MED]` (2024; tiers not re-verified post-rebrand — the pricing page 404s at the obvious paths). **`[UNVERIFIED]`** for current 2026 tiers.

**What MHC explicitly does NOT do** — from its own disclaimer `[HIGH]`:
> *"The MHC acts as a conduit of information… The MHC is **not involved in the actual transaction**… has **no control over the quality, safety or legality of the items advertised, the truth or accuracy of the listings**… This site cannot ensure that a Shopper or Vendor you are dealing with will actually complete a transaction."*
> *"You are encouraged to report all user-to-user disputes to your **local law enforcement, postmaster general, or a certified mediation or arbitration entity**."*
> *"Shoppers, you are responsible for 'knowing' your Vendor — take advantage of the eBay feedback link (if provided), **join MHHR or Blab**, and/or ask for references."*

**This is the thesis in the incumbent's own words:** the venue of record has no reputation system, no dispute process, no escrow, and **outsources trust to a Yahoo-era mailing list and a broken forum**. `[HIGH]`

Also absent, confirmed by browsing the site's category structure `[HIGH]`: no show records, no provenance/chain-of-ownership, no sold-price history (the "$1,959,093 value" is *asking* value of live ads; completed sales are not published).

### 4.2 There is no public price history — and the hobby pays to work around it

- **What is my Original Finish Breyer Worth?** — 11,962 members whose entire purpose is humans manually answering "what's this worth". Rule 2, in caps: *"**ABSOLUTELY, POSITIVELY DO NOT TELL THEM TO LOOK IT UP. NO NO NO.** DO NOT SEND THEM TO ID YOUR BREYER and tell them to LOOK IT UP. NEVER. This is what our group is FOR — IDing and VALUES."* `[HIGH]` — i.e. the community has explicitly concluded that **no lookup resource is adequate**.
- That group's rule 5 documents the manipulation risk: *"**BE HONEST** — If I catch people low-balling values, then offer to buy it, you'll be kicked out and banned immediately."* `[HIGH]` Valuation-by-crowd is gameable by the people bidding.
- Rule 3: *"DON'T ASK IF IT WILL BE FOR SALE. DO NOT PM POSTER… NO TOLERANCE."* `[HIGH]` — valuation and transaction are forcibly separated.
- Rule 9 notes IDYB photos are *"pristine examples of the run"* and produce *"a false value"* for a worn model. `[HIGH]` Condition-adjusted value is unsolved.
- **Rare Model Horse Sales** rule 3 routes value questions away: *"This is also not a values group. We recommend the group 'What is My Original Finish Breyer Worth?' for values."* `[HIGH]`
- In the public Artist Resin ID group I observed a member asking the community to *remember* an artist resin's original release price, answered only with "Worth much more now". `[HIGH]` (observed 2026-08-21; described as a pattern, individuals not identified) — release prices for artist resins are not recorded anywhere retrievable.

**The paid workaround: Breyer Value Guide** — https://www.breyervalueguide.com/ `[HIGH]`
- *"instant access to over 6600 Breyer Model Horse Values"*; values are **paywalled** (the public page shows `Value: Subscribe Now`).
- **Pricing, observed 2026-08-21 on the signup form:** **$65.00/year**, $30.00/3 months, or $14.00/month, auto-renewing. `[HIGH]`
- Gaps: **Original-Finish Breyer only** — no Stone, no artist resins, no customs, no tack/props. Values are *asserted* by the operator, not derived from published transaction data. Marketed for *"insurance or estate planning"*.

**Willingness-to-pay read `[MED]`:** hobbyists pay **$65/yr for opinions about OF Breyer values** while the entire sales venue of record costs ~$10/yr. Valuation/records data is priced ~6.5x the marketplace itself. That is the clearest monetization signal in this research.

### 4.3 Model Horse Blab — effectively dead as a venue

https://modelhorseblab.com/ `[HIGH]`, all observed 2026-08-21:
- Site-wide banner: *"Most of Blab is restored, the rest is coming soon… For the time being all paid forums are free. An update on paid memberships is coming as soon as we get the details together."*
- Archive scale is genuinely large: **182,769 threads / 3,429,661 messages / 6,960 members**.
- **But:** `/whats-new/posts/` returns **"No results found."**
- The **Show Announcements** forum reads **"There are no threads in this forum."**
- **Every** forum section is marked *Private* to logged-out visitors — the 3.4M-message archive is invisible to search engines and to newcomers.
- The homepage's most recent surfaced content is **"Blab's Secret Santa 2025"** (Dec 2025 ship dates) and a **"BreyerFest — 2025 July 11-13"** section still presented as current — **stale by over a year**.
- Corroborating `[MED]`: a 2024 hobbyist wrote *"It does look like maybe the site work was abandoned at some point? I'm unable to change my profile photos and their Facebook page hasn't been posted to since 2022."* — https://martha.net/2024/09/where-to-sell-model-horses-and-props/

**Read:** Blab is a **rescuable archive, not a live competitor**. Note it historically monetised via paid "Premium Paddocks" forums — precedent that this hobby will pay subscriptions for content. `[HIGH]`

### 4.4 The platform graveyard — competitors that died

- **Star Dapple** (stardapple.com) — a 2024-era paid model horse marketplace ($29.99/yr basic, $39.99 unlimited `[MED]`). **The domain has now expired**; it serves a registrar parking page reading *"This domain stardapple.com has expired."* Observed 2026-08-21. `[HIGH]` Contemporary review: *"So far I've had zero luck, so I will most likely go down to a free account"* — https://martha.net/2024/09/where-to-sell-model-horses-and-props/ `[MED]`
- **Yahoo Groups** — took the hobby's reference archives with it; MHHR had to migrate in 2019. `[HIGH]`
- **modelhorse.gallery photo-show listings** — https://modelhorse.gallery/PR/PScalendar.html still ranks in search while advertising the *"MEPSA 2009/2010 show season"* and a *"Championship Show in June 2010."* `[HIGH]` Sixteen-year-old content is still the discoverable answer for "model horse photo shows".

**Read `[LOW]`:** paid-marketplace-vs-MHC is a losing wedge — it was tried recently and the domain lapsed. The unmet need is records/trust/valuation, not another listings board.

### 4.5 Model Horse Place — the one with real commerce mechanics

https://www.modelhorseplace.com/ `[HIGH]` — free, eBay-style storefronts with **live auctions, Buy-It-Now, carts, and per-seller numeric feedback scores** (e.g. a store showing `38`). Multi-currency (USD/GBP/EUR) and international sellers (Finland, Canada, UK). Active listings observed including a "Breyer 2026 Scandi Surprise" at $400 with a $500 buyout.
- **It already has the seller-feedback primitive MHC lacks.** `[HIGH]`
- But volume is thin — a 2024 seller reported *"1 sale in 2024"*. `[MED]` https://martha.net/2024/09/where-to-sell-model-horses-and-props/
- **`[UNVERIFIED]`:** total listing count and whether sold prices are retained publicly after a sale ends.

### 4.6 OMHPS — the closest thing to a records competitor

https://www.omhps.com/About `[HIGH]` — Online Model Horse Photo Shows. Domain bought 2018, built nights/weekends, launched ~2020. **This is prior art for a horse-as-entity records model** and should be studied closely:
> *"Each horse you upload is its own entity. **It keeps a record of its placings** and it's easy to enter in new shows with just the click of a button. Every model will have its own page with all of the information you entered for it… you only ever have to enter once."*

On judging, it names the incumbent pain directly:
> *"We want judges to look forward to judging rather than dread having to **manually enter placings into a spreadsheet** or in comments after combing through hundreds of photos."*
Judging is drag-and-drop ordering; top placings auto-advance to sectional judging and section champions auto-advance onward. `[HIGH]`

**`[UNVERIFIED]`:** OMHPS user count, show volume, current activity level, and pricing. Not determinable from the About page. **This is the highest-value follow-up in this document.**

---

## 5. Photo shows and showing infrastructure

- **USOMHS** — Facebook group of **1,723** members, 96 posts/30d, with an off-Facebook site at USOMHS.com. `[HIGH]`
- **IMEHA** (International Model Equine Hobbyists Association) — described as *"25 years old… Oldest and largest model horse online show. Show held monthly. Over 400 exhibitors, 20 Divisions, & 1600 plus classes."* `[MED]` — sourced from the stale modelhorse.gallery listing page; the "25 years old" figure is undated and should not be quoted as current. https://modelhorse.gallery/PR/PScalendar.html
- **IPABRA** — pedigree-assignment club; **membership $3.00/year**, paid *"via surface mail or via PayPal… Please mail Chris for her address."* `[MED]`, same stale source. Illustrative of how manual the club layer is.
- **MEPSA** (Model Equine Photo Showers Association) — mail-in photo show series feeding a championship show. `[MED]`, same stale source.
- **IMTBA** — International Model Thoroughbred Association, 4 shows/year (Feb/May/Aug/Nov 15th). `[MED]`
- MHC has dedicated ad categories for **"Live Shows"** and **"Photo Shows/Clubs"** — showing is commercially adjacent to sales in the incumbent's own taxonomy. `[HIGH]`
- Blab's dead **Show Announcements** forum (§4.3) was the traditional place to publicise shows. Its emptiness means show discovery has no neutral home. `[HIGH]`

*Deeper findings on NAMHSA/NAN, show-record verification, and showing disputes are in §8 (parallel research strand).*

---

## 6. Forums, Discord, Reddit

**Discord is negligible.** Observed 2026-08-21 via Disboard listings `[HIGH]`:

| Server | Members | Online |
|---|---|---|
| Crescent Cove Model Horses and Art | 703 | 107 |
| Road To BreyerFest | 155 | 13 |
| Model Horses | 185 | 41 |
| The Fine Equine Collectors (TFEC) | 101 | 26 |

Sources: https://disboard.org/servers/tag/breyer · https://disboard.org/server/887112699572539392 · https://disboard.org/server/693957377195769926 · https://disboard.org/server/1227617698197016686 · https://disboard.org/server/1001173515870949426

Total across the four largest listed servers is **~1,144 members** — roughly **4%** of one Facebook group. Discord is not a distribution channel for this hobby. Caveat: Disboard only lists servers that opt in; private/invite-only servers are invisible. `[MED]`

**Reddit — `[UNVERIFIED]`.** Reddit blocked WebFetch ("unable to fetch") and returned an app shell instead of JSON via the API from this environment. I could not confirm whether r/modelhorses exists, its subscriber count, or its activity. **Do not assume a size.** Needs a manual check.

**Forums:** Blab is the only forum of consequence and is stalled (§4.3). A small ProBoards community exists — https://modelhorselove.proboards.com/ — size and activity **`[UNVERIFIED]`**.

---

## 7. Where trust breaks down — evidence from the rules themselves

The most defensible evidence is that **group admins wrote rules against these specific failures**. Rules are reactive artifacts; each one implies a recurring incident.

| Failure mode | Rule-text evidence | Conf. |
|---|---|---|
| **Outright scams** | Model Horse Sale and Trade has a dedicated post tag: *"This person is a scammer!! Please use this tag for scammers!"* | `[HIGH]` |
| **Fake/throwaway accounts** | Breyer Buy/Sell/Trade rule 6: *"NO LOCKED OR SUB-PROFILES ALLOWED… This is to help weed out scammers."* | `[HIGH]` |
| **Stolen listing photos** | Model Horse Sale and Trade rule 3: *"You must use YOUR picture of YOUR model! NO 'borrowing' from IDYB, Instagram, or any other website."* | `[HIGH]` |
| **Fake sales generally** | Breyer Horse Collectors rule 5: *"FAKE SALES WILL NOT BE TOLERATED!! Think before you buy! if it sounds too good to be true..it probably is! People will sometimes steal photos…"* | `[HIGH]` |
| **Payment method risk (F&F vs G&S)** | Presales-Allowed group rule 4: *"We advise to use Paypal… **goods and services, its the safest way to avoid being scammed**, if you choose to use any other platform than PayPal, do so at your own risk."* | `[HIGH]` |
| **Presale non-delivery** | Same group, rule 5: *"Be aware to be careful of scammers when purchasing presales… if shipped directly to you from breyer from seller, **the seller is not responsible for any flaws**."* | `[HIGH]` |
| **Buyers backing out** | Stablemates rule 5: *"If you commit to buy a model, please follow through/up. Any conflict will cause a member to be subject to removal."* | `[HIGH]` |
| **Custom passed off as original finish** | Rare Model Horse Sales rule 4: *"Customs and FAUX OFs MUST BE IDENTIFIED as customs prominently in your post."* | `[HIGH]` |
| **3D prints sold as resins** | Model Horse Customizers rule 2.4: *"3D printed models must be labeled as a '3D printed model' **without use of the word resin. No misleading.**"* | `[HIGH]` |
| **Condition misdescription** | *"'good condition for its age' simply won't cut it if you want to get a decent price"* — https://identifyyourbreyer.com/buying.htm | `[MED]` |
| **Retaliatory reputation attacks** | MHTB rule 7 exists solely to prevent revenge-lights. | `[HIGH]` |
| **Valuation manipulation** | "What is my OF Breyer Worth?" rule 5 bans low-balling-then-offering. | `[HIGH]` |

**The generic buying advice that stands in for infrastructure** `[MED]` — https://identifyyourbreyer.com/buying.htm:
> *"Please check references on any hobbyist you don't know before buying or selling to them. Places to check references include the Yahoo group Model Horse Hobby References (MHHR), Model Horse Blab's Transaction Board and the Model Horse Transaction Board on Facebook."*

Two of those three are now broken or invisible (Yahoo→Groups.io members-only; Blab stalled). The hobby's canonical trust advice points at dead infrastructure. `[HIGH]`

### 7.1 Time / urgency: Facebook is deleting the hobby's sales history

Observed directly in the **Model Horses for Sale or Trade** group's Buy-and-Sell surface, 2026-08-21 `[HIGH]`:
> *"Older listings will be deleted starting **Aug 30, 2026**. We'll delete inactive listings 2 years or older. Access your data before deletion begins."*

Corroborating `[MED]`: https://www.threads.com/@theahmedghanem/post/Dbc2OK5Dl7S — *"Facebook Marketplace will begin deleting older listings starting August 30, 2026. Inactive listings that are two years old or older will be permanently removed."*

**This is the single most time-sensitive fact in this document.** Whatever informal price history existed inside Facebook sale posts begins being destroyed **nine days after this research date**. Sellers are being told by Facebook itself to export their data. That is a concrete, dated, externally-caused reason for a records platform to exist, and it is arriving now.

**Caveat `[LOW]`:** the notice is Facebook-wide, not model-horse-specific, and applies to structured "listings" — ordinary group *posts* may persist. Verify scope before building a campaign on it.

---

## 8. Trust failures and showing records — parallel research strand

*Findings from the second research strand (scams, payment/layaway disputes, recasts, condition and shipping disputes, NAMHSA/NAN and show-record verification) are pending and will be appended here.*

---

## 9. Explicitly unverified — do not guess these

1. **r/modelhorses / Reddit presence and size.** Blocked from this environment. `[UNVERIFIED]`
2. **MHC's current 2026 subscription tiers.** The $10/yr Quarter Horse figure is from a 2024 blog and predates the rebrand; pricing URLs 404. `[UNVERIFIED]`
3. **OMHPS scale** — users, shows/year, pricing, whether it is still actively run. Highest-value follow-up. `[UNVERIFIED]`
4. **Breed- and discipline-specific Facebook groups.** I found scale/brand/finish segmentation but no large breed groups; absence of evidence only. `[UNVERIFIED]`
5. **EU-mainland and Australian groups.** Only brand pages found, no sized groups. `[UNVERIFIED]`
6. **Model Horse Place** total listing volume; whether sold prices remain publicly visible. `[UNVERIFIED]`
7. **IMEHA's "400 exhibitors / 25 years old"** — from a page whose other content is from 2010. Undated and unreliable. `[UNVERIFIED]`
8. **Whether MHC's ransomware incident exposed user data.** The site mentions the attack and "security upgrades" but I found no breach-notification. `[UNVERIFIED]`
9. **Member-count accuracy.** Facebook self-reported; inactive accounts included. `[LOW]`
10. **modelhorselove.proboards.com** size/activity. `[UNVERIFIED]`
