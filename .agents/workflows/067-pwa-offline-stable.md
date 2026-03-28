---
description: PWA Integration — install @serwist/next, configure service worker, offline Stable access for live shows
---

# PWA Integration & Offline Barn Mode

> **Constraint:** Offline mode is critical for collectors at live shows where cell signal is poor. Cache the user's stable and dashboard for offline access.
> **Last Updated:** 2026-03-28
> **Prerequisite:** None — standalone feature
> **Packages:** `@serwist/next`, `serwist`

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: Installation & Manifest
# ═══════════════════════════════════════

## Step 1.1 — Install Serwist

```
cmd /c "npm install @serwist/next serwist"
```

## Step 1.2 — Create the Web App Manifest

**Target File:** `public/manifest.json` (NEW FILE)

```json
{
    "name": "Model Horse Hub",
    "short_name": "MHH",
    "description": "Your Digital Stable — catalog, trade, and show model horses",
    "start_url": "/dashboard",
    "display": "standalone",
    "background_color": "#F4EFE6",
    "theme_color": "#2C5545",
    "orientation": "portrait-primary",
    "icons": [
        {
            "src": "/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}
```

> **Action Required:** Generate a 192px and 512px PNG icon from the 🐴 emoji or existing branding and place in `public/icons/`.

## Step 1.3 — Add manifest link to layout

**Target File:** `src/app/layout.tsx`

Add to the `<head>` block (inside the existing `<head>` tag):

```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2C5545" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

## Verify Phase 1

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] `public/manifest.json` exists with correct theme colors
- [ ] Layout includes manifest link
- [ ] Build passes

---

# ═══════════════════════════════════════
# PHASE 2: Service Worker Configuration
# ═══════════════════════════════════════

## Step 2.1 — Create the service worker entry

**Target File:** `src/app/sw.ts` (NEW FILE)

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

## Step 2.2 — Wrap next.config.ts with Serwist

**Target File:** `next.config.ts`

> **Note:** If Sentry is already wrapping the config (from workflow 066), compose both wrappers.

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
    /* existing config */
};

export default withSerwist(nextConfig);
// If also using Sentry: export default withSentryConfig(withSerwist(nextConfig), sentryOptions);
```

## Step 2.3 — Add custom runtime caching for Stable pages

**Target File:** `src/app/sw.ts`

Add custom caching rules BEFORE `serwist.addEventListeners()`:

```ts
import { StaleWhileRevalidate, CacheFirst } from "serwist";

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        ...defaultCache,
        // Cache Stable/Dashboard pages for offline access at live shows
        {
            urlPattern: /^\/(dashboard|stable\/[^/]+)$/,
            handler: new StaleWhileRevalidate({
                cacheName: "stable-pages",
                plugins: [],
            }),
            method: "GET",
        },
        // Cache horse images aggressively — they rarely change
        {
            urlPattern: /\.supabase\.co\/storage\/v1\/object\/public\/horse-images\//,
            handler: new CacheFirst({
                cacheName: "horse-images",
                plugins: [
                    // Limit cache to 200 images, expire after 30 days
                ],
            }),
            method: "GET",
        },
    ],
});
```

## Verify Phase 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] `public/sw.js` is generated during build
- [ ] Dev server runs without errors (SW disabled in dev)
- [ ] Build passes cleanly

---

# ═══════════════════════════════════════
# PHASE 3: Offline UX Indicator
# ═══════════════════════════════════════

## Step 3.1 — Create an offline indicator component

**Target File:** `src/components/OfflineIndicator.tsx` (NEW FILE)

```tsx
"use client";

import { useState, useEffect } from "react";

export default function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);

        // Check initial state
        setIsOffline(!navigator.onLine);

        window.addEventListener("offline", goOffline);
        window.addEventListener("online", goOnline);

        return () => {
            window.removeEventListener("offline", goOffline);
            window.removeEventListener("online", goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-lg">
            📡 You're offline — viewing cached data
        </div>
    );
}
```

## Step 3.2 — Add to root layout

**Target File:** `src/app/layout.tsx`

Add `<OfflineIndicator />` alongside `<BackToTop />` and `<CookieConsent />`:

```tsx
import OfflineIndicator from "@/components/OfflineIndicator";

// In the body:
<OfflineIndicator />
```

## Verify Phase 3

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] Offline indicator appears when network is disconnected
- [ ] Indicator disappears when network returns
- [ ] All tests pass
- [ ] Build passes cleanly

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: PWA offline barn mode — service worker, manifest, offline indicator"
```
