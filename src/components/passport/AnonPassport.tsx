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
import { getPublicHorseCards } from "@/lib/shows/publicCards";

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
}

interface PassportCatalog {
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    item_type: string;
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

export default async function AnonPassport({ horseId }: { horseId: string }) {
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

    const cardsCount = forSale ? (await getPublicHorseCards(horseId)).length : 0;

    return (
        <ExplorerLayout noHeader>
            <PassportMasthead
                horseName={horse.custom_name}
                ownerAlias={ownerAlias}
                referenceName={cat ? `${cat.maker} — ${cat.title}` : null}
                referenceHref={refHref}
                backHref="/community"
                backLabel="Show Ring"
            />
            <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
                {/* Gallery */}
                <div className="overflow-hidden rounded-2xl shadow-md" id="passport-photos">
                    <PassportGallery images={galleryImages} />
                </div>

                {/* Ledger card (read-only) */}
                <div
                    className="flex min-h-[100%] flex-col gap-4 rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10"
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

                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        {horse.finish_type && (
                            <div>
                                <dt className="text-muted-foreground">Finish</dt>
                                <dd className="font-semibold text-foreground">{horse.finish_type}</dd>
                            </div>
                        )}
                        {horse.condition_grade && (
                            <div>
                                <dt className="text-muted-foreground">Condition</dt>
                                <dd className="font-semibold text-foreground">{horse.condition_grade}</dd>
                            </div>
                        )}
                        {cat?.scale && (
                            <div>
                                <dt className="text-muted-foreground">Scale</dt>
                                <dd className="font-semibold text-foreground">{cat.scale}</dd>
                            </div>
                        )}
                        {horse.edition_number != null && (
                            <div>
                                <dt className="text-muted-foreground">Edition</dt>
                                <dd className="font-semibold text-foreground">
                                    #{horse.edition_number}
                                    {horse.edition_size ? ` / ${horse.edition_size}` : ""}
                                </dd>
                            </div>
                        )}
                    </dl>

                    {horse.public_notes && (
                        <p className="whitespace-pre-line text-sm text-secondary-foreground">{horse.public_notes}</p>
                    )}

                    <div className="mt-auto rounded-lg border border-input bg-card/60 p-4 text-center">
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

            {/* MHH Qualification Cards — the buyer trust section, same
                anon-safe RPC path as the rest of this page (migration
                141). Renders nothing pre-migration or with no cards. */}
            <PublicCardsSection horseId={horseId} />
        </ExplorerLayout>
    );
}
