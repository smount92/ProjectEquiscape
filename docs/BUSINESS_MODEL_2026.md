# What Model Horse Hub can earn

**Written August 2026, for Stephen and Amanda.** Research and analysis only — no application
code was changed to produce this.

This answers the question as it was asked: *what can we expect to make on this website, what
targets get us to a given level of income, and — first — how many users do we need before it
pays for itself?*

Every external number below is labelled with its source and a confidence level. Working notes
with the full arithmetic live in [`business-research/`](business-research/):
[the cost curve](business-research/infra-cost-curve.md),
[what the repo actually says](business-research/repo-ground-truth.md),
[how big the hobby is](business-research/hobby-size.md), and
[conversion and churn benchmarks](business-research/conversion-benchmarks.md).

---

## Executive summary — one page

**To pay for itself, Model Horse Hub needs roughly 140 to 750 monthly-active members — most
likely around 300.**

The bill is about **$47/month** today: Vercel Pro $20, Supabase Pro $25, and a `.com` at
roughly $1.50/month. Your "about $50 a month" was accurate. At $5/month, Stripe leaves $4.56
of every Pro subscription. So:

> **Eleven paying members covers the entire bill.** Fifteen covers it once you need paid
> email, which you will as soon as shows become routine.

Eleven subscribers is 8% of 138 active members, 4% of 275, or 2% of 550. Every one of those
is a number this hobby can produce. **You are not far away.** With 75 registered members
today, break-even is a doubling-and-a-bit of the community, not a transformation of it.

Four things shape everything below.

**1. Hosting is not the problem, and it never becomes the problem.** Going from 75 members to
10,000 takes the bill from ~$47 to roughly **$205/month** — 4× the cost for 130× the people.
$45 of today's $47 is two fixed platform fees, and the site happens to be built in ways that
stay cheap at scale. Every income level past break-even is an *audience and conversion*
problem. It is never a server problem.

**2. The hobby has a hard ceiling, and it sits between Level 2 and Level 3.** The serious,
engaged core of the model horse hobby is plausibly **around 20,000 people worldwide** — not
200,000. Break-even and a genuine side income are both comfortably inside that. A second
salary is not, and no amount of good execution changes it.

**3. Subscriptions alone will not carry you past a few hundred dollars a month.** The lever
with the most room in it is the one already pre-approved: **entry fees on MHH-run shows**. A
modest championship calendar can earn more per engaged member than subscriptions do, because
somebody who pays to enter a show has already proved the engagement that a $5/month feature
bundle struggles to prove is worth $5.

**4. Right now, none of this is measurable.** There is no `subscriptions` table, no
`profiles.tier` column, and no `last_seen` column. The site cannot currently answer "how many
active members do we have" or "what is our conversion rate" — the two numbers every row of
the table below depends on. That is a few days of work, and everything else is guesswork
until it exists.

### The levels at a glance

