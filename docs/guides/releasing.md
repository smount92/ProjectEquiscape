# Releasing

One release = one milestone on the Backlog board = **one push to `main` =
one rebuild** of the website.

## While a release is being built

- Work happens on a release branch (`release-1`, `release-2`, ...). Push it
  as often as you like: GitHub runs every check (lint, types, tests,
  migration standards, dependency audit, build) and the website does **not**
  rebuild. Only `main` deploys (`vercel.json`, `git.deploymentEnabled`).
- Each ticket's commits name the ticket (`MHH-012: ...`).
- New migrations are collected and listed in the release ticket notes.

## Shipping it (owner says go)

1. **Checks are green** on the release branch (GitHub › Actions).
2. **Paste the release's migrations** into the Supabase SQL editor, in number
   order. Code works before they are pasted, but paste them first anyway so
   the new features are live the moment the site rebuilds. Admin › Ops shows
   each probe turn green.
3. **Run any repair scripts** the release calls for: dry run first, then the
   repair.
4. **Merge to `main` and push.** Vercel builds once.
5. **The live smoke test runs by itself** when the deploy finishes
   (GitHub › Actions › Live smoke test). GitHub emails the owner if it fails.
6. **Archive the milestone** on the board and start the next one.

## If a release breaks something

Vercel › Deployments › the previous production deploy › **Promote to
Production** puts the last good version back in about a minute, with no
rebuild. Then fix forward on a new branch.

## Owner setup (once)

- GitHub › Settings › Secrets › Actions: `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public values; the weekly Registry health
  report and the build use them).
- GitHub › Settings › Code security: turn on Dependabot alerts and Dependabot
  security updates.
- Optional: GitHub › Settings › Branches: protect `main` so it only accepts
  merges whose checks passed.

## Scheduled checks

| What | When | Where to look |
|---|---|---|
| Registry health report | Mondays | GitHub › Actions › Registry health (summary page); counts that rose are flagged |
| Dependency updates | Mondays | Dependabot pull requests; merge them into the next release |
| Supabase advisors | First of the month | Supabase › Advisors (security and performance); file a ticket for anything new |
