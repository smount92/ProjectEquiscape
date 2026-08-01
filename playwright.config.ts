import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load env vars from .env.local (same file Next.js uses)
const envPath = resolve(__dirname, ".env.local");
if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const value = trimmed.substring(eqIdx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    }
}

export default defineConfig({
    testDir: "./e2e",
    // 60s: against the production server (see webServer below) the Serwist
    // service worker — disabled in dev, active in prod — precaches the asset
    // manifest once per fresh browser context. Under all four projects in
    // parallel that keeps the network busy long enough that a spec's
    // waitForLoadState("networkidle") can legitimately need >30s even though
    // the page rendered long before. (Do NOT block service workers instead:
    // registration failures make the client retry and networkidle then never
    // settles at all.)
    timeout: 60000,
    retries: 0,
    projects: [
        {
            name: "Desktop Chrome",
            use: {
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Mobile Safari",
            use: {
                ...devices["iPhone 12"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Mobile Chrome",
            use: {
                ...devices["Pixel 5"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Tablet",
            use: {
                ...devices["iPad (gen 7)"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
    ],
    webServer: {
        // Production build + serve. `next dev` compiles each route on first
        // hit, and under parallel projects those cold compiles produced
        // rotating one-off test timeouts (see the generous-timeout comments
        // in e2e/show-entry.spec.ts). A prebuilt server answers every route
        // warm, so specs measure the app rather than the compiler.
        command: "npm run build && npm run start",
        port: 3000,
        // Still honors a server you started yourself — local iteration
        // against a running `next dev` keeps working exactly as before;
        // with nothing on :3000 you get the prod build.
        reuseExistingServer: true,
        // The port only appears after a full cold `next build`; allow for it.
        timeout: 600_000,
    },
});
