# Release 2: Reports reach us

Branch `release-2`. Board milestone "Release 2 - Reports reach us". One push
to `main`, one rebuild. How releases work: `docs/guides/releasing.md`.

## What members will notice

- The contact form asks what it's about, and an error page's reference is
  attached for you. If sending fails, everything you typed is still there.
  Signed-in members find their name and email already filled in, a link
  can open the form on the right subject (/contact?category=report), and
  "Reporting a member or content" points to the 🚩 Report button. The
  browser checks the email address before sending, and the thank-you says
  "We'll reply by email as soon as we can."
- Members are told when a membership payment fails, and when a refund is
  on its way. Settings › Subscription has **Manage billing** (Stripe's own
  page: update the card, see receipts, cancel). For a member who pays
  through Stripe it is the main button, with "Compare plans" beside it, and
  links to /settings#subscription now land on that section.
- Entrants can write to a show's host from the site: "message the host" on
  the show page, "Ask the host" on each of their entries, and every bar,
  scratch or removal notice opens it. The message names the show and the
  entry, and lands in the ordinary inbox thread with the host.
- A notice that a host removed your entries, or asked you not to enter,
  now names the show: 'The host of "Summerween" has removed your entries,
  and you can't re-enter this show. You can message the host about it.'
- Drop-down menus on the contact and message-the-host forms match the
  other fields, and no longer make an iPhone zoom in.

## What the owner will notice

- A bell for every new contact message and every outside-show listing
  waiting for review.
- Admin › Mailbox shows Open / Resolved / All, what each message is about,
  the sender's account if they were signed in, and the error reference
  when they came from an error page (no more typing it). Older messages
  load on demand. The Mailbox badge and the pulse tile count **open**
  messages (what the Open filter lists); read/unread is only a detail on
  each card. The bell names the category in short ("Billing"). Resolved
  messages carry a "Resolved" chip, and a failed delete or load says so.

- A bell when Stripe refunds a member or a member opens a chargeback, with
  a link to the customer in Stripe. Refunds never cancel anyone by
  themselves: to end a member's access, cancel the subscription in Stripe.

- A bell when a member opens a Deal Room dispute; open disputes are counted in
  the console pulse, badge the Members tab, and are listed at the top of
  Admin › Members. Notification links now open the right admin tab, even
  when you are already on the console.

- Admin › Catalog › Hidden eBay prices: prices members reported as the wrong
  model, with "Show it again" (the member is told).
- Admin › Ops › Scheduled jobs: each job shows its last success and whether
  it is on time, late or failing.
- The review queue includes suggestions under review, and the Registry
  history records who approved each change.

## Go-live checklist (owner)

1. **Stripe dashboard, once:**
   - Settings › Billing › Customer portal: turn it on (allow updating the
     payment method, viewing invoices and cancelling).
   - Developers › Webhooks › the modelhorsehub.com endpoint: add the events
     `charge.refunded` and `charge.dispute.created` (the endpoint already
     receives the subscription and invoice events).
2. Push the branch, wait for CI to go green.
3. Paste this release's migrations in number order:
   - `235_report_targets.sql`: reports on show entries and Help ID, and
     hiding reported posts, replies and Help ID rows. Until it is pasted
     those reports say "not switched on yet" and Hide says to paste it;
     everything else works.
   - `236_contact_messages_triage.sql`
   - `237_cron_heartbeats.sql`
   - `238_stripe_notice_ledger.sql`: Stripe notices (payment failed, refund,
     chargeback) go out once, even when Stripe delivers an event twice.
4. Merge to main and push. The live smoke test runs by itself.

## Reports, start to finish (MHH-019, MHH-021 report half, MHH-024, MHH-025)

What members will notice:

- A small 🚩 Report on everything people make: feed posts and replies, barn
  threads and replies, profiles, private messages, horses (which covers
  their Market listing), show entries and Help ID requests and
  suggestions. Never on your own things. It opens a short form: pick a
  reason, add a note if you like.
- Whoever reported something hears how it ended: "we removed it", "we've
  dealt with it" or "it doesn't break the community rules". Never who, or
  what happened to anyone.
- A member whose post, message, horse page or entry is taken down is told
  so, with the contact page. Nothing is deleted: posts and Help ID rows are
  hidden, a message reads "removed by a moderator", a horse goes private
  (ending its listing), a show entry is scratched.
- A member who submitted a show to the calendar hears when it is approved
  or turned down, with the note you write. A host whose sanctioning
  request is dismissed hears it. A barn thread's author hears when barn
  staff mark it (In progress, Implemented, Not planned).
- A suspended member is told, with your reason and the contact page; an
  unsuspended member is told they are active again.

What the owner will notice:

- A bell for every new report, opening Admin › Reports.
- Each report card shows what was reported (its words or name), who made
  it, where it stands and an "Open it" link. Buttons that act: take it down
  (Hide the post, Remove the message, Make the horse private, Scratch the
  entry …), "Doesn't break the rules", "Dealt with another way" (needs a
  note), and "Suspend @alias…", which opens Members on that member. Every
  one closes the report with a note; a take-down closes every open report on
  the same content.
- **Wording you write is now read by members**: the suspension reason, and
  the note on an approved or rejected calendar show. The fields say so.
