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
    ],
});