Every figure is **net**: infrastructure cost and Stripe fees already deducted. "Members"
means *monthly-active* members, not total registrations — see
[the counting problem](#a-note-on-counting-what-active-member-means).

| | Net to you | Subscribers needed | Members @ 2% | @ 4% | @ 8% | Can the hobby support it? |
|---|---|---|---|---|---|---|
| **Level 0** — pays for itself | $0 | **11–15** | 550–750 | **275–375** | 138–188 | **Yes — this year** |
| **Level 1** — costs + tooling headroom | $250/mo | **71** | 3,550 | **1,775** | 888 | **Yes — a good two or three years** |
| **Level 2** — real side income | $1,000/mo | **253** | 12,650 | **6,325** | 3,163 | **Only at the top of the hobby, and only with show fees** |
| **Level 3** — meaningful second income | $2,500/mo | **614** | 30,700 | **15,350** | 7,675 | **No — exceeds the engaged core** |
| **Level 4** — a salary | $7,000/mo | **1,724** | 86,200 | **43,100** | 21,550 | **No — exceeds the whole online hobby** |

Read the **4% column** as the honest planning case.

### The three moves that matter most

1. **Make the money measurable before trying to grow it.** A `last_seen_on` date on `users`
   and a real record of who is subscribed. Cheap, fast, and everything else is blind without it.
2. **Add an annual plan at two months free** — $50/year Pro, $100/year Studio. Roughly 40%
   more lifetime value per subscriber, no new features required, and it suits a hobby whose
   members already think in annual dues (NAMHSA charges $30 per two years; Model Horse
   Connection $10/year).
3. **Take entry fees on MHH-run events only — at $10 and up, never $2 — with a published
   split that visibly pays the judges.** The central case earns **$178/month**, which is more
   than triple the hosting bill, from about 300 show entries a year rather than thousands of
   subscribers.

### And the thing that should keep you honest

`modelhorses.com` — "Model Horse Social", a purpose-built standalone platform for exactly
this hobby — **has 158 members** (fetched live, August 2026). MHH is a vastly more capable
product and that is not a prophecy. But it is hard evidence that *building it* and *them
coming* are two different projects, and that the competitor to beat is **free Facebook
groups**, not other websites.

---

## A note on counting: what "active member" means

Every number here is denominated in **monthly-active members** — people who used the site at
all in a given month. That is not the same as registrations, and it is not what the site
currently measures.

`site_activity_daily` (migration 175) records **daily** actives. By design it cannot be
rolled up into a monthly figure: the only per-viewer structure, `object_view_scratch`, holds
a salted daily hash and is purged nightly, so there is deliberately no way to tell whether
Tuesday's 20 members were the same 20 as Monday's. That is a good privacy design and this
report is not asking to weaken it — but it does mean **the denominator of every conversion
rate below is currently unmeasurable**.

Two ways to bridge it:

- **Estimate.** Monthly actives typically run 5–10× daily actives for a browse-and-catalogue
  hobby site. General consumer benchmarks put a "good" DAU/MAU near 20%, with 20–50% reserved
  for social and gaming apps (https://vmobify.com/blog/dau-mau-stickiness-benchmarks,
  https://clevertap.com/blog/dau-vs-mau-app-stickiness-metrics/); a collection manager sits
  below that. **Confidence: low.** Sanity check only.
- **Measure it, without touching the privacy rule.** Add a single `last_seen_on DATE` column
  to `users`, written at most once per member per day. Counting distinct members whose
  `last_seen_on` falls inside the last 30 days gives an exact MAU. It records *when* someone
  was here, never *what they looked at* — so it does not engage the "metrics track objects,
  never people" guardrail at all.

**Rule of thumb meanwhile:** expect monthly actives to run around half of total registrations
for an engaged niche community in its first year. So 300 monthly actives implies roughly
500–700 registrations. Also low confidence, also worth replacing with your own number.

---

## Part 1 — What is actually for sale

Verified in the tree on 2026-08-21. Detail:
[`business-research/repo-ground-truth.md`](business-research/repo-ground-truth.md).

| Product | Price | Net after Stripe | What it buys |
|---|---|---|---|
| **MHH Pro** | $5/month | **$4.56** | Photo Suite+ (30 extra detail photos), Blue Book PRO sales charts, Market Replacement Values on insurance PDFs, printable show tags, the Monthly Stablemaster report, early access |
| **Studio Pro** | $10/month | **$9.41** | Everything in Pro, plus unlimited active commissions (free studios cap at 3) and the Hoofprint artist credit |
| **Supporter** | annual; amount lives in Stripe | ~$24 on $25 | A brass plaque and a ledger line. **Unlocks nothing, on purpose.** |

Stripe's standard US online card rate is **2.9% + $0.30** (https://stripe.com/pricing,
**very high confidence**), so a $5 charge nets $4.555 and a $10 charge nets $9.41.

**That $0.30 fixed component is the whole story of this business.** It is 6% of a $5 charge,
10% of a $3 charge, and 15% of a $2 charge. The $5 tier loses about **9%** to Stripe while
the $10 tier loses **6%** — the cheap tier is half again as expensive to service, in
percentage terms, as the expensive one. Keep this in mind every time a small price is
proposed.

One thing to check on your actual statement: **Stripe Billing adds 0.7% of billing volume**
on subscriptions. MHH uses Checkout Sessions in `subscription` mode, so this may already be
on your invoice — in which case Pro nets $4.52 rather than $4.555. It moves nothing material,
but it is worth knowing which number is real.

**The Supporter price is not in the code.** `src/app/upgrade/page.tsx` reads it live from
Stripe via `STRIPE_SUPPORTER_PRICE_ID`, and the card does not render at all if that env is
unset. **Please check the Stripe dashboard for the real amount** — this report models $25/year
and flags every Supporter figure as unverified.

**Two dormant one-off checkouts still exist in the tree:** `promote` ($2.99, 7-day promoted
listing) and `boost-iso` ($1.99, 48-hour pinned wanted ad). Both were ruled off-culture —
`COMMERCE_AND_COMMS_PLAN.md` calls pay-for-placement "off-culture for this hobby regardless
of whether it worked" — and both charge for effects nothing consumes. **Modelled at zero;
the recommendation is to delete them.** The third one-off, the $1.99 insurance report, has
already been retired and the PDF is free.

**The beta promo is live, and it moves the date without moving the target.** The upgrade FAQ
promises early supporters "a promo code for 6 months free," and all three checkouts pass
`allow_promotion_codes: true`. Anyone who subscribes during the launch window contributes
**$0 until roughly February 2027**. That was the right call. It also means neither of you
should read a $0 Stripe balance in November as a failure of the model.

### Is the Pro bundle good enough to convert? Honestly: not yet.

This has to be said plainly, because it caps every conversion figure in this report.

**The pitch is strong.** "Pro is how the lights stay on" is exactly the right pitch for a
hobby that watched Model Horse Blab go dark for two years and watched MH$P get ransomwared in
March 2024. In this community *continuity is the product*, and people will pay for it. The
page is also unusually honest — a code comment records that a "5-year trends" claim was cut
because the data doesn't exist yet. Honesty like that converts, slowly, over years.

**The bundle is weaker than the pitch.** Of the six Pro features, exactly one — Photo Suite+ —
is something a member uses every week. Show tags matter a few times a year. Insurance reports
matter once. The Stablemaster report is monthly and unproven. And **Blue Book PRO is
circular**: sales-history charts built from real Hub sales need a volume of real Hub sales
that does not exist yet. The flagship paid feature is at its weakest precisely when you most
need conversions. Expect Pro to convert *below* benchmark in year one and to improve as the
Blue Book fills. That is an argument for patience, not for panic — and an argument for not
discounting further.

**Studio Pro is the sharper product and the smaller market.** "Three active commissions free,
unlimited for $10" is a real cap that a working artist hits and *knows* they have hit, aimed
at the one segment with actual business income. It is the only paywall on the site sitting on
capacity rather than on nice-to-haves. It should convert several times better than Pro. There
are simply far fewer artists than collectors, so it improves the *rate* and barely moves the
*total*. Both facts are in the model.

### What can never be sold — the rulings, restated

From `.agents/MASTER_BLUEPRINT.md`, owner-ratified August 2026, repeated in the Operator
Playbook. Nothing in this report is modelled against these:

1. **The platform never holds money.** No escrow, not now, not as a roadmap item.
2. **No selling fees.** *"Show-entry fees are a maybe, someday. Nothing else."*
3. **We are the record, not the referee.**
4. **Time-payment tracking is the headline feature** of the Deal Room.
5. **Trust features are never paywalled** — show records, condition and flaw notes, Hoofprint
   provenance, the Blue Book, the evidence pack, the payment ledger. Precedent: flaws are free.

The reason is arithmetic, not sentiment. The hobby's default listing venue — Model Horse
Connection, the renamed MH$P — charges **$10 a year, flat, for 50 listings, and takes nothing
from a sale**. A marketplace cut would cost a seller **$6–9 on a $60 horse**. There is no
percentage that survives that comparison, and Discogs raising its selling fee to 9% in May
2023 is the cautionary tale the whole hobby already knows.

**And the outside evidence says the iron law is commercially right, not just ethically
right.** Of six mature hobby-database platforms examined, the two largest with the deepest
collection data — **Discogs and Ravelry — both tried consumer subscriptions and effectively
abandoned them.** Discogs launched a $12/yr "Market Price History" tier in July 2007 and
killed it the same year (https://en.wikipedia.org/wiki/Discogs). Ravelry's "$5/year Extras"
is described by Ravelry itself as generating minimal revenue while advertising carried the
business (https://blog.ravelry.com/how-does-ravelry-make-money/, first-party but dated 2012).
BoardGameGeek keeps patronage alive at **under 1% of registered users, declining three years
running**. The one that made subscriptions work — Letterboxd — charges for **stats, ad
removal and vanity, never for access to the collection data itself.**

> **Paywall convenience and identity. Never the catalog.** That is what MHH already does.

---

## Part 2 — What it costs to run, at every size

Full workings, sources and per-user assumptions:
[`business-research/infra-cost-curve.md`](business-research/infra-cost-curve.md).

**Today: about $47/month.** Vercel Pro $20 (includes 1 TB transfer, 10M edge requests, and a
$20 usage credit) + Supabase Pro $25 (includes $10 compute credit, 8 GB disk, 250 GB egress,
250 GB cached egress, 100 GB file storage, 100,000 MAU) + `.com` at ~$15–20/year. Resend and
Sentry are both on free tiers.

| Monthly-active members | Vercel | Supabase | Resend | Sentry | Domain | **Total/month** |
|---|---|---|---|---|---|---|
| ~75 (today) | $20 | $25 | $0 | $0 | $1.50 | **~$47** |
| 100 | $20 | $25 | $0 | $0 | $1.50 | **~$47** |
| 500 | $20 | $25 | $20 | $0 | $1.50 | **~$67** |
| 2,000 | $20 | $30 | $20 | $0 | $1.50 | **~$72** |
| 5,000 | $23 | $80 | $20 | $26 | $1.50 | **~$150** |
| 10,000 | $52 | $95 | $29 | $26 | $1.50 | **~$205** |

Vendor prices are **high confidence** (vendor docs, checked 2026-08-21). **The per-member
usage assumptions behind the growth rows are low confidence** — engineering estimates chosen
to err high, not measurements. Replace them the moment you have a full month of real data:
take the Vercel Usage tab and the Supabase Usage page, divide each metric by that month's
active members, and re-run the table.

**Four things about how the site is built keep this curve flat**, and all four are worth
protecting:

- **Photos do not go through Vercel's image pipeline.** Only two components import
  `next/image`; the other 91 image tags point straight at the public Supabase bucket. Photo
  bytes are therefore billed as Supabase **cached egress at $0.03/GB** rather than Vercel Fast
  Data Transfer at **$0.15/GB** — five times cheaper on the biggest byte source on the site.
- **Thumbnails are pre-generated at upload**, not transformed per request, so there is no
  per-view transformation bill on either vendor.
- **Uploads are compressed in the browser** before storage (free 1000px/q0.70, Pro
  2500px/q0.92). A side effect worth knowing: **a Pro subscriber costs meaningfully more to
  host than a free member** — still pennies, but it is real.
- **The `horse-images` bucket is public and CDN-cacheable.** If it ever moved to signed URLs
  the CDN would stop working and most photo bytes would jump to the $0.09/GB uncached meter —
  roughly a 3× increase on the largest variable line, for no user-visible benefit.

**The first meter to run out is Vercel Edge Requests, at around 2,800 active members** — and
even then the first $20 of overage is absorbed by the included credit. The first bill that
actually *rises* is email.

### The one cost problem you have today

**Resend's free tier caps at 100 emails per day.** Not per month — per *day*
(https://resend.com/pricing). A single show-results announcement to 120 entrants blows
through it, and so does the monthly Stablemaster mailing once there are more than ~100 Pro
members. **On any day the Hub runs a show, notification emails will start failing.** This is a
*today* problem at 75 members, not a scale problem. Resend Pro is $20/month for 50,000 emails
and removes the daily cap. Budget for it as part of the break-even bill rather than meeting
it as a surprise — that is why Level 0 is quoted as 11–15 subscribers rather than 11.

---

## Part 3 — How big is the hobby, really?

Full sourcing: [`business-research/hobby-size.md`](business-research/hobby-size.md).

**Fair warning: this hobby publishes almost no usable statistics.** Facebook, where most of
the hobby lives, is behind a login wall. Both marketplace domains
(`modelhorsesalespages.com`, `modelhorseconnection.com`) currently serve **expired TLS
certificates and would not load**, so active listing counts — the best commercial signal —
could not be obtained. NAMHSA has published no show list since 2019-20. What follows is built
around the few hard numbers that exist.

### The best anchor is not attendance — it is 13,000

The BreyerFest Celebration Model is included with every VIP, All-Access and Online Traditional
Access ticket, and Breyer makes almost exactly as many as there are ticket-holders:

| Year | Model | Edition size |
|---|---|---|
| 2024 | Athenian Lady | **13,000** (https://identifymybreyer.com/Events/BreyerFest/breyerfest2024.html) |
| 2025 | Tight Lines | **13,000** (https://www.breyerhorses.com/blogs/breyerfest-blog/breyerfest-limited-editions) |

**High confidence** for 2024, medium for 2025. Two consecutive years at an identical figure
reads as a deliberate ceiling. Discount for multi-ticket households and retail overstock and
you get **9,000–13,000 unique committed participants** — people who spent real money to be
there. That is a far better anchor than the "30,000 attendees" headline
(https://www.morganhorse.com/home/index/detail/11605/), which is almost certainly person-days
across three days blended with virtual attendance, includes accompanying children, and has
barely moved across 2023/2024/2025 in a way that reads like a recycled press number.

Corroborating: **Breyer Web Specials run 750–1,000 pieces**, one per person, Collector-Club
only, with a standby list. That is Breyer's own read on its most committed cohort.

### The three layers

| Layer | Low | **Central** | High | Confidence |
|---|---|---|---|---|
| **A — English-speaking people who collect at all** | 150,000 | **~350,000** | 900,000 | Low |
| **B — internet-active hobbyists** (groups, forums, showing, buying and selling online) | 30,000 | **~70,000** | 150,000 | Low-medium |
| **C — the serious core a platform like this could realistically sign up** | 15,000 | **~20,000** | 35,000 | Low-medium |

Layer C is bounded above by the 13,000 who pay for BreyerFest, multiplied 1.5–2.5× to catch
serious collectors who don't travel to Kentucky; and bounded below by the live-showing
population, roughly 2,000–5,000 people in North America.

**A good free product might register 3,000–10,000 accounts over two to three years**, with
perhaps 100–500 paying. That is the realistic trajectory, and it is the yardstick every level
below is measured against.

### Two structural findings that matter more than the totals

**The hobby is bifurcating, and MHH's differentiator is on the shrinking half.** NAN entrant
counts, from NAMHSA's own archives (https://namhsa.org/nan-archives/, **high confidence**):

| Year | Entrants | Models |
|---|---|---|
| 2024 | **126** | 4,521 |
| 2018 | 99 | 2,863 |
| 2014 | 212 | 5,703 |
| 2004 | **230** | — |

Entrants are down about **45% since the mid-2000s**, models per entrant are *up* from 27 to
36 — fewer people showing more horses — and **NAN is now biennial**. IMEHA, once the major
online showing organisation, **shut down in 2018**. Model Horse Blab has 6,960 cumulative
registrations since 2002 and is still recovering from its outage. Meanwhile the casual and
collecting end is healthy: BreyerFest grew from ~1,000 to 30,000+ since 1990, and Breyer's
Instagram has 91,200 followers.

**But the decline is partly infrastructure failure, not lost interest.** Ransomware, expired
certificates, dead organisations, a sanctioning body whose show database stopped in 2019 —
and **no online-showing incumbent at all since IMEHA closed**. That vacuum is precisely what
MHH was built for, and the repo's own strategy note already says it: *"Nobody serves live
showholders at all."*

The honest read: **showing is the wedge — the thing that acquires members and the only
approved revenue line beyond subscriptions. But the volume has to come from the collecting
end, which is the half that is growing.**

---

## Part 4 — The levels

### The arithmetic

Each level asks: *how much must arrive, net, for this to be true?* Revenue needed = the
target plus that level's infrastructure cost. Subscribers needed = revenue ÷ $4.56 (all-Pro,
the conservative assumption). Members needed = subscribers ÷ conversion rate.

**Where the three conversion rates come from.** Benchmarks are in
[`conversion-benchmarks.md`](business-research/conversion-benchmarks.md); the short version:

- **2% — conservative.** RevenueCat's freemium download-to-paid median is 2.1% across 115,000
  apps (https://www.revenuecat.com/state-of-subscription-apps, high confidence). This is also
  roughly where you land if MHH drifts toward the pure-patronage pattern — BoardGameGeek sits
  at 0.36–0.63% and Wikipedia's donor rate is far below 1%.
- **4% — base case.** Set deliberately *below* the 5–6% that the general benchmarks suggest,
  because of two MHH-specific drags: the $5 price point sits in RevenueCat's worst-converting
  band (low-priced products convert at 1.4% versus 2.8% for high-priced — cheaper converts
  *worse*), and Blue Book PRO is circular at launch scale.
- **8% — optimistic.** Just under **Duolingo's disclosed 9.2% of MAU** (12.2M paid / 133.1M
  MAU, Q4 2025, SEC filing — **very high confidence**). Treat 9% as a hard realistic ceiling:
  at that rate you are matching a public company with a dedicated growth organisation.

### Level 0 — it pays for itself

**Target: $0 net. Cover the bill.**

| Bill to cover | Pro subscribers | 80/20 Pro+Studio mix | Members @ 2% | @ 4% | @ 8% |
|---|---|---|---|---|---|
| **$47** (today) | **11** | 9 | 550 | **275** | 138 |
| **$67** (with Resend Pro) | **15** | 13 | 750 | **375** | 188 |

**Verdict: reachable this year.** 275–375 monthly-active members implies roughly 500–750
registrations — well inside the 3,000–10,000 trajectory, and about 2–4% of the hobby's
engaged core. Note the Studio effect: a blend of 80% Pro and 20% Studio Pro raises the average
net per subscriber from $4.56 to $5.53 and cuts the subscribers needed by about a fifth.

### Level 1 — covers itself with tooling headroom

**Target: $250/month net.** Enough to pay for the site, a design tool, a better analytics
plan, a domain or two, and the occasional paid asset without thinking about it.

| | Value |
|---|---|
| Infrastructure at this scale | ~$72/month |
| Revenue needed | ~$322/month |
| **Pro subscribers needed** | **71** |
| Members @ 2% / **4%** / 8% | 3,550 / **1,775** / 888 |

**Verdict: reachable in a good two or three years.** 1,775 monthly actives implies roughly
3,500 registrations — the middle of the realistic trajectory, and about 9% of the engaged
core. This is the level worth actually planning for.

### Level 2 — real side income

**Target: $1,000/month net.** A meaningful contribution to a household.

| | Value |
|---|---|
| Infrastructure at this scale | ~$150/month |
| Revenue needed | ~$1,150/month |
| **Pro subscribers needed** | **253** |
| Members @ 2% / **4%** / 8% | 12,650 / **6,325** / 3,163 |

**Verdict: the top of what the hobby can support — and only with show fees.** At the base 4%
case, 6,325 monthly actives implies ~12,600 registrations: **more than half the entire
engaged core of the hobby, active every month.** Only the 8% column (3,163 actives, ~6,300
registrations) sits inside a trajectory you could plan.

**But add the show-entry line from Part 5** and it changes materially. At the central entry-fee
case plus the Judging Clinic — about **$274/month of non-subscription income** — the
subscribers needed fall from 253 to **192**, and the members needed at 4% fall from 6,325 to
**4,800**. That is a 24% smaller audience requirement, and it moves Level 2 from *unlikely* to
*a genuine stretch goal*. This is the single strongest argument in the report for eventually
charging show entry.

### Level 3 — a meaningful second income

**Target: $2,500/month net.**

| | Value |
|---|---|
| Infrastructure at this scale | ~$300/month |
| Revenue needed | ~$2,800/month |
| **Pro subscribers needed** | **614** |
| Members @ 2% / **4%** / 8% | 30,700 / **15,350** / 7,675 |

**Verdict: not achievable on this model.** Even the optimistic 8% column needs 7,675 monthly
actives — roughly 15,000 registrations, or **77% of the entire engaged core signed up and
active every month.** The base case needs 15,350 actives, which is most of Layer B, the whole
internet-active hobby. Even at the *optimistic* show-fee case plus the clinic (~$695/month of
other income), you still need 462 subscribers and 11,550 monthly actives. Still out of reach.

### Level 4 — a salary

**Target: $7,000/month net** (the middle of $6–8k).

| | Value |
|---|---|
| Infrastructure at this scale | ~$860/month |
| Revenue needed | ~$7,860/month |
| **Pro subscribers needed** | **1,724** |
| Members @ 2% / **4%** / 8% | 86,200 / **43,100** / 21,550 |

**Verdict: no.** Even at the optimistic 8% conversion, 21,550 monthly actives is more than the
entire estimated engaged core and roughly a third of every internet-active hobbyist on earth,
all active every month. The base case, 43,100, is **62% of Layer B**. This is not a matter of
working harder; the hobby does not contain enough people at a $5 price point.

If a salary is ever genuinely the goal, it does not come from subscriptions. It comes from
something structurally different — becoming NAMHSA's technology partner, licensing the
catalog and Blue Book data, sponsorship from the manufacturers (Breyer sponsored an entire
NAN division in 2026; Stone sponsored the Stone division), or selling the platform. Those are
different businesses with different risks, and they are outside the scope of this report. But
it is more honest to name them than to pretend a bigger funnel gets there.

### The ceiling, drawn on one line

```
engaged core of the hobby ≈ 20,000 people  (15,000 – 35,000)
realistic registrations over 2–3 years ≈ 3,000 – 10,000

Level 0  ▓░░░░░░░░░░░░░░░░░░░  ~550 registrations      comfortably inside
Level 1  ▓▓▓▓░░░░░░░░░░░░░░░░  ~3,500 registrations    inside, with work
Level 2  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  ~12,600 registrations   at/over the edge
Level 3  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ~30,000       beyond the hobby
Level 4  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ~86,000  far beyond
```

---

## Part 5 — Show-entry fees, the one approved new SKU

This is the only new revenue line the rulings permit, and the arithmetic says it deserves to
stop being "someday" and start being "season two."

### The price anchors already exist

NAN 2026's published fee matrix (`.agents/docs/NAMHSA report.txt`) — the hobby's premier event:

| Fee | Current member | Non-member |
|---|---|---|
| Base entry | $35.00 | $75.00 |
| Class fee, current card | $4.00 | $6.00 |
| Class fee, buy-in | $12.00 | $18.00 |

And local shows run a *"volunteer economy ($1–10 entry fees, coupons, satin ribbons)"* per the
August design review. **The hobby is entirely used to paying to enter shows.** It is not used
to paying a platform, which is why the posture matters more than the price.

**The posture is already ratified.** `docs/CHAMPIONSHIP_PROGRAM_2026.md` states that at MHH-run
events *"a published percentage of entry fees goes to the judging panel, split evenly, capped
per judge — the fee visibly pays the judges, not the platform, which is the only fee posture
this hobby's volunteer economy respects. Community-hosted sanctioned shows keep their own fee
arrangements untouched."* That is the correct design and this report does not improve on it.

### The model

MHH-run events only: the annual International Championship plus four quarterly Opens — five
events a year, the cadence already planned. **One checkout per exhibitor per show**, covering
all their classes. Half the fee to the judging panel, published.

| Scenario | Exhibitors per event | Average fee | Gross/year | After Stripe | Judges (50%) | **Platform/month** |
|---|---|---|---|---|---|---|
| **Conservative** | 25 | $10 | $1,250 | $1,176 | $588 | **$49** |
| **Central** | 60 | $15 | $4,500 | $4,280 | $2,140 | **$178** |
| **Optimistic** | 120 | $25 | $15,000 | $14,385 | $7,193 | **$599** |

For scale: **NAN 2024 drew 126 entrants**, so the optimistic case is an MHH championship
matching the hobby's premier live event. 60 is plausible for a well-run online championship —
online showing has far lower friction than travelling to Kentucky, and there has been no
online incumbent since 2018.

**The central case alone is $178/month — nearly four times the current hosting bill**, from
about 300 exhibitor-entries a year rather than thousands of subscribers. That is the
capital-efficiency argument: a person who pays $15 to enter a championship has proved
engagement that a $5/month feature bundle spends a year trying to prove.

### Three design rules that follow from the arithmetic

1. **Never charge per class.** Stripe takes $0.30 flat, which is **15% of a $2 charge and 10%
   of a $3 charge**. Batch every class a person enters into one checkout. Below about $10 a
   transaction, you are working mostly for Stripe.
2. **$10 minimum, $15 central.** Below $10 the fixed fee eats too much; at $15 the effective
   rate is 4.9%, which is defensible when half is visibly going to the judges.
3. **MHH-run events only, forever.** The moment a fee touches a community-hosted show it
   becomes a tax on a volunteer, and the ruling — *"only as a convenience for hosts, never as
   a cut of a sale"* — is breached in spirit.

### The second pre-approved SKU: the Judging Clinic

`CHAMPIONSHIP_PROGRAM_2026.md` already describes a paid MHH Judging Clinic as *"an honest
revenue line: education, never access,"* with a free apprentice route so accreditation is
never paywalled. A $40 course taken by 30 people a year is ~**$96/month** of near-pure margin
— the curriculum is written once. Modest, culturally safe, and it strengthens the judge ladder
that makes the Championship credible. Worth building alongside the fee.

---

## Part 6 — Churn: the treadmill, and why it kills Levels 3 and 4

Churn does not change how many subscribers a level *needs*. It changes how many new ones you
must **recruit every month, forever, just to stand still**.

> **Subscribers you must add each month = subscribers needed × monthly churn rate.**

**The assumption: 6% monthly churn.** Recurly's payment-network data puts the $10–$25 band at
**4.29% monthly** (2.99% voluntary + 1.30% involuntary) — and that is their *lowest* published
band, so MHH at $5–$10 sits below it. Elena Verna's consumer benchmark is 5–7% monthly as
"good." 6% is the honest middle. (Mobile app-store churn runs ~17% monthly, but that reflects
impulse installs and does not apply to a deliberate signup on a site you already use.)

| Level | Subscribers | New subs/month at 6% churn | …and at 4% conversion, **new active members/month** |
|---|---|---|---|
| **Level 0** | 11–15 | ~1 | **~17** |
| **Level 1** | 71 | ~4 | **~107** |
| **Level 2** | 253 | ~15 | **~380** |
| **Level 3** | 614 | ~37 | **~921** |
| **Level 4** | 1,724 | ~103 | **~2,586** |

Read the last column. **Level 4 requires recruiting about 2,600 new active members every
month, in a hobby whose engaged core is roughly 20,000 people** — you would need to sign up
13% of the entire serious hobby, every month, forever. That is the clearest single statement
of why Level 4 is not a stretch goal but an impossibility.

At 8% churn multiply those figures by 1.33; at 4% multiply by 0.67.

**Two things about churn worth acting on:**

- **Month one is where subscribers die.** Every dataset shows first-term churn dominating —
  RevenueCat finds 44% of monthly mobile subscribers gone after one renewal, Verna puts
  first-term churn near 25%. A flat blended rate will overstate your first year. Budget for the
  first month being the leakiest, and put your onboarding effort there.
- **About 1.3 points of that 6% is involuntary** — expired and declined cards, not decisions.
  Roughly half of it is recoverable with retry logic and dunning emails. **The Stripe webhook
  currently handles exactly three events and does not handle `invoice.payment_failed` at all**,
  so today a failed renewal is invisible to the app. That is the cheapest subscriber you will
  ever save.

**Lifetime value, for reference:** a Pro subscriber at 6% churn is worth $4.56 ÷ 0.06 =
**~$76**. A Studio Pro subscriber is worth **~$157**. An annual Pro subscriber at $50 with a
55% renewal rate is worth **~$107** — about 40% more than monthly, which is the whole argument
for Part 7's second recommendation.

---

## Part 7 — What moves the needle, ranked

### Which lever is worth pulling

At Level 1, the levers rank like this — and the ordering is genuinely surprising:

| Lever | Effect at Level 1 ($250/mo) |
|---|---|
| **1. Show-entry fees** (central case) | **$178/month — 71% of the entire level, on its own** |
| **2. Conversion 2% → 4%** | Halves the audience needed: 3,550 → 1,775 members |
| **3. Studio Pro mix 0% → 20%** | Subscribers needed 71 → 58 (−18%), audience falls in step |
| **4. Annual plans** | ~40% more lifetime value; cuts the recruitment treadmill, not the target |
| **5. Raw member growth** | Linear, slowest, most expensive, and capped by the hobby's ceiling |

The counter-intuitive result is that **growing the audience is the *worst* lever available**,
because it is the one thing the hobby's size actually constrains. Everything above it improves
the yield on the members you already have. At Level 2 and beyond the ordering collapses — you
need all of them at once — but for the next two years, work the top four.

### The recommendations

**1. Make the money measurable. (Do this first; everything else is blind without it.)**
Add a `last_seen_on DATE` column to `users`, written once per member per day, so monthly
actives become an exact number rather than an estimate — it records *when* someone visited,
never *what they looked at*, so the "metrics track objects, never people" guardrail is
untouched. Then give subscriptions a home in the database: today tier lives only in
`auth.users.app_metadata` with no `subscriptions` table, so **MRR, churn, conversion and
cohort retention are questions the schema cannot answer**. And handle `invoice.payment_failed`
in the webhook. A few days of work; without it, every number in this report stays a guess.

**2. Add annual plans at two months free — $50/year Pro, $100/year Studio.**
The standard convention is a 17% discount framed exactly that way, and it is well attested. An
annual subscriber is worth roughly 40% more in lifetime value, pays 3.5% to Stripe instead of
8.9%, and cannot churn in month three. It needs **no new features** — just two more Stripe
price ids and a toggle on the upgrade page. And it fits the hobby's own habits: NAMHSA charges
$30 per two years, Model Horse Connection $10 per year. People here already think in annual
dues. *(One caution from the data: over a third of annual subscribers cancel auto-renew inside
the first month. Annual buys twelve months of cash, not twelve months of loyalty.)*

**3. Introduce show-entry fees on MHH-run events, at $10–15, in Championship season two.**
Not now — the format has to prove itself first, and Summerween is not the moment. But after the
first Championship has run and been judged well, this is the line that takes Level 2 from
unlikely to reachable. Keep the posture already ratified: **one checkout per exhibitor per
show** (never per class — Stripe's flat $0.30 is 15% of a $2 charge), a **published split that
visibly pays the judges**, and **MHH-run events only, forever**. Community-hosted shows stay
free to host and free to enter as far as the platform is concerned.

**4. Make Studio Pro the priority conversion surface.**
It is the only paywall on the site that sits on capacity rather than on nice-to-haves, it aims
at the one segment with actual business income, and it nets more than twice what Pro does. The
concrete change is small: **surface the three-commission cap before an artist hits it** — a
quiet "2 of 3 active commissions" line on the studio dashboard — rather than only at the
moment `sendQuote` refuses. A cap you can see coming converts; a cap that ambushes you
irritates. Recruiting ten working artists is worth more than a hundred casual collectors, and
there are far fewer of them to find.

**5. Be patient with the Pro bundle, and strengthen it where it is thinnest.**
Blue Book PRO will get better on its own as sales accumulate — that is not a problem to fix,
it is a clock to run. What is worth actual effort is the **Monthly Stablemaster report**: it is
the only Pro feature that arrives in someone's inbox unprompted, which makes it the one that
can *demonstrate* value rather than wait to be discovered. Make it good enough that a free
member who sees a friend's copy wants one. Add the Judging Clinic when the judge ladder is
real — $40, near-pure margin, and "education, never access" is a phrase this hobby will accept.

### What not to do

- **Do not paywall any trust feature**, ever. Beyond the ruling, the evidence says it is also
  the commercially right call: Discogs killed its paid data tier within months, Ravelry's perks
  tier is a rounding error, and the platform that made subscriptions work — Letterboxd —
  charges for stats and vanity while leaving the catalog free.
- **Do not take a percentage of a sale.** The competing venue charges $10 a year and takes
  nothing. There is no percentage that wins that argument.
- **Do not revive `promote` or `boost-iso`.** Delete them. They charge real money for effects
  nothing consumes, pay-for-placement is off-culture here, and leaving live checkouts in the
  tree that do nothing is a trust liability in a hobby that is watching for exactly that.
- **Do not add advertising.** It is Ravelry's biggest revenue line — on 180 million monthly page
  views. At MHH's scale it would earn tens of dollars a month and cost you the "independent and
  ad-free" promise the upgrade page currently makes. That promise is worth more than the money.
- **Do not lower the price.** RevenueCat's data is clear that low-priced products convert
  *worse*, not better (1.4% versus 2.8%), and at $5 the flat $0.30 Stripe fee is already
  costing you 6%. If anything, the pricing question worth revisiting later is whether Pro
  should be $6 or $7 — not whether it should be $3.
- **Do not plan around Level 3 or Level 4, and do not make a life decision on this model.**
  The honest ceiling on subscriptions in this hobby is somewhere around Level 2. That is a real
  achievement for two people with day jobs and a passion project — it is just not a salary, and
  the report would be doing you a disservice to imply otherwise.

---

## Confidence and caveats

**High confidence.** Every vendor price (Vercel, Supabase, Resend, Sentry, Stripe — all read
from vendor documentation on 2026-08-21). Everything stated about what the repo contains: the
$5 and $10 prices, the tier matrix, the six checkout routes, the rulings, the absence of a
`subscriptions` table or a `last_seen` column, the beta promo. NAN entrant counts and the
BreyerFest Celebration Model edition sizes. Duolingo's 9.2% of MAU (an SEC filing). The
BoardGameGeek supporter series.

**Medium confidence.** The infrastructure cost curve's *shape* — vendor prices are exact but
the per-member usage estimates behind them are engineering judgement, deliberately erring
high. The 6% churn assumption. The three conversion rates as applied to *this* product. The
Supabase compute-tier step points, which are the largest single source of error in the cost
curve.

**Low confidence, and flagged wherever used.** All three hobby-size layers — they rest on
ratio assumptions, not measurement, and the most important commercial signal (marketplace
listing volumes) could not be obtained because both domains serve expired certificates. The
Supporter tier's price and therefore all Supporter arithmetic. The MAU-to-registrations ratio.
The show-entry-fee exhibitor counts, which are estimates against a format that has not run yet.

**Deliberately excluded as unreliable.** Patreon's widely-quoted "1–5% follower conversion"
(no rigorous source exists anywhere). Baremetrics' annual-versus-monthly retention figures
(contradict a far larger dataset by 3×). The claim that "passion niches convert better" (vendor
marketing only; the hard data arguably points the other way). A "Discogs Gold" subscription
tier that several search results asserted and no Discogs-owned page corroborates.

**The three things most likely to make this report wrong.** First, if conversion lands nearer
BoardGameGeek's sub-1% patronage pattern than the 2–4% freemium pattern, every member figure
here roughly quadruples and Level 1 becomes the ceiling rather than Level 2. Second, if the
hobby's engaged core is nearer 35,000 than 20,000, Level 2 becomes comfortable. Third, and most
importantly: **these are all estimates, and within about two months of shipping recommendation
#1 you will be able to replace the lot of them with your own numbers.** Do that. A measured
conversion rate from 300 real members is worth more than every benchmark in this document.
