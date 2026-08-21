# Commerce & Communications Master Plan

**Written August 2026 · for Sam and Amanda · research and planning only, no code changed**

This covers the four things that were asked about together — adding a horse, messaging,
the inbox, and payment — because they turn out to be one system. A sale on Model Horse Hub
starts with a listing (add-horse), happens in a conversation (inbox), and is recorded as a
transaction (Safe-Trade). Today those three are built to three different standards.

Supporting research, with links, is in [`commerce-research/market-research-notes.md`](commerce-research/market-research-notes.md).

---

## The short version

**Payments.** Don't become the money. Not now, and never as the default. The hobby's own
default sales venue charges **$10 a year, flat, and touches none of the money**; every
platform that *does* hold the money charges 8–15% of every sale. On a $60 resin that's
roughly $6 gone. There is no version of a percentage cut that reads as anything but a tax
to this hobby, and Discogs learned in 2023 what happens when a collector marketplace tries.

But "don't hold the money" is not the same as "do nothing about payment." The thing this
hobby actually struggles with is not card processing — it's **time payments**. Six monthly
installments arranged in a Facebook DM, tracked in nobody's spreadsheet, with a $400 resin
sitting off the market for half a year on a handshake. Nothing in the hobby gives either
side a shared, honest record of that. We can, for free, with no regulatory exposure at all.

So: **build the deal room first, add optional card checkout later, never make it mandatory.**

**Messaging.** The inbox is a chat app with a horse photo stapled to the top. The offer
lives in a card *above* the conversation and leaves no trace *inside* it — you can accept a
$300 offer and the transcript still reads like two people saying hello. Make the thread the
deal room: the horse pinned, every offer and state change written into the transcript as a
permanent entry, agreed terms and a payment schedule both sides can see, and plain DMs
working the same way with the deal parts hidden.

**Add-horse.** Three forms, ~4,500 lines, four hand-maintained copies of the same
"is this field required?" rule, and three different lists of what a valid condition grade
is. Fix it by making `assetFields.ts` the single source of truth and deriving everything —
the fields, the validation, the server-side checks, the CSV importer — from it. No database
migration. Ship it in slices behind a flag, keeping every DOM id, so nobody's muscle memory
breaks.

---

# 1. Where we are

## 1.1 The Safe-Trade system — better than we remembered

This is the pleasant surprise. Safe-Trade is not a stub. It is a complete, tested,
end-to-end flow with UI at every step:

```
Buyer makes offer  →  offer_made
Seller accepts     →  pending_payment
Buyer pays (off-platform) and says so   →  paid_at stamped
Seller confirms the money arrived       →  funds_verified + a 6-character claim PIN
Buyer redeems the PIN at /claim         →  completed
                                           ownership swaps, provenance updates,
                                           show cards follow the horse,
                                           the private vault is wiped,
                                           both sides can leave a review
```

The state graph lives in `src/lib/commerce/stateMachine.ts` — a genuinely well-written
file, pure logic, fully tested, with the exact refusal messages treated as a contract.
Money movement is guarded by atomic database functions. Inputs are validated at every
boundary. There is a forgery guard that stops anyone minting a fake "completed" sale to
farm reviews.

**Crucially, it was never escrow and never pretended to be.** The buttons say
"External Payment Sent" and "Acknowledge External Payment & Release." The safety copy in
`src/lib/safety.ts` says outright: *payments happen directly between you and the other
trader — Model Horse Hub never holds funds.* That honesty is an asset. Anything we build
next has to stay that honest.

## 1.2 What's half-built or broken

Found during this review. None of these are new work — they're existing things that don't
reach the user. Several are one-line fixes, and they matter because everything in this plan
sits on top of them.

| Thing | Status | Detail |
|---|---|---|
| **"Pending Sale" lock** | **Broken** | When a seller accepts an offer, the code sets the horse's status to `"Pending Sale"` — a value the database's own rule doesn't allow. The write silently fails and nobody checks. **The horse stays listed and other buyers can keep making offers on a horse that's already sold.** `src/app/actions/transactions.ts:781`. |
| **Declining an offer** | **Broken** | The decline path writes to a column (`updated_at`) that doesn't exist on the transactions table. Declining should throw a raw database error at the user. Migrations 099 and 133. |
| **"Community Trusted" badge** | **Fixed, not yet applied** | The badge query looked for a transfer status that the database can never contain, so it has been empty since the day it shipped and the badge has never appeared for anyone. Migration `169_market_completion.sql` fixes it — but 169 is the newest migration and needs to be applied by hand. |
| **Review prompts** | **Dead code** | `getReviewableTransactions()` is written, correct, and called from nowhere. There is no "you have a sale to review" prompt anywhere. Reviews only happen if someone happens to wander back to the thread. |
| **Deletion guard** | **Leaky** | Blocking a horse's deletion mid-sale is a check in application code, not a database rule, and it uses a query shape that errors out (and then fails *open*) when a horse has two competing offers. |
| **Blocking** | **Doesn't work where it matters** | The block check runs when a conversation is *created*, and nowhere else. Once a thread exists, a blocked person can keep messaging, keep ringing your notification bell, and keep triggering emails to you. The block dialog promises "They won't be able to message you." That promise is false for every existing thread — which is the only case where blocking matters. |
| **Message rate limits** | **Absent** | The platform has a working rate-limiter used by five other features. Messaging uses none of it. Nothing stops a script from opening a thread with every member and blasting them, each message costing us an outbound email. |
| **Message editing** | **Wide open** | The database rule that's supposed to let you mark messages read has no restriction on *what* you change. Either participant can rewrite the other person's messages, or re-point a whole conversation at a different horse. For a thread we want to treat as the record of a deal, that has to close. |
| **Attachment privacy** | **Leaky** | Every logged-in member can list the filenames and captions of every private DM attachment on the platform. The image files themselves are protected; the metadata isn't. |
| **Notification prefs** | **Half-honoured** | Turning off "messages" in settings silences the in-app bell and does nothing to the email. Every single message sends its own email — no batching, no digest, no unsubscribe link. |
| **Inbox performance** | **Won't scale** | Rendering the inbox loads *every message you have ever received* to compute previews and unread counts. Three separate unread-count implementations exist, two of them dead. |
| **Realtime chat** | **Fragile** | The line that enables live message delivery is commented out in the migration with a note saying "run this manually." A fresh database produces a chat that silently never updates. |
| **Add-horse server validation** | **Absent** | The two big forms write through actions with no schema validation at all — just an allow-list of column names. All validation is in the browser. |
| **Condition note** | **Silently dropped** | The edit form's "What happened?" note when you change a condition grade is passed to the server and never read. |
| **Promoted listings / boosted wanted ads / paid insurance report** | **Dead but purchasable** | Three live Stripe checkouts ($2.99, $1.99, $1.99) that charge real money for effects nothing consumes. The insurance PDF is free elsewhere. Prior audits said wire-or-delete. |

