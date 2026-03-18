# ADR 004: Materialized Views for Read Performance

**Status:** Accepted  
**Date:** February 2026  
**Deciders:** Project team

## Context

Two key features require aggregating data across many rows:
1. **Hoofprint™ Timeline** — Provenance events from 6 different source tables
2. **Blue Book Price Guide** — Market prices aggregated from completed transactions

Joining 6 tables in real-time for the timeline, or scanning all transactions for price aggregation, would be too slow for page loads.

## Decision

- Use a **regular VIEW** (`v_horse_hoofprint`) for the provenance timeline
- Use a **MATERIALIZED VIEW** (`mv_market_prices`) for market prices

## Rationale

### v_horse_hoofprint (Regular VIEW)
- Provenance data is read infrequently (only on passport pages) but must be up-to-date
- A regular view executes the UNION ALL at query time, ensuring freshness
- The query is bounded (per-horse), so performance is acceptable

### mv_market_prices (MATERIALIZED VIEW)
- Price aggregation scans all completed transactions — expensive live query
- Prices don't need real-time accuracy (hourly or daily is fine)
- A materialized view pre-computes the aggregation; reads are instant
- Refreshed daily at 6 AM UTC via Vercel cron → `/api/cron/refresh-market`

## Consequences

- Blue Book prices can be up to 24 hours stale (acceptable for a price guide)
- After a completed transaction, `refresh_market_prices` is also called directly (best-effort, non-blocking)
- The cron job must be configured in `vercel.json`
- Materialized view refresh requires admin privileges (no RLS bypass needed since it's a global read)
