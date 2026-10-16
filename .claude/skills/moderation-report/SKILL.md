---
name: moderation-report
description: Use when someone reports a person, post, comment, horse photo, listing, show entry or message for breaking the rules - harassment, spam, trolling, stolen photos, fake listings - or when the owner spots it.
---

# Handle a conduct report

## Tools we have

- **Admin › Reports**: each open report shows what was reported, who made it, and an "Open it" link. Buttons: take it down (Hide the post / reply / Help ID row, Remove the message, Make the horse private, Scratch the entry), **Doesn't break the rules**, **Dealt with another way** (note required), and **Suspend @alias…** (opens Members). Both take-down and "Doesn't break the rules" ask to confirm. Nothing is deleted; a take-down can be undone in the database by clearing `hidden_at` / `deleted_at`, or `moderation_hidden_at` (and the horse's visibility) / `moderation_scratched_at` (migration 235). A held horse can't be made public or listed by its owner; a horse scratched by us can't be entered in that class again. A horse in a sale past the offer can't be taken down here: resolve it in the Deal Room first (the card links it); open offers are withdrawn and their buyers told. Published show results can't be scratched from here: use Strike.
- **Admin › Members**: find a member by alias, **suspend** (reason required) or unsuspend. The member is notified, with your reason and the contact page.
- **Automatic notices**: the reporter hears "we removed it", "we've reviewed your report and closed it" or "it doesn't break the rules", naming the item (never who, or what happened to anyone); the member whose content came down is told which one, citing Community Conduct (Terms §6), with the contact page.
- **Show hosts**: bar a person from one show, strike an entry, scratch, void a card.
- **Members**: Block (profile and DM). Blocks are invisible to the admin.
- There is **no account ban**. Ban evasion is watched with the new-accounts card, not IP tracking.

## Steps

1. **Look at the content itself**, with its link. Screenshot it before anything is removed - the record matters if it escalates.
2. **Decide which rule it breaks** (Terms, `/terms`). If none, dismiss with a note saying why.
3. **Pick the smallest action that stops it**: hide or remove the content, a show-level bar, then suspension. Suspension is for repeated or serious conduct.
4. **Tell both sides**: the bell does the basic notice for both. Anything more (which rule, a warning) is drafted; the owner sends.
5. **Check for a pattern**: other content by the same account, new accounts created right after, the same photos elsewhere.
6. **Record it**: the report note, plus a ticket if a tool was missing.

## Stolen photos and false credit

An artist credit the artist did not give: the artist can **disavow** it in
the Art Studio. Photo ownership disputes go to the owner with both members'
evidence; the site keeps the record and does not judge who owned a model
historically.

## Known gaps

- Old Paddock text posts (from before the unified feed) have no Report button: they aren't in `posts`, so they can't be hidden. New ones can't be written any more (only the events the site records).
- No Undo button for a take-down yet; clear the stamp by hand.
- Withdrawing an offer in a horse take-down tells the buyer by bell but writes no line into the Deal Room transcript.
- If a host combines classes after we scratched an entry, the stamp stays with the old class, so the horse could be entered in the combined one.
- A few SECURITY DEFINER paths still see hidden rows: barn post counts (`get_barn_post_stats`), Help ID upvotes and accepting a suggestion, and the admin Paddock pin.

See `docs/workflows/README.md` for the gaps in how reports reach us.