## 1.3 The three add-horse forms

| | Full form | Quick form | Edit form |
|---|---|---|---|
| File | `src/app/add-horse/page.tsx` | `src/app/add-horse/quick/page.tsx` | `src/app/stable/[id]/edit/page.tsx` |
| Lines | 1,922 | 530 | 2,070 |
| Shape | 4-step wizard | one card | one long scroll, 3 sections |
| State | ~60 separate `useState` hooks | a handful | ~60 again |
| Server validation | none | a real schema | none |
| Tests | one end-to-end happy path | none | none |

They share roughly 800 near-identical lines. The Show Bio block, the marketplace
status block, the visibility picker, the financial vault, the image-crop queue handlers,
and the attribute packing code are each written out twice, verbatim or nearly so, in the
full and edit forms. Two of the crop-queue helpers are byte-identical.

**Four independent copies of one rule.** "A model needs a name, a finish type, and a
condition grade unless it's a work in progress" is written out four times — three times
inside the full form alone, once in the edit form. Change it in one place and the other
three drift.

**Three different ideas of a valid condition grade.** The forms offer ten. The CSV
importer knows nine — it's missing "Play Grade," so a spreadsheet row saying "Play Grade"
is rejected as invalid even though the dropdown right next to it offers exactly that.

**There's also a fourth way to create a horse** nobody thinks about: the Help-ID flow
(`src/app/actions/help-id.ts:261`) inserts a horse directly with hardcoded defaults and
no asset category or visibility at all.

**`assetFields.ts` is closer to a wish than a schema.** It defines 10 field keys across
5 asset categories with `visible`, `label`, and `required` for each. In practice:
`required` is never read by anything. Only 3 of the 10 keys actually go through the
visibility check. Three fields render unconditionally regardless of what the config says.
And the config claims tack and props can have a condition grade while both forms hard-code
that control to models only — so tack can never get one. The file's own comment says its
validator is called before every database write. It isn't; it only ever runs in the browser.

## 1.4 What's genuinely solid — don't disturb it

- The Safe-Trade state machine and its atomic database functions.
- The transfer/claim system: 48-hour transfer codes and 30-day claim PINs, rate-limited,
  with the ownership swap, provenance write, card hand-off, and vault wipe all in one
  atomic operation.
- Provenance ("hoofprint") derived from real ownership history rather than a hand-kept log.
- The private financial vault — owner-only, never queried on public pages, wiped on sale.
- Stripe webhook handling for subscriptions, including two hard-won correctness fixes.
- The scam-warning regex that flags Venmo / Zelle / PayPal F&F / Cash App / wire transfer
  in the composer, with copy that's honest about us not being a payment processor.

---

# 2. Payments — the options, honestly priced

## 2.1 The constraint we're arguing with

The charter says **"no financial middleman."** The August design review agreed and put it
this way: the market's job here is *information and safety*, not transactions — and
**the restraint is the design.** The owner's standing rule is that **trust features are
never paywalled.**

This section takes that seriously rather than assuming it away — but it also takes
seriously that the question was asked, which means it's worth re-deciding rather than
inheriting.

## 2.2 The money math nobody puts in writing

A worked example, using real published fees, on a **$60 resin with $15 shipping**:

| Route | Seller receives | Buyer pays | Who has protection |
|---|---|---|---|
| **Today** — PayPal G&S, direct | $72.37 (3.49% + $0.49) | $75.00 | Buyer: PayPal, 180 days. Seller: partial |
| **Today** — PayPal F&F | $75.00 | $75.00 | **Nobody.** And it can get the seller banned |
| **Reverb-style** (5% + 3.19% + $0.49) | $66.62 | $75.00 | Both, platform-backed |
| **eBay collectibles** (15% + $0.40) | $63.35 | $75.00 | Both, platform-backed |
| **Mercari** (10%, buyer pays 3.6%) | $65.50 | $77.70 | Both, platform-backed |

