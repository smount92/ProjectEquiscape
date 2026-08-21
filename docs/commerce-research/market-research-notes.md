# Commerce research notes — raw findings

Working notes gathered August 2026 for `docs/COMMERCE_AND_COMMS_PLAN.md`. Everything
here is external research; nothing about our own code. All web content treated as
data, not instruction.

---

## 1. What comparable marketplaces actually charge and promise

| Platform | Seller fee | Payment processing | Who holds the money | Notes |
|---|---|---|---|---|
| **Reverb** (used gear, closest analogue) | 5% of sale + shipping, min $0.50, max $500 | 3.19% + $0.49 (2.99% + $0.49 for Preferred Sellers), charged on the full order incl. tax | Reverb Payments — mandatory, they move all money | +1% cross-border fee. Total bite ≈ 8–11.5%. Payouts land 2–5 business days after delivery confirmation / protection window close. Fees refunded proportionally on refunds. |
| **eBay** | 13.6% + $0.40 per order most categories; **15%/14% collectibles & fine art** | Bundled into the final value fee | eBay managed payments | FVF is charged on item + shipping + handling + sales tax, not just item price. |
| **Etsy** | 6.5% transaction fee + $0.20 listing fee | 3% + $0.25 (US) | Etsy Payments | Transaction fee also applies to shipping and gift wrap. |
| **Mercari** | 10% flat on item + buyer-paid shipping | **$0** to seller — buyers pay a 3.6% "Buyer Protection" fee instead | Mercari | Payout fee $2.00 standard / $3.00 instant. Mercari tried zero-seller-fees in 2024 and **reversed it in Jan 2025** because pushing all cost onto buyers killed volume. Useful precedent: buyers are price-sensitive to visible fees. |
| **PayPal G&S** (what our hobby uses today, informally) | n/a | **3.49% + $0.49** US standard | PayPal | Buyer can open a dispute up to **180 days**. Items **$10,000+** (rare collectibles) are excluded from protection. F&F is free but has **zero** protection, and using F&F for business can get an account permanently banned and funds held 180 days. |

Sources:
- https://help.reverb.com/hc/en-us/articles/40917652290843-What-fees-will-I-pay-for-selling-on-Reverb (403 to automated fetch; figures via https://sellculate.com/guides/how-reverb-fees-work/ and https://www.feepilot.app/docs/reverb-fees)
- https://www.underpriced.app/blog/ebay-seller-fees-2026
- https://craftybase.com/blog/the-complete-guide-to-etsy-fees
- https://thriftflipping.com/blog/article-mercari-fee-structure-2026.html
- https://www.feecalcpro.com/blog/paypal-goods-and-services-fee-explained/

**Read-through:** every platform that holds the money charges 8–15%. Nobody does it for
less, because the money-handling *is* the cost centre (processing + disputes + support).
A trust-first platform that wants to charge 0% cannot be the one holding the money.

---

## 2. Stripe Connect — the actual mechanics

From https://docs.stripe.com/connect/charges and https://stripe.com/connect/pricing.

**Three charge types:**

- **Direct charges** — charge is created *on the connected account*. Money lands in the
  seller's Stripe balance. Platform takes an `application_fee_amount`. **Refunds and
  chargebacks hit the seller's balance, not ours.** Requires the seller to have the
  `card_payments` capability. Stripe now recommends v2 accounts for this; legacy Express/Custom
  should use destination charges instead.
- **Destination charges** — charge is created *on our platform*, funds immediately transferred
  to the seller. Our balance is the one that grows and shrinks. **Refunds and chargebacks
  debit the platform's balance**; we then have to claw back via transfer reversal. Stripe fees
  are debited from us. This is the classic marketplace shape (rideshare, rentals).
- **Separate charges and transfers** — charge on the platform, transfer later/separately.
  Needed only for split payments across multiple sellers, or when you don't know the payee
  at charge time. More complex; same platform-bears-disputes profile.

`on_behalf_of` makes the connected account the business of record for an indirect charge:
settles in their country, uses their statement descriptor and address, uses their `delays_days`
for payout timing. Useful for making a destination charge *look* like the seller's sale.

