# Working notes — conversion, churn, and what comparable platforms actually earn

**Researched 2026-08-21.** Working notes for
[`../BUSINESS_MODEL_2026.md`](../BUSINESS_MODEL_2026.md).

---

## 1. The denominator problem — read this before any other number

**Nearly every published "2–5% freemium conversion" benchmark uses *new registered accounts*
as the denominator, not active users.** OpenView/Pendo/Lenny's Newsletter define it
explicitly: "new accounts who begin paying within their first 6 months ÷ total new accounts
created in the window."

Applying such a figure to monthly-active members understates the true rate by roughly the
inverse of the active rate. **Strava is the cleanest illustration**: ~195M registered, ~50M
MAU, ~$490M ARR (2025) implying 4–6M paid — which is **2% of registered users** or **8–12% of
MAU**, the same company looking either mediocre or excellent depending purely on the
denominator. (https://sacra.com/c/strava/ — **low-medium confidence**, subscriber count is
estimated, never disclosed.)

The report states its denominator (monthly-active members) on every table for this reason.

## 2. Free-to-paid conversion

| Figure | Denominator | Source | Confidence |
|---|---|---|---|
| Freemium self-serve: **3–5% good, 6–8% great** | New accounts, 6-mo window | https://www.lennysnewsletter.com/p/what-is-a-good-free-to-paid-conversion (OpenView + Pendo, 1,000+ products, Aug 2023) | **High** |
| 20% of freemium products convert **under 2.5%**; 33% at 2.5–5%; 15% above 20% | Same | Same | High |
| Freemium download-to-paid (D35) median **2.1%** vs 10.7% for hard paywalls | Installs | https://www.revenuecat.com/state-of-subscription-apps (2026 ed., 115k apps, $16B, 1B+ transactions) | **High** — largest dataset available |
| Overall D35: global median **2.0%**, North America **2.6%** (p90 10.4%) | Installs | RevenueCat 2026 | High |
| By price point: low-priced **1.4%**, mid 2.0%, high **2.8%** | Installs | RevenueCat 2026 | High |
| Median 8% across 200 B2B products | Free signups | https://www.growthunhinged.com/p/free-to-paid-conversion-report | Medium — **do not use**, respondents are $50–249 ARPU B2B |

**MAU-denominated reference points — the ones that match this report's framing:**

- **Duolingo: 9.2% of MAU are paid** (12.2M paid / 133.1M MAU, Q4 2025), 8.9% in Q1 2025.
  Source: SEC 10-K/10-Q. **Confidence: very high** — audited disclosure. Treat this as close
  to a *ceiling* for a well-optimised mass-consumer freemium product with a dedicated growth
  organisation.
- **Spotify: ~41–46% of MAU** — high confidence on the arithmetic, but **not a valid
  comparable**: the free tier is deliberately degraded (ads, shuffle-only, no offline) in a
  way a goodwill-dependent hobby community cannot copy.

> ### "Passion niches convert better" — no rigorous evidence, and the hard data leans the
> ### other way
>
> Every source making this claim was a membership-platform vendor's marketing blog with no
> methodology or sample. **Very low confidence — do not build a plan on it.** Against it:
> RevenueCat shows *low-priced* products converting *worst* (1.4% vs 2.8%), and BoardGameGeek
> and Ravelry — two of the largest passion communities in existence — both monetise
> subscriptions poorly. The defensible position is that **passion helps retention more than
> it helps conversion.**

### Recommended modelling assumptions (% of monthly-active members)

| Scenario | % of MAU paying | Anchor |
|---|---|---|
| **Conservative** | **2–3%** | RevenueCat freemium 2.1%; lower half of the OpenView distribution. Where you land if the paid tier reads as optional patronage rather than utility — the BGG/Ravelry pattern. |
| **Base** | **5–6%** | Top of OpenView's "good" band adjusted up for the MAU denominator; a genuinely useful paid tier in a high-intent niche. |
| **Optimistic** | **9–12%** | Bounded above by Duolingo's disclosed 9.2% of MAU. Treat 9% as a hard realistic ceiling. Above 12% is almost certainly a denominator artifact. |

