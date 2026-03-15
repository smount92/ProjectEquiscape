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

/**
 * Sanitize plain-text input: strip ALL HTML tags.
 * Use for names, titles, notes, descriptions, etc.
 */
export function sanitizeText(input: string): string {
    return sanitizeHtml(input, {
        allowedTags: [],
        allowedAttributes: {},
    }).trim();
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
