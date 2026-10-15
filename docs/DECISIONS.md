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

---

## Rulings log

Owner rulings, newest first. Each one is also folded into the sections below.

**2026-10-15**
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
- **Registry moderators** (planned): trusted members with the owner's Registry powers (add, merge, edit, bulk changes) in an admin-like tab. Members apply; seats open when the review queue backs up. Design first.
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
