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
  experimental: {
    // Cap static-generation workers. Vercel's Turbo build machine has
    // 30 cores → 29 workers, and every prebuilt /reference page hits
    // Supabase with several queries — 29 at once stampedes the
    // connection pool, queues everything past the 60s per-page cap,
    // and fails the build (2026-08-21 launch deploy). Six workers
    // build the same pages comfortably inside the window.
    cpus: 6,
    // Server-action request bodies default to 1 MB, which sat BELOW the
    // 2 MB avatar and 3 MB banner limits the actions advertise — a phone
    // photo got a bare 413 before the action ever ran (Sentry,
    // /profile/customize, 2026-09). Clients now compress first; this is
    // the backstop so the advertised limits are real.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bdmwubihwinsxfykjqfe.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
    // Suppress source map upload noise in CI
    silent: true,
    // Don't widen the upload scope
    widenClientFileUpload: false,
    // Disable automatic instrumentation tunnel (free tier doesn't need it)
    tunnelRoute: undefined,
});
