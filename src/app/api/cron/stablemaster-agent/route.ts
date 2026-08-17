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
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Model Horse Hub <noreply@modelhorsehub.com>";

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
        // Find all Pro users
        const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const proUsers = users?.users?.filter(
            (u) => (u.app_metadata?.tier === "pro" || u.app_metadata?.tier === "studio") && u.email
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
                    reference: h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` : "Custom",
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
                const escapeHtml = (s: string) =>
                    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

                // Send email via Resend
                const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Monthly Stablemaster Report</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f23;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:24px;font-weight:700;">
        <span style="color:#f59e0b;">🐴</span>
        <span style="color:#e2e8f0;"> Stablemaster Report</span>
      </h1>
      <p style="color:#64748b;font-size:13px;margin:8px 0 0;">
        Monthly Collection Analysis · ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
    </div>

    <div style="background:linear-gradient(135deg,rgba(30,30,60,0.9),rgba(20,20,50,0.95));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;margin-bottom:24px;">
      
      <div style="display:flex;gap:16px;margin-bottom:24px;text-align:center;">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Models</div>
          <div style="color:#e2e8f0;font-size:20px;font-weight:700;">${horses.length}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Est. Value</div>
          <div style="color:#10b981;font-size:20px;font-weight:700;">$${totalEstimated.toLocaleString()}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Market</div>
          <div style="color:#f59e0b;font-size:20px;font-weight:700;">$${totalMarket.toLocaleString()}</div>
        </div>
      </div>

      <div style="color:#cbd5e1;font-size:14px;line-height:1.7;">
        ${analysisHtml}
      </div>
    </div>

    <div style="text-align:center;">
      <a href="https://modelhorsehub.com/dashboard" 
         style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
        View My Stable →
      </a>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="color:#475569;font-size:11px;margin:0;">
        You're receiving this because you're an MHH Pro subscriber.
        <br />
        <a href="https://modelhorsehub.com/settings" style="color:#818cf8;text-decoration:none;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

                const { error: emailError } = await resend.emails.send({
                    from: FROM_EMAIL,
                    to: proUser.email!,
                    subject: `🐴 Your Monthly Stablemaster Report — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
                    html: emailHtml,
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
