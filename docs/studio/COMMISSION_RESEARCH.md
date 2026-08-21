# Art Studio — Commission Research & Design Doc

**Date:** 2026-08-19
**Status:** Research complete; drives the `ws/art-studio` rebuild.
**Scope:** How commission work *actually* flows in the real world, how the model horse
hobby specifically does it, and what our existing Art Studio got wrong.

> Payments on Model Horse Hub are **off-platform**. Stripe is used only for Pro
> subscriptions. Nothing in this document should be read as a mandate to process
> money. We are building a **record of agreement + a business tracker**, not an escrow.

---

## 1. How commission work actually flows

Every credible source — general art-commission guides, contract templates, and the
purpose-built platforms (VGen, Artistree) — describes the same spine. The names differ;
the shape does not.

### 1.1 The canonical pipeline

```
  discovery ──▶ inquiry/request ──▶ quote/proposal ──▶ agreement ──▶ deposit
      │                                    │                            │
      │                                 (decline)                   (in progress)
      │                                                                 │
      └──────────────────── portfolio / queue state          WIP checkpoints ◀─┐
                                                                 │             │
                                                          awaiting approval ───┘
                                                                 │        (revisions)
                                                          final payment
                                                                 │
                                                            delivery
                                                                 │
                                                            completed
```

**Stage by stage, and what each stage is actually *for*:**

| Stage | Who acts | The real function |
|---|---|---|
| **Request / inquiry** | commissioner | Scope capture. Reference images, subject, size/scale, deadline, budget. Guides are unanimous that the artist asks clarifying questions here — so the request form should pre-answer them. |
| **Quote / proposal** | artist | The artist names a **price + timeline + terms**. Nothing is scheduled until this is accepted. VGen calls this a proposal with scope/timeline/pricing; contract templates call it the letter of agreement. |
| **Acceptance** | commissioner | Explicit, recorded, timestamped consent to *those specific* numbers. This is the single most important record for dispute resolution. |
| **Deposit** | commissioner | Universally 30–50% up front, "non-refundable once work begins." Covers materials and protects against client disappearance. |
| **In progress / WIP** | artist | Progress photos at agreed checkpoints. Guides stress early checkpoints (sketch, base coat) *because changes are cheap then*. This is the trust engine. |
| **Awaiting approval** | commissioner | Client signs off, or requests revisions within the agreed count. |
| **Final payment + delivery** | both | Final balance clears, then the deliverable ships. "Don't send the unwatermarked high-res before payment clears" is the digital analogue of "don't ship the horse before the balance lands." |
| **Completed** | both | Reviews/feedback both directions. The record becomes portfolio evidence. |

### 1.2 Queue & slot systems (the part most homegrown systems miss)

VGen's model is the clearest and is worth copying almost verbatim:

- A service has a **status**: `OPEN` / `WAITLIST` / `CLOSED` / `UNLISTED` / `DRAFT`.
- **Slots** = how many commissions the artist will accept before the service
  *automatically* flips from Open to Waitlist. Slots exist for **capacity and
  transparency**; explicitly they do **not** force first-come-first-served. The artist
  still reviews, accepts, or declines in whatever order they want.
- Requests land in a **queue** the artist triages. Declining is normal and expected,
  not a failure state.

Design consequence: *slots are a display + gating concept, not a reservation system.*
We count active commissions against a declared slot count and show
`3 of 5 slots filled`. When full, new requests are accepted as **waitlist** requests
rather than blocked outright — blocking outright destroys demand signal the artist
wants.

### 1.3 Terms of Service norms — the fields that actually matter

