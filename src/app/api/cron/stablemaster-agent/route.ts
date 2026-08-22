// ============================================================
// Vercel Cron: Stablemaster Monthly Report
// Monthly collection analysis for MHH Pro subscribers
//
// To activate, add to vercel.json:
// {
//     "crons": [{
//         "path": "/api/cron/stablemaster-agent",
//         "schedule": "0 9 1 * *"   ← 1st of every month at 9am UTC
//     }]
// }
//
// Requires: CRON_SECRET, RESEND_API_KEY (no LLM — deterministic digest)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { catalogDisplayName } from "@/lib/catalog/displayName";
import { getAdminClient } from "@/lib/supabase/admin";
import { entitledTier } from "@/lib/entitlement/clock";
import { isPro } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";
import {
    EMAIL_FROM,
    escapeEmailHtml,
    renderBrandedEmail,
    renderBrandedEmailText,
    renderEmailStats,
} from "@/lib/email/layout";

export async function GET(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    // Unset-secret guard: without it, an env missing CRON_SECRET
    // (e.g. preview deploys) accepts the literal "Bearer undefined".
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const admin = getAdminClient();
    let processed = 0;
    let errors = 0;

    try {
        // Find all Pro users. entitledTier applies the entitlement
        // clock, so a prepaid or fixed term that has run out stops the
        // report — nothing rewrites app_metadata.tier when a term simply
        // expires, so reading the raw flag here would keep delivering a
        // Pro-only feature to someone who is no longer Pro.
        const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const proUsers = users?.users?.filter(
            (u) => isPro(entitledTier(u.app_metadata)) && u.email
        ) || [];

        for (const proUser of proUsers) {
            try {
                // Fetch user profile
                const { data: profile } = await admin
                    .from("users")
                    .select("alias_name")
                    .eq("id", proUser.id)
                    .single();
                const alias = (profile as { alias_name: string } | null)?.alias_name || "Collector";

                // Fetch financial vault data with horse names and catalog info
                const { data: horses } = await admin
                    .from("user_horses")
                    .select(`
                        custom_name, catalog_id,
                        catalog_items:catalog_id(title, maker),
                        financial_vault(purchase_price, estimated_current_value)
                    `)
                    .eq("owner_id", proUser.id)
                    .is("deleted_at", null);

                if (!horses || horses.length === 0) continue;

                // Get catalog IDs for market price lookup
                const catalogIds = horses
                    .map((h: { catalog_id: string | null }) => h.catalog_id)
                    .filter(Boolean) as string[];

                // Fetch current market prices
                const marketPrices: Record<string, number> = {};
                if (catalogIds.length > 0) {
                    const { data: prices } = await admin
                        .from("mv_market_prices")
                        .select("catalog_id, average_price")
                        .in("catalog_id", catalogIds);
                    (prices || []).forEach((p) => {
                        if (p.catalog_id && p.average_price != null) {
                            marketPrices[p.catalog_id] = p.average_price;
                        }
                    });
                }

                // Build portfolio summary for the digest
                const portfolioSummary = horses.map((h: {
                    custom_name: string;
                    catalog_id: string | null;
                    catalog_items: { title: string; maker: string } | null;
                    financial_vault: { purchase_price: number | null; estimated_current_value: number | null } | null;
                }) => ({
                    name: h.custom_name,
                    reference: h.catalog_items ? catalogDisplayName(h.catalog_items.maker, h.catalog_items.title) : "Custom",
                    purchasePrice: h.financial_vault?.purchase_price || null,
                    estimatedValue: h.financial_vault?.estimated_current_value || null,
                    marketValue: h.catalog_id ? marketPrices[h.catalog_id] || null : null,
                }));

                const totalPurchase = portfolioSummary.reduce((s, h) => s + (h.purchasePrice || 0), 0);
                const totalEstimated = portfolioSummary.reduce((s, h) => s + (h.estimatedValue || 0), 0);
                const totalMarket = portfolioSummary.reduce((s, h) => s + (h.marketValue || 0), 0);

                // Deterministic digest — NO LLM. Vault data previously
                // left the platform to Google's Gemini API here, directly
                // contradicting the "even our team cannot access your
                // vault" privacy promise (audit Part 2 §Area 8 #3). The
                // community also rejected AI features outright; the
                // numbers below are computed in-process and nothing
                // leaves the building.
                const usd = (n: number) =>
                    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
                const movers = portfolioSummary
                    .filter((h) => h.marketValue !== null && h.estimatedValue !== null)
                    .map((h) => ({
                        name: h.name,
                        diff: (h.marketValue as number) - (h.estimatedValue as number),
                    }))
                    .filter((m) => Math.abs(m.diff) >= 5)
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
                    .slice(0, 3);
                const escapeHtml = escapeEmailHtml;
                const moversHtml = movers.length
                    ? `<p><strong>Worth a look:</strong> ${movers
                          .map(
                              (m) =>
                                  `${escapeHtml(m.name)} — Blue Book ${m.diff > 0 ? "above" : "below"} your estimate by <strong>${usd(Math.abs(m.diff))}</strong>`,
                          )
                          .join("; ")}. Blue Book values come from real completed sales on the Hub.</p>`
                    : "";
                const analysisHtml = `
<p>Hi ${escapeHtml(alias)} — here's your stable's ledger for the month: <strong>${horses.length} ${horses.length === 1 ? "model" : "models"}</strong>${totalPurchase > 0 ? `, ${usd(totalPurchase)} invested` : ""}${totalEstimated > 0 ? `, ${usd(totalEstimated)} in your estimated values` : ""}${totalMarket > 0 ? `, and ${usd(totalMarket)} at current Blue Book prices for the models the market has data on` : ""}.</p>
${moversHtml}
<p>Tip: keeping purchase prices and estimates current in each horse's vault makes this report — and your insurance export — sharper every month.</p>`;

                // Send email via Resend, through the shared branded shell.
                // The stat row is now a <table>: it used display:flex, which
                // Outlook on Windows ignores, so the three tiles stacked into
                // a column for every desktop Outlook subscriber.
                const reportMonth = new Date().toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                });
                const card = {
                    title: `Your Monthly Stablemaster Report — ${reportMonth}`,
                    heading: `Stablemaster Report · ${reportMonth}`,
                    bodyHtml: `${renderEmailStats([
                        { label: "Models", value: String(horses.length) },
                        { label: "Est. Value", value: `$${totalEstimated.toLocaleString()}` },
                        { label: "Market", value: `$${totalMarket.toLocaleString()}` },
                    ])}${analysisHtml}`,
                    ctaLabel: "View my stable",
                    ctaUrl: "/dashboard",
                    footerNote: "You're getting this because you're an MHH Pro subscriber.",
                };

                const { error: emailError } = await resend.emails.send({
                    from: EMAIL_FROM,
                    to: proUser.email!,
                    subject: `🐴 Your Monthly Stablemaster Report — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
                    html: renderBrandedEmail(card),
                    text: renderBrandedEmailText(card),
                });

                if (emailError) {
                    logger.error("Stablemaster", `Resend error for user ${proUser.id}`, emailError);
                    errors++;
                } else {
                    processed++;
                }
            } catch (err) {
                Sentry.captureException(err, { tags: { domain: "cron", user_id: proUser.id } });
                logger.error("Stablemaster", `Failed to process user ${proUser.id}`, err);
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            proUsersFound: proUsers.length,
            emailsSent: processed,
            errors,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        Sentry.captureException(error, { tags: { domain: "cron" }, level: "fatal" });
        logger.error("Stablemaster", "Cron job failed", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
