import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
    reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(withSerwist(nextConfig), {
    // Suppress source map upload noise in CI
    silent: true,
    // Don't widen the upload scope
    widenClientFileUpload: false,
    // Disable automatic instrumentation tunnel (free tier doesn't need it)
    tunnelRoute: undefined,
});