The **annual patronage/Supporter tier behaves differently and must be modelled far lower —
0.5–1.5% of MAU.** BGG's 0.36–0.63% and Wikipedia's sub-1% are the governing precedents.

*(The main report uses 2% / 4% / 8% rather than 2–3 / 5–6 / 9–12. The base column is set
deliberately below this synthesis because of two MHH-specific drags: the $5 price point sits
in RevenueCat's worst-converting band, and Blue Book PRO — the flagship paid feature — is
circular at launch scale, needing a volume of real Hub sales that does not yet exist.)*

## 3. Churn for sub-$10/month consumer subscriptions

Two universes in the literature, disagreeing by 3–4×. Reconciling them matters.

**Web-billed subscriptions (Recurly network, updated July 2026)** — closest match to a
Stripe-billed web platform. https://recurly.com/research/churn-rate-benchmarks/

| ARPC tier | Total monthly churn | Voluntary | Involuntary |
|---|---|---|---|
| **$10–$25** | **4.29%** | 2.99% | 1.30% |
| $25–$50 | 3.84% | 2.73% | 1.11% |
| $50–$100 | 3.15% | 2.41% | 0.74% |
| $250+ | 3.07% | 2.90% | 0.18% |

Network overall 3.60%; Digital Media 4.14%; Education 4.99%. **Confidence: high.** Caveat:
**$10–$25 is their lowest published band, and MHH prices below it** — so 4.3% is a floor, not
a midpoint.

**Mobile app-store subscriptions (RevenueCat, 10,000+ apps)** — much worse, driven by impulse
installs. Monthly plans retain a **median 11% at 12 months** (≈17% average monthly churn);
**56% median first-renewal rate**, i.e. 44% churn in month one. **Confidence: high on the
data, medium on applicability** — app-store impulse buys churn far harder than a deliberate
signup on a site you already use.

**Elena Verna (Mar 2025):** consumer subscriptions — 5–7% monthly is *good*, over 10% is poor;
~25% first-term churn; ~40% of annual first-term churn is involuntary (payment failure).
**Confidence: medium-high.** https://www.elenaverna.com/p/subscription-churn-benchmarks-and

**Price-point effect, cleanly stated: cheaper does not buy lower churn.** Involuntary churn
falls 87% from the cheapest tier to the most expensive (1.30% → 0.18%), and voluntary churn is
highest in the cheap bands. At $5/month you get the worst of both — price-insensitive but
disengaged signups, *and* the highest card-failure rate.

### Recommended churn assumptions

- **Base: 6% monthly** — above Recurly's $10–$25 band because MHH prices below it, inside
  Verna's 5–7% "good" range, well below RevenueCat's mobile ~17%.
- Conservative **8%**; optimistic **4%** (justified only if passion-retention effects are
  real — plausible, unproven).
- **Model month one separately at 20–30%.** First-term churn is the dominant loss event in
  every dataset. A flat blended rate materially overstates year-one revenue.
- Assume **~1.3% of the 6% is involuntary** (card failures); dunning and retry logic recover
  roughly half of that. Cheap, high-ROI.

## 4. Comparable hobby/community platforms

### BoardGameGeek — the best comparable, and it is sobering

| Year | Supporters |
|---|---|
| 2020 | 19,200 |
| 2021 | 18,600 |
| 2022 | 17,200 |
| 2023 | **17,048** (lowest since 2015) |

Source: https://boardgamewire.com/index.php/2024/01/09/boardgamegeeks-support-drive-numbers-fall-for-third-year-running/
(**high confidence** on the series). Against ~2.7M registered users and ~4.7M monthly unique
visitors — **implied paid share 0.63% of registered, 0.36% of monthly uniques, declining
three years running.** (Denominator contested: Wikipedia says 4M+ registered as of Mar 2025,
which swings the share by ~35%.)

