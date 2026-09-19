/**
 * Config for the contrast audit only (npm run test:contrast).
 *
 * One desktop project — the measurement is about colour, not layout.
 * With E2E_BASE_URL set it attaches to a server you are already running
 * (a dev server, say); otherwise it builds and serves the app on :3000
 * like the main config, with the fixtures route switched on for that
 * local build.
 */
import { defineConfig } from "@playwright/test";

import base from "../playwright.config";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
    ...base,
    testDir: __dirname,
    testMatch: /contrast\.spec\.ts$/,
    reporter: [["list"]],
    projects: [
        {
            name: "Desktop Chrome",
            use: { baseURL, headless: true, viewport: { width: 1280, height: 900 } },
        },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              ...base.webServer!,
              env: { ...(process.env as Record<string, string>), NEXT_PUBLIC_E2E_FIXTURES: "1" },
          },
});
