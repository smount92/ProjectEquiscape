import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Catalog Changelog — Model Horse Hub",
    description:
        "See recent community updates to the Model Horse Hub reference catalog. Corrections, additions, and photo submissions.",
};

export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
    const supabase = await createClient();

    const { data: entries, count } = await supabase
        .from("catalog_changelog")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50);

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <nav className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6">
                <Link href="/catalog">📚 Reference Catalog</Link>
                <span className="flex items-center gap-1 text-[calc(0.85rem*var(--font-scale))] text-muted mb-6-sep">›</span>
                <span>Changelog</span>
            </nav>

            <h1 className="font-sans text-[calc(1.8rem*var(--font-scale))] mb-1">
                📋{" "}
                <span className="text-forest">Catalog Changelog</span>
            </h1>
            <p className="text-muted mb-6">
                Community-approved updates to the reference catalog.{" "}
                {count ?? 0} total changes.
            </p>

            <div className="flex flex-col gap-[0]">
                {(
                    entries as unknown as {
                        id: string;
                        suggestion_id: string | null;
                        catalog_item_id: string | null;
                        change_type: string;
                        change_summary: string;
                        contributed_by: string | null;
                        contributor_alias: string;
                        created_at: string;
                    }[]
                )?.map((entry) => {
                    const timeAgo = getTimeAgo(entry.created_at);

                    return (
                        <div key={entry.id} className="flex gap-4 py-4 px-[0] border-b border-edge">
                            <span className="text-[1.3rem] min-w-[28px]">
                                {entry.change_type === "correction"
                                    ? "🔧"
                                    : entry.change_type === "addition"
                                      ? "📗"
                                      : entry.change_type === "photo"
                                        ? "📸"
                                        : "🗑"}
                            </span>
                            <div className="ref-changelog-content">
                                <p className="text-[calc(0.9rem*var(--font-scale))] font-medium mb-[4px]">
                                    {entry.change_summary}
                                </p>
                                <p className="text-forest">
                                    Contributed by{" "}
                                    <Link
                                        href={`/profile/${entry.contributor_alias}`}
                                        className="text-forest font-semibold"
                                    >
                                        @{entry.contributor_alias}
                                    </Link>
                                    {" · "}
                                    {timeAgo}
                                    {entry.catalog_item_id && (
                                        <>
                                            {" · "}
                                            <Link
                                                href={`/catalog/${entry.catalog_item_id}`}
                                            >
                                                View entry →
                                            </Link>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {(entries ?? []).length === 0 && (
                    <div className="bg-card border border-edge rounded-lg p-12 shadow-md transition-all text-center p-8 text-muted">
                        <p>No changes yet. The catalog awaits your contributions!</p>
                        <Link href="/catalog" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">
                            Browse Catalog
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}
