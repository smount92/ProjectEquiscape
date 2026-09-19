/**
 * An artist's outbound links (artist_profiles.links, migration 212).
 *
 * Artists type what they have to hand — "@blackfoxfarm", a full
 * Instagram URL, "blackfoxfarm.etsy.com". Normalise to one https URL
 * per network so the storefront renders a clickable icon and nothing
 * else ever has to guess. Only http(s) survives; anything that won't
 * parse is dropped rather than rendered as a broken link.
 */

export type LinkKey = "instagram" | "facebook" | "website" | "etsy";

export type StudioLinks = Partial<Record<LinkKey, string>>;

export const LINK_META: { key: LinkKey; label: string; glyph: string; placeholder: string }[] = [
    { key: "instagram", label: "Instagram", glyph: "📸", placeholder: "@yourstudio or the profile link" },
    { key: "facebook", label: "Facebook", glyph: "📘", placeholder: "Page name or the page link" },
    { key: "etsy", label: "Etsy", glyph: "🧶", placeholder: "Shop name or the shop link" },
    { key: "website", label: "Website", glyph: "🌐", placeholder: "https://yourstudio.com" },
];

const HANDLE = /^[a-z0-9._-]{1,60}$/i;

function asUrl(raw: string): URL | null {
    const s = raw.trim();
    if (!s) return null;
    try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
        if (u.protocol !== "https:" && u.protocol !== "http:") return null;
        if (!u.hostname.includes(".")) return null;
        return u;
    } catch {
        return null;
    }
}

function normalizeOne(key: LinkKey, raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const s = raw.trim();
    if (!s) return null;

    // A bare handle → the network's profile URL.
    const handle = s.replace(/^@/, "");
    if (key === "instagram" && HANDLE.test(handle) && !handle.includes(".")) {
        return `https://www.instagram.com/${handle}/`;
    }
    if (key === "facebook" && HANDLE.test(handle) && !handle.includes(".")) {
        return `https://www.facebook.com/${handle}`;
    }
    if (key === "etsy" && HANDLE.test(handle) && !handle.includes(".")) {
        return `https://www.etsy.com/shop/${handle}`;
    }

    const u = asUrl(s);
    if (!u) return null;
    u.hash = "";
    return u.toString();
}

/** Normalise whatever was stored or typed into clean https URLs. */
export function normalizeStudioLinks(input: unknown): StudioLinks {
    if (!input || typeof input !== "object") return {};
    const out: StudioLinks = {};
    for (const { key } of LINK_META) {
        const v = normalizeOne(key, (input as Record<string, unknown>)[key]);
        if (v) out[key] = v;
    }
    return out;
}

/** The links a page can render, in display order. */
export function linkEntries(links: StudioLinks): { key: LinkKey; label: string; glyph: string; href: string }[] {
    return LINK_META.flatMap(({ key, label, glyph }) =>
        links[key] ? [{ key, label, glyph, href: links[key]! }] : [],
    );
}
