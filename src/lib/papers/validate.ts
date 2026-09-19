/**
 * Papers — breeding certificates, registration papers, pedigree charts
 * filed on a horse (migration 213).
 *
 * The hobby's pedigrees are a social contract: a "breeding" between two
 * members' models comes with a certificate, and the sire's and dam's own
 * pages live on their owners' sites. This module is the vocabulary and
 * the rules — file types, sizes, where a file may live in the bucket,
 * what an outbound link may be — shared by the form, the server action
 * and the passport, and tested once.
 */

export type PaperKind = "breeding_certificate" | "registration" | "pedigree_chart" | "other";

export const PAPER_KINDS: { value: PaperKind; label: string; glyph: string; hint: string }[] = [
    {
        value: "breeding_certificate",
        label: "Breeding certificate",
        glyph: "📜",
        hint: "Issued by the sire's or dam's program when the breeding was granted.",
    },
    {
        value: "registration",
        label: "Registration papers",
        glyph: "🏛️",
        hint: "A model registry's papers for this horse.",
    },
    {
        value: "pedigree_chart",
        label: "Pedigree chart",
        glyph: "🌳",
        hint: "The family tree as issued or as you keep it.",
    },
    { value: "other", label: "Other papers", glyph: "🗂️", hint: "Anything else that belongs with the horse." },
];

export const PAPER_KIND_LABELS: Record<string, string> = Object.fromEntries(
    PAPER_KINDS.map((k) => [k.value, k.label]),
);

export function isPaperKind(x: unknown): x is PaperKind {
    return typeof x === "string" && PAPER_KINDS.some((k) => k.value === x);
}

/** Mirrors the bucket's allowed_mime_types (213). */
export const PAPER_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
]);
/** Mirrors the bucket's file_size_limit and the byte_size CHECK. */
export const MAX_PAPER_BYTES = 10 * 1024 * 1024;
/** Enough for a certificate, its registry papers and a chart or two. */
export const MAX_PAPERS_PER_HORSE = 12;
export const MAX_PAPER_TITLE = 120;
export const MAX_PAPER_ISSUER = 120;
export const MAX_PAPER_NOTES = 1000;
export const MAX_OUTBOUND_URL = 500;

export function isPdf(mime: string): boolean {
    return mime === "application/pdf";
}

/** The file extension a stored paper gets from its MIME type. */
export function extensionFor(mime: string): string {
    switch (mime) {
        case "application/pdf":
            return "pdf";
        case "image/png":
            return "png";
        case "image/gif":
            return "gif";
        case "image/jpeg":
            return "jpg";
        default:
            return "webp";
    }
}

/**
 * Where a paper may live: {owner}/{horse}/{uuid}.{ext}. The server
 * re-derives everything from the path and refuses anything else, so a
 * client can never name an object it doesn't own.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export function isValidPaperPath(path: string, ownerId: string, horseId: string): boolean {
    const re = new RegExp(`^${ownerId}/${horseId}/${UUID}\\.(webp|jpg|png|gif|pdf)$`, "i");
    return re.test(path);
}

/** A client-side check before any upload starts. */
export function validatePaperFile(file: { type: string; size: number }): string | null {
    if (!PAPER_MIMES.has(file.type)) {
        return "Papers can be a photo or scan (JPG, PNG, WebP, GIF) or a PDF.";
    }
    if (file.size > MAX_PAPER_BYTES) return "That file is over 10 MB — a scan at 300 dpi is usually well under.";
    if (file.size <= 0) return "That file is empty.";
    return null;
}

/**
 * An outbound link a member typed: the sire's page, the dam's page.
 * https (or http) only, tidied, nothing else — a `javascript:` or a bare
 * word is dropped, never rendered.
 */
export function safeHttpUrl(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const s = raw.trim();
    if (!s) return null;
    try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
        if (u.protocol !== "https:" && u.protocol !== "http:") return null;
        if (!u.hostname.includes(".")) return null;
        const out = u.toString();
        return out.length <= MAX_OUTBOUND_URL ? out : null;
    } catch {
        return null;
    }
}

/** "starrfyre.com" for a link label, so a long address can't blow out a row. */
export function linkHost(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

/** "Issued by Starrfyre · March 2014" — whichever parts exist. */
export function issuedLine(issuedBy: string | null, issuedOn: string | null): string | null {
    const when = issuedOn
        ? new Date(`${issuedOn}T00:00:00Z`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
          })
        : null;
    if (issuedBy && when) return `Issued by ${issuedBy} · ${when}`;
    if (issuedBy) return `Issued by ${issuedBy}`;
    if (when) return `Issued ${when}`;
    return null;
}
