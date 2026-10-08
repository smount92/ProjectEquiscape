/**
 * Safely extract a required string field from FormData.
 * Returns null if missing, empty, or literally "null".
 */
export function getRequiredString(formData: FormData, key: string): string | null {
    const val = formData.get(key);
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") return null;
    return str;
}

/**
 * Safely extract an optional string field from FormData.
 */
export function getOptionalString(formData: FormData, key: string): string | null {
    const val = formData.get(key);
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str === "null" || str === "undefined") return null;
    return str;
}

/**
 * Safely extract a numeric field from FormData.
 */
export function getOptionalNumber(formData: FormData, key: string): number | null {
    const str = getOptionalString(formData, key);
    if (!str) return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

/**
 * Safely extract a boolean field from FormData.
 */
export function getBoolean(formData: FormData, key: string, defaultValue = false): boolean {
    const val = formData.get(key);
    if (val === null) return defaultValue;
    return String(val) === "true";
}

// ============================================================
// INPUT SANITIZATION — XSS Prevention
// Strip dangerous HTML/script content before database insertion.
// ============================================================

import sanitizeHtml from "sanitize-html";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";

/**
 * Sanitize plain-text input: strip ALL HTML tags and return PLAIN TEXT.
 * Use for names, titles, notes, descriptions, etc.
 *
 * The result is text, not HTML. sanitize-html escapes the characters it
 * keeps, so "Bugs & Help" came back as "Bugs &amp; Help" and was stored
 * that way; React then escaped it again on render and members saw the
 * literal "&amp;" in barn names, posts and messages (report, 2026-10-07).
 * Four call sites had grown their own decode-after-sanitize workaround.
 * The decode now lives here, once. Plain text is always rendered as
 * text (React escapes it), so a decoded "<" is inert.
 */
export function sanitizeText(input: string): string {
    return decodeHtmlEntities(
        sanitizeHtml(input, {
            allowedTags: [],
            allowedAttributes: {},
        }),
    ).trim();
}

/**
 * Sanitize rich-text input: allow a safe subset of HTML.
 * Use for bio fields, post content, etc.
 */
export function sanitizeRichText(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
        allowedAttributes: {
            a: ["href", "target", "rel"],
        },
        allowedSchemes: ["https", "http", "mailto"],
    }).trim();
}
