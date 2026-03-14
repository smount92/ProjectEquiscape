import type { MetadataRoute } from "next";

/**
 * sitemap.xml — Tells search engines about all discoverable pages.
 *
 * Static pages are always included with appropriate priorities.
 * Dynamic pages (community horses, shows, profiles) could be added later
 * by querying the database for public content.
 *
 * Next.js automatically serves this at /sitemap.xml.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    const now = new Date();

    return [
        // ── Core static pages ──
        {
            url: baseUrl,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 1.0,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.6,
        },
        {
            url: `${baseUrl}/privacy`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.4,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.4,
        },
        {
            url: `${baseUrl}/getting-started`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/faq`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.6,
        },

        // ── Public community pages ──
        {
            url: `${baseUrl}/community`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/discover`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/feed`,
            lastModified: now,
            changeFrequency: "hourly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/community/groups`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/community/events`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/community/help-id`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.6,
        },

        // ── Public feature pages ──
        {
            url: `${baseUrl}/market`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/shows`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/studio`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.7,
        },
    ];
}
