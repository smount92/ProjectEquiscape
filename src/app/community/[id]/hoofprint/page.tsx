import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getHoofprint } from "@/app/actions/hoofprint";
import HoofprintTimeline from "@/components/HoofprintTimeline";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: horse } = await supabase
        .from("user_horses")
        .select("custom_name")
        .eq("id", id)
        .eq("is_public", true)
        .single();
    return {
        title: horse
            ? `🐾 Hoofprint™ — ${(horse as { custom_name: string }).custom_name} | Model Horse Hub`
            : "Hoofprint™ Report | Model Horse Hub",
    };
}

export default async function HoofprintReportPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: horseId } = await params;
    const supabase = await createClient();

    // Verify horse is public
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name, finish_type, condition_grade, is_public, catalog_items:catalog_id(title, maker, item_type)")
        .eq("id", horseId)
        .eq("is_public", true)
        .single();

    if (!horse) notFound();

    const h = horse as unknown as {
        id: string;
        custom_name: string;
        finish_type: string;
        condition_grade: string;
        catalog_items: { title: string; maker: string; item_type: string } | null;
    };

    const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);

    // Fetch show records
    const { data: rawRecords } = await supabase
        .from("show_records")
        .select("show_name, show_date, division, \"placing\", ribbon_color")
        .eq("horse_id", horseId)
        .order("show_date", { ascending: false, nullsFirst: false });

    const records = (rawRecords ?? []) as {
        show_name: string;
        show_date: string | null;
        division: string | null;
        placing: string | null;
        ribbon_color: string | null;
    }[];

    const refName = h.catalog_items
        ? `${h.catalog_items.maker} ${h.catalog_items.title}`
        : null;

    return (
        <div className="page-container">
            {/* Header */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        🐾 <span className="text-gradient">Hoofprint™ Report</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Full provenance record for <strong>{h.custom_name}</strong>
                    </p>
                    {refName && (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                            {refName} · {h.finish_type} · {h.condition_grade}
                        </p>
                    )}
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)", flexWrap: "wrap" }}>
                        <Link href={`/community/${horseId}`} className="btn btn-ghost">
                            ← Back to Passport
                        </Link>
                        <ShareButton
                            title={`🐾 Hoofprint™ — ${h.custom_name}`}
                            text={`Check out the full provenance record for ${h.custom_name} on Model Horse Hub!`}
                            variant="full"
                            label="Share Report"
                        />
                    </div>
                </div>
            </div>

            {/* Ownership + Timeline */}
            <div className="animate-fade-in-up" style={{ marginTop: "var(--space-xl)" }}>
                <HoofprintTimeline
                    horseId={horseId}
                    timeline={timeline}
                    ownershipChain={ownershipChain}
                    lifeStage={lifeStage}
                    isOwner={false}
                />
            </div>

            {/* Show Records Summary */}
            {records.length > 0 && (
                <div className="animate-fade-in-up card" style={{ marginTop: "var(--space-xl)", padding: "var(--space-lg)" }}>
                    <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                        🏆 Show Record
                    </h2>
                    <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                        {records.map((r, i) => (
                            <div key={i} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-sm)",
                                padding: "var(--space-xs) var(--space-sm)",
                                borderRadius: "var(--radius-md)",
                                background: "rgba(255,255,255,0.03)",
                                fontSize: "calc(0.8rem * var(--font-scale))",
                            }}>
                                <span style={{ fontSize: "1rem" }}>
                                    {r.ribbon_color === "Blue" ? "🥇" : r.ribbon_color === "Red" ? "🥈" : r.ribbon_color === "Yellow" ? "🥉" : "🏅"}
                                </span>
                                <span style={{ fontWeight: 600 }}>{r.show_name}</span>
                                {r.division && <span style={{ color: "var(--color-text-muted)" }}>— {r.division}</span>}
                                {r.placing && <span style={{ color: "var(--color-text-muted)" }}>({r.placing})</span>}
                                {r.show_date && (
                                    <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", fontSize: "calc(0.7rem * var(--font-scale))" }}>
                                        {new Date(r.show_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
