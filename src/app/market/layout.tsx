import type { Metadata } from "next";

/**
 * Segment-level metadata for the market. Each page below overrides it
 * with its own title/description/canonical — /market (the marketplace
 * front door) and /market/guide (the Blue Book price guide) are two
 * distinct search results, not one.
 */
export const metadata: Metadata = {
    title: "Model Horse Marketplace — Buy Model Horses With Verified Show Records",
    description:
        "Browse model horses for sale from collectors, each with its full passport: verified show records, condition grade, and ownership history. Plus the Blue Book price guide of real completed sales.",
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
    return children;
}
