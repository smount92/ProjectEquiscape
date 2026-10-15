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
- Settings › "New horses start as" Public / Unlisted / Private now really
  applies to Add Horse, Quick Add and spreadsheet import (it was saved but
  ignored before); spreadsheet import lets you pick for that import too
  (needs migration 234 for Unlisted).

## What changes behind the scenes

- Security: Next.js 16.1.6 → 16.3.8 (30+ advisories), other dependency
  fixes; production dependencies have no known vulnerabilities. The
  notable moves from `npm audit fix`: resend 6.9.3 → 6.33.0 (email),
  @sentry/nextjs 10.46 → 10.76.2 (error reports), sharp 0.34 → 0.35
  (images), zod 4.4 → 4.6, sanitize-html 2.17 → 2.18, serwist 9.5.7 →
  9.5.13 (the installable app). Step 6 below checks the first two.
- The pipeline: checks on every branch, the site builds only from `main`,
  a live smoke test after each deploy, a weekly Registry health report,
  Dependabot.
- Standards enforced by tests: lint, app type check, migration rules,
  Registry vocabularies, cache tags, colour and action ratchets.
- Gold curators' corrections pass the same checks as Silver.
- The admin Roadmap tab and the legacy "Create Photo Show" box are gone.

## Go-live checklist (owner)

1. **GitHub settings** (once):
   - Actions secrets `HEALTH_SUPABASE_URL` and `HEALTH_SUPABASE_ANON_KEY`:
     the public Supabase URL and anon key (the same values as
     `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
     Vercel). Only the weekly Registry health report uses them; the CI
     build never touches the real database.
   - Turn on Dependabot alerts and security updates.
   - Make sure a red CI can't go live: protect `main` (Settings › Branches:
     require the `checks` job to pass), or turn on Vercel Deployment Checks
     (https://vercel.com/docs/deployment-checks).
   - The 28 old `ws/*` branches will keep making Vercel preview deploys
     until they are deleted (they predate the "only `main` deploys"
     setting). All of them are fully merged, so they are safe to delete on
     GitHub (the Branches page).
2. **Push the branch** (`git push origin release-1`) and wait for CI to go
   green. The website does not rebuild.
3. **Paste migrations 233 and 234** (`supabase/migrations/233_registry_guards.sql`,
   then `234_default_horse_visibility.sql`) in the Supabase SQL editor. If
   either prints a NOTICE, send it to the developer. Admin › Ops shows both
   green once the site is live.
4. **Registry format repair** (after 233): read
   `scripts/catalog-delta/review/registry_format_review_2026_10.md`, then run
   `registry_format_repair_2026_10_dryrun.sql`, then
   `registry_format_repair_2026_10.sql`.
5. **Merge to main and push.** Vercel builds once; the live smoke test runs
   on its own.
6. **Check email and error reports** on the live site: send yourself one
   transactional email (e.g. a password reset) and confirm one Sentry event
   arrives.
7. **Regenerate types** (`npm run gen-types`) so `catalog_slug_history` and
   `updated_at` enter the types, in the next release.

## Still open in this milestone

- MHH-018 code formatting: checked 2026-10-15, all 28 worktrees and every
  branch are merged with nothing uncommitted, so it runs as the last commit
  of this release, after the review fixes.
