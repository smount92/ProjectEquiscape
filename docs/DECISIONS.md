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
| Q1 | Does a page address change when an item's maker is corrected? | August: the maker part of the address stays forever. October (migration 232): it follows a maker correction, so old links break. | Keep 232 and add a redirect from the old address (needs a small slug-history table). |
| Q2 | How do changes reach the live site? | Repo docs: branches, never push to main. Practice: commit to main, batch pushes, push when the owner says. | Write down the practice: main, batched, owner says push. Emergency fixes go out at once. |
| Q3 | Does the design lead see new looks before they ship? | Playbook: mock, approve, build. A later note: review on live and roll back if needed. | Mock first for new pages and flows; small visual fixes are reviewed live. |
| Q4 | Can files pass through server actions? | Rule: never. Code: avatars and banners do, with a 4 MB limit. | Keep the avatar/banner exception, written down; everything else uploads directly to storage. |
| Q5 | Should Gold curators' corrections apply without any format check? | Gold auto-approves any correction; the code notes that the apply path does no vocabulary validation. Silver must pass format checks. | Gold passes the same format checks as Silver. A rank should skip the queue, not the rules. |

### Earlier decisions to re-confirm

| # | Decision today | Why it needs a look | Recommendation |
|---|---|---|---|
| Q6 | One admin: the single `ADMIN_EMAIL` account. | Expedient hard-code; the design lead cannot see admin. | A small admin list (role-based), when a second person needs it. |
| Q7 | The new linker is opt-in; the old picker is the default. | Trial running. | Set a date or a condition (for example, two weeks without a new linker bug) to make it the default and delete the old picker. |
| Q8 | No manufacturer → mold → release tree browsing ("don't rock the boat"). | Made before the Registry became the priority. | Revisit after the linker is the default; the data now supports it. |
| Q9 | Collector counts on reference pages count public horses only. | Changed from "all owners" in migration 145. | Keep public-only (privacy). |
| Q10 | Unlisted horses show no history to logged-out visitors. | "One-word change if wanted." | Keep. |
| Q11 | CSV import defaults new horses to public. | Agent-made default. | Default to the member's own default visibility setting. |
| Q12 | Want List private, country flags opt-in, cast-by per horse. | Taken with defaults after the artist feedback. | Keep. |
| Q13 | Free studios: 3 active commissions; the tier check fails open. | Made under pre-launch pressure. | Keep the cap; failing open is right for an outage. |
| Q14 | Prepaid prices: Pro $15/27/50, Studio $30/54/100 for 3/6/12 months. | Marked "proposed". | Owner sets. |
| Q15 | No account ban; suspend plus per-show bars. | Moderation scope after the Summerween troll. | Keep, but add a real ban if a suspended member returns. |
| Q16 | No comment threads on show pages. | Dated August, pre-launch. | Owner decides. |
| Q17 | Live (in-person) show judging is a target, photo shows only for now. | Timing never set. | Owner decides. |
| Q18 | Championship star thresholds. | Marked provisional. | Confirm before the season ends 2027-04-30. |
| Q19 | OMEQ card expiry rule. | An assumption; NAN card colours were recorded from memory. | Check with USOMHS and NAMHSA. |
| Q20 | Admin can still create legacy photo shows. | Keep or kill never decided. | Kill; hosts use the normal flow. |
| Q21 | National numbering (M-/H- numbers). | Research done, 8 decisions open. | Wait for NAMHSA. |
| Q22 | Photo model (sizes, quality, free categories). | 5 decisions open. | Owner decides. |

### Registry data formats (see `docs/STANDARDS.md` §3)

| # | Question | Today | Recommendation |
|---|---|---|---|
| Q23 | Do colour descriptions start with a capital? | 4,016 lowercase ("red chestnut"), 2,283 capitalized ("Bay"). | Capitalize the first letter only: "Red chestnut, star". Matches the rule for names. |
| Q24 | What happens to the 279 release titles that hold a description ("QVC With hang tag. Model shown has aftermarket base.")? | The import put the description into the title. | Keep the name in the title; move the rest to the release's notes. Owner reviews the list before the repair. |
| Q25 | Maker and artist names one or two letters apart (12 pairs, e.g. Brigitte / Brigette Eberl, Melody Peña / Pena). Typo or two people? | Each spelling has its own maker page. | Owner (or a member who knows) rules pair by pair; obvious typos merge to the more common spelling. |
| Q26 | 1,290 artist resins have no scale. | Shown with no scale. | Leave empty (unknown is honest) and invite members to fill it in from the reference page. |

---

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
- **The Roadmap tab is the backlog.**
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