So a full marketplace model costs this seller **$6 to $9 on a $60 horse** versus what they
net today. The hobby's own default listing venue — Model Horse Connection, the renamed
MH$P — charges **$10 per year, total, for 50 listings**, and takes nothing from the sale.

That is the price point we would be arguing against. It isn't close.

**Discogs is the cautionary tale.** In May 2023 Discogs raised its selling fee to 9% and
extended it to shipping costs. Sellers publicly reported netting $50 on a $53 record plus
$6 shipping, and some pulled their inventory entirely. Discogs spent the following year on
an apology tour and a seller advisory board. Model horses are a smaller, tighter, more
opinionated community than vinyl, and word travels faster.

## 2.3 Option A — stay off-platform, strengthen the trust rails

**What it is.** What we do now, but finished: the platform never touches money; it records
the deal, escorts it through defined steps, transfers the horse, writes the provenance, and
publishes reputation. Plus the new work in §3 — deal terms and a shared payment ledger.

**Buyer's view.** You browse, you message, you make a structured offer, you agree terms in
writing, you pay by PayPal Goods & Services like you always have (with our nudge saying so),
you mark it paid, the seller confirms, you get a PIN, the horse and its whole record land in
your stable. Your protection comes from PayPal, exactly as today — but now you also have a
timestamped record of what was agreed, and the seller's real reputation in front of you
before you send anything.

**Seller's view.** Nothing changes about how you get paid. No SSN handed to a payment
processor, no payout delay, no percentage. You get a listing, structured offers instead of
forty comment threads, a lock on the horse while the deal is live, an automatic provenance
entry, and a reputation that follows you.

**Platform risk and ops.** Effectively zero. We are not a money transmitter, not a
third-party settlement organisation, we file no 1099-Ks, we hold no funds, we eat no
chargebacks. Support burden is moderation and "he never shipped" complaints — which we
answer with the record and the review system, not with refunds.

**Hobby fit.** Perfect. This is what the hobby already does, made legible. It handles time
payments better than any payment processor would, because a time payment here is just a
schedule both parties can see and tick off.

**Effect on the existing Safe-Trade states.** None. Every state stays exactly as it is.
`pending_payment` and `funds_verified` remain the two self-attestation steps they already
are. This option is the only one that requires no changes to the state machine at all.

**The honest weakness.** Buyer protection is still PayPal's, not ours, and PayPal excludes
items over $10,000 — which does cover the top of this hobby's market. And we never see a
verified sale price, so the Blue Book stays dependent on self-reported numbers.

## 2.4 Option B — full Stripe Connect marketplace with a platform fee

**What it is.** Reverb's model. Sellers onboard to Stripe Connect. Buyers check out on our
site with a card. We take a percentage. Money is released to the seller after delivery.

**How it would actually be wired.** Three shapes exist and the choice determines who eats
the losses:

- **Direct charges** — the charge is created on the seller's Stripe account. The money lands
  in *their* balance. We take an application fee. **Refunds and chargebacks hit their
  balance, not ours.** Stripe recommends their newer v2 accounts for this.
- **Destination charges** — the charge is created on *our* account and immediately
  transferred onward. **Refunds and chargebacks automatically debit our balance**, and we
  have to claw the money back from the seller by reversing the transfer. If the seller has
  already spent it and their balance is empty, the loss is ours.
- **Separate charges and transfers** — only needed for splitting one payment across multiple
  sellers. Same loss profile as destination charges, more complexity.

The classic marketplace shape is destination charges. It is also the one that makes us
liable for every chargeback on the platform.

**"Holding the money until it arrives" is not escrow.** Real escrow means state-by-state
money transmitter licences — application fees of roughly $500 to $5,000+ per state, annual
renewals, surety bonds, minimum net worth. Nobody our size does this. What marketplaces
actually do is **delayed payouts** inside Stripe: funds sit in Stripe (whose licences cover
it) for a configurable period **up to 90 days** before release. Stripe holds it, not us.
That gets us escrow-like behaviour without the licensing — but only under Option B or C,
and only with the chargeback liability that comes with it.

**Buyer's view.** Better than today: card payment, a real dispute process, one checkout.

**Seller's view.** Materially worse than today, on four counts:
1. **They must give Stripe an SSN or EIN** and pass identity verification to get paid at
   all. For someone selling three horses a year, that is a conversion cliff, and in this
   hobby specifically it will read as intrusive.
2. **They lose 8–11% of every sale**, against $10/year on their current venue.
3. **Payout delay** — Reverb pays out 2–5 business days after delivery confirmation.
4. **Time payments break.** Stripe has no native layaway. You either run installments as a
   subscription and cancel it after N cycles, or send an invoice per installment and make
   the buyer re-enter their card each time. Neither handles the hobby's normal terms
   (variable down payment, pay-off-early-and-ship, forfeiture on default) without us
   building a scheduler ourselves.

**Platform risk and ops.** This is the real cost, and it isn't the engineering:
- **Chargebacks.** A single disputed $2,000 artist resin under destination charges debits
  our balance immediately. Chargebacks on collectibles are common — "not as described" is
  a matter of opinion about a hand-painted object.
- **We become the dispute court.** Every unhappy trade becomes a support ticket with a
  refund demand, and we're the one with the money.
- **Fraud.** Card-testing and money-laundering through marketplace listings are standard
  attacks. We'd need review tooling, payout holds for new sellers, and someone watching.
