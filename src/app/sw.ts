import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate, CacheFirst, ExpirationPlugin } from "serwist";

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
    runtimeCaching: [
        ...defaultCache,
        // Cache Stable/Dashboard pages for offline access at live shows
        {
            matcher: /^\/(dashboard|stable\/[^/]+)$/,
            handler: new StaleWhileRevalidate({
                cacheName: "stable-pages",
            }),
        },
        // Cache horse images aggressively — they rarely change
        {
            matcher: /\.supabase\.co\/storage\/v1\/object\/public\/horse-images\//,
            handler: new CacheFirst({
                cacheName: "horse-images",
                plugins: [
                    new ExpirationPlugin({
                        maxEntries: 200,
                        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                    }),
                ],
            }),
        },
    ],
    fallbacks: {
        entries: [
            {
                url: "/~offline",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();