Critically, **BGG paywalls nothing** — it is pure patronage with cosmetic perks, which is
exactly why it lands under 1%. **This is the single most relevant precedent for MHH's
Supporter tier.**

### Ravelry — the cautionary tale for a small perks tier

~4-person profitable company. Revenue in rank order: **advertising** (largest — ~1,500
advertisers, half spending under $15/mo, ~180M monthly page views), then merchandise, then
pattern-sale commissions, then affiliate. **"Ravelry Extras" — $5/year for enhanced forum
features — is explicitly described as generating minimal revenue.**
https://blog.ravelry.com/how-does-ravelry-make-money/ — **high confidence on content
(first-party), but dated January 2012.** The strategic signal survives the vintage: a large
passion community with an optional perks tier found ads far more lucrative.

### Discogs — has no consumer subscription at all

Revenue is advertising plus marketplace fees (9% seller fee on item and shipping, $0.10 min /
$150 max). A paid tier ("Market Price History", $12/yr) launched July 2007 and was
**abolished the same year**, returning the site to fully free. ~19M releases, 110 employees.
https://en.wikipedia.org/wiki/Discogs

> **Correction worth recording:** several search results asserted a "Discogs Gold/Premium"
> tier with unlimited database queries and batch editing. This could not be corroborated
> against any Discogs-owned page and it contradicts Wikipedia. It appears to be AI-generated
> SEO content. **It is not in the report.**

### Letterboxd — the right shape, no published numbers