- **Tax paperwork.** Stripe bills $2.99 per 1099 e-filed with the IRS, $1.49 per state,
  $2.99 to mail. Though note the threshold now: the One Big Beautiful Bill restored the
  1099-K trigger to **$20,000 and 200+ transactions**, so almost nobody here would get one.
- **Direct platform costs** in the "you handle pricing" model: $2 per monthly active seller
  account plus 0.25% + $0.25 per payout, on top of card processing.
- Stripe Connect **doesn't support** India, China, Russia, or most of Latin America and
  Africa — 46 countries against PayPal's 200+. Overseas hobbyists would be locked out.

**Hobby fit.** Poor. And it fights the charter head-on.

**Effect on Safe-Trade states.** They'd be gutted. `pending_payment` and `funds_verified`
would stop being self-attestations and become Stripe webhook states. The PIN/claim flow
would become an automatic consequence of a webhook rather than a seller decision. That's
not necessarily bad engineering — but it's a rewrite of the one part of this system that
currently works well, in service of a business model the community will resent.

**Verdict: no.** Not as the default, not with a percentage cut, not now.

## 2.5 Option C — hybrid: optional on-platform checkout, Safe-Trade deals only

**What it is.** Off-platform stays the default and stays fully supported, forever. Sellers
who *want* card payments turn on a "Accept card payments" switch, onboard to Stripe, and
get a Pay button inside the deal room. Everyone else carries on exactly as today.

**The critical design choice: direct charges, not destination charges.** The seller is the
merchant of record. Money goes to their balance. **Their** account eats their refunds and
chargebacks, not ours. We collect an application fee if we choose to. This keeps the
platform out of the loss column, which is the entire reason to prefer this shape.

**Fee stance.** Start at **0% platform fee** — buyer or seller pays only Stripe's card
processing, which at 2.9% + $0.30 is *cheaper than PayPal G&S* at 3.49% + $0.49. That is
a genuinely honest pitch: "cheaper than what you use now, and the deal is tracked."
Revisit a small flat fee (not a percentage) only if volume ever justifies it.

**The feature that actually earns this: structured time payments.** This is the one thing
on-platform payments give this hobby that nothing else does. A payment plan becomes a real
object — 6 installments, $75 each, due the 1st, the horse locked and marked "on payment
plan," both sides seeing the same ledger, automatic charges against the buyer's saved card,
automatic reminders, and explicit written terms for what happens on a missed payment.
Today that arrangement lives in a DM and a seller's memory. Sellers in this hobby already
run these plans constantly, and the "Lay-Buy" services some retailers use charge ~2.9% for
a worse version of it.

**Buyer's view.** Optional card checkout with real dispute rights, or pay how you always
have. Installments that don't require re-entering a card every month.

**Seller's view.** Opt in only if you want it. If you don't, nothing about your life
changes. If you do: cheaper than PayPal, installments handled for you, and you keep control
because you're the merchant of record.

**Platform risk and ops.** Small and bounded. We're not liable for chargebacks under direct
charges. We're not holding funds. Ops cost is Connect onboarding support and the payment-plan
scheduler. The one real exposure is reputational: if a seller's Stripe account goes sideways,
it happened on our surface.

**Hobby fit.** Good, *because it's optional*. The moment it becomes mandatory it turns into
Option B and inherits all of Option B's problems.

**Effect on Safe-Trade states.** Additive, not destructive. `pending_payment` gains a second
way to be satisfied: instead of the buyer self-attesting, a Stripe webhook stamps `paid_at`
and (for full payment) auto-advances to `funds_verified`. Everything downstream — PIN, claim,
ownership swap, provenance, review — is untouched. The two paths converge before the horse
moves. That's the property that makes this safe to build.

## 2.6 Recommendation

**Option A now. Option C later, opt-in, direct charges, 0% to start. Never Option B.**

Reasons, in order of weight:

1. **The price point is unwinnable.** The competing venue costs $10/year flat. We cannot
   charge a percentage and be the community's platform.
2. **The trust rails are the product, and they must stay free.** The owner's rule that trust
   features are never paywalled is exactly right, and it means payments can never be the
   thing that makes the platform trustworthy. Payment is a convenience; the record is the
   product.
3. **The half-built things are worth more than the new thing.** Reviews nobody is prompted
   to leave, a Trusted badge that has never rendered, a "Pending Sale" lock that silently
   fails, blocking that doesn't block. Fixing those costs days and moves trust more than
   card checkout would.
4. **The unique feature isn't escrow — it's time payments.** Escrow is what a platform
   builds when it doesn't know its market. Time payments are what this market actually runs
   on and nobody has ever made legible. We can build the tracking half for free, today.
5. **Chargeback liability would be existential at our size.** One disputed high-end resin
   under the standard marketplace shape costs more than a year of Pro subscriptions.
6. **Nothing is being lost by waiting.** The 1099-K threshold went back up to $20k/200
   transactions, so on-platform payments save nobody paperwork. There's no deadline here.

### The phased path

**Phase 1 — the honest deal room (no money touched).**
Fix the broken locks. Structured offers written into the transcript. Agreed terms as a real
object: price, shipping method and cost, who insures, payment method, and — the new one — a
**payment schedule** the buyer ticks off and the seller acknowledges, with the horse locked
for the duration and a visible "on payment plan" state. Review prompts that actually fire.
The Trusted badge live. Blocking that blocks.

