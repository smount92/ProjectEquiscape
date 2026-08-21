# Working notes — what the code and the rulings actually say

**Verified against the repo on 2026-08-21** (branch `ws/business-model`, worktree of
`model-horse-hub`). Everything here was read out of the tree, not remembered. Working notes
for [`../BUSINESS_MODEL_2026.md`](../BUSINESS_MODEL_2026.md).

---

## 1. What is actually for sale today

`src/app/upgrade/page.tsx` is the only pricing surface. Three products render there.

| Product | Price | Where the price lives | Notes |
|---|---|---|---|
| **MHH Pro** | **$5/month** | Hardcoded in the page copy (line ~341); the Stripe price id is `STRIPE_PRO_PRICE_ID` | Marked "Most popular", the only leather-panel card |
| **Studio Pro** | **$10/month** | Hardcoded in the page copy (line ~389); `STRIPE_STUDIO_PRO_PRICE_ID` | Includes everything in Pro |
| **Supporter** | **Annual — amount not in the code** | Read live from Stripe at render time via `STRIPE_SUPPORTER_PRICE_ID` | Dark ship: if the env is unset or the price id fails to resolve, the card and its FAQ entry simply do not render |

The Supporter price is deliberately not in the repo — `getSupporterPriceLabel()` calls
`stripe.prices.retrieve()` and memoises for 10 minutes. **The amount has to be read from
the Stripe dashboard.** The report models it at $25/year with the sensitivity shown, and
flags the number as unverified.

Supporter grants: a brass plaque on the profile, an optional line in the Supporters' Ledger,
and nothing else. The FAQ says so outright — *"Nothing — on purpose."* It is orthogonal to
the tier (a free member can be a Supporter; `users.is_supporter`, migration 142), and the
webhook intercepts supporter subscriptions before the generic Pro branch so it can never
grant a tier by accident.

**Beta discount, currently in force:** the FAQ promises early supporters *"a promo code for
6 months free."* All three subscription checkouts pass `allow_promotion_codes: true`. Any
subscriber recruited during the launch window therefore contributes **$0 for six months**.
This is the right thing to have done and it also means the break-even clock starts around
February 2027 for those members, not today.

### The dormant a-la-carte checkouts

`src/app/api/checkout/` contains six routes. Three are subscriptions (`route.ts` = Pro,
`studio-pro/`, `supporter/`). Two are one-off charges that still exist in the tree:

- `promote/` — $2.99, 7-day promoted listing (`unit_amount: 299`)
- `boost-iso/` — $1.99, 48-hour pinned wanted ad (`unit_amount: 199`)

The third one-off, the **$1.99 insurance report, has been retired** — there is no
`checkout/report` route left in the tree, and the insurance PDF is free for everyone.

Both survivors were ruled off-culture. `docs/COMMERCE_AND_COMMS_PLAN.md` §2.6 says
pay-for-placement is *"off-culture for this hobby regardless of whether it worked"* and that
they *"charge real money for effects nothing consumes."* Two prior audits said delete-or-wire.
**They are treated as zero revenue in the model and the report recommends deleting them.**

## 2. The tier matrix — what money actually buys

From `TIER_MATRIX` in `src/app/upgrade/page.tsx`.

