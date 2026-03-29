/**
 * Construct an eBay affiliate search URL for a catalog reference entry.
 * Uses the eBay Partner Network (EPN) "rover" redirect format.
 *
 * @param title - e.g. "Alborozo"
 * @param maker - e.g. "Breyer"
 * @param itemNumber - e.g. "712053"
 */
export function buildEbaySearchUrl(
    title: string,
    maker?: string | null,
    itemNumber?: string | null
): string {
    const campaignId = process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID;

    // Build a smart search query
    const parts: string[] = [];
    if (maker) parts.push(maker);
    parts.push(title);
    if (itemNumber) parts.push(`#${itemNumber}`);
    // Add "model horse" to narrow results
    parts.push("model horse");

    const query = encodeURIComponent(parts.join(" "));

    // eBay Partner Network redirect URL format
    if (campaignId) {
        return `https://www.ebay.com/sch/i.html?_nkw=${query}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${campaignId}&toolid=10001&mkevt=1`;
    }

    // Fallback: direct eBay search (no affiliate tracking)
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&_sacat=417`;
}
