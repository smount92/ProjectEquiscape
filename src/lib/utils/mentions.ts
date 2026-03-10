/**
 * Extract @mentions from text content.
 * Supports two formats:
 *   - @SimpleAlias (no spaces, 3-30 chars)
 *   - @"Alias With Spaces" (quoted, for aliases that contain spaces)
 * Returns an array of unique alias names (without the @ prefix or quotes).
 */
export function extractMentions(text: string): string[] {
    // Match both @simple and @"quoted with spaces"
    const regex = /(?:^|\s)@"([^"]{3,30})"|(?:^|\s)@([a-zA-Z0-9_-]{3,30})/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const alias = match[1] || match[2]; // group 1 = quoted, group 2 = simple
        if (alias && !matches.includes(alias)) {
            matches.push(alias);
        }
    }
    return matches;
}
