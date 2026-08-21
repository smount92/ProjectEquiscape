import { notFound } from "next/navigation";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPublicImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PublicCardsSection from "@/components/shows/PublicCardsSection";
import { Button } from "@/components/ui/button";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { PARCHMENT_INK } from "@/lib/theme/parchment";
import { getPublicHorseRecords } from "@/lib/shows/publicRecords";
import {
    isChampionshipRecord,
    recordChipLabel,
    sortRecordsBestFirst,
    summarizeShowRecords,
    verifiedChipLabel,
    type MarketRecordDetailRow,
} from "@/lib/market/recordSummary";
import PassportMasthead from "@/components/passport/PassportMasthead";
import BuyerPanel from "@/components/passport/BuyerPanel";
import { DetailRow, LedgerBlock } from "@/components/passport/PassportDetails";
import { getPublicHorseCards } from "@/lib/shows/publicCards";
import { getHorseTitles } from "@/lib/shows/horseTitles";
import { titlePrefix } from "@/lib/shows/titles";
import TitlesSection from "@/components/shows/TitlesSection";
import AssetDetailRenderer from "@/components/AssetDetailRenderer";
import { getAssetConfig } from "@/lib/config/assetFields";
import type { AssetCategory } from "@/lib/types/database";
import { getPublicFavoriteCount } from "@/lib/favorites/publicCount";

// Read-only public passport for logged-OUT visitors (FUNNEL-4). The full
// interactive passport (favorite/comment/message/hoofprint) stays in
// community/[id]/page.tsx untouched for authenticated users; this renders the
// public-safe subset from the get_public_passport DEFINER RPC (migration 135)
// and funnels visitors to sign up. Never touches the users table directly.

const ANGLE_LABELS: Record<string, string> = {
    Primary_Thumbnail: "Near-Side",
    Left_Side: "Left Side",
    Right_Side: "Right Side",
    Front: "Front",
    Rear: "Rear",
    Detail: "Detail",
};

// get_public_passport (135) already returns every field below — the
// anon card used to declare (and render) only a handful of them, which
// is what left the tan panel half empty. Declaring the rest costs no
// extra read.
interface PassportHorse {
    id: string;
    custom_name: string;
    finish_type: string | null;
    condition_grade: string | null;
    catalog_id: string | null;
    trade_status: string | null;
    listing_price: number | null;
    edition_number: number | null;
    edition_size: number | null;
    public_notes: string | null;
    asset_category: string | null;
    attributes: Record<string, unknown> | null;
    created_at: string | null;
    finishing_artist: string | null;
    finishing_artist_verified: boolean | null;
    finish_details: string | null;
    assigned_breed: string | null;
    assigned_gender: string | null;
    assigned_age: string | null;
    regional_id: string | null;
}

interface PassportCatalog {
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    item_type: string;
    attributes: Record<string, unknown> | null;
}

interface PassportRow {
    horse: PassportHorse | null;
    owner_alias: string | null;
    catalog: PassportCatalog | null;
    images: { image_url: string; angle_profile: string; short_slug: string | null }[] | null;
}

/** "Recent placings, best first" — the anon record list shows at most this many. */
const TOP_RECORDS_SHOWN = 10;

