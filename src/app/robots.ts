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
                    "/community",
                    "/community/*",
                    "/discover",
                    "/discover/*",
                    "/market",
                    "/market/*",
                    "/shows",
                    "/shows/*",
                    "/feed",
                    "/studio",
                    "/profile/*",
                    "/getting-started",
                ],
                disallow: [
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
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
