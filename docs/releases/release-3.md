# Release 3: Registry cleanup

Branch `release-3` (the Registry Desk was integrated on `desk-integrated`).
Board milestone `m-3`, "Release 3 - Registry cleanup". One push to `main`,
one rebuild. How releases work: `docs/guides/releasing.md`.

The seven Registry fixes (MHH-074 to MHH-080) come from one volunteer
cataloguing Breyer Stablemates
(2026-10-15/16), checked against the live Registry before and after.

## What members will notice

- **Sets list under a mold only when they name that mold (MHH-074).** The
  linker and the mold page read a set's roster piece by piece, so "American
  Saddlebred" no longer counts as the Stablemate "Saddlebred". The
  Stablemate Saddlebred shows 28 lines in the linker instead of 45 (its 24
  releases and 4 sets that really include it). The same words in another
  order still count: "Morgan - Prancing" is the Prancing Morgan.
- **Searching a mold shows the mold first, then the sets that only list it
  (MHH-075).** On the Registry page those sets come last, under "Sets that
  include “Arabian Stallion”", in both the cards and the table. The old
  picker, the wishlist search and the linker's "Resins and other pieces"
  list use the same order.
- **Report a duplicate finds the duplicate (MHH-076).** The picker searches
  the way the Registry page does (a named mold brings its releases, "SM"
  and "G1" come off, punctuation is kept), shows up to 25 entries in a
  scrolling list, and gives each one its number, years, colour and mold,
  so look-alikes can be told apart. Entries on the same mold, then the
  same scale, come first among equally good matches; a model number can be
  typed on its own. Before anything is typed it lists the other entries on
  the same mold. The send button says what is missing ("Pick the entry to
  keep first", "Say how you can tell") instead of looking dead.
- **Years can be a range (MHH-077).** "Fill in what you know" and "Add my
  release" take 1976, 1995-1997, 1995–97, 1995 - 1997 or 1995 to 1997 and
  file the first and the last year; a backwards range is refused in words.
  "Suggest a new entry" has a "Last year (if it ended)" box. Everywhere a
  release's years show, a first year alone reads "1998", not "1998–", and
  a last year alone reads "–1997". An older year stored in words ("1990s")
  shows as written.
- **Every missing fact can be filled in, one after another (MHH-078).** A
  release row offers "add the colour · add the year · add the model
  number"; a filed fact reads "sent for review" (or "saved to the
  Registry" for a curator) and the others stay one click away. A set
  piece offers "add this piece's own row", which opens "Add my release"
  with the set's number, name and years already filled in.
- **A model number typed into a name moves to the number box (MHH-079).**
  "#5038 Silky Sullivan" with 5038 in the box files as "Silky Sullivan";
  with the box empty the number moves there; when the two differ, the
  form asks which is right. A number without "#" may be part of the name
  ("101 Dalmatians"), so with the box empty the form asks "Is that the
  model number?" instead of moving it. Same in "Add my release", and the
  server applies the rule to every new entry and title correction, moving
  a number silently only when it has a "#" or equals the box.
- **Search reads past punctuation (MHH-080, after migration 240 is
  pasted).** "Horspital Play Set" finds “Horspital” Play Set, "12 Piece"
  finds 12-Piece, "Lover's" finds Lover’s, and "Prancing Morgan" finds
  "Morgan - Prancing". Until 240 is pasted, search works exactly as today.

## What the owner will notice

- Admin › Ops lists migration **240 "Search reads past punctuation"**; it
  turns green once `catalog_items.search_key` exists.
- Fewer duplicate reports and title corrections that need fixing by hand:
  titles arrive without a leading model number, and years arrive as
  first/last pairs (the review queue shows `year` and `year_end` on new
  entries, and `release_year_end` on corrections).
- After pasting 240, `npm run gen-types` adds `search_key` to the types.

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

## Registry Desk, Phase 1 (MHH-084 to MHH-093)

The owner's ruling of 2026-10-16 hands the Registry's clean-up to vetted
Registry moderators. Phase 1 gives them a workspace, the **Registry Desk**
at `/catalog/desk`, and puts every Registry write through one writer that
records who did what and can undo it. Plan:
`docs/design/registry-desk-phase1-plan.md`. Built in three packages (A the
engine, B the Desk, C the lists) and merged on `desk-integrated`.

### What moderators will notice

- A **Registry Desk** link in the Registry masthead, shown only to
  moderators and the owner. Anyone else who types the address gets a plain
  not-found. Five tabs:
    - **Queue**: members' corrections, new entries and duplicates, oldest
      first, plus "Auto-applied" (curators' changes from the last week,
      with **Put it back**) and "Second looks" (merges waiting for
      someone else to confirm). Opening one holds it for 30 minutes.
      **Approve**, **Edit, then approve** (the member is told what was
      changed) or **Say no** with a reason the member reads. Nobody
      decides their own suggestion, and an artist doesn't decide
      suggestions about their own pieces.
    - **Mold view**: pick a mold, click through its releases (J/K or
      Prev/Next), and edit **every field**; Ctrl/Cmd+S saves. Re-file a
      release under another mold (its scale follows), merge two rows, or
      remove a row nothing points at. If someone saved the row in the
      meantime, the editor shows their version instead of overwriting it.
      Flags on each row say what looks wrong; an in-effect style rule
      offers a suggested fix with **Use this**.
    - **To-do**: work lists found by scanning the whole Registry (no
      colour, number in the title, wrong scale, set pieces missing ...),
      Stablemates first, with "I'm on it" and "Done".
    - **Rules**: the house style. One moderator proposes, three
      agreements put it in effect, the owner can veto.
    - **History**: every change with who made it and in which role;
      **Undo** within 30 days and **Looks right** on someone else's.
- Daily limits: 300 edits and approvals, 20 merge requests, 50 removals,
  10 rule proposals. A refused action says so in words.
- The draft guide, `docs/guides/registry-moderation.md`, explains all of
  this in plain words. **It is a draft for the owner to approve** before
  the first moderator is asked to read it.

### What the owner will notice

- **Admin › Members** has a Registry moderators strip (who holds a seat,
  since when, term end, last action) and **Make moderator** / **Remove** on
  member rows. Removing asks for a private reason; the badge comes off and
  the next Desk click is refused.
- The owner uses the Desk too, with no limits. The owner's merges apply at
  once (still undoable); a moderator's wait for a second look.
- **Bell alerts at once** for merges requested and applied, removals, a
  moderator hitting a limit, more than 100 changes in an hour, and one
  moderator undoing another. Links open `/catalog/desk/history` or
  `/catalog/desk?tab=second_looks`.
- **One digest a day** in the bell (from the 06:00 `refresh-market` run):
  how many changes, every removal and merge by name, and how many member
  suggestions wait in the Queue. Once any moderator is active, the
  per-suggestion pings stop; that last line is where they went.
- Merges now **keep members' sale reports and price flags** (MHH-093): the
  old merge deleted them. Machine price rows on a merged-away or removed
  row are dropped and re-collected; undo doesn't bring those back.
- `/catalog/changelog` names a moderator's change as such, and a removed
  entry's line has no dead link.
- Admin › Ops lists **242**, **243** and **244**; each turns green once
  pasted. Admin › Catalog's review still works and goes through the same
  writer.

### Before each update is pasted

Nothing breaks if the code ships first. Before 242 only the owner passes
the Desk's role check, History and claims are skipped, and the changelog
is written without the new columns. Before 243 the owner gets the old
one-way merge (not undoable) and moderators read "Merging and removing
open once the owner adds update 243." Before 244, Rules, to-do claims and
the digest say "Coming once update 244 is added."

### Granting the first moderator

After 242 is pasted: **Admin › Members**, search for the member by alias,
choose **Make moderator**. They get the Registry moderator badge and the
Desk link at once, for a 12-month term. Send them the approved guide
first.

### Small defaults to confirm (Package C)

- An "I'm on it" claim on a to-do list or row lasts **a day**.
- **Done** hides a row until the next check; if the problem is still
  there, it comes back.
- Each cached to-do list keeps **300 rows** (the count is the full count).
- A **quiet day sends no digest** (it is recorded, but the bell stays
  silent). A day with member suggestions still waiting in the Queue is
  not quiet (added at integration, so the owner hears when the Queue
  piles up).
- A rule that is **in effect stays in effect** if someone later takes back
  an agreement; only a veto or retiring it ends it.
- **Check again** (re-scan now) is limited to **6 an hour** per moderator.

## Go-live checklist (owner)

1. Push the branch, wait for CI to go green.
2. Paste **`supabase/migrations/240_registry_search_key.sql`** in the
   Supabase SQL editor. It is safe to paste twice. It adds a generated
   column to `catalog_items` (about 12,000 rows, rewritten once, well under
   a second; no `updated_at` is touched), a trigram index, and re-creates
   `search_catalog_fuzzy` with the same signature, grants and SECURITY
   INVOKER. Check afterwards (each returns rows, the last returns 0):
    ```sql
    SELECT title FROM public.search_catalog_fuzzy('Horspital Play Set', 5);
    SELECT title FROM public.search_catalog_fuzzy('Horse Lover''s Collection', 5);
    SELECT title FROM public.search_catalog_fuzzy('Prancing Morgan', 5);
    SELECT count(*) FROM public.catalog_items WHERE search_key IS NULL;
    ```
3. Paste **`supabase/migrations/241_vault_purchase_notes.sql`** (safe to paste twice): purchase
   notes in the Financial Vault. Admin › Ops shows 241 green once it is in.
4. Paste **`supabase/migrations/242_registry_moderators.sql`**: moderator
   seats, the History tables, the changelog's role column and suggestion
   claims. Admin › Ops shows 242 green.
5. Paste **`supabase/migrations/243_registry_merge_undo.sql`** (after 242):
   the removal archive and the merge, unmerge, remove and restore
   functions. Admin › Ops shows 243 green.
6. Paste **`supabase/migrations/244_registry_rules_todo.sql`** (after 242
   and 243): style rules, votes, to-do claims and the digest record.
   Admin › Ops shows 244 green. All three are safe to paste twice.
7. Merge to main and push. The live smoke test runs by itself.
8. `npm run gen-types` and commit the types (they gain `search_key`,
   purchase notes and the Registry Desk tables).
9. Look: `/catalog?q=Arabian%20Stallion&scale=Stablemate%20(1%3A32)` shows
   the mold and its releases, then "Sets that include “Arabian Stallion”".
10. Look: `/catalog/desk` opens the Desk for the owner; History shows
    nothing yet. Approve `docs/guides/registry-moderation.md`, then grant
    the first moderator in **Admin › Members** (see "Granting the first
    moderator" above).

## Decisions made in this release (to confirm)

Recorded in `docs/DECISIONS.md` as Q33 to Q36.

- Sets that only list a name go last **under a heading**, not just last.
- `search_key` is a generated column rather than a trigger and a one-time
  backfill: same result, can't drift, and the backfill would have stamped
  `updated_at` on every row.
- Release years run from 1900 (Hagen-Renaker, Hartland and Beswick predate
  Breyer) to next year plus one; a two-digit end takes the start's century.
- A bare four-digit year in front of a name ("2019 Holiday Horse") is a
  year, not a model number, unless it has a "#". Molds and artist pieces
  keep a leading number in their title, because they have no number field
  to move it to.

## Not in this release

- **Rows already stored the old way** are data, not code. Under the
  2026-10-16 ruling the Stablemate and set clean-up is the Registry
  moderators' work on the Registry Desk. What they will meet: 128 titles
  start with a model number (80 repeat the stored number, 39 have none
  stored, 9 differ), and some pieces sit under the wrong mold (for example
  #5904 Black and White Saddlebred is on the Stablemate American
  Saddlebred, beside the Saddlebred mold's own black pinto rows).
- **The new linker as the default (MHH-032, ruling Q7).** Items 1, 4, 5 and
  6 are linker bugs reported on 2026-10-15/16. Q7 counts two weeks with no
  new linker bug from 2026-10-15; whether this release restarts that clock
  is the owner's call. The `linker-default` branch touches the same two
  files (`ReferenceLinker.tsx`, `actions/linker.ts`) and will need a merge.
