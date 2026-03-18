# ADR 001: Server Actions Over API Routes

**Status:** Accepted  
**Date:** January 2026  
**Deciders:** Project team

## Context

Next.js App Router offers two patterns for backend logic:
1. **API Routes** — Traditional REST endpoints at `/api/*`
2. **Server Actions** — `"use server"` functions callable from components

## Decision

Use **Server Actions** as the primary backend pattern. API Routes are reserved for the 5 cases where they are technically required.

## Rationale

- **Type safety end-to-end:** Server actions share TypeScript types between client and server without serialization boilerplate
- **No API route maintenance:** No REST controller layer, no request/response parsing, no URL routing
- **Co-location:** Backend logic lives alongside the features that use it
- **Next.js optimization:** Server actions are POSTed by the framework with automatic request deduplication

## Consequences

- All 35 backend files are `"use server"` action files rather than API routes
- Server actions cannot stream responses (hence PDF export uses an API route)
- Server actions cannot handle GET requests (hence PKCE callback uses an API route)
- Testing requires mocking the Supabase client rather than HTTP requests

## Exceptions

5 API routes exist for technical reasons:
- `/api/auth/callback` — Must be a GET endpoint for PKCE
- `/api/cron/refresh-market` — Vercel cron must hit an HTTP endpoint
- `/api/export/[horseId]` — PDF streaming response
- `/api/identify-mold` — AI image analysis
- `/api/reference-dictionary` — GET reference data for search
