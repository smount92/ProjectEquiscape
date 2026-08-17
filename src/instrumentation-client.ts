// Next 16 + Turbopack loads browser Sentry ONLY from
// instrumentation-client.ts — the old sentry.client.config.ts was
// never injected, so client errors silently went unreported.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Free tier: low sample rate to stay under 5K events/month
    tracesSampleRate: 0.05,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out common non-actionable errors
    ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "Load failed",
        "AbortError",
        // Facebook in-app browser injects its own perf logger into every
        // page and throws when its Java bridge dies on navigation — their
        // script, not ours (first seen 2026-08-17, /signup via FB app).
        "Java object is gone",
        "Error invoking postMessage",
    ],
    // Third-party scripts injected by app WebViews report under app://
    // pseudo-URLs (e.g. app://navigation_performance_logger_android).
    // Our own chunks report as app:///_next/* — keep those.
    denyUrls: [/^app:\/\/(?!\/_next\/)/],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