**Phase 2 — measure.** Instrument how many deals use a payment plan, how many stall, how
many end in a complaint. Ask sellers directly whether they'd take card payments at 0%
platform fee. This is a real decision gate, not a formality: if the answer is "no thanks,"
Phase 3 never happens and nothing is wasted.

**Phase 3 — optional card checkout (only if Phase 2 says yes).** Stripe Connect Express,
v2 accounts, direct charges, 0% platform fee, opt-in per seller, off-platform always
available. Installments become auto-charged against the plan built in Phase 1.

**Phase 4 — never.** Mandatory on-platform payment, or any percentage cut of a sale.

### One thing to do regardless

**Delete or wire the three dead paid upsells** — the $2.99 promoted listing, the $1.99
boosted wanted ad, the $1.99 insurance report. They charge real money for effects nothing
consumes, and the insurance PDF is already free elsewhere. Two prior audits said so. Pay-for-
placement is also off-culture for this hobby regardless of whether it worked.

---

# 3. Messaging and the inbox — the thread as the deal room

## 3.1 What's wrong with the shape today

The offer lives *above* the conversation, not *in* it. `OfferCard` renders at the top of the
thread showing current state; the message list below it has no idea any of it happened. Accept
a $300 offer and the transcript reads: "hi" / "hi". There's no record in the conversation of
what was offered, when it was accepted, what was agreed about shipping, or when payment was
claimed.

Everything else follows from that:
- A message is `content TEXT` and nothing more. No type, no payload. A photo message is
  stored with the literal text `"📷 Sent a photo"` as a stand-in.
- The horse reference is per-*conversation*, not per-message — you can't discuss two horses
  in one thread, and the subject can't evolve.
- `buyer_id` actually means "whoever clicked first." If a seller opens the thread, the
  header labels are backwards.
- Read state is a boolean on each message, unread counts are computed three different ways
  in three places, and marking-as-read happens as a side effect of rendering a page.

## 3.2 The target shape

**One thread per relationship-and-subject, with three layers stacked in it:**

1. **The pinned header** — the horse, its photo, price, condition, LSP/show record, the
   seller's trust chips (member since, N transfers, average rating, Community Trusted). Most
   of this already renders; it needs to survive scrolling and gain the deal state.
2. **The deal strip** — the current state in one line, with the one action available now:
   *"Offer $275 · waiting on seller"* / *"Accepted · payment 2 of 6 due Sep 1"* /
   *"Paid · waiting on seller to confirm."* This replaces the current `OfferCard`.
3. **The transcript** — messages *and* events, in one chronological stream. Every state
   change writes a permanent, non-editable entry: offer made, countered, accepted, declined,
   retracted, terms agreed, payment marked sent, payment confirmed, installment paid, PIN
   issued, horse claimed, sale completed, review left.

A plain member-to-member DM is the same thread with no horse and no deal strip. Same code,
same inbox, one less layer.

### Structured offers

Offer, counter, accept, decline — using the transaction states that already exist. Add
**counter-offers**, which today don't exist at all (the seller can only accept or decline).
A counter is just a new offer from the other side against the same horse; the state machine
already has everything needed.

Borrow the industry's expiry conventions rather than inventing: eBay's offers run 96 hours
with 24–48 hours on counters; Reverb's expire in 48. Our stale-offer cron already
auto-cancels at 7 days — tighten that to 72 hours and *show the countdown*, which turns a
silent timeout into a visible deadline that moves deals along.

### Agreed terms and the payment plan

A new object attached to the deal, written once both sides confirm:

- Final price, shipping method, shipping cost, who pays it, insurance, expected ship date.
- Payment method (PayPal G&S / other), stated plainly in the record.
- **Payment schedule**: number of installments, amount, due dates, and the terms on a missed
  payment — stated in writing rather than assumed. Each installment is a row both sides can
  mark and see: *due · buyer marked sent · seller confirmed*.
- The horse is locked to `Pending Sale` for the whole plan, with a badge on the listing so
  it's clear to everyone else why it's off the market.

This is the feature. It costs no money handling, no licences, no fees, and it's the single
thing this hobby does constantly and has never had a tool for.

### Safety rails

- Keep the risky-payment warning, but **evaluate it server-side on the stored message**, not
  just live in the composer, and flag repeat offenders for moderation instead of only warning
  the person typing.
- A one-time interstitial the first time a thread turns into a deal: what we do (record it),
  what we don't (hold money), and what protects the buyer (G&S, not F&F).
- **Enforce blocking on send**, not only on thread creation, and add a database function that
  can answer "have these two blocked each other" in both directions — today the rules make
  "did they block me?" unanswerable.
- **Report affordance in the inbox.** The reports table already accepts `target_type = 'message'`
  and the server action already handles it; there is simply no button anywhere.
- **Rate limits on sending and on opening new threads**, using the limiter five other
  features already use.
- **Server-side length cap** on message content. The 2,000-character limit is currently
  browser-side only.

## 3.3 Data-model deltas

All additive. No data loss, no rewrite of existing rows.

