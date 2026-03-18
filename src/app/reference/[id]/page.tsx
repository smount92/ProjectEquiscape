import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SuggestEditModal from "@/components/SuggestEditModal";
import Link from "next/link";

interface Props {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ suggest?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createClient();
    const { data } = await supabase
        .from("catalog_items")
        .select("title, maker")
        .eq("id", id)
        .single();

    if (!data) return { title: "Entry Not Found — Model Horse Hub" };
    const d = data as { title: string; maker: string };
    return {
        title: `${d.title} by ${d.maker} — Reference Catalog — Model Horse Hub`,
        description: `View details for ${d.title} by ${d.maker} in the Model Horse Hub reference catalog.`,
    };
}

export const dynamic = "force-dynamic";

export default async function CatalogItemPage({ params, searchParams }: Props) {
    const { id } = await params;
    const { suggest } = await searchParams;
    const supabase = await createClient();

    const { data: item, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !item) notFound();

    const catalogItem = item as {
        id: string;
        item_type: string;
        parent_id: string | null;
        title: string;
        maker: string;
        scale: string | null;
        attributes: Record<string, unknown>;
        created_at: string;
    };

    // Get pending suggestions for this item
    const { data: suggestions, count: suggestionCount } = await supabase
        .from("catalog_suggestions")
        .select("id, suggestion_type, status, upvotes, created_at", {
            count: "exact",
        })
        .eq("catalog_item_id", id)
        .in("status", ["pending", "under_review"])
        .order("created_at", { ascending: false })
        .limit(5);

    // Check auth for suggest button
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Extract attributes for display
    const attrs = catalogItem.attributes ?? {};
    const displayFields = [
        { label: "Title", value: catalogItem.title },
        { label: "Maker", value: catalogItem.maker },
        { label: "Type", value: formatItemType(catalogItem.item_type) },
        { label: "Scale", value: catalogItem.scale ?? "—" },
        ...(typeof attrs === "object"
            ? Object.entries(attrs)
                  .filter(([, v]) => v != null && v !== "")
                  .map(([k, v]) => ({
                      label: formatLabel(k),
                      value: String(v),
                  }))
            : []),
    ];

    return (
        <div className="page-container">
            {/* Breadcrumb */}
            <nav className="ref-breadcrumb">
                <Link href="/reference">📚 Reference Catalog</Link>
                <span className="ref-breadcrumb-sep">›</span>
                <span>{catalogItem.title}</span>
            </nav>

            <div className="ref-detail-layout">
                {/* Main Card */}
                <div className="card ref-detail-card animate-fade-in-up">
                    <div className="ref-detail-header">
                        <div>
                            <h1 className="ref-detail-title">{catalogItem.title}</h1>
                            <p className="ref-detail-maker">by {catalogItem.maker}</p>
                        </div>
                        <span className="ref-detail-type-badge">
                            {formatItemType(catalogItem.item_type)}
                        </span>
                    </div>

                    <div className="ref-detail-grid">
                        {displayFields.map((field) => (
                            <div key={field.label} className="ref-detail-field">
                                <span className="ref-detail-label">{field.label}</span>
                                <span className="ref-detail-value">{field.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="ref-detail-actions">
                        {user ? (
                            <SuggestEditModal
                                catalogItem={catalogItem}
                                openOnMount={suggest === "true"}
                            />
                        ) : (
                            <Link href="/login" className="btn btn-primary">
                                Log in to Suggest Edit
                            </Link>
                        )}
                    </div>
                </div>

                {/* Pending Suggestions */}
                {(suggestionCount ?? 0) > 0 && (
                    <div className="card ref-pending-card">
                        <h3>📝 Pending Suggestions ({suggestionCount})</h3>
                        <ul className="ref-pending-list">
                            {(
                                suggestions as {
                                    id: string;
                                    suggestion_type: string;
                                    status: string;
                                    upvotes: number;
                                    created_at: string;
                                }[]
                            )?.map((s) => (
                                <li key={s.id} className="ref-pending-item">
                                    <Link href={`/reference/suggestions/${s.id}`}>
                                        <span className="ref-pending-type">
                                            {s.suggestion_type === "correction"
                                                ? "🔧"
                                                : s.suggestion_type === "addition"
                                                  ? "📗"
                                                  : s.suggestion_type === "photo"
                                                    ? "📸"
                                                    : "🗑"}
                                        </span>
                                        <span>
                                            {formatItemType(s.suggestion_type)} suggestion
                                        </span>
                                        <span className="ref-pending-votes">
                                            ▲ {s.upvotes}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={`/reference/suggestions?item=${id}`}
                            className="ref-view-all-link"
                        >
                            View all suggestions →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatItemType(type: string): string {
    return type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLabel(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