Pro $19/yr (~$1.58/mo), Patron $49/yr (~$4.08/mo), plus an HQ tier for film organisations.
**Confidence: high on Pro pricing** (https://newsletter.pricingsaas.com/p/letterboxd-and-niche-social-monetization),
medium on Patron. **Paid subscriber count and conversion rate: never disclosed.** Use for
model *shape*, never for rates. It is MHH's closest structural analogue: near-complete
functionality free, charging for convenience, stats and vanity.

### Others

- **AllTrails: 1 million paid subscribers**, announced Jan 2021
  (https://www.prnewswire.com/news-releases/alltrails-celebrates-1-million-paid-subscribers-301214556.html)
  — high confidence on the figure, but five years stale and no ratio published.
- **eBird / iNaturalist: not comparables.** Free, nonprofit, grant- and donation-funded.
- **Wikimedia FY2024-25:** $184.5M from 18M+ donations, **7.7M donors** (down 2.4% YoY),
  average gift $10.15, 1M monthly recurring. https://meta.wikimedia.org/wiki/Fundraising/2024-25_Report
  (**very high confidence**). Against ~1.5B monthly unique devices, the donor rate is **far
  below 1%**.
- **Patreon follower→patron conversion, "1–5%": LOW confidence — the shakiest number
  encountered.** Every source was a forum thread or SEO listicle; no rigorous study exists.

> ### The structural finding
>
> Of the six mature hobby-database platforms examined, **the two largest with the deepest
> collection data — Discogs and Ravelry — both tried consumer subscriptions and effectively
> abandoned them.** Discogs killed its paid tier within months of launching it in 2007;
> Ravelry relegated its $5/yr Extras to a rounding error while advertising carried the
> business. BGG kept patronage alive but under 1% and declining. The platform that made
> subscriptions work — Letterboxd — did so by charging for **stats, ad removal and vanity,
> never for access to the collection data itself.**
>
> **Paywall convenience and identity. Never the catalog.** MHH's trust-features-are-free iron
> law is, by this evidence, not just ethically right but commercially right.

## 5. Annual plans

- **RevenueCat 2026:** subscriptions split **42% monthly / 34% yearly** (rest weekly/other),
  varying hugely by category (Productivity 77% yearly, Health & Fitness 68% monthly). Median
  annual price **$34.80**; median monthly $8–$10. **High confidence.**
- **Retention lift:** annual **28% vs monthly 11%** retained at 12 months — a genuine ~2.5×
  over an identical window. **High confidence.** (RevenueCat explicitly warns *against*
  comparing first-renewal rates across durations: monthly 56% vs annual 27% is an invalid
  comparison.)
- **Standard discount: 17%, framed as "two months free"**, within a 10–25% range.
  **Medium-high confidence** — widely and consistently attested. Safe to use.
- **Offsetting risk:** RevenueCat 2026 finds **over one third of annual subscribers cancel
  auto-renew within the first month** — the first month is 35% of all annual cancellations.
  **Annual plans buy 12 months of cash, not 12 months of loyalty.**

> **Excluded as unreliable:** Baremetrics' widely-quoted "annual retains 92% at 12 months vs
> 68% monthly", "annual subscribers stay 40 months vs 14", "target 40–60% of new subs on
> annual". These contradict a far larger dataset by ~3×, the numbers are suspiciously round,
> no methodology is given, and the page carries content-farm markers. **The direction is
> right; the magnitudes are not credible.** Not used in the report.

**Recommended: assume 25–35% annual uptake at a 17% discount, with roughly 2.5× the 12-month
retention of monthly.**

## 6. Stripe fees

**Standard US online card rate: 2.9% + $0.30** per successful transaction, verified on
https://stripe.com/pricing. **Very high confidence.** Add-ons: +1.5% international cards, +1%
currency conversion. Nonprofits can qualify for 2.2% + $0.30.

| Charge | Fee | **Net** | Effective |
|---|---|---|---|
| **$5.00** | $0.445 | **$4.555** | **8.90%** |
| $5.00 + Billing 0.7% | $0.48 | $4.52 | 9.60% |
| **$10.00** | $0.59 | **$9.41** | **5.90%** |
| $10.00 + Billing 0.7% | $0.66 | $9.34 | 6.60% |
| $50.00 (annual) | $1.75 | $48.25 | 3.50% |
| $25.00 (annual supporter) | $1.025 | $23.98 | 4.10% |
| $3.00 (entry fee) | $0.387 | $2.61 | **12.90%** |

**The $0.30 fixed fee is the whole story.** It alone is 6% of a $5 charge, 10% of a $3 charge,
and 15% of a $2 charge. The $5 tier loses ~9% to Stripe while the $10 tier loses ~6% — **the
cheap tier is about 50% more expensive to service in percentage terms**, and small one-off
charges are punitive.

**Stripe Billing adds 0.7% of billing volume** pay-as-you-go on subscriptions. MHH uses
Checkout Sessions in `subscription` mode, so this may already be on the invoice — **worth
checking the actual Stripe statement** before trusting the $4.555 figure exactly.

**Micropayments pricing exists but is not publicly offered** — Stripe says "contact sales,"
and where unavailable recommends batching small transactions into one larger charge. The
widely-repeated "5% + $0.05" comes only from payment resellers, not Stripe. **Low-medium
confidence.** If obtained, breakeven versus standard pricing is **$11.90** — below that
micropayment pricing wins. Only worth a sales conversation if $5 subscriptions become
volume-dominant.

## 7. The shakiest numbers in this file — flagged so they can be discounted

1. **Patreon conversion (1–5%)** — no rigorous source exists. Weakest number here; not used.
2. **Baremetrics annual-vs-monthly figures** — contradict a much larger dataset by 3×. Excluded.
3. **"Niche/passion converts better"** — vendor marketing only; hard data leans the other way.
4. **Stripe's "5% + $0.05" micropayment rate** — reseller-sourced, absent from Stripe's pricing.
5. **Ravelry's economics** — first-party and useful, but dated January 2012.
6. **Strava's paid subscriber count** — never disclosed; derived from revenue estimates.
7. **Letterboxd** — closest structural comparable, zero published numbers.
8. **BGG's denominator** — 2.7M vs 4M+ registered swings the implied paid share by ~35%.
