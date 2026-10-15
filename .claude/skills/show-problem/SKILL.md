---
name: show-problem
description: Use for problems with a show - an entrant can't enter or sees the wrong eligibility, results or placings look wrong, a card is missing or wrong, a scratch or bar is disputed, a host can't run or close a show, a judge is stuck, or a sanctioning request.
---

# Sort out a show problem

The **host** runs their show; the site gives them the tools and keeps the
record. The owner steps in for site bugs and for MHH Sanctioned status.

## Who can do what

- **Host**: class list, entries, scratch, strike after results, bar a person, void a card, announce to entrants.
- **Admin**: Admin › Sanctioning (grant or dismiss qualifying status), Admin › Shows › overdue shows (nudge the host).
- **Entrants and judges** have no dispute button; they contact the host, or the owner through the contact form.

## Steps

1. **Find the show and the entry**: show link, class, horse, the member's alias.
2. **Is it the rules or the site?**
   - Rules (eligibility, one breed-halter class per horse, same-photo rule, judge conflict of interest, card rules): explain the rule and where it comes from. The site warns on edge cases; only the server refuses.
   - Site: a wrong eligibility label, a missing entry, a placing that did not save: `investigate-bug`. Show-entry logic is spread across many files; read the entry-flow decisions in `docs/DECISIONS.md` before patching one of them.
3. **Results or cards wrong**: the host corrects them; check that the card and the horse's Hoofprint followed. A card issued wrongly is voided by the host, never deleted.
4. **Host not responding** (overdue show): nudge from Admin › Shows; the owner decides anything beyond that.
5. **Wording**: never say "NAMHSA sanctioned" or "NAN-qualifying" for an online show. It is "MHH Sanctioned".
6. Reply to the member; copy the host when the host must act.
