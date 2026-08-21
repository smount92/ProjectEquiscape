# API Routes

Model Horse Hub uses **Server Actions** as its primary backend. 18 API routes exist for cases where HTTP endpoints are technically required, plus two handlers that live outside `/api`.

## Route Index

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/callback` | GET | PKCE code | Exchanges PKCE code for session, sets cookie, redirects. **Not under `/api`** |
| `/api/auth/me` | GET | Session cookie | Returns current user data |
| `/api/beacon/view` | POST | None (public) | Object-metrics view beacon. Validates the entity type against a 7-value allow-list, rate-limits per IP in process memory, hashes the viewer with the daily salt, and calls `record_object_view`. **Answers 204 for success, junk and an unapplied migration alike** — a beacon can never be why a page misbehaves |
| `/api/checkout` | POST | Session cookie | Creates Stripe Checkout Session for Pro tier subscription |
| `/api/checkout/promote` | POST | Session cookie | Creates Stripe Checkout for promoted listing purchase |
| `/api/checkout/boost-iso` | POST | Session cookie | Creates Stripe Checkout for ISO feed bounty |
| `/api/checkout/studio-pro` | POST | Session cookie | Creates Stripe Checkout for Studio Pro artist tier |
| `/api/checkout/supporter` | POST | Session cookie | Creates Stripe Checkout for the Supporter tier |
| `/api/webhooks/stripe` | POST | Stripe signature | Handles Stripe subscription events (checkout.completed, subscription.updated/deleted) |
| `/api/cron/refresh-market` | GET | Vercel cron secret | Daily 06:00 UTC — refreshes `mv_market_prices` and `mv_trusted_sellers`, runs garbage collection (including the nightly purge of `object_view_scratch`), unparks expired transfers, cleans rate limits |
| `/api/cron/transition-shows` | GET | Vercel cron secret | Hourly — auto-transitions shows whose entry/judging windows have elapsed |
| `/api/cron/stablemaster-agent` | GET | Vercel cron secret | Monthly (1st, 09:00 UTC) — Pro-only AI collection analysis via Gemini |
| `/api/export` | GET | Session cookie | Generates PDF (Certificate of Authenticity) |
| `/api/export/show-tags` | GET | Session cookie (Pro) | Generates printable show tag PDF with QR codes |
| `/api/export/nan-cards` | GET | Session cookie | NAN card CSV export for collectors |
| `/api/export/show-results/[eventId]` | GET | Session cookie | Legacy photo-show results export |
| `/api/export/show-results-v2/[showId]` | GET | Session cookie | Shows v2 NAMHSA-format results export |
| `/api/insurance-report` | GET | Session cookie | Generates PDF insurance report for horse |
| `/api/reference-dictionary` | GET | None (public) | Returns reference catalog data for client-side search |
| `/serwist/[path]` | GET | None | Serwist service-worker asset handler. **Not under `/api`** |

> **Removed:** `/api/identify-mold` (AI mold identification) and `/api/checkout/insurance-report`
> no longer exist. The AI project was shut down, and the a-la-carte report checkout was retired
> by owner ruling — `/market/reports` is now a ledger of what you already own, and the report
> itself is reached from `/settings#insurance`.

## Why These Are API Routes

Server Actions have two limitations that require API routes:

1. **Cannot handle GET requests** — PKCE auth callbacks and cron triggers must be GET endpoints
2. **Cannot stream responses** — PDF generation needs a streaming `Response` object

| Route | Why Not A Server Action |
|-------|------------------------|
| `/auth/callback` | Must be a GET endpoint (PKCE redirect target) |
| `/api/auth/me` | Must be a GET endpoint (middleware check) |
| `/api/beacon/view` | Fired from a `keepalive` fetch as the page unloads — must survive navigation, and must be callable by anon |
| `/api/checkout*` (5 routes) | Creates an external Stripe Session with a redirect URL |
| `/api/webhooks/stripe` | External webhook — Stripe POSTs to this endpoint |
| `/api/cron/*` (3 routes) | Vercel cron hits a GET URL |
| `/api/export`, `/api/export/show-tags`, `/api/insurance-report` | PDF streaming response |
| `/api/export/nan-cards`, `/api/export/show-results*` | CSV streaming response |
| `/api/reference-dictionary` | Must be a GET (pre-fetched by search component) |
| `/serwist/[path]` | Service-worker asset served at a fixed path |

## Cron Configuration

Defined in `vercel.json`:

```json
{
    "crons": [
        {
            "path": "/api/cron/refresh-market",
            "schedule": "0 6 * * *"
        },
        {
            "path": "/api/cron/transition-shows",
            "schedule": "0 * * * *"
        },
        {
            "path": "/api/cron/stablemaster-agent",
            "schedule": "0 9 1 * *"
        }
    ]
}
```

The cron endpoints validate the `CRON_SECRET` header to prevent unauthorized access.

## Auth Callback

The PKCE auth callback at `src/app/auth/callback/route.ts` is handled separately from the API routes above. It:
1. Reads the `code` query parameter
2. Exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`
3. Sets the session cookie
4. Redirects to the appropriate page

See [Auth Flow](../architecture/auth-flow.md) for the full flow diagrams.

---

**Next:** [Server Actions](server-actions.md) · [Route Map](../routes/route-map.md)