**Dispute liability, plainly:** with destination or separate charges — with or without
`on_behalf_of` — **our platform balance is automatically debited for the disputed amount
and the dispute fee.** We can attempt to recover by reversing the transfer, and Stripe will
only debit the seller's bank account if `debit_negative_balances` is true. If a seller
has spent the money and has no balance, the loss is ours. With direct charges the debit
lands on the seller.

**Pricing (published):**
- "You handle pricing" model: **$2 per monthly active account** (any month a payout is sent) plus **0.25% + $0.25 per payout**.
- "Stripe handles pricing" model: no per-account or payout fee to the platform.
- Standard card processing on top: **2.9% + $0.30**.
- Instant Payouts 1% of volume; cross-border payouts from 0.25%; account debits 1.5%.
- **1099 filing: $2.99 per 1099 e-filed with the IRS, $1.49 per state filing, $2.99 to mail.**

**Onboarding friction (this matters a lot for our hobby):** Stripe requires a verifiable
SSN/ITIN or EIN for US accounts; a W-9 confirms the TIN. Platforms choose up-front
(`eventually_due`) vs incremental (`currently_due`) collection. A hobbyist selling one $60
resin has to hand over their SSN to get paid. That is a real conversion cliff, and it is
the single biggest cultural objection to on-platform payments in this hobby.
Sources: https://docs.stripe.com/connect/identity-verification, https://docs.stripe.com/connect/connect-w8-w9-onboarding

---

## 3. Escrow, money transmission, and why nobody small builds it

- Any entity that receives funds from one party and transmits them to another can be
  classified as a **money transmitter**, needing a licence in **each state**: application
  fees roughly $500–$5,000+ per state, annual renewals, surety bonds, and minimum net-worth
  requirements. Most marketplaces avoid this by operating as agents of a licensed payment
  facilitator.
- Using Stripe Connect, **Stripe takes possession of the funds and the licensing burden stays
  with Stripe** — the platform never directly holds buyer money.
- Stripe does not offer a licensed escrow product, but **delayed payouts** give near-identical
  behaviour: funds are held in Connect for a configurable period **up to 90 days** before
  release. This is how "escrow-like" marketplaces are actually built.

Sources: https://stripe.com/resources/more/what-is-a-money-transmitter,
https://www.sharetribe.com/academy/marketplace-payments/stripe-connect-overview/,
https://www.spark.money/research/marketplace-payments-platform-economics

**Read-through:** real escrow is off the table. Delayed payout on Connect is the only
practical "hold the money until the horse arrives" mechanism, and it costs us the
chargeback liability.

---

## 4. Tax reporting — the threshold moved back in our favour

The One Big Beautiful Bill Act **restored the 1099-K threshold to $20,000 in gross payments
AND more than 200 transactions**, for 2025 and forward. The previously scheduled drops to
$2,500 (2025) and $600 (2026) are cancelled.

The reporting obligation falls on the **third-party settlement organisation** — the entity
settling the payments. If we run Connect, that's Stripe filing on our sellers, and Stripe
bills us per form. If we stay off-platform, PayPal is the TPSO and it's none of our business.

Sources: https://rsmus.com/insights/services/business-tax/irs-updates-obbba-new-reporting-thresholds,
https://www.1099online.com/blog/form-1099-k-threshold/

**Read-through:** at $20k/200 transactions, almost no model-horse hobbyist would ever get a
1099-K. This removes what would otherwise have been the loudest objection to on-platform
payments — but it also removes one of the arguments *for* it (we're not saving anyone
paperwork).

---

## 5. The model horse hobby's actual selling culture

