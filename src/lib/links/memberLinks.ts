/**
 * A member's outbound links — the one definition, used by the member
 * profile (users.links, migration 229) and the Art Studio storefront
 * (artist_profiles.links, migration 212).
 *
 * People type what they have to hand — "@blackfoxfarm", a full
 * Instagram URL, "blackfoxfarm.etsy.com", the link to their trader
 * feedback thread. Normalise to one https URL per slot so a page
 * renders a clickable button and nothing else ever has to guess. Only
 * http(s) survives; anything that won't parse is dropped rather than
 * rendered as a broken link. Rendered links are always
 * rel="nofollow noopener noreferrer" — a member's links are theirs,
 * not this site's endorsement (member ask, 2026-10-11: "links to
 * Facebook groups and the transaction board").
 */

export type LinkKey = "instagram" | "facebook" | "etsy" | "website" | "feedback";

export type MemberLinks = Partial<Record<LinkKey, string>>;

export interface LinkMeta {
    key: LinkKey;
    label: string;
    glyph: string;
    placeholder: string;
}

export const LINK_META: LinkMeta[] = [
    { key: "instagram", label: "Instagram", glyph: "📸", placeholder: "@yourname or the profile link" },
    { key: "facebook", label: "Facebook", glyph: "📘", placeholder: "Page or group name, or the link" },
    { key: "etsy", label: "Etsy", glyph: "🧶", placeholder: "Shop name or the shop link" },
    { key: "website", label: "Website", glyph: "🌐", placeholder: "https://yoursite.com" },
    {
        key: "feedback",
        label: "Feedback board",
        glyph: "🤝",
        placeholder: "Link to your trader feedback thread or board",
    },
];

/** The slots a storefront offers (no feedback board — that is a trader's link). */
export const STUDIO_LINK_KEYS: readonly LinkKey[] = ["instagram", "facebook", "etsy", "website"];
/** The slots a member profile offers. */
export const PROFILE_LINK_KEYS: readonly LinkKey[] = ["facebook", "instagram", "website", "feedback"];

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

/** Normalise whatever was stored or typed into clean https URLs, for the given slots. */
export function normalizeMemberLinks(input: unknown, keys: readonly LinkKey[] = LINK_META.map((m) => m.key)): MemberLinks {
    if (!input || typeof input !== "object") return {};
    const out: MemberLinks = {};
    for (const key of keys) {
        const v = normalizeOne(key, (input as Record<string, unknown>)[key]);
        if (v) out[key] = v;
    }
    return out;
}

/** The links a page can render, in display order (the order of `keys`). */
export function linkEntries(
    links: MemberLinks,
    keys: readonly LinkKey[] = LINK_META.map((m) => m.key),
): { key: LinkKey; label: string; glyph: string; href: string }[] {
    return keys.flatMap((key) => {
        const meta = LINK_META.find((m) => m.key === key);
        const href = links[key];
        return meta && href ? [{ key, label: meta.label, glyph: meta.glyph, href }] : [];
    });
}

/** Meta for a subset of slots, in that order — what a form renders. */
export function linkMeta(keys: readonly LinkKey[]): LinkMeta[] {
    return keys.flatMap((key) => LINK_META.filter((m) => m.key === key));
}
