import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import CatalogBrowser from "@/components/CatalogBrowser";

export const metadata: Metadata = {
    title: "Reference Catalog — Model Horse Hub",
    description:
        "Browse 10,500+ model horse reference entries. Search by name, maker, mold, color, and scale. Community-maintained catalog for Breyer, Stone, and Artist Resins.",
};

export const dynamic = "force-dynamic";

export default async function ReferencePage() {
    const supabase = await createClient();

    // Fetch initial page of catalog items
    const { data: items, count } = await supabase
        .from("catalog_items")
        .select("*", { count: "exact" })
        .order("title", { ascending: true })
        .range(0, 49);

    // Fetch unique makers for filter chips
    const { data: makerRows } = await supabase
        .from("catalog_items")
        .select("maker")
        .not("maker", "is", null);

    const makers = [
        ...new Set(
            (makerRows ?? [])
                .map((r: { maker: string }) => r.maker)
                .filter(Boolean)
        ),
    ].sort() as string[];

    // Fetch unique scales
    const { data: scaleRows } = await supabase
        .from("catalog_items")
        .select("scale")
        .not("scale", "is", null);

    const scales = [
        ...new Set(
            (scaleRows ?? [])
                .map((r: { scale: string | null }) => r.scale)
                .filter(Boolean)
        ),
    ].sort() as string[];

    // Fetch top curators
    const { data: curators } = await supabase
        .from("users")
        .select("id, alias_name, avatar_url, approved_suggestions_count")
        .gt("approved_suggestions_count", 0)
        .order("approved_suggestions_count", { ascending: false })
        .limit(5);

    // Get pending suggestion count
    const { count: pendingSuggestions } = await supabase
        .from("catalog_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

    // Get recent changelog count (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentChanges } = await supabase
        .from("catalog_changelog")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo);

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6 max-w-[var(--max-width)]">
            {/* Hero Section */}
            <div className="text-center py-8 px-[0] animate-fade-in-up">
                <div className="text-center py-8 px-[0]-content">
                    <h1>
                        📚{" "}
                        <span className="text-forest">
                            Reference Catalog
                        </span>
                    </h1>
                    <p className="text-center py-8 px-[0]-subtitle">
                        {(count ?? 0).toLocaleString()}+ model horse entries, maintained by the
                        community
                    </p>
                </div>
                <div className="text-center py-8 px-[0]-stats">
                    <div className="flex flex-col items-center">
                        <span className="flex flex-col items-center-number">
                            {(count ?? 0).toLocaleString()}
                        </span>
                        <span className="flex flex-col items-center-label">Catalog Entries</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="flex flex-col items-center-number">
                            {pendingSuggestions ?? 0}
                        </span>
                        <span className="flex flex-col items-center-label">
                            Pending Suggestions
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="flex flex-col items-center-number">{recentChanges ?? 0}</span>
                        <span className="flex flex-col items-center-label">Changes This Week</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-[1fr 280px] gap-8 mt-6">
                {/* Main Content */}
                <div className="ref-main">
                    <CatalogBrowser
                        initialItems={(items ?? []) as CatalogItemRow[]}
                        totalCount={count ?? 0}
                        makers={makers}
                        scales={scales}
                    />
                </div>

                {/* Sidebar */}
                <aside className="flex flex-col gap-4">
                    {/* Quick Links */}
                    <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all flex flex-col gap-4-card">
                        <h3 className="flex flex-col gap-4-title">📋 Community</h3>
                        <div className="flex flex-col gap-4-links">
                            <a href="/catalog/suggestions" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none btn max-md:min-h-[44px]-secondary btn-small flex flex-col gap-4-btn">
                                View Suggestions
                                {(pendingSuggestions ?? 0) > 0 && (
                                    <span className="bg-forest text-white text-[0.7rem] py-[2px] px-[6px] rounded-[10px] font-bold">
                                        {pendingSuggestions}
                                    </span>
                                )}
                            </a>
                            <a href="/catalog/suggestions/new" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm btn max-md:min-h-[44px]-small flex flex-col gap-4-btn">
                                📗 Suggest New Entry
                            </a>
                            <a href="/catalog/changelog" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none btn max-md:min-h-[44px]-secondary btn-small flex flex-col gap-4-btn">
                                📋 View Changelog
                            </a>
                        </div>
                    </div>

                    {/* Top Curators */}
                    {(curators ?? []).length > 0 && (
                        <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all flex flex-col gap-4-card">
                            <h3 className="flex flex-col gap-4-title">🏆 Top Curators</h3>
                            <ul className="list-none p-0 m-0">
                                {(
                                    curators as {
                                        id: string;
                                        alias_name: string;
                                        avatar_url: string | null;
                                        approved_suggestions_count: number;
                                    }[]
                                ).map((curator, i) => (
                                    <li key={curator.id} className="border-b-0">
                                        <span className="min-w-[24px]">
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                                        </span>
                                        <a
                                            href={`/profile/${curator.alias_name}`}
                                            className="text-forest font-semibold"
                                        >
                                            @{curator.alias_name}
                                        </a>
                                        <span className="ml-auto text-muted text-[calc(0.75rem*var(--font-scale))]">
                                            {curator.approved_suggestions_count} contributions
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

// Type for catalog items passed to client component
interface CatalogItemRow {
    id: string;
    item_type: string;
    parent_id: string | null;
    title: string;
    maker: string;
    scale: string | null;
    attributes: Record<string, unknown>;
    created_at: string;
}
