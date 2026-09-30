import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { InsuranceReportDocument, type InsuranceHorse, type SetInfo } from "@/lib/pdf/InsuranceReport";
import { isMissingSetColumn } from "@/lib/vault/setPurchase";
import { getUserTier, isPro } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const tier = await getUserTier();

        // Fetch all horses with vault data (set columns are 224; read
        // without them until the paste).
        const selectHorses = (withSets: boolean) =>
            supabase
                .from("user_horses")
                .select(`
                id, custom_name, finish_type, condition_grade, trade_status, created_at, catalog_id,
                catalog_items:catalog_id(title, maker, scale),
                financial_vault(purchase_price, purchase_date, estimated_current_value, insurance_notes${withSets ? ", purchase_group_id, purchase_group_label" : ""})
            `)
                .eq("owner_id", user.id)
                .is("deleted_at", null)
                .order("custom_name");
        let horsesResult = await selectHorses(true);
        if (horsesResult.error && isMissingSetColumn(horsesResult.error)) horsesResult = await selectHorses(false);
        const horses = horsesResult.data;

        // One entry per set: total, size, label — the detail page names it
        // and the summary counts the set once through per-horse shares.
        const setInfo = new Map<string, SetInfo>();
        {
            const sizes = new Map<string, number>();
            for (const h of (horses ?? []) as { financial_vault?: { purchase_group_id?: string | null } | null }[]) {
                const g = h.financial_vault?.purchase_group_id;
                if (g) sizes.set(g, (sizes.get(g) ?? 0) + 1);
            }
            for (const h of (horses ?? []) as { id: string; financial_vault?: { purchase_price: number | null; purchase_group_id?: string | null; purchase_group_label?: string | null } | null }[]) {
                const g = h.financial_vault?.purchase_group_id;
                if (!g) continue;
                setInfo.set(h.id, { total: Number(h.financial_vault?.purchase_price ?? 0), members: sizes.get(g) ?? 1, label: h.financial_vault?.purchase_group_label ?? null });
            }
        }

        // Fetch owner profile for report header. full_name + email are
        // column-REVOKE'd from the authenticated role (migration 133), so read
        // them with the service-role client, scoped to this user's own id.
        const { data: profile } = await getAdminClient()
            .from("users")
            .select("alias_name, full_name, email, currency_symbol")
            .eq("id", user.id)
            .single();

        // Fetch image URLs for each horse (prefer Primary_Thumbnail, fall back to any angle)
        const horseIds = (horses || []).map((h: { id: string }) => h.id);
        const { data: images } = await supabase
            .from("horse_images")
            .select("horse_id, image_url, angle_profile")
            .in("horse_id", horseIds.length > 0 ? horseIds : ["__none__"]);

        const thumbnailMap = new Map<string, string>();
        (images || []).forEach((img: { horse_id: string; image_url: string; angle_profile: string }) => {
            // Only set if no entry yet, or if this is the preferred Primary_Thumbnail
            if (!thumbnailMap.has(img.horse_id) || img.angle_profile === "Primary_Thumbnail") {
                thumbnailMap.set(img.horse_id, img.image_url);
            }
        });

        // Pro users: fetch market replacement values from mv_market_prices
        const marketValueMap = new Map<string, number>();
        if (isPro(tier)) {
            const catalogIds = (horses || [])
                .map((h: { catalog_id: string | null }) => h.catalog_id)
                .filter(Boolean) as string[];
            if (catalogIds.length > 0) {
                const { data: prices } = await supabase
                    .from("mv_market_prices")
                    .select("catalog_id, average_price")
                    .in("catalog_id", catalogIds);
                (prices || []).forEach((p) => {
                    if (p.catalog_id && p.average_price != null) {
                        marketValueMap.set(p.catalog_id, p.average_price);
                    }
                });
            }
        }

        // Render PDF
        const buffer = await renderToBuffer(
            InsuranceReportDocument({
                owner: (profile as { alias_name: string; full_name: string | null; email: string }) || {
                    alias_name: "Unknown",
                    full_name: null,
                    email: user.email || "",
                },
                // Two select shapes (with / without the 224 columns); the report reads either.
                horses: (horses ?? []) as unknown as InsuranceHorse[],
                thumbnailMap,
                generatedAt: new Date().toISOString(),
                tier,
                marketValueMap,
                currencySymbol: (profile as { currency_symbol?: string | null } | null)?.currency_symbol || "$",
                setInfo,
            })
        );

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="insurance_report_${new Date().toISOString().split("T")[0]}.pdf"`,
                "Cache-Control": "no-cache, no-store",
            },
        });
    } catch (err) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(err, { tags: { domain: "pdf" }, level: "error" });
        return NextResponse.json(
            { error: "Failed to generate insurance report." },
            { status: 500 }
        );
    }
}
