/**
 * Safari-safe UUID v4 generator.
 * crypto.randomUUID() is only available in secure contexts (HTTPS)
 * and was added in Safari 15.4. This fallback uses crypto.getRandomValues()
 * which has been available since Safari 11.
 */
export function safeUUID(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        try {
            return crypto.randomUUID();
        } catch {
            // Falls through to manual implementation
        }
    }

    // Manual UUID v4 via crypto.getRandomValues (Safari 11+)
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xx) bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