**`messages`** — add:
- `kind TEXT NOT NULL DEFAULT 'text'` — `text | photo | offer | offer_response | terms | payment | transfer | system`
- `payload JSONB` — the structured body for non-text kinds
- `edited_at`, `deleted_at TIMESTAMPTZ`
- partial index on unread rows (every unread query filters on exactly that and there's no index for it)
- a length constraint on `content`

**New `conversation_participants`** — `(conversation_id, user_id, role, last_read_at, muted, archived, joined_at)`.
This one table fixes four things at once: unread counts become "messages after my
`last_read_at`" instead of three JS reducers; the buyer/seller misnaming goes away (role is
derived from the *transaction*, not from who clicked first); mute and archive become possible;
and a moderator can be added to a disputed thread later without another migration.

**`conversations`** — add `last_message_at`, `last_message_preview`, `subject_type`. Index
`last_message_at` (the inbox orders by a column with no index today). Keep `buyer_id` /
`seller_id` populated during a transition period so nothing breaks, then retire them.

**New `deal_terms`** — one row per transaction: `shipping_method`, `shipping_cost`,
`shipping_paid_by`, `insured`, `expected_ship_date`, `payment_method`, `agreed_by_buyer_at`,
`agreed_by_seller_at`, `notes`.

**New `payment_installments`** — `(transaction_id, seq, amount, due_date, marked_sent_at,
confirmed_at, note)`. Phase 3 adds a nullable `stripe_payment_intent_id` and nothing else
changes.

**Triggers to add** (there are currently *no* triggers on conversations or messages, so all
of this is application code today and drifts whenever a write path forgets):
- bump `conversations.last_message_at` / `last_message_preview` on insert
- emit a system message into the transcript on every transaction state change
- keep `updated_at` honest

**Rules to fix:**
- Add `WITH CHECK` to both UPDATE rules so participants can't rewrite each other's messages
  or re-point a conversation at a different horse.
- Narrow the message UPDATE rule to read-state columns only.
- Narrow attachment visibility to thread participants.

**One thing to un-break outside the schema:** the line that enables live chat delivery is
commented out in migration 039 with a note saying to run it by hand. Put it in a real
migration.

## 3.4 Surfaces to build or change

| Surface | Change |
|---|---|
| `/inbox` | Rewrite the list query — it currently loads every message you've ever received. Read from `last_message_*` and `last_read_at`. Add tabs (Deals / Messages), search, archive. |
| `/inbox/[id]` | Pinned header, deal strip, mixed transcript. Cut roughly ten sequential queries down to two or three. |
| `ChatThread` | Render by message `kind`. Server-side safety check. Report button per message. |
| `OfferCard` | Becomes the deal strip; its state text stops rendering every terminal state as "❌ Offer Declined" (cancelled and declined look identical today). |
| New: `TermsPanel` | Propose / agree / view agreed terms. |
| New: `PaymentPlanPanel` | The installment ledger. |
| New: counter-offer | In `MakeOfferModal` and from the seller's side. |
| `MessageSellerButton` | Prefill a first message ("I'm interested in {horse}") — today it creates a conversation with zero messages, which renders as "No messages yet." |
| Header badge | Single source of truth from `last_read_at`; delete the two dead implementations; make the badge actually clear when you open a thread (today it stays stale for up to 30 seconds). |
| Notifications | Honour the message preference for email. Batch to a digest. Add an unsubscribe header. Move the send off the write path — a chat message currently waits on ~9 database queries and an email API call. |
| Dashboard | A "sales needing attention" panel — offers waiting on you, payments due, sales to review. This is where `getReviewableTransactions()` finally gets called. |

---

# 4. Add-horse unification

## 4.1 The goal

**One form engine, driven by one field registry, serving four consumers:** the full create
wizard, the quick add, the edit page, and the CSV importer — plus, for the first time, the
server actions.

Today the registry (`assetFields.ts`) describes 10 fields and is only partly obeyed; the
real rules live in four hand-written copies inside two files, and the importer has its own
third rule set. The prize isn't fewer lines. It's that **"what is a valid horse" is written
down once**, and the browser, the server, and the importer all read the same sentence.

## 4.2 The shape

**`assetFields.ts` grows into a real registry.** Each field gains: `type`
(`text | select | number | date | textarea | chips | catalog-ref`), `options` (pointing at
the existing shared lists rather than the ad-hoc arrays scattered through the forms),
`visibleWhen` (a predicate over category and current values, replacing the hard-coded
`isModel` checks), `requiredWhen` (which finally makes `required` mean something and kills
all four copies of the rule), `maxLength`, `importAliases` (the CSV header synonyms, moved
in from the importer), and `attributeKey` for the fields that live in the JSON attributes bag.

**One zod schema derived from it,** used in three places instead of zero:
- the browser, for live validation;
- **`createHorseRecord` and `updateHorseAction`, which have no validation today** beyond a
  column allow-list — this is a real security improvement, not just tidying;
- the CSV importer, which stops maintaining its own condition and finish lists. (The
  "Play Grade" bug disappears by construction.)

**Three components, all thin:**
- `useHorseForm(mode, category, initialValues)` — headless. Owns all state (replacing ~120
  `useState` hooks across two files), validation, dirty tracking, and the submit sequence.
- `<HorseFormFields section={...} />` — renders from the registry. The Show Bio block, the
  marketplace block, the visibility picker, and the vault each exist once.
- `<PhotoStudio mode={...} />` — the image pipeline, once. Slots, flaws, extras, crop queue,
  compression, upload-with-retry, reorder. This is the largest single duplication and the
  one where the two copies have already drifted: the edit form accepts `image/*` with no
  size check while the add form validates properly and accepts HEIC.

