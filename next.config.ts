import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
    // Suppress source map upload noise in CI
    silent: true,
    // Don't widen the upload scope
    widenClientFileUpload: false,
    // Disable automatic instrumentation tunnel (free tier doesn't need it)
    tunnelRoute: undefined,
});
