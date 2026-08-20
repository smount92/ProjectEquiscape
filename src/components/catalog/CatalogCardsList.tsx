import Link from "next/link";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";
import {
    disambiguationLine,
    displayTitle,
    type CardAttributes,
} from "@/lib/catalog/cardDisplay";

/**
 * Identification-card browse for the Reference Catalog (CATALOG_V2, the
 * Amanda-approved mock). Each card answers "which model is this?" at a
 * glance: 64px community thumbnail (🐴 placeholder until migration 147's
 * thumbs RPC is applied), proper-case name, the disambiguation sub-line
 * "Maker · years · color", type/scale chips, and the collectors count.
 * The whole card links to the item's reference page (stored slugs).
 *
 * Server component — pure render over data the page already batched
 * (items + stats + thumbs + release counts); no per-card fetching.
 */

export interface CatalogCardItem {
    id: string;
    item_type: string;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    attributes?: CardAttributes | null;
}

export default function CatalogCardsList({
    items,
    statsMap,
    thumbs,
    releaseCounts,
}: {
    items: CatalogCardItem[];
    statsMap: Map<string, { owner: number; want: number; forSale: number }>;
    /** catalog_id → community thumbnail URL (migration 147; may be empty). */
    thumbs: Map<string, string>;
    /** mold catalog_id → number of child releases (may be empty). */
    releaseCounts: Map<string, number>;
}) {
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="catalog-cards">
            {items.map((item) => {
                const st = statsMap.get(item.id);
                const owner = st?.owner ?? 0;
                const thumb = thumbs.get(item.id);
                const isMold = item.item_type === "plastic_mold";
                const releases = isMold ? (releaseCounts.get(item.id) ?? 0) : 0;
                const subLineBase = disambiguationLine(item.maker, item.attributes);
                const subLine =
                    isMold && releases > 0
                        ? subLineBase
                            ? `${subLineBase} · ${releases} release${releases === 1 ? "" : "s"}`
                            : `${releases} release${releases === 1 ? "" : "s"}`
                        : subLineBase;
                const typeChip = {
                    // Taxonomy v2 labels; raw value only for data drift.
                    label: CATEGORY_LABELS[item.item_type] ?? item.item_type,
                    forest:
                        item.item_type === "plastic_release" ||
                        item.item_type === "artist_resin",
                };

                return (
                    <li key={item.id}>
                        <Link
                            href={referenceHref(item)}
                            className="group flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-2.5 no-underline transition-colors hover:border-forest hover:bg-muted/40"
                        >
                            {/* 64px identification thumbnail — community photo or 🐴 */}
                            {thumb ? (
                                // Community photos live at arbitrary storage URLs;
                                // plain <img> matches ReferencePhotoGallery's approach.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={thumb}
                                    alt=""
                                    width={64}
                                    height={64}
                                    loading="lazy"
                                    className="h-16 w-16 shrink-0 rounded-md border border-input object-cover"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-input bg-muted/50 text-2xl opacity-70"
                                >
                                    🐴
                                </span>
                            )}

                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-foreground group-hover:text-forest">
                                    {displayTitle(item.title)}
                                </span>
                                {subLine && (
                                    <span className="mt-0.5 block truncate text-xs text-secondary-foreground">
                                        {subLine}
                                    </span>
                                )}
                                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span
                                        className={
                                            typeChip.forest
                                                ? "inline-flex items-center rounded-full border border-forest/40 bg-forest/5 px-2 py-px font-serif text-[0.7rem] tracking-wide text-forest"
                                                : "inline-flex items-center rounded-full border border-input bg-transparent px-2 py-px font-serif text-[0.7rem] tracking-wide text-secondary-foreground"
                                        }
                                    >
                                        {typeChip.label}
                                    </span>
                                    {item.scale && (
                                        <span className="inline-flex items-center rounded-full border border-input bg-transparent px-2 py-px font-serif text-[0.7rem] tracking-wide text-secondary-foreground">
                                            {item.scale}
                                        </span>
                                    )}
                                </span>
                            </span>

                            {/* Collectors count — right-aligned, from the existing
                                stats fetch (migration 134/145: public owners only) */}
                            {owner > 0 && (
                                <span
                                    className="shrink-0 text-xs tabular-nums whitespace-nowrap text-secondary-foreground"
                                    title="collectors have this"
                                >
                                    👥 {owner.toLocaleString()}
                                </span>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
