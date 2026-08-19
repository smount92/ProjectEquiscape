import Link from "next/link";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";

/**
 * The five-column catalog results table — the ORIGINAL /catalog renderer,
 * extracted verbatim from src/app/catalog/page.tsx so one copy serves both
 * the flag-off page (unchanged default) and the CATALOG_V2 compact-table
 * toggle (power curators). Server component: markup and classes must stay
 * byte-for-byte what the page rendered before the extraction — do not
 * restyle this; the cards renderer (CatalogCardsList) is where the new
 * design lives.
 */

// Taxonomy v2: labels come from the shared vocabulary.
const TYPE_LABELS: Record<string, string> = CATEGORY_LABELS;

export interface CatalogTableItem {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
}

export interface CatalogTableStats {
    owner: number;
    want: number;
    forSale: number;
}

export default function CatalogResultsTable({
    items,
    statsMap,
}: {
    items: CatalogTableItem[];
    statsMap: Map<string, CatalogTableStats>;
}) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Maker</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Scale</th>
                        <th className="py-2 pr-4">Collectors</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const st = statsMap.get(item.id);
                        return (
                        <tr key={item.id} className="transition-colors hover:bg-muted/50">
                            <td className="py-2 pr-4 font-semibold">
                                <Link
                                    href={
                                        referencePagesEnabled()
                                            ? referenceHref(item)
                                            : `/catalog/${item.id}`
                                    }
                                    className="text-foreground no-underline hover:text-forest hover:underline"
                                >
                                    {item.title}
                                </Link>
                            </td>
                            <td className="py-2 pr-4 text-secondary-foreground">{item.maker}</td>
                            <td className="py-2 pr-4 text-secondary-foreground">
                                {TYPE_LABELS[item.item_type] ?? item.item_type}
                            </td>
                            <td className="py-2 pr-4 text-secondary-foreground">{item.scale ?? "—"}</td>
                            <td className="py-2 pr-4 text-xs tabular-nums">
                                {st && (st.owner > 0 || st.want > 0 || st.forSale > 0) ? (
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        {st.owner > 0 && <span className="text-secondary-foreground" title="in collections">👥 {st.owner}</span>}
                                        {st.want > 0 && <span className="text-forest" title="want this">⭐ {st.want}</span>}
                                        {st.forSale > 0 && <span title="for sale" style={{ color: "var(--color-warning)" }}>🏷️ {st.forSale}</span>}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">—</span>
                                )}
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
