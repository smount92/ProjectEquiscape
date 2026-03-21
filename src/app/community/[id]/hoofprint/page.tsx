import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getHoofprint } from "@/app/actions/hoofprint";
import HoofprintTimeline from "@/components/HoofprintTimeline";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: horse } = await supabase
        .from("user_horses")
        .select("custom_name")
        .eq("id", id)
        .in("visibility", ["public", "unlisted"])
        .single();
    return {
        title: horse
            ? `🐾 Hoofprint™ — ${(horse as { custom_name: string }).custom_name} | Model Horse Hub`
            : "Hoofprint™ Report | Model Horse Hub",
    };
}

export default async function HoofprintReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: horseId } = await params;
    const supabase = await createClient();

    // Verify horse is public or unlisted
    const { data: horse } = await supabase
        .from("user_horses")
        .select(
            "id, custom_name, finish_type, condition_grade, is_public, catalog_items:catalog_id(title, maker, item_type)",
        )
        .eq("id", horseId)
        .in("visibility", ["public", "unlisted"])
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
        .select('show_name, show_date, division, "placing", ribbon_color')
        .eq("horse_id", horseId)
        .order("show_date", { ascending: false, nullsFirst: false });

    const records = (rawRecords ?? []) as {
        show_name: string;
        show_date: string | null;
        division: string | null;
        placing: string | null;
        ribbon_color: string | null;
    }[];

    const refName = h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` : null;

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            {/* Header */}
            <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                    <h1>
                        🐾 <span className="text-forest">Hoofprint™ Report</span>
                    </h1>
                    <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
                        Full provenance record for <strong>{h.custom_name}</strong>
                    </p>
                    {refName && (
                        <p className="text-muted text-[calc(0.85rem*var(--font-scale))]">
                            {refName} · {h.finish_type} · {h.condition_grade}
                        </p>
                    )}
                    <div className="mt-4 gap-2" style={{ display: "flex", flexWrap: "wrap" }}>
                        <Link
                            href={`/community/${horseId}`}
                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                        >
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
            <div className="animate-fade-in-up mt-8">
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
                <div className="animate-fade-in-up bg-card border-edge mt-8 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                    <h2 className="mb-4 text-[calc(1.1rem*var(--font-scale))]">🏆 Show Record</h2>
                    <div className="gap-1" style={{ display: "grid" }}>
                        {records.map((r, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-sm)",
                                    padding: "var(--space-xs) var(--space-sm)",
                                    borderRadius: "var(--radius-md)",
                                    background: "rgba(255,255,255,0.03)",
                                    fontSize: "calc(0.8rem * var(--font-scale))",
                                }}
                            >
                                <span className="text-base">
                                    {r.ribbon_color === "Blue"
                                        ? "🥇"
                                        : r.ribbon_color === "Red"
                                          ? "🥈"
                                          : r.ribbon_color === "Yellow"
                                            ? "🥉"
                                            : "🏅"}
                                </span>
                                <span className="font-semibold">{r.show_name}</span>
                                {r.division && <span className="text-muted">— {r.division}</span>}
                                {r.placing && <span className="text-muted">({r.placing})</span>}
                                {r.show_date && (
                                    <span
                                        className="text-muted text-[calc(0.7rem*var(--font-scale))]"
                                        style={{ marginLeft: "auto" }}
                                    >
                                        {new Date(r.show_date).toLocaleDateString("en-US", {
                                            month: "short",
                                            year: "numeric",
                                        })}
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