Across contract templates (Graphic Artists Guild letter of agreement, PandaDoc/Juro
commission agreements, working artists' public ToS) the recurring, *structured* terms
are a small, closed set:

| Term | Typical real-world value |
|---|---|
| Deposit | 30–50%, **non-refundable once work starts** (refundable before) |
| Revisions included | 1–3 at defined checkpoints; extras billed (~30% of price is a quoted figure) |
| Turnaround | Stated range, not a promise. "1–4 months" is normal in this hobby. |
| Rush orders | Usually explicitly **not accepted**, or surcharged |
| Kill fee / cancellation | 50% of fee if cancelled before final stage; 100% if the work is finished |
| Shipping / delivery | Who pays, insured or not |
| Rights / usage | Artist retains right to photograph and display the work |

**This is the key design insight for our rebuild: those are ~8 structured fields, not a
prose blob.** A text blob cannot be compared across artists, cannot be surfaced at the
moment of decision, and cannot be quoted into a specific commission's record. Structured
terms can be snapshotted onto the commission at quote time — which is what makes the
record dispute-proof.

### 1.4 How artists track the business side

The commission-tracker template market (Notion, Jotform boards, Google Sheets, Ko-fi
trackers) tells us exactly what artists want and currently have to build themselves:

- A **kanban/pipeline board** of commissions by stage, with a visual progress indicator.
- **Deadline alerts** on a dashboard.
- A **client request log** separate from the active job list.
- **Payment & delivery tracking** per job.
- **Income over time** — "which projects pay off, which months perform best."

Artists are currently gluing this together from spreadsheets. If our Studio dashboard
*is* that board, we replace the spreadsheet, and the artist has a reason to keep their
commission records on-platform even though the money moves elsewhere.

---

## 2. The model horse hobby specifically

Our users are not generic illustrators. They are customizers, finishwork artists, china
painters, and tack makers. The differences are material.

### 2.1 Vocabulary (use these words in the UI; do not invent our own)

| Term | Meaning |
|---|---|
| **OF** | Original Finish — untouched factory model |
| **CM** | Custom Model — a factory plastic model altered by an artist |
| **Custom / customizing** | Sculptural alteration: re-sculpting, repositioning, hair/mane work |
| **Finishwork** | The paint job: airbrush acrylics, hand-brushed acrylics, pastel pigments, colored pencil, sealant/gloss layers |
| **Prep / prepwork** | Seam removal, pinholes, warps, logo removal, dent filling, re-sculpting lost mold detail. **Priced separately.** |
| **Resin / artist resin** | Cast original sculpture, sold unpainted; needs prep + finishwork |
| **LSQ** | Live Show Quality |
| **Scales** | Traditional (~1:9), Classic (~1:12), Stablemate (~1:32), plus medallions, pewters, 3D prints |
| **Workmanship** | A live-show division judging *how well the model was crafted* — i.e. the artist's work is literally what's being judged |
| **Drybrush / etched / matte sealant** | Finishing technique vocabulary |

### 2.2 Pricing norms (for range presets and sanity checks)

Real published rate cards, 2026:

- **Traditional scale custom:** ~$500–$1,200 (up to $2,000+ for named artists / high complexity)
- **Classic scale:** ~$400–$1,000
- **Stablemate scale:** ~$150–$350
- **Medallions:** ~$150–$600
- **Finishwork only (repaint):** ~$600–$2,000 depending on coat complexity
- **Minor prep:** $15–$30. **Major prep:** $45–$60. Full prep from ~$150.
- Complexity drivers named repeatedly: **pinto markings, appaloosa spots, dapples,
  roaning** — i.e. price scales with *coat pattern*, not just size.
- **Turnaround: 1–4 months is normal.** Rush orders commonly refused outright.

Design consequence: services must be priced **per scale** and as a **range**, with prep
as a **separate line**, or the price display is a lie.

### 2.3 How the hobby takes commissions *today*

- Artists run their own Weebly/Wix/Squarespace pages with a **commission guidelines
  page** and an **email or Google Form request**.
- Availability is announced ad hoc — "slots open" posts on Facebook groups, personal
  sites, and sales pages. Waitlists are informal, often a private list the artist keeps.
- Sales/marketplace traffic runs through MH$P (now Model Horse Connection) and Facebook
  groups; **those are sales venues, not commission-management venues.** Nobody in the
  hobby has a pipeline tool.
- Trust is entirely reputational and word-of-mouth. There is **no portable proof of
  work** — an artist's evidence is scattered across their own site, Facebook photo
  albums, and other people's show result posts.

### 2.4 The thing only *we* can do

Show results are the hobby's currency of quality. A custom that wins in **Workmanship**
or takes NAN-qualifying ribbons is proof of the artist's skill in a way no portfolio
image is. **We already hold those records.** Horses on this platform carry a finishing
artist credit and accumulate show placings and titles.

So the killer feature of the artist page is not a gallery — it's a **receipts wall**:
> *These are the horses I finished. Here is what they won.*

No other commission platform on earth can render that, because no other commission
platform owns the show database. That's the differentiator and it should be the loudest
thing on the page.

---

## 3. The four points of view

### Commissioner / buyer
Wants: to know if the artist is **open**, what it will **cost** in their scale, how
**long** it will take, what happens if they need a change, and whether the artist is
**real and good**. Wants a record of what was agreed. Wants to see progress without
nagging. After delivery, wants the cost recorded against the horse — this is a
collection, and collections have books.

**Implication:** status + slots + per-scale price ranges + structured terms visible
*before* the request form. WIP thread visible. Vault hand-off at completion.

### Artist / seller
Wants: to control intake (open/closed/waitlist, slot counts), to quote without
committing until accepted, to decline gracefully, to see the whole pipeline at a glance,
to know what they earned this month, and to be credited on the horses they finished.
Does **not** want to be forced into first-come-first-served or into a payment rail they
didn't choose.

**Implication:** triage queue, quote-with-terms, kanban dashboard, income summary,
terms editor. Decline is a first-class action at every stage, not an error.

### The horse's owner (distinct from the commissioner!)
Sometimes the commissioner *is* the owner sending their own model. Sometimes the artist
sells a finished piece. Either way the horse ends up with a **provenance record**: who
prepped it, who finished it, when, and what it cost. `customization_logs` is the right
home for that and is currently dead weight.

### Platform / trust
Wants: no money handled, no liability for disputes, but a record so clean that disputes
mostly don't happen. Timestamped state transitions, immutable quote snapshots, both-sides
notifications, and no ability for either party to rewrite history. Trust features are
never paywalled (house precedent).

**Implication:** the state machine must be enforced **server-side**, transitions must be
**logged with actor + timestamp**, and the agreed quote must be **frozen** at acceptance.

---

## 4. What the current system got wrong

The v1 Art Studio (migrations 028/069/089/092, `src/app/actions/art-studio.ts`,
7 routes) was not a bad sketch — it was a sketch that had never been run. Nobody has
used it, and the audit shows why it would not have survived first contact.

### 4.1 Silent failures — three write paths that never landed

These are the reason "nobody has used it" is not surprising. Each fails **silently**:
RLS rejects the write, the action still returns `{ success: true }`, and the UI
cheerfully refreshes to show nothing changed.

1. **Notifications never fired.** All three notification sites did a raw
   `supabase.from("notifications").insert(...)` under the *user's* session. The
   `notifications` table has **no INSERT policy** (migration 014: "Service Role inserts
   only"). Every commission notification the system has ever tried to send was dropped
   on the floor. The house helper `createNotification` (service role, prefs-gated,
   never throws) existed and was not used.
2. **The commissioner could never approve their own commission.** `commissions` has
   exactly one UPDATE policy — `"Artist manages commissions"`, `auth.uid() = artist_id`.
   The `isClientApproval` carve-out in `updateCommissionStatus` (`review → completed`)
   passes the app-level check and is then rejected by RLS: 0 rows affected, no error.
   The commissioner's only meaningful action in the entire flow was a no-op.
3. **The verified-artist stamp never landed.** On `delivered` the action writes
   `finishing_artist` + `finishing_artist_verified` to `user_horses` — a row the artist
   does not own and has no RLS grant to update. Wrapped in try/catch, logged, ignored.
   The single most valuable trust signal in the product was writing to /dev/null.

### 4.2 The pipeline was the wrong shape

4. **There was no quote.** `createCommission` took the client's `budget` and wrote it
   straight into `price_quoted`. The **client set the artist's price**, and the artist's
   only move was to "Accept" a number a stranger made up. This inverts the one
   negotiation that every real commission flow is built around, and it is why the whole
   thing reads as a ticket tracker rather than a business.
5. **No agreement was ever frozen.** No `accepted_at`, no terms snapshot. If the artist
   later edited their terms blob, the historical record of what was agreed changed with
   it. There is nothing to point at in a dispute.
6. **Shipping was one status doing two opposite jobs.** `accepted → shipping` meant
   *the client ships their model to the artist*; `completed → shipping` meant *the
   artist ships the finished horse back*. Same status, opposite directions, and
   `shipping → in_progress` was the only way back. In a hobby where the physical model
   really does travel both ways, this made the queue unreadable.
7. **Public queue RLS and the query disagreed.** The `[slug]` page asks for
   `status IN ('accepted','in_progress','review')`; the policy only exposes
   `('accepted','in_progress')`. Anything in review silently vanished from the queue.
8. **Revisions weren't counted.** A revision request posted a timeline message and put
   the commission back to `revision`. Nothing tracked how many were used against how
   many were promised — the single most common source of commission disputes.
9. **Decline was artist-only and terminal-by-surprise.** The commissioner had no way to
   walk away, and cancellation had no notion of the kill-fee etiquette every real ToS
   defines.

### 4.3 Slots and terms were decoration

10. **`max_slots` was stored and never enforced or counted against intake.** Requests
    were accepted whenever `status !== 'closed'`; `waitlist` behaved identically to
    `open`; `slot_number` was never assigned by anything.
11. **Terms were a single `terms_text` blob.** Unqueryable, uncomparable, unsnapshottable
    — and therefore useless at the two moments that matter (choosing an artist, and
    resolving a disagreement).
12. **Price was one flat `price_range_min/max` for the whole studio.** In a hobby where
    a Stablemate is $150–350 and a Traditional is $500–1,200 and prep is billed
    separately, one range across all work is not a price — it's noise.

### 4.4 The portfolio wasn't a portfolio

13. **`/studio/[slug]` showed zero work.** Specialties chips, a price range, a turnaround
    range, a terms blob, and a queue of commission *types*. No images, no finished
    horses, no show records. The page that is supposed to sell the artist proved nothing.
14. **Both `/studio` and `/studio/[slug]` `redirect("/login")`.** An artist's portfolio
    page — the one URL they would paste into a Facebook group — was unreachable to
    anyone not already signed in. `artist_profiles`' SELECT policy is `TO authenticated`,
    so this was baked in at the database.
15. **`customization_logs` was write-only in practice.** It is read by the
    `v_horse_hoofprint` view (so it reaches the horse's timeline), but it carries no
    `commission_id` and no artist user id — only a free-text `artist_alias` — so it can
    never be joined back to the artist. Provenance existed and pointed nowhere.
16. **`financial_vault` was never touched by the studio at all.** The horse's money
    record and the money the owner actually spent having it painted were unrelated
    systems.

### 4.5 Housekeeping

17. `linkHorseToCommission` never checks that anyone involved owns the horse — the
    artist can link a commission to an arbitrary horse id, which is exactly what would
    then have driven the (dead) verified-artist stamp.
18. `posts.studio_id` exists, is indexed, is excluded from the global feed, and **has no
    writer and no reader**. The real WIP thread is `commission_updates`. We keep
    `commission_updates` and leave `posts.studio_id` alone.
19. Two components (`CommissionTimeline`, `CommissionBoard`) carry class names from a
    botched CSS codemod — `commission-relative`, `gap-4-dot`, `gap-4-content` — that
    exist nowhere in `globals.css`. The timeline rail simply doesn't render.
20. **Zero tests.** No `art-studio.test.ts`, no component tests. The only coverage is a
    responsive-layout e2e sweep that loads `/studio`.

### 4.6 What we keep

The **data** is sound enough to build on, and the rebuild is additive:
`artist_profiles`, `commissions`, `commission_updates` (a good append-only thread with
per-update client visibility), `guest_token` (a genuinely nice touch — share a
commission with a client who isn't on the platform), the `transactions` + `reviews`
hookup on delivery, and `customization_logs → v_horse_hoofprint`. All of it stays.

---

## 5. The pipeline we are building

**Statuses (commission-level):**

| Status | Meaning | Who can move it | Moves to |
|---|---|---|---|
| `requested` | commissioner submitted a request | artist | `quoted`, `declined` |
| `quoted` | artist attached price + terms + timeline | commissioner | `accepted`, `declined` |
| `accepted` | commissioner agreed to those terms; quote frozen | artist | `in_progress`, `cancelled` |
| `in_progress` | work underway; WIP updates posted | artist | `awaiting_approval`, `cancelled` |
| `awaiting_approval` | artist submitted work for sign-off | commissioner | `completed`, `in_progress` (revision) |
| `completed` | signed off, delivered | — | terminal |
| `declined` | artist refused, or commissioner refused the quote | — | terminal |
| `cancelled` | either party withdrew after acceptance (kill-fee territory) | — | terminal |

Rules derived from the research:
1. **Only the party the ball is with can advance the state.** Enforced in the server
   action, not the UI.
2. **Revisions loop `awaiting_approval → in_progress`** and are *counted* against the
   agreed revision allowance. The count is visible to both sides.
3. **Declining is normal.** Available to the artist at `requested`/`quoted` and to the
   commissioner at `quoted`. Never a dead-end error screen; always with an optional note.
4. **Cancelling after acceptance is different from declining** — it happens in kill-fee
   territory and both sides should see the agreed cancellation terms at that moment.
5. **The quote is frozen at acceptance.** Price, terms snapshot, and timeline become
   immutable on the commission row. The artist's *current* terms may change later; the
   commission keeps the ones that were agreed.
6. **Both parties are notified on every transition.** Dynamic import + try/catch —
   `createNotification` is server-only and must never be statically imported into a
   module a client component can reach.
7. **Deposits/payments are recorded, not processed.** A boolean + amount + a note, so
   the artist's tracker is accurate and the commissioner has a record. No card touches
   this system.

---

## Sources

- [Sharetribe — how to build an art commission marketplace](https://www.sharetribe.com/create/how-to-build-marketplace-for-art-commissions/)
- [Milan Art Institute — how commissioned art actually works](https://blog.milanartinstitute.com/what-is-an-art-commission/)
- [Milan Art Institute — art commission contract clauses](https://blog.milanartinstitute.com/art-commission-contract/)
- [Artsy Shark — tips for taking art commissions](https://www.artsyshark.com/2020/07/22/10-tips-for-taking-art-commissions/)
- [RedDotBlog — artist's guide to commission agreements](https://reddotblog.com/the-artists-guide-to-commission-agreements-how-to-protect-your-process-without-overcomplicating-the-experience/)
- [The Graphic Artists Guild — the letter of agreement](https://graphicartistsguild.org/the-letter-of-agreement/)
- [VGen Help Center — how the commission system works](https://help.vgen.co/hc/en-us/articles/12820045188119-How-does-the-VGen-commission-system-work)
- [VGen Help Center — limiting commission slots](https://help.vgen.co/hc/en-us/articles/12820276795415-Is-it-possible-to-limit-the-amount-of-slots-available-for-commissions)
- [VGen — for artists](https://vgen.co/for-artists)
- [Blue Unicorn Studios — model horse commission guidelines](https://blueunicornstudios.com/commission-guidelines)
- [She Moved to Texas — model horse showing: artist resins and customs](https://www.shemovedtotexas.com/model-horse-showing-artist-resins-and-customs/)
- [Model Horse Artisan Guide — customizers](https://modelhorseartisanguide.weebly.com/customizers.html)
- [Castella Studios — custom model horse commissions](https://www.castellastudios.com/commissions)
- [NAMHSA — merit awards program](https://namhsa.org/merit-awards/)
- [NAMHSA — core classlist recommendations](https://namhsa.org/core-classlist-recommendations/)
- [Jotform — artist commissions tracking board template](https://www.jotform.com/board-templates/artist-commissions-tracking-board-template)
- [Women in Arts Network — tracking income and costs as an artist](https://womeninartsnetwork.com/how-to-track-your-income-and-costs-as-an-artist/)
