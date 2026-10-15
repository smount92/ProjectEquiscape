# Release 1: Standards and Registry

Branch `release-1`. Board milestone "Release 1 - Standards and Registry
batch". One push to `main`, one rebuild. How releases work:
`docs/guides/releasing.md`.

## What members will notice

- Old Registry links keep working after a maker correction or a merge;
  they forward to the page's new address (needs migration 233).
- Resin pages with no scale say "Not recorded. Know it? Add it".
- "Suggest a new entry" offers the molds in the Registry as you type, so a
  new release is filed under the right mold; "#1838 Montana Harvest" in the
  title now moves the number into its own field, as intended.
- New Registry values arrive tidy: colours start with a capital, names lose
  stray punctuation, years are stored as numbers.
- Bulk edits can't take a horse in an active sale off the market.

## What changes behind the scenes

- Security: Next.js 16.1.6 → 16.3.8 (30+ advisories), other dependency
  fixes; production dependencies have no known vulnerabilities.
- The pipeline: checks on every branch, the site builds only from `main`,
  a live smoke test after each deploy, a weekly Registry health report,
  Dependabot.
- Standards enforced by tests: lint, app type check, migration rules,
  Registry vocabularies, cache tags, colour and action ratchets.
- Gold curators' corrections pass the same checks as Silver.
- The admin Roadmap tab and the legacy "Create Photo Show" box are gone.

## Go-live checklist (owner)

1. **GitHub settings** (once): Actions secrets `NEXT_PUBLIC_SUPABASE_URL`
   and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; turn on Dependabot alerts and
   security updates.
2. **Push the branch** (`git push origin release-1`) and wait for CI to go
   green. The website does not rebuild.
3. **Paste migration 233** (`supabase/migrations/233_registry_guards.sql`)
   in the Supabase SQL editor. If it prints a NOTICE, send it to the
   developer. Admin › Ops shows 233 green once the site is live.
4. **Registry format repair** (after 233): read
   `scripts/catalog-delta/review/registry_format_review_2026_10.md`, then run
   `registry_format_repair_2026_10_dryrun.sql`, then
   `registry_format_repair_2026_10.sql`.
5. **Merge to main and push.** Vercel builds once; the live smoke test runs
   on its own.
6. **Regenerate types** (`npm run gen-types`) so `catalog_slug_history` and
   `updated_at` enter the types, in the next release.

## Still open in this milestone

- MHH-005 CSV import visibility: needs a decision (see the ticket).
- MHH-018 code formatting: needs a go once no other branch or worktree
  holds unmerged work.
