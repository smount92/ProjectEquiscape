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
        <div className="page-container page-container-wide">
            {/* Hero Section */}
            <div className="ref-hero animate-fade-in-up">
                <div className="ref-hero-content">
                    <h1>
                        📚{" "}
                        <span className="text-gradient">
                            Reference Catalog
                        </span>
                    </h1>
                    <p className="ref-hero-subtitle">
                        {(count ?? 0).toLocaleString()}+ model horse entries, maintained by the
                        community
                    </p>
                </div>
                <div className="ref-hero-stats">
                    <div className="community-stat">
                        <span className="community-stat-number">
                            {(count ?? 0).toLocaleString()}
                        </span>
                        <span className="community-stat-label">Catalog Entries</span>
                    </div>
                    <div className="community-stat">
                        <span className="community-stat-number">
                            {pendingSuggestions ?? 0}
                        </span>
                        <span className="community-stat-label">
                            Pending Suggestions
                        </span>
                    </div>
                    <div className="community-stat">
                        <span className="community-stat-number">{recentChanges ?? 0}</span>
                        <span className="community-stat-label">Changes This Week</span>
                    </div>
                </div>
            </div>

            <div className="ref-layout">
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
                <aside className="ref-sidebar">
                    {/* Quick Links */}
                    <div className="card ref-sidebar-card">
                        <h3 className="ref-sidebar-title">📋 Community</h3>
                        <div className="ref-sidebar-links">
                            <a href="/reference/suggestions" className="btn btn-secondary btn-small ref-sidebar-btn">
                                View Suggestions
                                {(pendingSuggestions ?? 0) > 0 && (
                                    <span className="ref-badge">
                                        {pendingSuggestions}
                                    </span>
                                )}
                            </a>
                            <a href="/reference/changelog" className="btn btn-secondary btn-small ref-sidebar-btn">
                                📋 View Changelog
                            </a>
                        </div>
                    </div>

                    {/* Top Curators */}
                    {(curators ?? []).length > 0 && (
                        <div className="card ref-sidebar-card">
                            <h3 className="ref-sidebar-title">🏆 Top Curators</h3>
                            <ul className="ref-curator-list">
                                {(
                                    curators as {
                                        id: string;
                                        alias_name: string;
                                        avatar_url: string | null;
                                        approved_suggestions_count: number;
                                    }[]
                                ).map((curator, i) => (
                                    <li key={curator.id} className="ref-curator-item">
                                        <span className="ref-curator-rank">
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                                        </span>
                                        <a
                                            href={`/profile/${curator.alias_name}`}
                                            className="ref-curator-name"
                                        >
                                            @{curator.alias_name}
                                        </a>
                                        <span className="ref-curator-count">
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
