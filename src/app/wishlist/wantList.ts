import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";

/**
 * The Want List's data layer — lifted out of page.tsx so the page is
 * composition and copy, and the Matchmaker query has somewhere to be read.
 *
 * WHAT THIS IS: purchase intent. A Want List entry says "I would buy this
 * mold/release/resin if one came up", and Matchmaker turns that into an
 * alert the moment a collector sets a matching horse For Sale or Open to
 * Offers. It is not Favorites — favorites are public likes on one specific
 * horse and live somewhere else entirely.
 *
 * THE LISTING PREDICATE IS THE MARKET'S PREDICATE. A Want List match must
 * mean the same thing a marketplace listing means, or the two rooms
 * disagree about what is for sale. So this mirrors market/listings.ts
 * exactly: visibility = 'public' (NOT the derived is_public mirror, which
 * would also admit 'unlisted' horses if the trigger ever lagged),
 * deleted_at IS NULL, and a live trade status.
 */

/** Same two statuses market/listings.ts treats as live. */
const LIVE_TRADE_STATUSES = ["For Sale", "Open to Offers"] as const;

/** How many candidate listings one pass will consider across the whole list. */
const MATCH_SCAN_CAP = 200;

export interface MarketplaceMatch {
    id: string;
    custom_name: string;
    trade_status: string;
    listing_price: number | null;
    marketplace_notes: string | null;
    thumbnailUrl: string | null;
    ownerAlias: string;
    ownerId: string;
}

export interface WantListItem {
    id: string;
    notes: string | null;
    created_at: string;
    catalog_id: string | null;
    title: string | null;
    maker: string | null;
    scale: string | null;
    itemType: string | null;
    /** Live listings of this exact catalog entry, by other collectors. */
    matches: MarketplaceMatch[];
}

export interface WantListBoard {
    items: WantListItem[];
    /** Matches across every entry — the Matchmaker headline number. */
    totalMatches: number;
    /** Entries that can never match, because they are free-text notes. */
    noteOnlyCount: number;
}

interface RawMatch {
    id: string;
    custom_name: string;
    trade_status: string;
    listing_price: number | null;
    marketplace_notes: string | null;
    catalog_id: string | null;
    owner_id: string;
    users: { alias_name: string | null } | null;
    horse_images: { image_url: string; angle_profile: string | null }[] | null;
}

function pickThumbnail(images: RawMatch["horse_images"]): string | null {
    if (!images || images.length === 0) return null;
    const primary = images.find((img) => img.angle_profile === "Primary_Thumbnail");
    return primary?.image_url ?? images[0]?.image_url ?? null;
}

/**
 * The whole board in two queries: the list itself, then one bounded sweep
 * for live listings whose catalog_id appears on it. Never a query per row.
 */
export async function getWantListBoard(userId: string): Promise<WantListBoard> {
    const supabase = await createClient();

    const { data: rawItems } = await supabase
        .from("user_wishlists")
        .select(
            `id, notes, created_at, catalog_id,
             catalog_items:catalog_id(title, maker, scale, item_type)`,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    const rows = rawItems ?? [];
    const catalogIds = [...new Set(rows.map((r) => r.catalog_id).filter(Boolean))] as string[];

    let matchesByCatalogId = new Map<string, MarketplaceMatch[]>();

    if (catalogIds.length > 0) {
        const { data: rawMatches } = await supabase
            .from("user_horses")
            .select(
                `id, custom_name, trade_status, listing_price, marketplace_notes,
                 catalog_id, owner_id,
                 users!inner(alias_name),
                 horse_images(image_url, angle_profile)`,
            )
            .eq("visibility", "public")
            .is("deleted_at", null)
            .neq("owner_id", userId)
            .in("trade_status", [...LIVE_TRADE_STATUSES])
            .in("catalog_id", catalogIds)
            .limit(MATCH_SCAN_CAP);

        const found = (rawMatches ?? []) as unknown as RawMatch[];

        // One batched pass for the thumbnails, then group by catalog id so
        // several list entries pointing at the same reference share the work.
        const thumbPaths = found
            .map((m) => pickThumbnail(m.horse_images))
            .filter((p): p is string => Boolean(p));
        const urlMap = getPublicImageUrls(thumbPaths);

        matchesByCatalogId = found.reduce((acc, m) => {
            if (!m.catalog_id) return acc;
            const path = pickThumbnail(m.horse_images);
            const bucket = acc.get(m.catalog_id) ?? [];
            bucket.push({
                id: m.id,
                custom_name: m.custom_name,
                trade_status: m.trade_status,
                listing_price: m.listing_price,
                marketplace_notes: m.marketplace_notes,
                thumbnailUrl: path ? (urlMap.get(path) ?? null) : null,
                ownerAlias: m.users?.alias_name ?? "Unknown",
                ownerId: m.owner_id,
            });
            acc.set(m.catalog_id, bucket);
            return acc;
        }, new Map<string, MarketplaceMatch[]>());
    }

    const items: WantListItem[] = rows.map((row) => {
        const catalogItem = row.catalog_items;
        return {
            id: row.id,
            notes: row.notes,
            created_at: row.created_at,
            catalog_id: row.catalog_id,
            title: catalogItem?.title ?? null,
            maker: catalogItem?.maker ?? null,
            scale: catalogItem?.scale ?? null,
            itemType: catalogItem?.item_type ?? null,
            matches: row.catalog_id ? (matchesByCatalogId.get(row.catalog_id) ?? []) : [],
        };
    });

    return {
        items,
        totalMatches: items.reduce((sum, item) => sum + item.matches.length, 0),
        noteOnlyCount: items.filter((item) => !item.catalog_id).length,
    };
}
