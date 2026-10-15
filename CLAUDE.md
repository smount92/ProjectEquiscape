# Model Horse Hub

A home for the model horse hobby: members' stables, photo shows, a market,
a social feed, and the **Registry** (the catalog of molds, releases and
resins), which is the reason most people come. Next.js 16 (app router) on
Vercel, Supabase (Postgres + RLS + storage), Tailwind v4, vitest,
Playwright. Pushing to `main` deploys.

## Read first

- `docs/GLOSSARY.md`: the words we use (mold, release, set piece, the five rooms ...).
- `docs/DECISIONS.md`: what has been decided, and the open questions. Check it before changing how something works; add to it when the owner decides.
- `docs/STANDARDS.md`: how code, the database and Registry data should look, and what enforces each rule.
- `docs/workflows/README.md`: every way members report problems, and which workflow handles each.

## Workflows (skills in `.claude/skills/`)

| When | Skill |
|---|---|
| Any report from a member, host, judge, artist or buyer | `member-report` (sorts it into one below) |
| Something broken, wrong or missing on the site | `investigate-bug` |
| Registry data: facts, duplicates, molds, the suggestion queue | `registry-data-fix` |
| Rule-breaking content or people | `moderation-report` |
| A sale between members gone wrong | `deal-dispute` |
| Charges, tiers, refunds | `billing-issue` |
| Entries, results, cards, hosting | `show-problem` |
| Login, deletion, data export | `account-request` |
| Errors, crons, cost, failed deploys | `system-alert` |
| New ideas and changes | `feature-request` |
| Any schema change | `add-migration` |
| Tracking any work: create, start, finish a ticket | `ticket` |

## Tickets and releases

The board is Backlog.md: one markdown file per ticket in `backlog/tasks/`,
managed with the `backlog` CLI (`backlog browser` opens the kanban board).
Each release is a milestone and ships as **one push, one rebuild**. Work
that isn't on the board isn't tracked; create the ticket first.

## Hard rules

1. **Never write to the production database.** No service-role or mass-update scripts. Read with the public key; hand the owner SQL files. The owner pastes migrations and runs repairs.
2. **Data repairs** have a dry run, are expect-guarded, run in one transaction, and are measured with `node scripts/catalog-delta/registry_health.mjs` before and after.
3. **Never delete a catalog row a horse or want list points at.** Merge and repoint.
4. **Migrations** are numbered, re-runnable, probed in Admin › Ops, and the code works before they are pasted.
5. **Tests first** for bug fixes. The pre-commit hook runs the full suite; don't skip it.
6. **Never handle credentials** or members' passwords. Never move money.
7. **Draft, don't send**: replies to members and anything public go to the owner first.
8. **Push to main only when the owner says**; batch pushes, since each deploy costs build time.
9. **Look-see files** (`e2e/zz-look.*`) are deleted before commit.
10. **No personal data in the repo**: aliases at most, never emails, payments or private messages.

## Where things are

- Server actions: `src/app/actions/` · shared logic: `src/lib/<domain>/` · tests: `__tests__/` beside the code.
- Registry vocabulary: `src/lib/catalog/taxonomy.ts` (the only place scales, run types and the rest are defined).
- Migrations: `supabase/migrations/` · probes: `PENDING_MIGRATIONS` in `src/app/actions/admin.ts`.
- Data scripts: `scripts/catalog-delta/` (see its README).
- Admin console: `/admin` (Mailbox, Reports, Catalog, Ops ...).
- Guides: `docs/guides/` · architecture: `docs/architecture/` (ADRs in `adrs/`).
