---
name: system-alert
description: Use when the system itself signals trouble with no member report - Sentry errors, a failed or silent cron, the Ops tab badge red (missing migration or secret), a Vercel cost or usage spike, slow pages, a failed deploy.
---

# Respond to a system alert

## Where to look

- **Admin › Ops**: Sentry issues from the last 24 hours, migration probes (red means a migration is not pasted yet), missing environment secrets.
- **Vercel**: deployments, function logs, usage. A failed build on main leaves the site on the last good deploy.
- **Crons** (`vercel.json`): refresh-market (daily), transition-shows (hourly), stablemaster-agent (monthly), ebay-price-signals (every 4 hours). Failures go to Sentry; **a cron that silently stops is not detected** - check its last run in Vercel.
- **Supabase**: database health and advisors (security and performance lints).

## Steps

1. **How many members does it hit, and since when?** One stale-deploy error is noise; the same error for many members is urgent.
2. **Red migration probe**: the owner pastes the migration (`add-migration`). Code feature-detects, so it should degrade, not crash; a crash is a bug.
3. **Error**: `investigate-bug`, with the stack trace as the reproduction.
4. **Cost spike**: check ISR writes and function invocations first. Layout-level caches must be long and cleared by tag (a 60-second layout cache once made every page revalidate per request).
5. **Deploy failed**: read the build log; never force-push to fix it.
6. Record what happened, and what would have caught it sooner, in a ticket.
