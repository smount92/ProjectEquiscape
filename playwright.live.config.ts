import { defineConfig, devices } from "@playwright/test";

/**
 * Live smoke test config: no dev server, one browser, aimed at SMOKE_URL
 * (the production site by default). Used by .github/workflows/live-smoke.yml
 * after each release, and by hand when checking a deploy.
 */
export default defineConfig({
    testDir: "./e2e/live",
    timeout: 45000,
    retries: 1,
    workers: 1,
    reporter: [["list"]],
    use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.SMOKE_URL || "https://modelhorsehub.com",
        headless: true,
    },
});
