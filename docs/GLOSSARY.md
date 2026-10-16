# Glossary

The words this project uses, and what each one means here. Use these
words in code, copy, docs, and conversations with members. When a word
changes meaning, change it here first.

## The site

| Word | Means |
|---|---|
| **The five rooms** | Stable · Shows · Market · The Paddock · Registry. The nav holds exactly these. Copy names the room, not the route. |
| **Stable** | A member's own horses (`/dashboard`). |
| **Shows** | Photo shows (and the live-show tools) hosted on the site. |
| **Market** | Horses for sale and wanted. The passport *is* the listing. |
| **The Paddock** | The social feed (`/feed`). Contains the **Show Ring** (`/community`), the public gallery of horses. |
| **Registry** | The public catalog of molds, releases, and resins (`/catalog`, reference pages at `/reference/[maker]/[slug]`). The reason most people come. |
| **More** | Everything outside the five rooms: **Barns** (groups), **Members** (`/discover`), **Events** (outside happenings, not shows), **Art Studio**, **Help ID**. |
| **Lamplight** | Night mode. |
| **Simple Mode** | The accessibility mode (bigger type, fewer controls). |
| **Leather Edition** | The design system: "leather at the landmarks, parchment for the work". |

## Registry

| Word | Means |
|---|---|
| **Catalog item** | One row of `catalog_items`. Its `item_type` says what it is. |
| **Mold** | A sculpture that a factory makes many releases from (`plastic_mold`). Releases hang under it by `parent_id`. |
| **Release** | One paint job / edition on a mold (`plastic_release`). Has a model number, colour, years, run type. |
| **Orphan release** | A release with no mold (`parent_id` null). |
| **Set / set piece** | A release sold as a group. Stored as one row per piece, each filed under its own mold, with the full roster in the title. |
| **Generation (G1, G2 …)** | Stablemate mold generations. The same name at G1 and G4 is two different molds. Written in the title as "Name (G1)". |
| **Scale** | The size line. Canonical list lives in `src/lib/catalog/taxonomy.ts` (`CANONICAL_SCALES`): Large Traditional (1:8), Traditional (1:9), Small Traditional (1:10), Classic (1:12), Pebbles (1:18), 1:20, Paddock Pal (1:24), Stablemate (1:32), Mini Whinnies (1:64), Venti, Curio, Micro Mini, Plush, Other. |
| **Run type** | How a release was sold: Regular Run, Special Run, BreyerFest, Collector's Club, Web Special, Store Special, Test Run, One of a Kind, Other (`RUN_TYPES` in taxonomy.ts). The original wording is kept as **run detail**. |
| **Maker** | Who made the item: the factory (Breyer, Peter Stone) or the sculptor of a resin. Drives the page address (`maker_slug`). |
| **Artist / Manufacturer** | For resins, the sculptor and the casting company, kept apart. For factory pieces the artist is the mold's sculptor by design. |
| **Artist resin** | A resin sculpture by an independent artist (`artist_resin`). |
| **Finish** | OF (original finish), Custom, Artist Resin, CM (customized by a maker). |
| **Reference page** | The public page for a catalog item, `/reference/[maker]/[slug]`. `/catalog/[id]` is the edit surface. |
| **Suggestion** | A member's proposed change to the Registry (`catalog_suggestions`): correction, new entry, photo, removal, duplicate. Reviewed in Admin › Catalog. |
| **Curator** | A member whose rank lets their corrections apply without review. |
| **Linker** | The Reference step of adding or editing a horse, where the member links their horse to a catalog row. There is the old picker and the new linker. |
| **Blue Book** | The price guide (`/market/guide`). eBay prices are *asking* prices and are never called sold. |
| **Registry Desk** (the Desk) | The Registry moderators' workspace, `/catalog/desk`: Queue, Mold view, To-do, Rules, History. Only moderators and the owner see it; it is not part of `/admin`. Guide: `docs/guides/registry-moderation.md`. |
| **To-do (list)** | A work list on the Desk, found by scanning the whole Registry with the same checks as `registry_health.mjs` (`src/lib/registry/checks.ts`): no colour, model number in the title, filed under the wrong scale ... "I'm on it" claims a list or one row for a day; "Done" takes a row off until the next check. |
| **Style rule** | A house-style rule for the Registry, written by the moderators (`registry_style_rules`): one proposes, and at 3 agreements (the owner's counts, the proposer's doesn't) it takes effect unless the owner vetoes. A rule can name a **suggested fix** (`src/lib/registry/fixes.ts`) that the Mold view then offers on every row it fits. |

## Stable and the horse's record

| Word | Means |
|---|---|
| **Passport** | A horse's page. Owner, public and anonymous views. |
| **Hoofprint** | A horse's permanent history: owners, shows, changes. Survives sale and deletion. |
| **Vault** | Private financial records for a horse. |
| **Recently Deleted** | Soft-deleted horses the owner can restore. |
| **Papers** | Pedigree / breeding certificates, private storage. |
| **Want List / Matchmaker** | What a member wants to buy, and the matching that finds it. **Favorites** are public likes, not intent. |

## Shows

| Word | Means |
|---|---|
| **Class list** | The structure of a show: divisions, sections, classes. |
| **Entry** | One horse in one class. |
| **Leg tag** | A horse's entry number within a show. |
| **Handler / proxy** | A person showing a horse on the owner's behalf. |
| **Callback ladder** | Class winners called back for section, division and show champion. |
| **Scratch** | The entrant withdraws. **Strike**: the host removes an entry after results. **Bar**: the host blocks a person from a show. |
| **NAN card** | NAMHSA's paper qualification card. Valid four years. The site records them, never issues them. |
| **OMEQ** | Online qualifiers run by USOMHS. Recorded, never issued. |
| **MHH card** | The site's own qualification card. Verified at `/cards/[code]`, travels with the horse when sold. **STAKES** card: from a class of 15+ entries and 6+ exhibitors. |
| **MHH Sanctioned** | A show the admin has granted qualifying status. Never say "NAMHSA sanctioned". |
| **Season** | 1 May – 30 April. |

## Market and deals

| Word | Means |
|---|---|
| **Deal Room** | A DM thread that grows into a deal: offers, signed terms, installment ledger. |
| **Evidence pack** | The frozen record of a disputed deal. The site keeps the record; it does not judge. |

## Art Studio

| Word | Means |
|---|---|
| **Work record** | An artist's credit on a horse. |
| **The Making** | The photo reel of work in progress. |
| **Workbench** | The artist's private work-in-progress area. |
| **Disavow** | An artist rejecting a false credit. |

## How we work

| Word | Means |
|---|---|
| **Migration** | A numbered SQL file in `supabase/migrations`. The owner pastes it into Supabase by hand. |
| **Probe** | The Ops-tab check that tells whether a migration has been pasted (`PENDING_MIGRATIONS` in `src/app/actions/admin.ts`). |
| **Repair script** | A SQL file in `scripts/catalog-delta/` that fixes data. Always paired with a dry run; the owner runs both. |
| **Expect-guard** | A repair writes a row only if it still holds the value we expected, so a re-run or a later edit is never trampled. |
| **Look-see** | A throwaway Playwright spec (`e2e/zz-look.*`) that walks a page as the test bot to confirm a change. Deleted before commit. |
| **Single owner** | One module decides one thing. When several places decide the same thing, build one owner and delete the rest. |