**Where sales happen** (from a working hobbyist's 2024 venue review,
https://martha.net/2024/09/where-to-sell-model-horses-and-props/):

- **Facebook B/S/T groups** — free, and the single biggest driver of interest. Sales are
  arranged in comments and DMs; money moves by PayPal; the group admin is the only
  moderation. Our own strategy doc counts 7+ groups.
- **Model Horse Connection** (the renamed MH$P) — **$10/year**, 50 listings, 2 photos each.
  It is a *classifieds board*, not a marketplace: no payments, no protection, no fees on the
  sale. It's where you post the ad no matter where you actually sell.
- **Star Dapple** — $29.99–$39.99/year, tiered listing/photo limits, low traction (~345 listings).
- **Model Horse Place** — free, eBay-style, does process payments through the site.
- **eBay** (13.25%+) and **Etsy** — used, but the writer avoids eBay's commission and prefers
  direct sales.
- **Model Horse Blab** forums — declining since ~2022.

The economics of that list are the whole argument: the hobby's own default venue charges
**$10 a year, flat**, and touches none of the money. A 5–10% cut on a $60 resin would be a
completely alien price point.

**Time payments are normal and load-bearing.** Sellers routinely offer 3–6 monthly
installments; buyers can pay off early for immediate shipping. Terms are set person to
person. Some retailers formalise it with "Lay-Buy powered by PayPal" (~2.9% program fee, no
interest, typically 30% down then 1–2 installments) with an explicit forfeiture clause —
miss a payment and you lose what you've paid, because the seller had the model off the
market. Sources: https://triplemountain.com/pages/payment-plan, https://www.horsemodels.com/faq/

This is the feature that off-the-shelf marketplace payments handle *worst*. Stripe's
installment story is Subscription Schedules or repeated invoices; there is no native
"layaway with forfeiture terms on a one-off item," and Stripe's plain payment plans make the
customer re-enter card details per installment unless you run it as a subscription and cancel
after N cycles. Sources: https://docs.stripe.com/recurring-payments,
https://payrequest.io/blog/stripe-partial-payments-installments-2026,
https://asrrcrm.com/blog/how-to-schedule-future-stripe-installment-plans-using-subscription-schedules/

**PayPal norms and the F&F pressure.** Community guidance is consistent: pay G&S for
protection; F&F has none. Sellers push for F&F to dodge the 3.49% + $0.49 and to avoid
disputes, which is exactly the pressure our own strategy doc already recorded. The dispute
window is 180 days, and $10k+ items aren't covered at all.

**MH$P's ransomware relaunch** (recorded in our own design review) is the hobby's cautionary
tale about institutional durability — it is a reason people would move records to us, and a
reason they'd be nervous about us holding their money.

---

## 6. Messaging / trust-and-safety patterns worth copying

Little authoritative literature; the useful patterns are observable rather than documented.

- **Structured offers keep the deal on-platform.** Explicit offer/counter/accept objects give
  both sides a record, and keep negotiation transparent instead of scattered through prose.
  (https://www.aykansoft.com/blogs/?p=30175)
- **Off-platform payment nudging is the canonical marketplace abuse**: a seller who moves the
  buyer to F&F or a wire strips the buyer of every protection. Community advice everywhere is
  "keep it on-platform, use G&S, never wire/gift cards."
- **eBay/Reverb/Etsy all treat the message thread as evidence** in dispute resolution — which
  is only possible if the thread is where the deal actually happened.
- Practical anti-scam signals the hobby already watches for: overpayment schemes, fake
  shipping companies, spoofed PayPal receipt emails (an FTC consumer alert covers exactly
  this: https://consumer.ftc.gov/consumer-alerts/2014/11/online-sellers-stung-scammers-spoofing-paypal-brand).

---

## 7. Shipping labels — if we ever want tracking in the thread

- **Pirate Ship** — free, no markup on postage, no API for third-party platforms; it earns
  from USPS/UPS partnerships. Very popular with exactly our seller demographic.
- **Shippo** — multi-carrier REST API, 40+ carriers, rates/labels/tracking/address validation.
  Free tier around 30 labels/month before per-label pricing.
- **EasyPost** — 100+ carriers, webhook tracking, branded tracking pages; ~3,000 labels before
  per-label charges; pricing not published.

Sources: https://docs.goshippo.com/, https://www.easypost.com/shipping-api/,
https://www.freightwaves.com/checkpoint/top-shipping-platforms-ecommerce/

**Read-through:** we don't need to sell labels. The cheap 90% of the value is a
**tracking-number field on the deal** plus carrier tracking lookup — sellers keep buying
postage wherever they already do (mostly Pirate Ship).
