/**
 * Extract @mentions from text content.
 * Returns an array of unique alias names (without the @ prefix).
 */
export function extractMentions(text: string): string[] {
    const regex = /(?:^|\s)@([a-zA-Z0-9_-]{3,30})/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (!matches.includes(match[1])) {
            matches.push(match[1]);
        }
    }
    return matches;
}
