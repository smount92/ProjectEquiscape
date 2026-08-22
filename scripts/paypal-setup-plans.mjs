#!/usr/bin/env node
/**
 * Create the PayPal catalog product and the two subscription plans.
 *
 * PayPal has no dashboard UI for this in sandbox — subscription products
 * and plans are API-only — so this script stands in for the buttons that
 * do not exist. It prints the ids to paste into .env.local.
 *
 * Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV from
 * .env.local. It never prints the secret.
 *
 *   node scripts/paypal-setup-plans.mjs           # sandbox (default)
 *   node scripts/paypal-setup-plans.mjs --live    # against live PayPal
 *
 * Re-running creates ANOTHER product and plans — PayPal has no upsert
 * here. Run it once per environment and keep the ids.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = process.argv.includes("--live");

/** Minimal .env.local reader — the repo has no dotenv dependency. */
function loadEnvLocal() {
    const out = {};
    try {
        const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eq = trimmed.indexOf("=");
            if (eq === -1) continue;
            out[trimmed.slice(0, eq).trim()] = trimmed
                .slice(eq + 1)
                .trim()
                .replace(/^["']|["']$/g, "");
        }
    } catch {
        // Falls through to process.env below.
    }
    return out;
}

const fileEnv = loadEnvLocal();
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || fileEnv.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || fileEnv.PAYPAL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
        "Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.\n" +
            "Add them to .env.local (from PayPal Developer → Apps & Credentials → your app).",
    );
    process.exit(1);
}

const BASE = LIVE ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function token() {
    const res = await fetch(`${BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const body = await res.json();
    if (!res.ok) {
        // Print PayPal's own error, never the credentials.
        throw new Error(`OAuth failed (${res.status}): ${JSON.stringify(body)}`);
    }
    return body.access_token;
}

async function api(accessToken, endpoint, payload) {
    const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            // Makes a retry safe rather than duplicating the object.
            "PayPal-Request-Id": randomUUID(),
        },
        body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${endpoint} failed (${res.status}): ${JSON.stringify(body, null, 2)}`);
    return body;
}

/** A fixed monthly price, billed forever until cancelled. */
function monthlyPlan(productId, name, description, price) {
    return {
        product_id: productId,
        name,
        description,
        status: "ACTIVE",
        billing_cycles: [
            {
                frequency: { interval_unit: "MONTH", interval_count: 1 },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0, // 0 = until cancelled
                pricing_scheme: { fixed_price: { value: price, currency_code: "USD" } },
            },
        ],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: { value: "0", currency_code: "USD" },
            setup_fee_failure_action: "CONTINUE",
            // After 3 failed attempts PayPal suspends; our webhook hears
            // BILLING.SUBSCRIPTION.SUSPENDED and drops the tier.
            payment_failure_threshold: 3,
        },
    };
}

async function main() {
    console.log(`\nPayPal ${LIVE ? "LIVE" : "SANDBOX"} — ${BASE}\n`);

    const accessToken = await token();
    console.log("✓ authenticated\n");

    const product = await api(accessToken, "/v1/catalogs/products", {
        name: "Model Horse Hub Membership",
        description: "Membership tiers on Model Horse Hub.",
        type: "SERVICE",
        category: "SOFTWARE",
        home_url: "https://modelhorsehub.com",
    });
    console.log(`✓ product  ${product.id}`);

    const pro = await api(
        accessToken,
        "/v1/billing/plans",
        monthlyPlan(product.id, "MHH Pro — Monthly", "Model Horse Hub Pro subscription.", "5"),
    );
    console.log(`✓ Pro plan     ${pro.id}   ($5/mo)`);

    const studio = await api(
        accessToken,
        "/v1/billing/plans",
        monthlyPlan(
            product.id,
            "MHH Studio Pro — Monthly",
            "Model Horse Hub Studio Pro subscription.",
            "10",
        ),
    );
    console.log(`✓ Studio plan  ${studio.id}   ($10/mo)`);

    console.log(`\nPaste into .env.local:\n`);
    console.log(`PAYPAL_PRO_PLAN_ID=${pro.id}`);
    console.log(`PAYPAL_STUDIO_PLAN_ID=${studio.id}`);
    console.log(
        `\nStill needed: PAYPAL_WEBHOOK_ID (Developer Dashboard → your app → Webhooks),` +
            `\nthen NEXT_PUBLIC_PAYPAL_BILLING=1 last.\n`,
    );
}

main().catch((err) => {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
});
