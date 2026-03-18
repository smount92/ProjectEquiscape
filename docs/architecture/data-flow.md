# Data Flow

## Request Lifecycle

Every user interaction follows one of two patterns:

### Pattern 1: Server Component Page Load

```mermaid
sequenceDiagram
    participant B as Browser
    participant SC as Server Component
    participant SB as Supabase (RLS)

    B->>SC: URL navigation
    SC->>SC: createClient() — reads auth cookies
    SC->>SB: SELECT query (RLS enforced)
    SB-->>SC: User's data only
    SC-->>B: Streamed HTML
```

**Key point:** Pages are Server Components by default. They fetch data via `await createClient()` from `@/lib/supabase/server`, which reads auth cookies. RLS ensures users only see their own data.

### Pattern 2: Client Component → Server Action

```mermaid
sequenceDiagram
    participant CC as Client Component
    participant SA as Server Action
    participant DB as Supabase
    participant BG as Background (after)

    CC->>SA: await doThing(data) — POST
    SA->>SA: 1. requireAuth()
    SA->>SA: 2. Validate input
    SA->>DB: 3. Database mutation
    DB-->>SA: Result
    SA->>SA: 4. revalidatePath()
    SA-->>CC: { success, data }
    SA--)BG: 5. after() — deferred
    BG->>DB: Notifications, activity events
```

## Standard Server Action Return Type

All server actions follow this consistent return pattern:

```typescript
{ success: boolean; error?: string; data?: T }
```

This enables consistent error handling in client components:

```typescript
const result = await doThing(data);
if (!result.success) {
    setError(result.error);
    return;
}
// use result.data
```

## Database Client Selection

| Need | Use | Import |
|------|-----|--------|
| Read user's own data (page load) | `createClient()` | `@/lib/supabase/server` |
| Write user's own data (server action) | `createClient()` or `requireAuth()` | `@/lib/supabase/server` or `@/lib/auth` |
| Read public data (no auth needed) | `createClient()` | `@/lib/supabase/server` |
| Upload files from browser | `createClient()` | `@/lib/supabase/client` |
| Cross-user writes (notifications) | `getAdminClient()` | `@/lib/supabase/admin` |
| Bypass RLS (admin operations) | `getAdminClient()` | `@/lib/supabase/admin` |

## Cron Jobs

| Schedule | Endpoint | Action |
|----------|----------|--------|
| Daily 6 AM UTC | `/api/cron/refresh-market` | Refreshes `mv_market_prices` materialized view |

Configured in `vercel.json`. The cron endpoint validates the request is from Vercel before executing.

## Image Flow

```mermaid
graph TD
    subgraph Upload["Upload Flow"]
        A["Client Component"] --> B["Compress image (imageCompression.ts)"]
        B --> C["Upload to Supabase Storage"]
        C --> D["Path: horse-images/horse_id/filename"]
        A --> E["Save metadata to horse_images table"]
    end

    subgraph Render["Rendering Flow"]
        F["Server Component"] --> G["getSignedImageUrl(path)"]
        G --> H["Time-limited signed URL"]
        H --> I["img src=signedUrl"]
    end
```

Horse images are in a **private** Supabase Storage bucket. The `getSignedImageUrl()` utility in `storage.ts` generates time-limited signed URLs for rendering. This prevents hotlinking and unauthorized access.

## Cache Invalidation

After mutations, server actions call `revalidatePath()` to invalidate Next.js cached data for affected routes:

```typescript
revalidatePath("/dashboard");           // User's dashboard
revalidatePath(`/community/${horseId}`); // Public passport
revalidatePath(`/inbox/${convoId}`);     // Chat thread
```

This ensures the user sees fresh data after their action without a full page reload.

---

**Next:** [Auth Flow](auth-flow.md) · [Architecture Overview](overview.md)
