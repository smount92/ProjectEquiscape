import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import { showsV2Enabled } from "@/lib/shows/flags";

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

/** Public horse passport (/community/[id]) — id + created_at only, no PII. */
type PublicHorseRow = {
    id: string;
    created_at: string | null;
};

/** Public v2 show (/shows/[id]) — id + updated_at only. */
type PublicShowRow = {
    id: string;
    updated_at: string | null;
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
    ];

    // ── Dynamic catalog reference pages (~10,900 rows, within the 50k limit) ──
    // Only listed once the reference pages are live (NEXT_PUBLIC_REFERENCE_PAGES),
    // so we never advertise URLs that 404. Guarded so any DB failure degrades
    // gracefully to the static entries.
    let referenceEntries: MetadataRoute.Sitemap = [];
    if (referencePagesEnabled()) try {
        const supabase = await createClient();
        // PostgREST caps a query at 1000 rows — page through all ~10,900.
        const PAGE = 1000;
        const rows: CatalogReferenceRow[] = [];
        for (let from = 0; from < 60_000; from += PAGE) {
            const { data, error } = await supabase
                .from("catalog_items")
                .select("maker_slug, slug, created_at")
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as unknown as CatalogReferenceRow[]));
            if (data.length < PAGE) break;
        }
        referenceEntries = rows
            .filter((row) => row.maker_slug && row.slug)
            .map((row): MetadataRoute.Sitemap[number] => ({
                url: `${baseUrl}/reference/${row.maker_slug}/${row.slug}`,
                lastModified: row.created_at ?? now,
                changeFrequency: "weekly",
                priority: 0.6,
            }));
    } catch {
        // Never throw from sitemap(): fall back to the static entries only.
        referenceEntries = [];
    }

    // ── Dynamic public horse passports (/community/[id]) ──
    // user_horses is `SELECT TO authenticated` only (migration 109) — anon
    // can't read it directly, which is why /community/[id] serves logged-out
    // visitors through the get_public_passport RPC (migration 135) instead of
    // a table query. Sitemap generation has no user session, so it needs the
    // admin (service-role) client to enumerate rows; we still manually filter
    // to `visibility = 'public'` (never 'unlisted' — those are link-only by
    // design, not meant to be crawled) and select only id/created_at, never
    // owner_id or any other private/PII column. Capped well under the 50k
    // sitemap limit; any DB failure degrades gracefully.
    let horseEntries: MetadataRoute.Sitemap = [];
    try {
        const admin = getAdminClient();
        const PAGE = 1000;
        const HORSE_CAP = 20_000;
        const rows: PublicHorseRow[] = [];
        for (let from = 0; from < HORSE_CAP; from += PAGE) {
            const { data, error } = await admin
                .from("user_horses")
                .select("id, created_at")
                .eq("visibility", "public")
                .is("deleted_at", null)
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as unknown as PublicHorseRow[]));
            if (data.length < PAGE) break;
        }
        horseEntries = rows.map((row): MetadataRoute.Sitemap[number] => ({
            url: `${baseUrl}/community/${row.id}`,
            lastModified: row.created_at ?? now,
            changeFrequency: "monthly",
            priority: 0.5,
        }));
    } catch {
        horseEntries = [];
    }

    // ── Dynamic public v2 shows (/shows/[id]) ──
    // /shows/[id] is the canonical URL for v2 shows too (src/app/shows/[id]/
    // page.tsx resolves by id; /shows/v2/[id] just redirects here). Every
    // non-draft status is anon-visible on the show page itself (RLS policy
    // "Public reads non-draft shows", migration 118) — draft is the only
    // status that never renders publicly — so this uses the same anon-safe
    // server client as the catalog reference query above. Gated behind
    // NEXT_PUBLIC_SHOWS_V2 (default off, src/lib/shows/flags.ts) — same
    // reasoning as referencePagesEnabled() above: never advertise URLs the
    // resolver would fall through to the legacy show system for.
    let showEntries: MetadataRoute.Sitemap = [];
    if (showsV2Enabled()) try {
        const supabase = await createClient();
        const PAGE = 1000;
        const SHOW_CAP = 5_000;
        const rows: PublicShowRow[] = [];
        for (let from = 0; from < SHOW_CAP; from += PAGE) {
            const { data, error } = await supabase
                .from("shows")
                .select("id, updated_at")
                .neq("status", "draft")
                .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            rows.push(...(data as unknown as PublicShowRow[]));
            if (data.length < PAGE) break;
        }
        showEntries = rows.map((row): MetadataRoute.Sitemap[number] => ({
            url: `${baseUrl}/shows/${row.id}`,
            lastModified: row.updated_at ?? now,
            changeFrequency: "weekly",
            priority: 0.6,
        }));
    } catch {
        showEntries = [];
    }

    return [...staticEntries, ...referenceEntries, ...horseEntries, ...showEntries];
}
