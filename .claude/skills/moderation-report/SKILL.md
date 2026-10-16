---
name: moderation-report
description: Use when someone reports a person, post, comment, horse photo, listing, show entry or message for breaking the rules - harassment, spam, trolling, stolen photos, fake listings - or when the owner spots it.
---

# Handle a conduct report

## Tools we have

- **Admin › Reports**: each open report shows what was reported, who made it, and an "Open it" link. Buttons: take it down (Hide the post / reply / Help ID row, Remove the message, Make the horse private, Scratch the entry), **Doesn't break the rules**, **Dealt with another way** (note required), and **Suspend @alias…** (opens Members). Nothing is deleted; a take-down can be undone in the database by clearing `hidden_at` / `deleted_at`. Published show results can't be scratched from here: use Strike.
- **Admin › Members**: find a member by alias, **suspend** (reason required) or unsuspend. The member is notified, with your reason and the contact page.
- **Automatic notices**: the reporter hears "we removed it", "we've dealt with it" or "it doesn't break the rules" (never who or what); the member whose content came down is told, with the contact page.
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

- Old Paddock text posts (from before the unified feed) have no Report button: they aren't in `posts`, so they can't be hidden.
- A hidden note an owner wrote on their own horse still shows on the logged-out passport history (built by a function from migration 177).
- No Undo button for a take-down yet; clear the stamp by hand.

See `docs/workflows/README.md` for the gaps in how reports reach us.