/** Same fuzzy-date preference as HorseRecordChip / ShowRecordTimeline. */
function formatShowDate(dateStr: string | null, dateText: string | null): string | null {
    if (dateText && (!dateStr || dateStr.endsWith("-01-01"))) return dateText;
    if (!dateStr) return null;
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

/**
 * Verification tier as VISIBLE text — anon buyers are mostly on shared
 * links/mobile, where title-attr tooltips don't exist. Legacy NAN rows
 * carry their own ⭐ badge, so self-reported NAN rows skip the 📝 tag.
 */
function TierText({ tier, isNan }: { tier: string | null; isNan: boolean }) {
    if (tier === "platform_generated") {
        return (
            <span className="inline-flex items-center gap-[2px] rounded-sm bg-success/15 px-1.5 py-[1px] text-[0.65rem] font-bold text-success">
                🛡️ MHH verified
            </span>
        );
    }
    if (tier === "host_verified") {
        return (
            <span className="inline-flex items-center gap-[2px] rounded-sm bg-info/15 px-1.5 py-[1px] text-[0.65rem] font-bold text-info">
                ✅ Host verified
            </span>
        );
    }
    if (isNan) return null;
    return (
        <span className="inline-flex items-center gap-[2px] rounded-sm bg-muted px-1.5 py-[1px] text-[0.65rem] font-medium text-muted-foreground">
            📝 Self-reported
        </span>
    );
}

/** One compact record line — adapted from the market quick-look RecordRow. */
function AnonRecordRow({ record }: { record: MarketRecordDetailRow }) {
    const champion = isChampionshipRecord(record.placing, record.ribbonColor);
    const date = formatShowDate(record.showDate, record.showDateText);
    return (
        <li className="rounded-md bg-muted px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={champion ? "font-serif font-bold text-warning" : "font-semibold text-foreground"}>
                    {champion ? "🏆 " : "🎖️ "}
                    {record.placing || "Shown"}
                </span>
                {record.isNan && (
                    <span className="inline-flex items-center gap-[2px] rounded-sm bg-warning/15 px-1.5 py-[1px] text-[0.65rem] font-bold tracking-wider text-warning uppercase">
                        ⭐ NAN
                    </span>
                )}
                <TierText tier={record.verificationTier} isNan={record.isNan} />
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-secondary-foreground">
                {record.className && <span>{record.className}</span>}
                <span>
                    {record.showId ? (
                        <Link href={`/shows/${record.showId}`} className="text-forest no-underline hover:underline">
                            {record.showName}
                        </Link>
                    ) : (
                        record.showName
                    )}
                </span>
                {date && <span>· {date}</span>}
            </div>
        </li>
    );
}

export default async function AnonPassport({
    horseId,
    backToMarket = false,
}: {
    horseId: string;
    /** Arrived from the marketplace browse — back breadcrumb returns there. */
    backToMarket?: boolean;
}) {
    const supabase = createAnonClient();
    // get_public_passport ships in migration 135 (not yet in generated types → cast).
    const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: { p_horse_id: string },
    ) => Promise<{ data: PassportRow[] | null }>;
    const { data } = await rpc("get_public_passport", { p_horse_id: horseId });

    const row = data?.[0];
    if (!row || !row.horse) notFound();

    // Show records via the anon-safe get_public_horse_records RPC
    // (migration 146) — [] until the migration is applied, so the
    // section below feature-detects itself away. Best results first,
    // capped, with the summary line the market quick-look uses.
    const showRecords = await getPublicHorseRecords(horseId);
    const recordSummary =
        summarizeShowRecords(
            showRecords.map((r) => ({
                horse_id: horseId,
                placing: r.placing,
                ribbon_color: r.ribbonColor,
                verification_tier: r.verificationTier,
            })),
        ).get(horseId) ?? null;
    const topRecords = sortRecordsBestFirst(showRecords).slice(0, TOP_RECORDS_SHOWN);

    const horse = row.horse;
    const cat = row.catalog;
    const ownerAlias = row.owner_alias ?? "Collector";
    const rawImages = row.images ?? [];

    const urlMap = getPublicImageUrls(rawImages.map((i) => i.image_url));
    const galleryImages = rawImages.map((img) => ({
        signedUrl: urlMap.get(img.image_url) || img.image_url,
        angle_profile: img.angle_profile,
        label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
        shortSlug: img.short_slug || null,
    }));

    const refHref =
        horse.catalog_id && cat
            ? referenceHref({
                  id: horse.catalog_id,
                  maker: cat.maker,
                  title: cat.title,
                  maker_slug: cat.maker_slug,
                  slug: cat.slug,
              })
            : null;

    const forSale = horse.trade_status === "For Sale" || horse.trade_status === "Open to Offers";
    const loginHref = `/login?redirectTo=${encodeURIComponent(`/community/${horseId}`)}`;

    // Independent anon-safe reads — one round trip, not four.
    //  · titles           horse_titles is SELECT TO authenticated, anon (159)
    //  · favorite count    NO anon read path today → null (see publicCount.ts)
    const [publicCardsForCount, publicTitles, favoriteCount] = await Promise.all([
        forSale ? getPublicHorseCards(horseId) : Promise.resolve([]),
        getHorseTitles(horseId),
        getPublicFavoriteCount(horseId),
    ]);
    const cardsCount = publicCardsForCount.length;
    const publicNamePrefix = titlePrefix(publicTitles.map((t) => t.code));

    // Same reference framing the member card uses.
    const catAttrs = (cat?.attributes ?? {}) as Record<string, unknown>;
    const refInfo = cat
        ? {
              type: cat.item_type === "artist_resin" ? "Artist Resin" : "Mold",
              name: cat.title,
              maker: cat.maker,
              scale: cat.scale || "Unknown",
              extra:
                  cat.item_type === "artist_resin"
                      ? (catAttrs.cast_medium as string | null)
                      : catAttrs.release_year_start
                        ? `First released ${catAttrs.release_year_start}`
                        : null,
          }
        : null;
    const releaseInfo =
        cat && cat.item_type === "plastic_release"
            ? {
                  name: cat.title,
                  modelNumber: catAttrs.model_number as string | null,
                  color: catAttrs.color_description as string | null,
                  yearStart: catAttrs.release_year_start as number | null,
                  yearEnd: catAttrs.release_year_end as number | null,
              }
            : null;

    const assetCat = (horse.asset_category || "model") as AssetCategory;
    const assetConfig = getAssetConfig(assetCat);
    const horseAttributes = (horse.attributes ?? {}) as Record<string, unknown>;
    const hasShowIdentity =
        assetConfig.showShowBio &&
        !!(horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id);

    return (
        <ExplorerLayout noHeader>
            <PassportMasthead
                horseName={
                    publicNamePrefix ? `${publicNamePrefix} ${horse.custom_name}` : horse.custom_name
                }
                ownerAlias={ownerAlias}
                referenceName={cat ? `${cat.maker} — ${cat.title}` : null}
                referenceHref={refHref}
                backHref={backToMarket ? "/market" : "/community"}
                backLabel={backToMarket ? "Marketplace" : "Show Ring"}
                favoriteCount={favoriteCount}
            />
            <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
                {/* Gallery */}
                <div className="self-start overflow-hidden rounded-2xl shadow-md" id="passport-photos">
                    <PassportGallery images={galleryImages} />
                </div>

                {/* Ledger card (read-only). `self-start`, NOT min-h-[100%]:
                    the card used to stretch to the gallery's height and
                    push its login CTA to the bottom of a field of empty
                    tan. It now ends where its content ends. */}
                <div
                    className="flex flex-col gap-3 self-start rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10"
                    style={PARCHMENT_INK}
                >
                    {/* Buyer panel — the masthead carries the name +
                        reference; the anon variant renders login-CTA
                        equivalents with the same redirectTo the bottom
                        CTA uses. */}
                    {forSale && (
                        <BuyerPanel
                            horseId={horseId}
                            horseName={horse.custom_name}
                            tradeStatus={horse.trade_status as "For Sale" | "Open to Offers"}
                            listingPrice={horse.listing_price}
                            conditionGrade={horse.condition_grade}
                            recordSummary={recordSummary}
                            cardsCount={cardsCount}
                            variant="anon"
                            loginHref={loginHref}
                            hoofprintHref={`/community/${horseId}/hoofprint`}
                        />
                    )}

                    {/* Owner pill — the anon card's one identity anchor;
                        /profile/[alias] is a public page. */}
                    <Link
                        href={`/profile/${encodeURIComponent(ownerAlias)}`}
                        className="inline-flex w-fit items-center gap-1 rounded-full border border-input bg-card py-1.5 pr-3.5 pl-1.5 text-sm font-semibold text-foreground no-underline shadow-md"
                    >
                        <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border border-input bg-muted text-muted-foreground">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </span>
                        <span>@{ownerAlias}</span>
                    </Link>
                    <Link
                        href={`/profile/${encodeURIComponent(ownerAlias)}`}
                        className="text-sm text-muted-foreground no-underline"
                        id="see-more-seller"
                    >
                        See all models from @{ownerAlias} →
                    </Link>

                    {/* Model Details — same rows, same rhythm as the member
                        ledger; every value comes from get_public_passport. */}
                    <LedgerBlock
                        icon="📋"
                        title={
                            assetCat === "model"
                                ? "Model Details"
                                : `${assetCat.charAt(0).toUpperCase()}${assetCat.slice(1)} Details`
                        }
                        testId="anon-model-details"
                    >
                        {assetCat !== "model" && (
                            <DetailRow label="Category">
                                {assetCat === "tack"
                                    ? "🏇 Tack & Gear"
                                    : assetCat === "prop"
                                      ? "🌲 Prop"
                                      : assetCat === "diorama"
                                        ? "🎭 Diorama"
                                        : "🐄 Other Model"}
                            </DetailRow>
                        )}
                        {horse.finish_type && (
                            <DetailRow label="Finish Type">{horse.finish_type}</DetailRow>
                        )}
                        {horse.condition_grade && (
                            <DetailRow label="Condition">
                                <span className="inline-flex items-center gap-[4px] rounded-full border border-success/30 bg-success/10 px-[10px] py-[2px] text-sm font-semibold text-success">
                                    {horse.condition_grade}
                                </span>
                            </DetailRow>
                        )}
                        {refInfo ? (
                            <>
                                <DetailRow label={refInfo.type}>{refInfo.name}</DetailRow>
                                <DetailRow
                                    label={refInfo.type === "Mold" ? "Manufacturer" : "Sculptor"}
                                >
                                    {refInfo.maker}
                                </DetailRow>
                                <DetailRow label="Scale">{refInfo.scale}</DetailRow>
                                {refInfo.extra && (
                                    <DetailRow
                                        label={refInfo.type === "Mold" ? "Released" : "Medium"}
                                    >
                                        {refInfo.extra}
                                    </DetailRow>
                                )}
                            </>
                        ) : (
                            <DetailRow label="Reference">
                                <span className="italic opacity-60">
                                    Not linked to database — Custom Entry
                                </span>
                            </DetailRow>
                        )}
                        {releaseInfo && (
                            <>
                                <DetailRow label="Release">{releaseInfo.name}</DetailRow>
                                {releaseInfo.modelNumber && (
                                    <DetailRow label="Model #">#{releaseInfo.modelNumber}</DetailRow>
                                )}
                                {releaseInfo.color && (
                                    <DetailRow label="Color">{releaseInfo.color}</DetailRow>
                                )}
                                {releaseInfo.yearStart && (
                                    <DetailRow label="Release Years">
                                        {releaseInfo.yearStart}
                                        {releaseInfo.yearEnd &&
                                        releaseInfo.yearEnd !== releaseInfo.yearStart
                                            ? `–${releaseInfo.yearEnd}`
                                            : ""}
                                    </DetailRow>
                                )}
                            </>
                        )}
                        {horse.finishing_artist && (
                            <DetailRow label="🎨 Finished by">
                                {horse.finishing_artist}
                                {horse.finishing_artist_verified && (
                                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-xs font-semibold text-success">
                                        ✅ Verified
                                    </span>
                                )}
                            </DetailRow>
                        )}
                        {(horse.edition_number || horse.edition_size) && (
                            <DetailRow label="📋 Edition">
                                {horse.edition_number && horse.edition_size
                                    ? `${horse.edition_number} of ${horse.edition_size}`
                                    : horse.edition_size
                                      ? `Limited to ${horse.edition_size}`
                                      : `#${horse.edition_number}`}
                            </DetailRow>
                        )}
                        {horse.created_at && (
                            <DetailRow label="Added">
                                {new Date(horse.created_at).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </DetailRow>
                        )}
                    </LedgerBlock>

                    {assetCat !== "model" && Object.keys(horseAttributes).length > 0 && (
                        <AssetDetailRenderer category={assetCat} attributes={horseAttributes} />
                    )}

                    {horse.finish_details && (
                        <LedgerBlock icon="✨" title="Finish">
                            <DetailRow label="Finish Details">{horse.finish_details}</DetailRow>
                        </LedgerBlock>
                    )}

                    {hasShowIdentity && (
                        <LedgerBlock icon="🏅" title="Show Identity" testId="anon-show-identity">
                            {horse.assigned_breed && (
                                <DetailRow label="Breed">{horse.assigned_breed}</DetailRow>
                            )}
                            {horse.assigned_gender && (
                                <DetailRow label="Gender">{horse.assigned_gender}</DetailRow>
                            )}
                            {horse.assigned_age && (
                                <DetailRow label="Age">{horse.assigned_age}</DetailRow>
                            )}
                            {horse.regional_id && (
                                <DetailRow label="Regional ID">{horse.regional_id}</DetailRow>
                            )}
                        </LedgerBlock>
                    )}

                    {horse.public_notes && (
                        <LedgerBlock icon="📝" title="Notes">
                            <p className="m-0 leading-[1.6] whitespace-pre-wrap text-secondary-foreground">
                                {horse.public_notes}
                            </p>
                        </LedgerBlock>
                    )}

                    <div className="rounded-lg border border-input bg-card/60 p-4 text-center">
                        <p className="mb-3 text-sm text-secondary-foreground">
                            {forSale
                                ? "Log in to message the owner and make an offer."
                                : "Log in to message the owner, favorite this model, and see its full history."}
                        </p>
                        <Button asChild>
                            <Link href={loginHref}>Log in or create a free account</Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Show Record — the buyer trust section. Anon-safe RPC
                (migration 146); renders nothing pre-migration or when
                the horse has no records. Best placings first, tier
                labels as visible text (no hover-only meaning). */}
            {topRecords.length > 0 && (
                <section
                    className="animate-fade-in-up mt-8"
                    aria-label="Show record"
                    id="passport-show-record"
                >
                    <div className="bg-card border-input rounded-lg border p-6 shadow-md">
                        <h3 className="mb-1 font-serif text-lg font-bold text-foreground">
                            <span aria-hidden="true">🏆</span> Show Record
                        </h3>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-secondary-foreground">
                            <span className="font-semibold text-foreground">{recordChipLabel(recordSummary)}</span>
                            {verifiedChipLabel(recordSummary) && (
                                <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 px-2 py-[1px] text-xs font-bold text-success">
                                    ✅ {verifiedChipLabel(recordSummary)}
                                </span>
                            )}
                        </div>
                        <ul className="m-0 list-none space-y-2 p-0">
                            {topRecords.map((record) => (
                                <AnonRecordRow key={record.id} record={record} />
                            ))}
                        </ul>
                        {showRecords.length > topRecords.length && (
                            <p className="mt-3 mb-0 text-xs text-muted-foreground italic">
                                Best {topRecords.length} of {showRecords.length} results shown —{" "}
                                <Link href={loginHref} className="text-forest hover:underline">
                                    log in
                                </Link>{" "}
                                to see the full trophy case.
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* MHH Titles (159) — public record (horse_titles is SELECT
                TO authenticated, anon), so the logged-out passport shows
                the same permanent titles the member one does. Renders
                nothing when the horse holds none. */}
            {publicTitles.length > 0 && (
                <div className="animate-fade-in-up mt-8">
                    <TitlesSection titles={publicTitles} />
                </div>
            )}

            {/* MHH Qualification Cards — the buyer trust section, same
                anon-safe RPC path as the rest of this page (migration
                141). Renders nothing pre-migration or with no cards. */}
            <PublicCardsSection horseId={horseId} />
        </ExplorerLayout>
    );
}
