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
    timeout: 30000,
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
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
    },
});
