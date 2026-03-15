/**
 * Extract @mentions from text content.
 * Supports three formats:
 *   - @SimpleAlias (no spaces, 3-30 chars)
 *   - @"Alias With Spaces" (quoted, for aliases that contain spaces)
 *   - @Alias With Spaces (unquoted multi-word — greedy match up to 5 words)
 * Returns an array of unique alias names (without the @ prefix or quotes).
 */
export function extractMentions(text: string): string[] {
    const matches: string[] = [];

    // 1. Quoted mentions: @"Some Name"
    const quotedRegex = /@"([^"]{3,30})"/g;
    let match;
    while ((match = quotedRegex.exec(text)) !== null) {
        const alias = match[1];
        if (alias && !matches.includes(alias)) {
            matches.push(alias);
        }
    }

    // 2. Unquoted mentions: @word or @multi word (greedy up to 5 words, 3-30 chars total)
    //    This captures the longest possible match — the caller resolves against real usernames
    const unquotedRegex = /(?:^|[\s,;!?])@([\w][\w ]{1,29})/g;
    while ((match = unquotedRegex.exec(text)) !== null) {
        const raw = match[1].trim();
        if (raw.length >= 3 && !matches.includes(raw)) {
            matches.push(raw);
        }
    }

    return matches;
}
