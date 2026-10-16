# Release 2: Reports reach us

Branch `release-2`. Board milestone "Release 2 - Reports reach us". One push
to `main`, one rebuild. How releases work: `docs/guides/releasing.md`.

## What members will notice

- Members are told when a membership payment fails, and when a refund is
  on its way. Settings › Subscription has **Manage billing** (Stripe's own
  page: update the card, see invoices, cancel).

## What the owner will notice

- A bell when Stripe refunds a member or a member opens a chargeback, with
  a link to the customer in Stripe. Refunds never cancel anyone by
  themselves: to end a member's access, cancel the subscription in Stripe.

## Go-live checklist (owner)

1. **Stripe dashboard, once:**
   - Settings › Billing › Customer portal: turn it on (allow updating the
     payment method, viewing invoices and cancelling).
   - Developers › Webhooks › the modelhorsehub.com endpoint: add the events
     `charge.refunded` and `charge.dispute.created` (the endpoint already
     receives the subscription and invoice events).
2. Push the branch, wait for CI to go green.
3. Paste this release's migrations, if any (listed here as they are added).
   - `supabase/migrations/235_report_targets.sql`: reports on show entries
     and Help ID, and hiding reported posts, replies and Help ID rows.
     Admin › Ops shows 235 green once it is in (it probes `posts.hidden_at`);
     then run `npm run gen-types`. Until it is pasted those reports say "not
     switched on yet" and Hide says to paste it; everything else works.
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
