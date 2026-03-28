// ============================================================
// Vercel Cron: Stablemaster AI Agent
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
// Requires: CRON_SECRET, GEMINI_API_KEY, RESEND_API_KEY
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";

const GEMINI_MODEL = "gemini-2.5-flash";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Model Horse Hub <noreply@modelhorsehub.com>";

export async function GET(request: NextRequest) {
    // Verify Vercel cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
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
            (u) => u.app_metadata?.tier === "pro" && u.email
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
                let marketPrices: Record<string, number> = {};
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

                // Build portfolio summary for Gemini
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

                // Call Gemini for analysis
                const systemPrompt = `Act as an expert equine model horse appraiser and market analyst named "Stablemaster". 
You are writing a monthly collection report for a Pro subscriber of Model Horse Hub. 
Summarize the portfolio in 3 concise, friendly paragraphs:
1. Overall collection health and value trends
2. Notable items — highlight any horses where market value significantly differs from estimated value
3. Brief actionable insight — a suggestion for the collector

Do NOT hallucinate financial advice. Only reference data present in the JSON.
Keep the tone warm, professional, and hobby-enthusiastic. Use the collector's name "${alias}" once.
Format your response as HTML with <p> tags for each paragraph. Use <strong> for emphasis.`;

                const geminiBody = {
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature: 0.6 },
                    contents: [{
                        parts: [{
                            text: JSON.stringify({
                                totalModels: horses.length,
                                totalPurchaseValue: totalPurchase,
                                totalEstimatedValue: totalEstimated,
                                totalMarketValue: totalMarket,
                                portfolio: portfolioSummary.slice(0, 50), // Cap at 50 to avoid token limits
                            }),
                        }],
                    }],
                };

                const geminiRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(geminiBody),
                    }
                );

                if (!geminiRes.ok) {
                    logger.error("Stablemaster", `Gemini API error for user ${proUser.id}`, {
                        status: geminiRes.status,
                    });
                    errors++;
                    continue;
                }

                const geminiData = await geminiRes.json();
                const analysisHtml = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

                if (!analysisHtml) {
                    logger.error("Stablemaster", `Empty Gemini response for user ${proUser.id}`);
                    errors++;
                    continue;
                }

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
