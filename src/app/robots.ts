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
                ],
                disallow: [
                    // Login-walled community surfaces (anon → /login). The $
                    // anchor keeps exactly /community out while /community/*
                    // passport pages stay crawlable via the allow above.
                    "/community$",
                    "/community/groups",
                    "/community/groups/*",
                    // /community/barns/* is the Barns-name alias that
                    // 307s into /community/groups/* — equally walled.
                    "/community/barns",
                    "/community/barns/*",
                    "/community/events",
                    "/community/events/*",
                    "/community/help-id",
                    "/community/help-id/*",
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
                    "/feed",
                    "/discover",
                    "/discover/*",
                    "/studio",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
