# API Routes

Model Horse Hub uses **Server Actions** as its primary backend. Only 15 API routes exist for cases where HTTP endpoints are technically required.

## Route Index

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/callback` | GET | PKCE code | Exchanges PKCE code for session, sets cookie, redirects |
| `/api/auth/me` | GET | Session cookie | Returns current user data |
| `/api/checkout` | POST | Session cookie | Creates Stripe Checkout Session for Pro tier subscription |
| `/api/checkout/promote` | POST | Session cookie | Creates Stripe Checkout for promoted listing purchase |
| `/api/checkout/boost-iso` | POST | Session cookie | Creates Stripe Checkout for ISO feed bounty |
| `/api/checkout/insurance-report` | POST | Session cookie | Creates Stripe Checkout for a-la-carte insurance report |
| `/api/checkout/studio-pro` | POST | Session cookie | Creates Stripe Checkout for Studio Pro artist tier |
| `/api/webhooks/stripe` | POST | Stripe signature | Handles Stripe subscription events (checkout.completed, subscription.updated/deleted) |
| `/api/cron/refresh-market` | GET | Vercel cron secret | Refreshes `mv_market_prices` materialized view |
| `/api/cron/stablemaster-agent` | GET | Vercel cron secret | Monthly AI collection analysis via Gemini |
| `/api/cron/transition-shows` | GET | Vercel cron secret | Auto-transitions expired shows from open→judging (every 6h) |
| `/api/export` | GET | Session cookie | Generates PDF (Certificate of Authenticity) |
| `/api/export/show-tags` | GET | Session cookie (Pro) | Generates printable show tag PDF with QR codes |
| `/api/identify-mold` | POST | Session cookie | AI-powered mold identification from photo |
| `/api/insurance-report` | GET | Session cookie | Generates PDF insurance report for horse |
| `/api/reference-dictionary` | GET | None (public) | Returns reference catalog data for client-side search |

## Why These Are API Routes

Server Actions have two limitations that require API routes:

1. **Cannot handle GET requests** — PKCE auth callbacks and cron triggers must be GET endpoints
2. **Cannot stream responses** — PDF generation needs a streaming `Response` object

| Route | Why Not A Server Action |
|-------|------------------------|
| `/api/auth/callback` | Must be a GET endpoint (PKCE redirect target) |
| `/api/auth/me` | Must be a GET endpoint (middleware check) |
| `/api/checkout` | Creates external Stripe Session with redirect URL |
| `/api/checkout/promote` | Creates external Stripe Session with redirect URL |
| `/api/checkout/boost-iso` | Creates external Stripe Session with redirect URL |
| `/api/checkout/insurance-report` | Creates external Stripe Session with redirect URL |
| `/api/checkout/studio-pro` | Creates external Stripe Session with redirect URL |
| `/api/webhooks/stripe` | External webhook — Stripe POSTs to this endpoint |
| `/api/cron/refresh-market` | Vercel cron hits a GET URL |
| `/api/cron/stablemaster-agent` | Vercel cron hits a GET URL |
| `/api/cron/transition-shows` | Vercel cron hits a GET URL |
| `/api/export` | PDF streaming response |
| `/api/export/show-tags` | PDF streaming response (Pro tier gated) |
| `/api/identify-mold` | Multi-part image upload to external AI |
| `/api/insurance-report` | PDF streaming response |
| `/api/reference-dictionary` | Must be a GET (pre-fetched by search component) |

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
            "path": "/api/cron/stablemaster-agent",
            "schedule": "0 8 1 * *"
        },
        {
            "path": "/api/cron/transition-shows",
            "schedule": "0 */6 * * *"
        }
    ]
}
```

The cron endpoints validate the `CRON_SECRET` header to prevent unauthorized access.

## Auth Callback

The PKCE auth callback at `/api/auth/callback/route.ts` is handled separately from the API routes above. It:
1. Reads the `code` query parameter
2. Exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`
3. Sets the session cookie
4. Redirects to the appropriate page

See [Auth Flow](../architecture/auth-flow.md) for the full flow diagrams.

---

**Next:** [Server Actions](server-actions.md) · [Route Map](../routes/route-map.md)
