import type { MetadataRoute } from "next";

/**
 * robots.txt — Controls search engine crawling behavior.
 *
 * Public pages:  Landing, About, Contact, Privacy, Terms, Show Ring, Discover,
 *                Market (Price Guide), Shows, Community, Feed, Studio.
 *
 * Private pages: Dashboard, Stable, Inbox, Notifications, Settings, Admin,
 *                Add-Horse, Auth flows.
 *
 * Robots.txt is a "please don't crawl" signal, NOT a security measure.
 * Real access control is enforced by auth middleware + RLS.
 */
export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    return {
        rules: [
            {
                userAgent: "*",
                allow: [
                    "/",
                    "/about",
                    "/contact",
                    "/privacy",
                    "/terms",
                    // Horse passports (/community/[id]) are genuinely public
                    // (anon RPC) — the login-walled community INDEX pages are
                    // disallowed below until they actually open up.
                    "/community",
                    "/community/*",
                    "/catalog",
                    "/catalog/*",
                    "/reference",
                    "/reference/*",
                    "/market",
                    "/market/*",
                    "/shows",
                    "/shows/*",
                    "/profile/*",
                    "/getting-started",
                    // Members directory. Was disallowed on the belief it
                    // redirected anon to /login; it does not, and migration
                    // 186 fixed the view that made it look empty.
                    "/discover",
                    "/discover/*",
                ],
                disallow: [
                    // /community/barns/* is the Barns-name alias that 307s
                    // into /community/groups/*. Kept out deliberately: the
                    // canonical /community/groups pages are crawlable above,
                    // and indexing both would be duplicate content.
                    "/community/barns",
                    "/community/barns/*",
                    "/dashboard",
                    "/dashboard/*",
                    "/stable",
                    "/stable/*",
                    "/inbox",
                    "/inbox/*",
                    "/notifications",
                    "/notifications/*",
                    "/settings",
                    "/settings/*",
                    "/admin",
                    "/admin/*",
                    "/add-horse",
                    "/add-horse/*",
                    "/login",
                    "/signup",
                    "/forgot-password",
                    "/auth/*",
                    "/claim",
                    "/claim/*",
                    "/api/*",
                    // Redirect anon to /login (personalized / members-only), so
                    // there's nothing for a crawler to index — keep them out.
                    // VERIFIED by fetching each as an anonymous client rather
                    // than assumed: only these two actually land on /login.
                    // Five others sat here on the same assumption and were
                    // serving full public pages the whole time — including
                    // /community/help-id, "Help Me ID This Model", which is
                    // the single page a newcomer is most likely to arrive on
                    // from a search and had three uses in its lifetime.
                    "/feed",
                    "/studio",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
