import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

/**
 * sitemap.xml — Tells search engines about all discoverable pages.
 *
 * Static pages are always included with appropriate priorities.
 * Dynamic pages (catalog reference releases) are appended by querying the
 * database for public content. Other dynamic pages (community horses, shows,
 * profiles) could be added later the same way.
 *
 * Next.js automatically serves this at /sitemap.xml.
 */

/**
 * Shape of the catalog_items columns we read for reference pages.
 * maker_slug / slug / created_at are added in migration 129 and may not yet
 * exist in the generated Database types, so query rows are cast through
 * `unknown` to this shape.
 */
type CatalogReferenceRow = {
    maker_slug: string | null;
    slug: string | null;
    created_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    const now = new Date();

    const staticEntries: MetadataRoute.Sitemap = [
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

    // ── Dynamic catalog reference pages (~10,900 rows, within the 50k limit) ──
    // Guarded so any DB failure degrades gracefully to the static entries.
    let referenceEntries: MetadataRoute.Sitemap = [];
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("catalog_items")
            .select("maker_slug, slug, created_at");

        if (!error && data) {
            const rows = data as unknown as CatalogReferenceRow[];
            referenceEntries = rows
                .filter((row) => row.maker_slug && row.slug)
                .map((row): MetadataRoute.Sitemap[number] => ({
                    url: `${baseUrl}/reference/${row.maker_slug}/${row.slug}`,
                    lastModified: row.created_at ?? now,
                    changeFrequency: "weekly",
                    priority: 0.6,
                }));
        }
    } catch {
        // Never throw from sitemap(): fall back to the static entries only.
        referenceEntries = [];
    }

    return [...staticEntries, ...referenceEntries];
}