**Free, forever, for everyone ("Trust & records" — the group note reads *"Free for everyone,
forever — these are the reason the Hub exists"*):** unlimited horses; Hoofprint provenance
and ownership history; verified show records and qualification cards; condition grades and
flaw records; the Blue Book price guide (avg/median/range); marketplace listings and the
Want List matchmaker; the standard insurance report PDF; Show Ring, barns, events and the
Paddock. Also free, in the Studio group: a public artist profile and portfolio, the
commission queue manager (3 active), and the WIP photo portal.

**Pro ($5) adds six things:** 30 extra detail photos per horse on top of the 5 free angles;
Blue Book PRO sales-history charts; Market Replacement Values stamped on insurance PDFs;
printable cut-out show tags; the Monthly Stablemaster report by email; early access and
priority support.

**Studio Pro ($10) adds two artist-only things** on top of all of Pro: unlimited active
commissions (the free cap is 3, enforced in `sendQuote` and on the `accept` transition per
`.agents/MASTER_BLUEPRINT.md`), and the Hoofprint artist credit on every custom.

### Honest read on whether that bundle converts

Worth writing down because the report has to answer it.

**Working in its favour.** The bundle is honestly described — the page even downgraded its
own analytics claim (a code comment records that "5-year trends" was cut because the data
doesn't exist yet). The pitch is patronage-first: *"Pro is how the lights stay on."* In a
hobby that has watched Model Horse Blab go dark for two years and MH$P get ransomwared, that
is a genuinely strong pitch and probably stronger than the feature list.

**Working against it.** Of the six Pro features, exactly one is an everyday capability
(Photo Suite+). Show Tags matter a few times a year. Insurance reports matter once. The
Stablemaster report is monthly and its value is unproven. And **Blue Book PRO's value is
circular at today's scale** — sales-history charts built from real Hub sales need a volume of
real Hub sales that does not exist yet, so the flagship analytics feature is at its weakest
precisely when the Hub most needs conversions. Expect Pro conversion to run below a
comparable product's benchmark until the Blue Book has depth.

**Studio Pro is the sharper product.** "3 active commissions free, unlimited for $10" is a
real, felt cap that a working artist hits and knows they have hit. It is the one place on
the site where the paywall sits on capacity rather than on nice-to-haves, and it is aimed at
the segment with actual business income. The problem is that artists are a small slice of
the hobby — so it converts better and matters less. Both facts belong in the model.

## 3. Owner-ratified revenue rulings (do not model around these)

From `.agents/MASTER_BLUEPRINT.md` §"Commerce Rulings (owner-ratified, August 2026)",
repeated verbatim in `docs/OPERATOR_PLAYBOOK.md`:

1. **The platform NEVER holds money.** No escrow, not now and not as a roadmap item.
2. **No selling fees.** *"Show-entry fees are a maybe, someday. Nothing else."*
3. **We are the record, not the referee.**
4. **Time-payment tracking is the headline feature** of the Deal Room.
5. **Trust features are never paywalled.**

The playbook restates the negative list: *"Never paywall: hosting a basic show, browsing,
cataloging, the reference pages, or any trust feature (the evidence pack, condition grades,
provenance, the payment ledger). Precedent: flaws are free."* And: *"Off the table by
ruling: selling fees of any kind, and anything that requires the platform to hold or move
money. Show-entry fee collection is the one maybe, someday — and only as a convenience for
hosts, never as a cut of a sale."*

`COMMERCE_AND_COMMS_PLAN.md` §2.2 supplies the reason, with arithmetic: the hobby's own
default listing venue (Model Horse Connection, the renamed MH$P) charges **$10/year flat for
50 listings and takes nothing from a sale**, while a marketplace cut would cost a seller
**$6–9 on a $60 horse**. Discogs raising its selling fee to 9% in May 2023 is the cited
cautionary tale. There is no percentage cut that survives contact with this hobby.

## 4. Show-entry-fee anchors already in the repo

The one approved-someday revenue line, so its price anchors matter.

**NAN 2026 fee matrix** (`.agents/docs/NAMHSA report.txt`) — the hobby's premier event:

| Fee | Current member | New/renewing | Non-member |
|---|---|---|---|
| Base entry | $35.00 | $65.00 (incl. $30 biennial membership) | $75.00 |
| Class fee, current card | $4.00 | $4.00 | $6.00 |
| Class fee, expired card | $8.00 | $8.00 | $12.00 |
| Class fee, buy-in | $12.00 | $12.00 | $18.00 |

Judges at NAN get a **$100/day stipend**, a shirt, a medallion and lunch. So even the
hobby's biggest show runs on a volunteer economy with token compensation.

**Local shows:** `docs/GOLD_STANDARD_DESIGN_REVIEW_2026-08.md` describes the hobby's
"volunteer economy ($1–10 entry fees, coupons, satin ribbons)."

**The owner has already ratified a fee *posture*** in
`docs/CHAMPIONSHIP_PROGRAM_2026.md`: at MHH-run events *"a published percentage of entry
fees goes to the judging panel, split evenly, capped per judge — the fee visibly pays the
judges, not the platform, which is the only fee posture this hobby's volunteer economy
respects. Community-hosted sanctioned shows keep their own fee arrangements untouched."*
The same doc also proposes a **paid MHH Judging Clinic** — *"an honest revenue line:
education, never access"* — with a free apprentice route so accreditation is never
paywalled. That is a second pre-approved SKU and the report should say so.

The Championship cadence is already planned: 1–2 sanctioned qualifiers a month, one
quarterly MHH Open, one annual International Championship in June. That cadence is the
denominator for any entry-fee model.

## 5. Current scale (given, not researched)

- `.agents/MASTER_BLUEPRINT.md` guardrails section: **"75+ registered users"**, `user_horses`
  at **"900+ rows"** — i.e. ~12 horses per member.
- Launched **2026-08-21** (the blueprint's own header calls it "the launch release"); the
  five-room rebuild and migrations 165–175 went to production that day.
- One show running (Summerween). Dozens of active members.
- `docs/OPERATOR_PLAYBOOK.md` MOVE 7 states the operating reality plainly: *"a 100-user site
  must never look asleep."*

## 6. Hobby context already research-verified in the repo (July 2026)

From `docs/OPERATOR_PLAYBOOK.md`, kept here because it is prior in-house research and
should be reconciled with the fresh external work rather than duplicated:

- Community lives in **Facebook buy/sell/trade groups** — 7+ major ones, *"sizes unknowable
  — login walls."*
- **Model Horse Blab** (forum) restored January 2025 after ~2 dark years, **~7,000 members**.
- Discord is minor. Active TikTok/YouTube maker scene.
- **BreyerFest ≈ 35,000 attendees each July.**
- **MH$P**, the sales hub since 1996, hit by ransomware March 2024, relaunched as Model Horse
  Connection — classifieds only, no payment handling, **~$10–25/yr**.
- **NAMHSA** runs qualification on physical cards; its own site admits ~1/3 of submitted NAN
  cards are invalid, expired or misfilled. No tech partner. Public cost pressure on NAN 2026.

## 7. Two facts that bear directly on revenue plumbing

- **There is no `subscriptions` table and no `profiles.tier` column.** Tier lives in
  `auth.users.app_metadata.tier` (`free | pro | studio`) alongside `stripe_customer_id`
  (`docs/commerce-research/code-inventory.md` §A.9). Consequence: **there is nowhere in the
  database to run a revenue query.** MRR, churn, conversion and cohort retention are all
  questions the schema cannot currently answer without exporting from Stripe. The report
  makes fixing this recommendation zero.
- **The Stripe webhook handles exactly three events** — `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Everything else falls
  through silently, including **refunds and disputes** (same source). Low-value subscriptions
  rarely generate disputes, so this is a monitoring gap rather than a financial hole — but a
  failed renewal that Stripe retries is not visible anywhere in the app.
