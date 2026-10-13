/**
 * The reference block on a horse's passport — one owner for the three
 * pages that print it (the owner's card, the public page, the anonymous
 * passport).
 *
 * Until 2026-10-13 all three printed the linked row's title under
 * "Mold". For a horse linked to a release that meant the release name,
 * the club name or the set name sat where the mold should be ("Zenyatta
 * - Racehorse Royalty" as the mold, not Lonesome Glory). A member
 * reported ten of them in one evening. The mold line now comes from the
 * release's parent; a release the Registry has not filed under a mold
 * yet says so instead of borrowing the release's name.
 */

export interface ReferenceRow {
    item_type: string;
    title: string;
    maker: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
    /** The parent mold, when the row is a release filed under one. */
    parent?: ReferenceParent | null;
}

export interface ReferenceParent {
    id?: string;
    title: string;
    maker?: string | null;
    attributes?: Record<string, unknown> | null;
    maker_slug?: string | null;
    slug?: string | null;
}

export interface ReferenceLines {
    /** The label of the first row: "Mold" or "Artist Resin". */
    type: "Mold" | "Artist Resin";
    /** What sits beside that label. */
    name: string;
    /** True when the mold line is the Registry's, false when it is a stand-in. */
    moldKnown: boolean;
    maker: string;
    scale: string;
    /** "First released 1976" for molds, the medium for resins, or null. */
    extra: string | null;
}

function year(attrs: Record<string, unknown> | null | undefined): string | number | null {
    const y = attrs?.release_year_start;
    return typeof y === "number" || (typeof y === "string" && y.trim()) ? (y as string | number) : null;
}

export function referenceLines(cat: ReferenceRow): ReferenceLines {
    const attrs = cat.attributes ?? {};
    if (cat.item_type === "artist_resin") {
        return {
            type: "Artist Resin",
            name: cat.title,
            moldKnown: true,
            maker: cat.maker ?? "",
            scale: cat.scale || "Unknown",
            extra: (attrs.cast_medium as string | null) ?? null,
        };
    }
    if (cat.item_type === "plastic_release") {
        if (cat.parent?.title) {
            const y = year(cat.parent.attributes) ?? year(attrs);
            return {
                type: "Mold",
                name: cat.parent.title,
                moldKnown: true,
                maker: cat.maker ?? "",
                scale: cat.scale || "Unknown",
                extra: y ? `First released ${y}` : null,
            };
        }
        const typed = typeof attrs.mold_name === "string" ? attrs.mold_name.trim() : "";
        return {
            type: "Mold",
            name: typed ? `${typed} (not yet filed in the Registry)` : "Not recorded for this release yet",
            moldKnown: false,
            maker: cat.maker ?? "",
            scale: cat.scale || "Unknown",
            extra: null,
        };
    }
    const y = year(attrs);
    return {
        type: "Mold",
        name: cat.title,
        moldKnown: true,
        maker: cat.maker ?? "",
        scale: cat.scale || "Unknown",
        extra: y ? `First released ${y}` : null,
    };
}

/** The PostgREST embed that fetches what referenceLines needs beside the usual columns. */
export const REFERENCE_PARENT_EMBED = "parent:parent_id(id, title, maker, attributes, maker_slug, slug)";

/** The Registry page the Mold row should open: the parent mold when there is one, else the linked row itself. */
export function moldLinkTarget(
    cat: ReferenceRow,
    linked: { id: string; maker: string | null; title: string; maker_slug?: string | null; slug?: string | null },
): { id: string; maker: string | null; title: string; maker_slug?: string | null; slug?: string | null } {
    if (cat.item_type === "plastic_release" && cat.parent?.id && cat.parent.title) {
        return { id: cat.parent.id, maker: cat.parent.maker ?? linked.maker, title: cat.parent.title, maker_slug: cat.parent.maker_slug ?? null, slug: cat.parent.slug ?? null };
    }
    return linked;
}