**Modes, not separate forms:**

| Mode | Layout | Sections |
|---|---|---|
| `create-full` | wizard | photos → reference → identity → vault |
| `create-quick` | single card | a curated subset |
| `edit` | scroll | photos (+ show photos, reorder) → identity → reference → vault |

Quick-add stops being a separate implementation and becomes the same engine with a shorter
field list — which incidentally fixes its inability to produce an "unlisted" horse and its
direct-from-the-browser database query.

## 4.3 How to ship it without breaking anyone

**This is the most-used flow on the site and it has almost no test coverage.** One end-to-end
happy path for the full wizard; nothing for quick-add, edit, or import. So the order matters
more than the design.

**Step 0 — build the safety net first (do not skip).**
Write characterisation tests against the *current* forms before changing a line: component
tests that fill in and submit each form and assert the exact payload sent to the server, for
each of the five asset categories. Extend the end-to-end suite to cover quick-add, edit, and
import. These tests describe today's behaviour, bugs included — their job is to scream if
tomorrow's behaviour differs.

**Rule for every step after this: the payload sent to the server must be byte-identical,
and the rendered DOM must be visually identical.** The existing e2e test drives the form
by DOM ids (`#step-1-next`, `#custom-name`, `#finish-type`, `#submit-horse`) and assumes the
model category's four-step layout. **Keep every id.** Renaming them is a silent break.

**Step 1 — extract pure logic** (no visual change, low risk). The attribute pack/unpack pair
that's currently maintained by hand as exact inverses in two files. The required-field rule,
once. The finish-type and condition option lists, imported rather than re-declared.

**Step 2 — extract the shared blocks.** Show Bio, marketplace status, visibility, vault. Each
is currently written twice and near-identical. Take the add form's version, prop the id
prefix, and swap both call sites. One block per pull request.

**Step 3 — extract `PhotoStudio`.** Biggest and riskiest. Take the add form's stricter file
validation as the shared behaviour — this fixes the edit form's missing size cap as a side
effect. Ship behind a flag and watch upload error rates for a week.

**Step 4 — introduce the registry-driven renderer** for the identity section, category by
category, starting with `other_model` (lowest traffic) and finishing with `model` (highest).
Fix the config-versus-form drift deliberately here rather than by accident: tack, props, and
"other model" gain the condition grade the config always said they should have. That is a
visible behaviour change and should be an explicit decision, not a side effect.

**Step 5 — fold in quick-add and the importer.** Same engine, shorter field list; importer
reads the registry's aliases and option lists.

**Step 6 — server-side validation.** Wire the derived schema into `createHorseRecord` and
`updateHorseAction`. Ship in log-only mode first: validate, log mismatches, don't reject.
After a week of clean logs, turn on enforcement.

**Risk controls throughout:**
- Feature flag `NEXT_PUBLIC_FORM_ENGINE`, both paths live, instant rollback.
- One slice per pull request, each independently revertible.
- No database migration in any of this — it is entirely a code refactor.
- Screenshot comparison before and after each slice (the visual QA sweep already covers
  `/add-horse`).
- Delete the dead code found along the way: the unused `PHOTO_STUDIO_SLOTS` constant, the
  unused `isModelLike` in both files, the never-read `AssetConfig.icon` and `StepDef.icon`.
- Fix the silently-dropped condition-change note while in there — it's declared, passed, and
  never read.
- Bring the Help-ID horse-creation path onto `createHorseRecord` so there stop being four
  ways to create a horse.

---

# 5. Sequencing

Sizes are rough calendar estimates for one focused developer, not guarantees.

| # | Phase | Contains | Migration? | Size |
|---|---|---|---|---|
| **0** | **Unbreak** | "Pending Sale" constraint; the decline path's phantom column; apply migration 169 (Trusted badge); the multi-offer deletion-guard bug; enforce blocking on send; message rate limits; server-side length cap; `WITH CHECK` on both update rules; narrow attachment visibility; put the realtime line in a real migration | Yes, small | **~1 week** |
| **1** | **Trust made visible** | Review prompts (wire the dead function); "sales needing attention" dashboard panel; counter-offers; offer countdown at 72 hours; delete-or-wire the three dead paid upsells | Code only | **~1 week** |
| **2** | **Form safety net** | Characterisation tests for all three forms × five categories; e2e for quick-add, edit, import | No | **~1 week** |
| **3** | **Deal room — schema** | `messages.kind`/`payload`; `conversation_participants`; `last_message_*`; `deal_terms`; `payment_installments`; triggers for last-message, system messages, `updated_at`; unread index | **Yes, the big one** | **~1–2 weeks** |
| **4** | **Deal room — surfaces** | Pinned header, deal strip, mixed transcript; inbox list rewrite; single unread source; terms panel; payment-plan ledger; report button; notification batching and prefs | Code only | **~2–3 weeks** |
| **5** | **Form unification** | Steps 1–6 of §4.3, one slice per PR, behind a flag | No | **~3–4 weeks** |
| **6** | **Decision gate** | Instrument payment-plan usage; ask sellers about card payments at 0% | — | — |
| **7** | **Optional checkout** *(only if 6 says yes)* | Stripe Connect Express v2, direct charges, seller opt-in, `paid_at` via webhook, auto-charged installments | Yes, small | **~3–4 weeks** |

**Dependencies:**
- 0 blocks everything. Building a deal room on a sale lock that silently fails is building
  on sand.
