/**
 * Construct an eBay affiliate search URL for a catalog reference entry.
 * Uses the eBay Partner Network (EPN) "rover" redirect format.
 *
 * @param title - e.g. "Alborozo"
 * @param maker - e.g. "Breyer"
 * @param itemNumber - e.g. "712053"
 */

/**
 * rel for every affiliate anchor: `sponsored` is Google's required
 * marker for paid/affiliate links; noopener/noreferrer are the usual
 * target=_blank hygiene. Keep link markup and URL construction in one
 * module so a call site can't ship one without the other.
 */
export const EBAY_AFFILIATE_REL = "noopener noreferrer sponsored";

/** Plain-language disclosure to render near any affiliate link (FTC). */
export const EBAY_AFFILIATE_DISCLOSURE =
    "MHH may earn a commission from eBay links.";
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
