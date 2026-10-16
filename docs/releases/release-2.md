# Release 2: Reports reach us

Branch `release-2`. Board milestone "Release 2 - Reports reach us". One push
to `main`, one rebuild. How releases work: `docs/guides/releasing.md`.

## What members will notice

- The contact form asks what it's about, and an error page's reference is
  attached for you.
- Members are told when a membership payment fails, and when a refund is
  on its way. Settings › Subscription has **Manage billing** (Stripe's own
  page: update the card, see invoices, cancel).

## What the owner will notice

- A bell for every new contact message and every outside-show listing
  waiting for review.
- Admin › Mailbox shows Open / Resolved / All, what each message is about,
  the sender's account if they were signed in, and the error reference
  when they came from an error page (no more typing it). Older messages
  load on demand.

- A bell when Stripe refunds a member or a member opens a chargeback, with
  a link to the customer in Stripe. Refunds never cancel anyone by
  themselves: to end a member's access, cancel the subscription in Stripe.

- A bell when a member opens a Deal Room dispute; open disputes are counted in
  the console pulse and listed in Admin › Members. Notification links now
  open the right admin tab.

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
   - `236_contact_messages_triage.sql`
   - `237_cron_heartbeats.sql`
4. Merge to main and push. The live smoke test runs by itself.