- 2 blocks 5. Do not touch the forms without the tests.
- 3 blocks 4.
- 1, 2, and 3 are independent of each other and can interleave.
- 7 depends on 3 and 4 (the installment ledger has to exist before it can be auto-charged).

**Migrations vs code-only:** only phases 0, 3, and 7 touch the database. Phase 3 is the only
substantial one, and it is entirely additive — new columns with defaults, new tables, new
triggers. Nothing is dropped and nothing is rewritten. The old `buyer_id` / `seller_id`
columns stay populated through a transition period.

---

# 6. Open decisions for the owners

Each has a recommendation. These are the ones that can't be decided from the code.

### 1. Do we ever hold money?

**Recommend: no — not in Phase 1, and never by default.** Keep the charter's "no financial
middleman" intact through the deal room work. Revisit at the Phase 6 gate, and if the answer
is yes, do it as **optional, seller-opt-in, direct charges** so the seller — not us — is the
merchant of record and carries their own chargebacks.

*What it costs to say yes instead:* 8–11% of sales against a competitor charging $10/year,
an SSN requirement for every seller, chargeback liability on our balance, and becoming the
dispute court for every unhappy trade.

*What it costs to say no:* buyer protection stays PayPal's rather than ours, and the Blue
Book keeps relying on self-reported prices.

### 2. If we ever do charge, what's the fee?

**Recommend: 0% at launch, and never a percentage of a sale.** At 2.9% + $0.30, card
processing alone is *cheaper* than PayPal G&S at 3.49% + $0.49 — the honest pitch is
"cheaper than what you use now." If it ever needs to pay for itself, use a **small flat
fee** (say $0.50 per completed deal), never a percentage. Percentages read as a tax on
someone's collection. Keep funding the platform through Pro subscriptions and by absorbing
show-holder overheads, which the design review already endorsed.

### 3. Do we build the payment-plan tracker in Phase 1, before any payment processing?

**Recommend: yes, and treat it as the headline feature.** It's the hobby's most common
arrangement, the one nobody has ever given a tool, and it costs us nothing regulatory
because we only *record* the schedule — the money still moves between the two people. It
also becomes the foundation that makes optional card checkout genuinely valuable later.

*The one thing to decide alongside it:* whether we state default terms on a missed payment
(the retailer norm is forfeiture of what's been paid) or leave it entirely to the parties.
**Recommend: leave it to the parties, but force them to write it down** — an unfilled terms
field is where disputes come from.

### 4. What do we do when a deal goes wrong?

**Recommend: we are the record, not the referee.** We don't arbitrate, don't refund, don't
judge who's right. What we do: mark the deal `disputed`, freeze the horse's state so nobody
can quietly relist or transfer it, preserve the transcript and the agreed terms as an
unalterable record, let both parties leave reviews, and give ourselves an admin view of
repeat offenders. This is defensible, cheap, and honest — and it's the only stance
compatible with not holding the money.

*The alternative* — actually adjudicating — requires either holding funds or having a
policy we can enforce, and we'd have neither.

### 5. Do we rebuild the conversation model properly, or patch it?

**Recommend: rebuild, once, in Phase 3.** The `conversation_participants` table fixes unread
counts, the buyer/seller misnaming, mute, archive, and future moderator access in one
additive migration. Patching around it means three more years of the current situation:
three unread implementations, backwards role labels, and read-marking as a side effect of
rendering a page. The migration is additive and the old columns can stay populated during
the transition, so the risk is genuinely low.

### 6. Do tack, props, and dioramas get condition grades?

**Recommend: yes.** The field config has said they should since it was written; both forms
hard-code the control to models only, so they never have. Fixing it during the form
unification is nearly free — but it's a visible behaviour change on the most-used flow on
the site, so it should be a decision rather than a surprise.

---

## Appendix — key files

**Commerce:** `src/lib/commerce/stateMachine.ts` (the state graph — read this first),
`src/lib/commerce/schemas.ts`, `src/app/actions/transactions.ts`,
`src/components/OfferCard.tsx`, `src/components/MakeOfferModal.tsx`,
`src/app/actions/parked-export.ts` (park/claim), `src/app/claim/page.tsx`

**Messaging:** `src/app/actions/messaging.ts`, `src/app/inbox/page.tsx`,
`src/app/inbox/[id]/page.tsx`, `src/components/ChatThread.tsx`,
`src/components/MessageSellerButton.tsx`, `src/lib/safety.ts`,
`src/lib/context/NotificationProvider.tsx`

**Forms:** `src/lib/config/assetFields.ts`, `src/app/add-horse/page.tsx`,
`src/app/add-horse/quick/page.tsx`, `src/app/stable/[id]/edit/page.tsx`,
`src/components/CsvImport.tsx`, `src/app/actions/horse.ts`,
`src/lib/csv-import/validation.ts`

**Payments (subscriptions only, today):** `src/app/api/webhooks/stripe/route.ts`,
`src/app/api/checkout/**`

**Migrations worth reading:** `044_universal_trust_engine.sql` (transactions + reviews),
`060_commerce_state_machine.sql` (the offer states), `018_hoofprint.sql` (transfers +
provenance), `009_native_inbox.sql` (conversations + messages),
`099_commerce_locks.sql` / `133_security_hardening.sql` (the atomic offer functions),
`169_market_completion.sql` (newest; fixes the Trusted badge)
