# Decisions

The decisions this site is built on, in one place. Before changing how
something works, check here. When the owner makes a new decision, add it
here in the same change.

**Status**
- **Confirmed**: the owner made this decision on purpose and it still holds.
- **To confirm**: it is how the site works today, but it came from an early, expedient, or agent-made choice, or two sources disagree. Listed under *Open questions* with a recommendation.
- **Superseded**: kept for history; the line says what replaced it.

Architecture decisions with long reasoning live in `docs/architecture/adrs/`.
This file is the index and the short form.

Harvested 2026-10-14 from the repo docs, the ADRs, and the working notes
kept by the AI assistant across sessions, then checked against the code.

---

## Open questions for the owner

### Sources disagree

| # | Question | What the sources say | Recommendation |
|---|---|---|---|

### Earlier decisions to re-confirm

| # | Decision today | Why it needs a look | Recommendation |
|---|---|---|---|
| Q8 | No manufacturer → mold → release tree browsing ("don't rock the boat"). | Made before the Registry became the priority. 2026-10-15: owner is open to it but wants to weigh what the community expects first. | Revisit after the linker is the default; the data now supports it. |
| Q27 | A market listing is reported as its horse; there is no separate "listing" report (MHH-019). | Agent-made in Release 2. The passport *is* the listing, so one report covers both and taking it down takes the listing down with it. | Keep. |
| Q28 | Taking reported content down never deletes it: posts, replies and Help ID rows are hidden (migration 235), a message shows "removed by a moderator", a horse goes private (ending its listing), a show entry is scratched (published results go through Strike). The member who made it is told which one, citing Community Conduct (Terms §6), with the contact page; the reporter hears only "we removed it", "we've reviewed your report and closed it" or "it doesn't break the rules", naming the item (MHH-024/025). | Agent-made in Release 2, following "never hard-delete member data". | Keep. Undoing a take-down is by hand for now (clear `hidden_at` / `deleted_at` / `moderation_hidden_at` / `moderation_scratched_at`); add an Undo if it is needed. |
| Q29 | A take-down sticks (235): a horse made private by a moderator is stamped and its owner can't make it public or list it; the stamp stays with the horse if it changes hands (the new owner contacts us). An entry scratched by a moderator keeps that horse out of that class, whoever owns it. A horse or entry its owner already hid or scratched can still be stamped. Only the site team can set or clear `messages.deleted_at`. | Agent-made in the Release 2 review fixes; otherwise every take-down could be undone by the member it was aimed at. | Keep. Revisit "the stamp stays through a transfer" if a buyer is caught by it. |
| Q30 | A horse take-down withdraws open offers (each buyer is told the horse is no longer for sale) and refuses while a sale is past the offer (payment pending or under way): the admin resolves that in the Deal Room first. | Agent-made in the Release 2 review fixes: money and a handover are between two members, so a report card shouldn't cut across them. | Keep. |
| Q31 | Hiding a barn thread or feed post deletes the notifications that point at it (they keep its title in every bell); hiding a reply deletes the notices that reply sent. Notifications are our words, not member data. | Agent-made in the Release 2 review fixes. Rewriting them would leave a dead link in the bell. | Keep. |
| Q32 | The member who made a report is told the outcome without any quoted words, names or titles ("Thank you for reporting that post. ..."). Only the owner of the content is told which item, with an excerpt of their own words. | Made in the Release 2 review: a member who reported abuse must not find it repeated in their own bell, and titles and horse names are member-written too. | Keep. |
| Q33 | A Registry search lists the rows that are, or sit on, what was typed first; sets that only list it among their pieces come last under "Sets that include …" (MHH-075). The duplicate picker puts the same mold, then the same scale, first among equally good matches, never over a better match (MHH-076). | Agent-made in Release 3. A heading reads better than sets silently last; same-mold-over-everything pushed an exact typed name to 16th. | Keep. |
| Q34 | `catalog_items.search_key` is a stored generated column (240), not a trigger plus a backfill. | Agent-made in Release 3: same result, can't drift from the title, and a backfill UPDATE would stamp `updated_at` (233) on every row. | Keep. |
| Q35 | Release years run from 1900 to next year plus one; a range's two-digit end takes the start's century ("1998-02" is 2002); the same year twice is one year (MHH-077). | Agent-made in Release 3. Hagen-Renaker, Hartland and Beswick predate Breyer's 1950; the old forms said 1950. | Keep. |
| Q36 | A leading model number comes off a title when it equals the number field, moves there when the field is empty, and the member is asked when they differ. A bare four-digit year leading a name ("2019 Holiday Horse") is a year, not a number, unless it has a "#". Molds and artist pieces keep a leading number, having no field for it (MHH-079). | Agent-made in Release 3, from STANDARDS (titles hold the name only). The form used to strip a mold's number and drop it. | Keep. |

