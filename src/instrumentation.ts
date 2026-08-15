import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config");
    }
}

// Without this, uncaught RSC/route-handler errors never reach Sentry
// (Sentry v9+ requires the hook explicitly).
export const onRequestError = Sentry.captureRequestError;
