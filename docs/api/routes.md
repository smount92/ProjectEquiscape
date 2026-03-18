# API Routes

Model Horse Hub uses **Server Actions** as its primary backend. Only 6 API routes exist for cases where HTTP endpoints are technically required.

## Route Index

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/me` | GET | Session cookie | Returns current user data |
| `/api/cron/refresh-market` | GET | Vercel cron secret | Refreshes `mv_market_prices` materialized view |
| `/api/export` | GET | Session cookie | Generates PDF (Certificate of Authenticity or insurance report) |
| `/api/identify-mold` | POST | Session cookie | AI-powered mold identification from photo |
| `/api/insurance-report` | GET | Session cookie | Generates PDF insurance report for horse |
| `/api/reference-dictionary` | GET | None (public) | Returns reference catalog data for client-side search |

## Why These Are API Routes

Server Actions have two limitations that require API routes:

1. **Cannot handle GET requests** — PKCE auth callbacks and cron triggers must be GET endpoints
2. **Cannot stream responses** — PDF generation needs a streaming `Response` object

| Route | Why Not A Server Action |
|-------|------------------------|
| `/api/auth/me` | Must be a GET endpoint (middleware check) |
| `/api/cron/refresh-market` | Vercel cron hits a GET URL |
| `/api/export` | PDF streaming response |
| `/api/identify-mold` | Multi-part image upload to external AI |
| `/api/insurance-report` | PDF streaming response |
| `/api/reference-dictionary` | Must be a GET (pre-fetched by search component) |

## Cron Configuration

Defined in `vercel.json`:

```json
{
    "crons": [{
        "path": "/api/cron/refresh-market",
        "schedule": "0 6 * * *"
    }]
}
```

The cron endpoint validates the `CRON_SECRET` header to prevent unauthorized access.

## Auth Callback

The PKCE auth callback at `/api/auth/callback/route.ts` is handled separately from the API routes above. It:
1. Reads the `code` query parameter
2. Exchanges the code for a session via `supabase.auth.exchangeCodeForSession()`
3. Sets the session cookie
4. Redirects to the appropriate page

See [Auth Flow](../architecture/auth-flow.md) for the full flow diagrams.

---

**Next:** [Server Actions](server-actions.md) · [Route Map](../routes/route-map.md)