---

## Rulings log

Owner rulings, newest first. Each one is also folded into the sections below.

**2026-10-16**
- **Registry clean-up is community-driven**: the Stablemate and set clean-up is done by vetted Registry moderators with the Registry Desk, not by owner rulings plus bulk repairs. More tools, but only for vetted members.
- **Founding moderators**: the owner hand-picks 2-3 now (the Stablemate volunteer first); applications and automatic seats come later (design doc Q1-Q4, Q15).
- **Second look**: single edits apply at once and are undoable; merges and batches over 25 rows wait for a second moderator or the owner; all undoable for 30 days (design Q5, Q6).
- **Removing rows**: any moderator may remove, alone, a row nothing points at (no horses, want lists, set pieces or child releases); it is hidden at once, undoable for 30 days, and listed in the owner's digest. Rows with anything attached are merged, never removed (design Q11).
- **Registry style rules** (set titles, auction rows, generation tags, title format) are written by moderators: one proposes, the others agree, and it takes effect unless the owner vetoes.
- **Defaults taken** for the other design questions (owner may override): public badge and name in the Registry history; "Registry moderator" and "Registry Desk"; 12-month term renewed in one click; Silver and Gold auto-approve stay; the admin Catalog tab stays until the Desk replaces it; daily digest plus alerts for merges, big batches and removals; artists can't approve suggestions about their own pieces.
- **Financial Vault**: a private "Purchase notes" field, and links in vault notes are clickable (member request).
- **Registry Desk mock approved** (https://claude.ai/artifact/BQuj11HRaMuYDfEy8succo), with one requirement: **every field is editable**, not only the few in the mock. The Mold view works as: pick a mold, click through its releases one by one, the release's full record opens below, edit, save.

**2026-10-15**
- **Artist names**: D'Arry Jones Frank, Sandra Winters and Pamela du Boulay are the right spellings; Maggie Jenner-Bennett is Maggie Bennett. The format repair merges the other spellings into these.
- **Default visibility**: Settings offers Public / Unlisted / Private for new horses, used by Add Horse, Quick Add and spreadsheet import (migration 234).
- **Tracker**: Backlog.md (task files in `backlog/`, kanban board) is the one tracker. The admin Roadmap tab's items move into it and the tab is retired. Ticket entry follows one written method so tickets stay consistent.
- **Q14 Prepaid prices**: Pro $15/27/50 and Studio $30/54/100 for 3/6/12 months stand; revisit if uptake stays low.
- **Q16 Show comments**: wanted eventually, and they must be premium: modern comment design, not a message board.
- **Q17 Live show judging**: the software exists; it waits for a host willing to test it at a real show.
- **Q18 Star thresholds**: confirm before the season ends (ticket due March 2027).
- **Q19 Card facts**: verify the OMEQ expiry rule and NAN card colours with USOMHS and NAMHSA (ticket).
- **Q20 Legacy photo shows**: remove admin creation of old-style photo shows.
- **Q21 National numbering, Q22 Photo model**: parked as tickets, taken up separately.
- **Q8 Tree browsing**: still open; the owner wants to weigh community expectations (ticket).
- **Q2 Going live**: fixes are batched locally and pushed on the owner's word; emergencies go out at once. Wanted next: a proper CI/CD pipeline with testing and auditing, and a kanban ticket system for long-term tracking.
- **Q3 Design approval**: a mock first for any new page or flow; small visual fixes are reviewed live.
- **Q4 Files through server actions**: never, except avatars and banners (4 MB).
- **Q6 Admin**: the admin pages are for the site's operator only (the owner). Other roles, such as Registry moderators, get their own tools, not admin.
- **Q9 Collector counts**: public horses only.
- **Q10 Unlisted horses**: no history shown to logged-out visitors.
- **Q11 CSV import**: imported horses take the member's own default visibility.
- **Q12 Artist-feedback defaults**: want lists private, country flags opt-in, cast-by per horse.
- **Q13 Free studios**: 3 active commissions; the check fails open.
- **Q15 Bans**: suspension and show bars for now; a real ban is a tracked ticket for later.
- **Q1 Page addresses**: a maker correction moves the page to the corrected address, and the old address forwards to the new one.
- **Q5 Trusted members**: Gold curators' corrections pass the same format checks as Silver. Also: a new **Registry moderator** role (see Registry below).
- **Q7 New linker**: becomes the default for everyone after two weeks with no new linker bug, counted from 2026-10-15; the old picker is then removed.
- **Q23 Colour descriptions**: first letter capitalized ("Red chestnut, star").
- **Q24 Descriptions in titles**: the name stays in the title; the rest moves to the release's notes (owner sees the list first).
- **Q25 Near-identical names**: merged into the more common spelling.
- **Q26 Resins with no scale**: left empty; members are invited to fill it in.

## Confirmed decisions

### The deciding rule (owner, 2026-10-15)
- **Which option produces a better product for the member?** Pick it, and accept more work to get there, unless it risks live data or completely changes an existing workflow. The bar is a premium experience, as if a team of twenty built and reviewed it; agents supply that review.

### Strategy
- **Registry first.** The Registry is the product and the moat. Shows are glue and a source of records, not the fight.
- **Everything in one place.** The hobby's data comes together here; outside feeds (eBay first) are welcome even if the sale happens elsewhere.
- **The horse's record is the product.** Shows produce records; cards travel with the horse when it is sold.
- **No AI features.** No AI identification, no member data sent to an AI service. Stablemaster runs without a language model.
- **No "no AI" statement** on the site; we can't control how other people judge.
- **NAMHSA wording.** Never "partnership", "sanctioned by NAMHSA", or "NAN-qualifying" for anything of ours. Ours is "MHH Sanctioned".

### Money
- **Cover costs, don't chase revenue.** Free / Pro / Studio Pro, monthly or prepaid.
- **Trust is never paywalled**: provenance, verification, condition and flaw photos, card verification, evidence pack, payment ledger.
- **The site never holds money.** No escrow, no selling fees. No paid boost or promote.
- **Tier of record** is the member's `app_metadata.tier`; `paid_through` is checked when read; a provider only revokes a tier it granted.
- **PayPal is its own path.** Never add PayPal to Stripe (Stripe cannot offer it to US merchants).

### Registry
- **One table, typed rows** (`catalog_items`: `item_type`, `parent_id`, `attributes`). See ADR 007.
- **One vocabulary owner**: `src/lib/catalog/taxonomy.ts` holds scales, run types and the rest. Nothing else defines them.
- **Identity, not titles.** A release is tied to its mold by `parent_id`; names are labels. "A release should be a release, and be tied to the mold correctly."
- **Merge, never strand.** Duplicates are merged so no member has to re-link a horse. Empty molds should not exist.
- **Repairs**: dry run first, expect-guarded, run by the owner, measured before and after (`registry-data-fix`).
- **Facts, not prose.** Take the facts, write our own sentences, credit sources, fetch politely.
- **Names**: capitalized, no trailing punctuation. Years go at the end of a title, still visible: "Name (2025)".
- **Release pages show their mold** and link to it.
- **Sets**: one row per piece, filed under the piece's own mold, full roster in the title.
- **Sculptor is the artist** for factory pieces, by design.
- **Never edit a row from a view that shows it under another parent.**
- **Reference pages** (`/reference/...`) are the public face; `/catalog/[id]` is the edit surface.
- **Addresses follow maker corrections**, and old addresses forward to the new one.
- **Curator ranks skip the queue, not the rules**: every auto-applied correction passes the format checks.
- **Registry moderators**: vetted members with the owner's Registry powers (add, edit, merge, bulk changes, remove unlinked rows) on the Registry Desk; founding seats hand-picked by the owner; merges and batches over 25 rows need a second look; everything undoable for 30 days. Design: `docs/design/registry-moderators.md`. Rulings 2026-10-16.
- **Registry style rules belong to the moderators**: proposed and agreed by moderators, owner veto. Members apply; seats open when the review queue backs up. Design first.
- **Formats**: colour descriptions start with a capital; titles hold the name only; one spelling per maker or artist; unknown scale stays empty.
- **eBay prices are asking prices**, never "sold". Minimum 3 listings. Currency is a label, never converted.

### Shows
- **Hosting is free.** Pro adds convenience only.
- **The site records NAN and OMEQ cards; it never issues them.** NAN cards last four years; the season runs 1 May to 30 April.
- **Never block an edge case in the UI.** Every horse is selectable; problems are warnings; only the server refuses.
- **Entry integrity**: nodes with entries are cancelled, not deleted; one breed-halter class per horse; same-photo rule; a judge can't enter their own show.
- **Scores inform, the judge places.**
- **Events are not shows.**

### Market and deals
- **Record, not referee.** Disputes freeze the deal and produce an evidence pack; the site does not judge.
- **Favorites are not the Want List.** Likes vs purchase intent.

### Stable and Studio
- **Soft delete** with Recently Deleted; history survives.
- **Folders**: the junction table is the truth; `membership.ts` is the only reader and writer.
- **Passport layout**: sticky gallery, 5:7 split. Record-board layouts were rejected.
- **Stable is what you own; the studio is what you made.** Commission cost is kept apart from purchase price.

### Security and privacy
- **Server action order**: validate (zod) → require auth → check ownership → write through RLS. The admin client only with a comment saying why.
- **Logged-out reads through SECURITY DEFINER functions restate the visibility checks.**
- **Count objects, never people.** No per-person analytics.
- **Blocks**: reads filter one way; sends are refused both ways.
- **Horse photos** are in a public bucket; privacy is enforced on the `horse_images` rows. Private files (papers, workbench) use signed URLs. *(ADR 006 is out of date on this.)*

### Process
- **Agents never write to the production database.** The owner pastes migrations and runs repair SQL; agents hand over files.
- **Migrations are pasted by hand**, re-runnable, with an Ops-tab probe; code works before they are pasted.
- **The full test suite runs before every commit.**
- **Single owner**: when several places decide the same thing, build one owner and delete the rest.
- **Long caches, cleared by tag**, for anything shared across pages.
- **Ship big changes opt-in** ("Try the new ..."), then make them the default and delete the old path and the flag.
- **The Backlog board is the one tracker** (`backlog/`, `ticket` skill). Each release is a milestone: one push, one rebuild.
- **Types are generated** (`npm run gen-types` → `database.generated.ts`). *(ADR 003 is out of date.)*

### Design and copy
- **Five rooms**: Stable · Shows · Market · The Paddock · Registry. Copy names the room.
- **Leather at the landmarks, parchment for the work.** Tokens only; the contrast guard runs in tests.
- **Plain hobbyist words.** Never describe a feature that isn't live as live.

---

## Superseded

- *A fixed list of five API routes* (ADR 001): there are more now; server actions remain the default.
- *Private bucket with signed URLs for horse photos* (ADR 006): see Security above.
- *Manual database types* (ADR 003): types are generated.
- *Gemini / AI analysis* (overview, deployment docs): removed; no AI features.
- *Hobby hosting tier, one cron* (deployment.md): Vercel Pro and Supabase Pro, four crons.
- *The 159-row duplicate collapse script*: superseded by the 2026-10-15 Registry repair.
