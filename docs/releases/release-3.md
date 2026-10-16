# Release 3

Branch `release-3`. One push to `main`, one rebuild. How releases work:
`docs/guides/releasing.md`.

## Purchase notes in the Financial Vault

A member asked (2026-10-16) for somewhere to note where a horse was bought,
and for the links in the vault to be clickable.

### What members will notice

- Add Horse and Edit Horse have a **Purchase notes** box in the vault
  section, under the purchase date: "Where and from whom you bought it, a
  receipt or listing link, anything you want to remember." Up to 2,000
  characters, private to the owner like the rest of the vault.
- On the passport, the Financial Vault shows Purchase notes in a card of
  its own. Web addresses in Purchase notes and Insurance Notes are now
  links (they open in a new tab); line breaks are kept, and long notes are
  no longer cut off at the bottom of the vault.
- The stable CSV export has a **Purchase Notes** column, and the insurance
  report PDF prints a horse's purchase notes beside its purchase details.
- When a horse is sold or transferred, the seller's purchase notes are
  cleared, so the buyer never sees them.
- Before migration 241 is pasted, everything else in the vault still saves;
  a member who typed a purchase note is told "Purchase notes switch on
  soon" and asked to add it again later.

### Go-live step (owner)

Paste `supabase/migrations/241_vault_purchase_notes.sql` into the Supabase
SQL editor (safe to paste twice). Then confirm Admin › Ops shows 241 green,
and run `npm run gen-types`.
