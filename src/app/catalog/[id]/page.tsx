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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6">
                <Link href="/catalog">📚 Reference Catalog</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <span>{catalogItem.title}</span>
            </nav>

            <div className="flex flex-col gap-6">
                {/* Main Card */}
                <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 animate-fade-in-up">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="font-sans text-[calc(1.6rem*var(--font-scale))] m-0">{catalogItem.title}</h1>
                            <p className="text-muted text-[calc(1rem*var(--font-scale))] mt-[4px]">by {catalogItem.maker}</p>
                        </div>
                        <span className="bg-glass border border-edge rounded-lg py-[4px] px-[12px] text-[calc(0.8rem*var(--font-scale))] whitespace-nowrap">
                            {formatItemType(catalogItem.item_type)}
                        </span>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fill, minmax(200px, 1fr))] gap-4 mb-6">
                        {displayFields.map((field) => (
                            <div key={field.label} className="flex flex-col gap-[2px]">
                                <span className="text-[calc(0.75rem*var(--font-scale))] text-muted uppercase tracking-[0.05em] font-semibold">{field.label}</span>
                                <span className="text-[calc(0.95rem*var(--font-scale))] font-medium">{field.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {user ? (
                            <SuggestEditModal
                                catalogItem={catalogItem}
                                openOnMount={suggest === "true"}
                            />
                        ) : (
                            <Link href="/login" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                                Log in to Suggest Edit
                            </Link>
                        )}
                    </div>
                </div>

                {/* Pending Suggestions */}
                {(suggestionCount ?? 0) > 0 && (
                    <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-4">
                        <h3>📝 Pending Suggestions ({suggestionCount})</h3>
                        <ul className="list-none p-0 m-[var(--space-sm) 0]">
                            {(
                                suggestions as {
                                    id: string;
                                    suggestion_type: string;
                                    status: string;
                                    upvotes: number;
                                    created_at: string;
                                }[]
                            )?.map((s) => (
                                <li key={s.id} className="flex items-center gap-2 py-1 px-[0] text-[var(--color-text)] no-underline">
                                    <Link href={`/catalog/suggestions/${s.id}`}>
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
                                        <span className="ml-auto text-muted text-[calc(0.8rem*var(--font-scale))]">
                                            ▲ {s.upvotes}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={`/catalog/suggestions?item=${id}`}
                            className="text-[calc(0.85rem*var(--font-scale))] text-forest"
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
