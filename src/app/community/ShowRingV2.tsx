/**
 * Show Ring v2 (NEXT_PUBLIC_SHOWRING_V2) — the filter-engine rebuild
 * of the community showcase. Ledger filter bar → server-filtered grid
 * fed by getShowRingPage (one shared query core; blocked users
 * excluded in SQL; facets across ALL public horses). The URL is the
 * single source of truth for filters.
 *
 * The stats row, Help-Me-ID link, and Featured Horse spotlight carry
 * over from the legacy page unchanged.
 */

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

import FeaturedHorseCard from "@/components/FeaturedHorseCard";
import ShowRingBrowser from "@/components/showring/ShowRingBrowser";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { getShowRingPage } from "@/app/actions/showring";
import { parseShowRingSearchParams } from "@/lib/showring/filterParams";

interface FeaturedHorse {
    horseId: string;
    horseName: string;
    title: string;
    description: string | null;
    ownerAlias: string;
    thumbnailUrl: string | null;
    finishType: string;
}

/** Most recent non-expired featured horse (same logic as legacy page). */
async function fetchFeaturedHorse(): Promise<FeaturedHorse | null> {
    const supabase = await createClient();

    const { data: rawFeatured } = await supabase
        .from("featured_horses")
        .select("id, horse_id, title, description, featured_at")
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("featured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!rawFeatured) return null;
    const feat = rawFeatured as { horse_id: string; title: string; description: string | null };

    const { data: fHorse } = await supabase
        .from("user_horses")
        .select(
            `id, custom_name, finish_type, owner_id,
             users!inner(alias_name),
             horse_images(image_url, angle_profile)`,
        )
        .eq("id", feat.horse_id)
        .single();

    if (!fHorse) return null;
    const h = fHorse as unknown as {
        id: string;
        custom_name: string;
        finish_type: string | null;
        users: { alias_name: string };
        horse_images: { image_url: string; angle_profile: string }[] | null;
    };
    const thumb = h.horse_images?.find((i) => i.angle_profile === "Primary_Thumbnail");
    const imgUrl = thumb?.image_url || h.horse_images?.[0]?.image_url;
    let signedFeatUrl: string | null = null;
    if (imgUrl) {
        const fMap = getPublicImageUrls([imgUrl]);
        signedFeatUrl = fMap.get(imgUrl) || null;
    }
    return {
        horseId: h.id,
        horseName: h.custom_name,
        title: feat.title,
        description: feat.description,
        ownerAlias: h.users.alias_name,
        thumbnailUrl: signedFeatUrl,
        finishType: h.finish_type ?? "OF",
    };
}

export default async function ShowRingV2({
    searchParams,
}: {
    searchParams: Record<string, string | string[] | undefined>;
}) {
    const filters = parseShowRingSearchParams(searchParams);

    const [pageResult, featuredHorse] = await Promise.all([
        getShowRingPage(filters),
        fetchFeaturedHorse(),
    ]);

    const cards = pageResult.success ? pageResult.cards : [];
    const totalCount = pageResult.success ? pageResult.totalCount : 0;
    const hasMore = pageResult.success ? pageResult.hasMore : false;
    const facetOptions = pageResult.success
        ? pageResult.facetOptions
        : { makers: [], scales: [], finishes: [] };

    return (
        <>
            {!pageResult.success && (
                <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {pageResult.error}
                </div>
            )}

            {/* Stats + Help ID link */}
            <div className="mt-6 flex items-center gap-6">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-forest">{totalCount}</span>
                    <span className="text-sm font-medium text-secondary-foreground">Models Showcased</span>
                </div>
                <Link
                    href="/community/help-id"
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-card px-5 py-2 text-sm font-semibold text-foreground no-underline shadow-sm transition-all hover:border-stone-400 hover:bg-muted"
                    id="help-id-link"
                >
                    🔍 Help Me ID
                </Link>
            </div>

            {/* Featured Horse */}
            {featuredHorse && <FeaturedHorseCard {...featuredHorse} />}

            <div className="mt-6">
                <ShowRingBrowser
                    initialCards={cards}
                    totalCount={totalCount}
                    initialHasMore={hasMore}
                    facetOptions={facetOptions}
                    filters={filters}
                />
            </div>
        </>
    );
}
