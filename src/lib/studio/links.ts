/**
 * An artist's outbound links (artist_profiles.links, migration 212).
 *
 * The definition moved to lib/links/memberLinks (one owner for the
 * member profile and the storefront, 2026-10-11); this module keeps
 * the storefront's four slots and its old names.
 */

import {
    linkEntries as entries,
    linkMeta,
    normalizeMemberLinks,
    STUDIO_LINK_KEYS,
    type LinkKey as AnyLinkKey,
    type MemberLinks,
} from "@/lib/links/memberLinks";

export type LinkKey = Extract<AnyLinkKey, "instagram" | "facebook" | "website" | "etsy">;

export type StudioLinks = Partial<Record<LinkKey, string>>;

export const LINK_META = linkMeta(STUDIO_LINK_KEYS) as { key: LinkKey; label: string; glyph: string; placeholder: string }[];

/** Normalise whatever was stored or typed into clean https URLs. */
export function normalizeStudioLinks(input: unknown): StudioLinks {
    return normalizeMemberLinks(input, STUDIO_LINK_KEYS) as StudioLinks;
}

/** The links a page can render, in display order. */
export function linkEntries(links: StudioLinks): { key: LinkKey; label: string; glyph: string; href: string }[] {
    return entries(links as MemberLinks, STUDIO_LINK_KEYS) as { key: LinkKey; label: string; glyph: string; href: string }[];
}
