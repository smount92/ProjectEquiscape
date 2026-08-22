#!/usr/bin/env node
/**
 * Create the PayPal catalog product and the subscription plans.
 *
 * PayPal has no dashboard UI for this in sandbox — subscription products
 * and plans are API-only — so this script stands in for the buttons that
 * do not exist. It prints the ids to paste into .env.local.
 *
 * Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV from
 * .env.local. It never prints the secret.
 *
 *   node scripts/paypal-setup-plans.mjs            # the two open-ended plans
 *   node scripts/paypal-setup-plans.mjs --terms    # ALSO the fixed-term plans
 *   node scripts/paypal-setup-plans.mjs --terms-only
 *   node scripts/paypal-setup-plans.mjs --live     # against live PayPal
 *
 * ── OPEN-ENDED vs FIXED-TERM ──────────────────────────────────────
 *
 * The two original plans bill $5 and $10 a month until cancelled
 * (total_cycles: 0). The --terms plans are the same thing with
 * total_cycles set to 3, 6 or 12: PayPal bills monthly and then stops on
 * its own, with nothing left running and nothing for the member to
 * cancel. Their prices and cycle counts come from
 * config/membership-terms.json, which is the one file to edit.
 *
 * PayPal cannot change a plan's price or cycle count after creation, so
 * changing either means creating a NEW plan and pasting the new id.
 * Members already on the old plan keep paying the old price, which is
 * usually what you want and is never what you expected.
 *
 * Re-running creates ANOTHER product and plans — PayPal has no upsert
 * here. Run it once per environment and keep the ids. --terms-only skips
 * the product and open-ended plans, for adding fixed terms to a setup
 * that already exists; it needs PAYPAL_PRODUCT_ID in .env.local, or pass
 * --product=PROD-XXXX.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const LIVE = process.argv.includes("--live");
const TERMS_ONLY = process.argv.includes("--terms-only");
const WITH_TERMS = TERMS_ONLY || process.argv.includes("--terms");
const PRODUCT_ARG = (process.argv.find((a) => a.startsWith("--product=")) ?? "").split("=")[1];

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

/**
 * A fixed monthly price.
 *
 * `totalCycles` is the ONLY difference between the two plan families:
 *   0 → bills forever until cancelled (the original $5 / $10 plans)
 *   N → bills N times and then stops by itself
 *
 * PayPal ends an N-cycle subscription with BILLING.SUBSCRIPTION.EXPIRED,
 * which it can fire the same second as the final successful charge. The
 * webhook is built for that: a fixed-term plan carries an entitlement
 * clock (app_metadata.paid_through) that outlives the agreement, and
 * revocation refuses while that clock is still in the future. Nothing
 * about this plan shape needs the member to be protected by hand.
 */
function monthlyPlan(productId, name, description, price, totalCycles = 0) {
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
                total_cycles: totalCycles, // 0 = until cancelled
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

/**
 * The fixed-term catalogue, read from the SAME file the site reads.
 *
 * Deliberately not duplicated into this script: a price that is right on
 * the upgrade page and wrong at PayPal is a bug nobody notices until a
 * member is charged the wrong amount.
 */
function loadTerms() {
    const raw = readFileSync(path.join(ROOT, "config", "membership-terms.json"), "utf8");
    const parsed = JSON.parse(raw);
    const terms = Array.isArray(parsed.terms) ? parsed.terms : [];
    if (terms.length === 0) throw new Error("config/membership-terms.json lists no terms");
    return terms;
}

async function main() {
    console.log(`\nPayPal ${LIVE ? "LIVE" : "SANDBOX"} — ${BASE}\n`);

    const accessToken = await token();
    console.log("✓ authenticated\n");

    const paste = [];
    let productId = PRODUCT_ARG || fileEnv.PAYPAL_PRODUCT_ID || process.env.PAYPAL_PRODUCT_ID;

    if (!TERMS_ONLY) {
        const product = await api(accessToken, "/v1/catalogs/products", {
            name: "Model Horse Hub Membership",
            description: "Membership tiers on Model Horse Hub.",
            type: "SERVICE",
            category: "SOFTWARE",
            home_url: "https://modelhorsehub.com",
        });
        productId = product.id;
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

        paste.push(`PAYPAL_PRODUCT_ID=${product.id}`);
        paste.push(`PAYPAL_PRO_PLAN_ID=${pro.id}`);
        paste.push(`PAYPAL_STUDIO_PLAN_ID=${studio.id}`);
    }

    if (WITH_TERMS) {
        if (!productId) {
            throw new Error(
                "--terms-only needs a product id: set PAYPAL_PRODUCT_ID in .env.local or pass --product=PROD-XXXX",
            );
        }
        console.log(`\nFixed-term plans (bill monthly, then stop) on product ${productId}:\n`);

        for (const term of loadTerms()) {
            const tierName = term.tier === "studio" ? "Studio Pro" : "Pro";
            const plan = await api(
                accessToken,
                "/v1/billing/plans",
                monthlyPlan(
                    productId,
                    `MHH ${tierName} — ${term.months} months`,
                    `Model Horse Hub ${tierName}, billed monthly for ${term.months} months then stops.`,
                    term.monthlyPrice,
                    term.months,
                ),
            );
            console.log(
                `✓ ${term.key.padEnd(10)} ${plan.id}   ($${term.monthlyPrice} × ${term.months})`,
            );
            paste.push(`${term.planEnvVar}=${plan.id}`);
        }
    }

    console.log(`\nPaste into .env.local:\n`);
    for (const line of paste) console.log(line);

    if (!TERMS_ONLY) {
        console.log(
            `\nStill needed: PAYPAL_WEBHOOK_ID (Developer Dashboard → your app → Webhooks),` +
                `\nthen NEXT_PUBLIC_PAYPAL_BILLING=1 last.`,
        );
    }
    if (WITH_TERMS) {
        console.log(
            `\nPrepaid one-off terms need NO PayPal objects at all — they are Orders v2,` +
                `\ncreated per purchase. They need only NEXT_PUBLIC_PREPAID_TERMS=1.` +
                `\n\nSubscribe the webhook to these events as well:` +
                `\n  CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED,` +
                `\n  PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED, PAYMENT.CAPTURE.DENIED`,
        );
    }
    console.log("");
}

main().catch((err) => {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
});
