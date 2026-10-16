import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { humanizeChangeSummary } from "@/lib/catalog/editableFields";
import type { Metadata } from "next";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { Button } from "@/components/ui/button";
import { referenceHref } from "@/lib/catalog/referenceUrl";

type ChangelogEntry = {
    id: string;
    change_type: string;
    change_summary: string;
    contributor_alias: string;
    created_at: string;
    catalog_item_id: string | null;
    /** Who made the change, in what role (migration 242); null on older rows. */
    actor_role?: string | null;
    catalog_items: {
        maker_slug: string | null;
        slug: string | null;
        maker: string | null;
        title: string | null;
    } | null;
};

/**
 * Reference page for a changelog entry's catalog item, else the curation
 * page, else no link at all: a removed entry's lines keep no item
 * (registry_remove clears it), and "/catalog/null" is not a page.
 */
function entryHref(entry: Pick<ChangelogEntry, "catalog_item_id" | "catalog_items">): string | null {
    if (!entry.catalog_item_id) return null;
    const cat = entry.catalog_items;
    if (cat) {
        return referenceHref({
            id: entry.catalog_item_id,
            maker: cat.maker,
            title: cat.title,
            maker_slug: cat.maker_slug,
            slug: cat.slug,
        });
    }
    return `/catalog/${entry.catalog_item_id}`;
}

const CHANGE_ICONS: Record<string, string> = {
    correction: "🔧",
    addition: "📗",
    photo: "📸",
    duplicate: "🔁",
    merge: "🔁",
    revert: "↩️",
    restore: "↩️",
    removal: "🗑",
};

export const metadata: Metadata = {
    title: "Catalog Changelog",
    description:
        "See recent community updates to the Model Horse Hub reference catalog. Corrections, additions, and photo submissions.",
};

export default async function ChangelogPage() {
    const supabase = await createClient();

    const { data, count } = await supabase
        .from("catalog_changelog")
        .select("*, catalog_items(maker_slug, slug, maker, title)", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(50);
    const entries = (data ?? []) as unknown as ChangelogEntry[];

    return (
        <ExplorerLayout noHeader>
            <CatalogSubMasthead
                icon="📋"
                title="Catalog Changelog"
                subtitle={`${count ?? 0} community-approved change${count === 1 ? "" : "s"}`}
            />

            <div className="flex flex-col gap-0">
                {entries.map((entry) => {
                    const timeAgo = getTimeAgo(entry.created_at);
                    const href = entryHref(entry);

                    return (
                        <div key={entry.id} className="flex gap-4 border-b border-input px-0 py-4">
                            <span className="min-w-[28px] text-[1.3rem]">
                                {CHANGE_ICONS[entry.change_type] ?? "🗑"}
                            </span>
                            <div className="space-y-4">
                                <p className="mb-[4px] text-sm font-medium text-foreground">
                                    {humanizeChangeSummary(entry.change_summary)}
                                </p>
                                <p className="text-forest">
                                    Contributed by{" "}
                                    <Link
                                        href={`/profile/${entry.contributor_alias}`}
                                        className="font-semibold text-forest"
                                    >
                                        @{entry.contributor_alias}
                                    </Link>
                                    {entry.actor_role === "moderator" && " · by a Registry moderator"}
                                    {" · "}
                                    {timeAgo}
                                    {href && (
                                        <>
                                            {" · "}
                                            <Link
                                                href={href}
                                                className="font-semibold text-secondary-foreground hover:text-foreground"
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

                {entries.length === 0 && (
                    <div className="rounded-lg border border-input bg-card p-8 text-center text-muted-foreground shadow-md transition-all">
                        <p>No changes yet. The catalog awaits your contributions!</p>
                        <Button asChild>
                            <Link href="/catalog">Browse Catalog</Link>
                        </Button>
                    </div>
                )}
            </div>
        </ExplorerLayout>
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
