import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import MarketValueBadge from "@/components/MarketValueBadge";
import { getPublicImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import VaultReveal from "@/components/VaultReveal";
import DeleteHorseModal from "@/components/DeleteHorseModal";
import ShowRecordTimeline from "@/components/ShowRecordTimeline";
import PedigreeCard from "@/components/PedigreeCard";
import HoofprintTimeline from "@/components/HoofprintTimeline";
import TransferModal from "@/components/TransferModal";
import ParkedExportPanel from "@/components/ParkedExportPanel";
import { getHoofprint } from "@/app/actions/hoofprint";

export const dynamic = "force-dynamic";

// Types
interface HorseDetail {
    id: string;
    owner_id: string;
    custom_name: string;
    finish_type: string | null;
    condition_grade: string | null;
    asset_category: string;
    is_for_sale: boolean;
    is_public: boolean;
    created_at: string;
    sculptor: string | null;
    finishing_artist: string | null;
    finishing_artist_verified: boolean;
    edition_number: number | null;
    edition_size: number | null;
    catalog_id: string | null;
    trade_status: string | null;
    catalog_items: {
        title: string;
        maker: string;
        scale: string | null;
        item_type: string;
        attributes: Record<string, unknown>;
    } | null;
    finish_details: string | null;
    public_notes: string | null;
    assigned_breed: string | null;
    assigned_gender: string | null;
    assigned_age: string | null;
    regional_id: string | null;
}

interface HorseImage {
    id: string;
    image_url: string;
    angle_profile: string;
    uploaded_at: string;
}

interface VaultData {
    purchase_price: number | null;
    purchase_date: string | null;
    estimated_current_value: number | null;
    insurance_notes: string | null;
    purchase_date_text: string | null;
}

const ANGLE_LABELS: Record<string, string> = {
    Primary_Thumbnail: "Primary Thumbnail",
    Left_Side: "Left Side",
    Right_Side: "Right Side",
    Front_Chest: "Front / Chest",
    Back_Hind: "Back / Hind",
    Belly_Makers_Mark: "Belly / Mark",
    Detail_Face_Eyes: "Face & Eyes Detail",
    Detail_Ears: "Ears Detail",
    Detail_Hooves: "Hooves Detail",
    Flaw_Rub_Damage: "Flaws / Damage",
    extra_detail: "Detail",
    Other: "Other",
};

// Priority for sorting images (thumbnail first)
const ANGLE_ORDER: string[] = [
    "Primary_Thumbnail",
    "Right_Side",
    "Front_Chest",
    "Back_Hind",
    "Belly_Makers_Mark",
    "Left_Side",
    "Detail_Face_Eyes",
    "Detail_Ears",
    "Detail_Hooves",
    "Flaw_Rub_Damage",
    "extra_detail",
    "Other",
];

export default async function HorsePassportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: horseId } = await params;
    const supabase = await createClient();

    // Check auth
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch horse with reference data
    const { data: rawHorse } = await supabase
        .from("user_horses")
        .select(
            `
      id, owner_id, custom_name, finish_type, condition_grade, asset_category,
      is_for_sale, is_public, created_at, sculptor, finishing_artist, finishing_artist_verified, edition_number, edition_size, catalog_id, trade_status,
      finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id,
      catalog_items:catalog_id(title, maker, scale, item_type, attributes)
    `,
        )
        .eq("id", horseId)
        .single();

    if (!rawHorse) {
        notFound();
    }

    const horse = rawHorse as unknown as HorseDetail;

    // Only the owner can see the full passport for now
    if (horse.owner_id !== user.id) {
        notFound();
    }

    // Check wishlist demand (only for owner, unlisted horses with catalog_id)
    let wishlistDemand = 0;
    if (horse.trade_status === "Not for Sale" && horse.catalog_id) {
        const { count } = await supabase
            .from("user_wishlists")
            .select("id", { count: "exact", head: true })
            .eq("catalog_id", horse.catalog_id)
            .neq("user_id", user.id);
        wishlistDemand = count || 0;
    }

    // Fetch all images
    const { data: rawImages } = await supabase
        .from("horse_images")
        .select("id, image_url, angle_profile, uploaded_at")
        .eq("horse_id", horseId)
        .order("uploaded_at");

    const images = (rawImages as unknown as HorseImage[]) ?? [];

    // Sort by angle priority
    images.sort((a, b) => {
        const aIdx = ANGLE_ORDER.indexOf(a.angle_profile);
        const bIdx = ANGLE_ORDER.indexOf(b.angle_profile);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });

    // Generate signed URLs for all images
    const imageUrls = images.map((img) => img.image_url);
    const signedUrlMap = getPublicImageUrls(imageUrls);

    const galleryImages = images.map((img) => ({
        signedUrl: signedUrlMap.get(img.image_url) || img.image_url,
        angle_profile: img.angle_profile,
        label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
    }));

    // Fetch financial vault (owner-only via RLS)
    const { data: rawVault } = await supabase
        .from("financial_vault")
        .select("purchase_price, purchase_date, estimated_current_value, insurance_notes, purchase_date_text")
        .eq("horse_id", horseId)
        .single<VaultData>();

    const vault = rawVault ?? null;

    // Fetch owner's currency symbol
    const { data: ownerProfile } = await supabase.from("users").select("currency_symbol").eq("id", user.id).single();
    const currencySymbol = (ownerProfile as { currency_symbol: string } | null)?.currency_symbol || "$";

    // ================================================================
    // PROVENANCE: Show Records + Pedigree
    // ================================================================

    const { data: rawRecords } = await supabase
        .from("show_records")
        .select(
            'id, show_name, show_date, division, class_name, "placing", ribbon_color, judge_name, is_nan, notes, show_location, section_name, award_category, competition_level, show_date_text',
        )
        .eq("horse_id", horseId)
        .order("show_date", { ascending: false, nullsFirst: false });

    const showRecords = (rawRecords ?? []).map(
        (r: {
            id: string;
            show_name: string;
            show_date: string | null;
            division: string | null;
            class_name: string | null;
            placing: string | null;
            ribbon_color: string | null;
            judge_name: string | null;
            is_nan: boolean;
            notes: string | null;
            show_location: string | null;
            section_name: string | null;
            award_category: string | null;
            competition_level: string | null;
            show_date_text: string | null;
        }) => ({
            id: r.id,
            showName: r.show_name,
            showDate: r.show_date,
            division: r.division,
            className: r.class_name,
            placing: r.placing,
            ribbonColor: r.ribbon_color,
            judgeName: r.judge_name,
            isNan: r.is_nan,
            notes: r.notes,
            showLocation: r.show_location,
            sectionName: r.section_name,
            awardCategory: r.award_category,
            competitionLevel: r.competition_level,
            showDateText: r.show_date_text,
        }),
    );

    const { data: rawPedigree } = await supabase
        .from("horse_pedigrees")
        .select("id, sire_name, dam_name, sire_id, dam_id, sculptor, cast_number, edition_size, lineage_notes")
        .eq("horse_id", horseId)
        .maybeSingle();

    const pedigree = rawPedigree
        ? {
              id: rawPedigree.id as string,
              sireName: (rawPedigree as { sire_name: string | null }).sire_name,
              damName: (rawPedigree as { dam_name: string | null }).dam_name,
              sireId: (rawPedigree as { sire_id: string | null }).sire_id,
              damId: (rawPedigree as { dam_id: string | null }).dam_id,
              sculptor: (rawPedigree as { sculptor: string | null }).sculptor,
              castNumber: (rawPedigree as { cast_number: string | null }).cast_number,
              editionSize: (rawPedigree as { edition_size: string | null }).edition_size,
              lineageNotes: (rawPedigree as { lineage_notes: string | null }).lineage_notes,
          }
        : null;

    // Hoofprint data
    const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);

    // Check if horse is parked (for Parked Export panel)
    const isParked = lifeStage === "parked";
    let existingPin: string | null = null;
    if (isParked) {
        const { data: activeTransfer } = await supabase
            .from("horse_transfers")
            .select("claim_pin")
            .eq("horse_id", horseId)
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .not("claim_pin", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        existingPin = (activeTransfer as { claim_pin: string } | null)?.claim_pin || null;
    }

    // Reference display info
    const cat = horse.catalog_items;
    const refInfo = cat
        ? {
              type: cat.item_type === "artist_resin" ? "Artist Resin" : "Mold",
              name: cat.title,
              maker: cat.maker,
              scale: cat.scale || "Unknown",
              extra:
                  cat.item_type === "artist_resin"
                      ? (cat.attributes?.cast_medium as string | null)
                      : cat.attributes?.release_year_start
                        ? `First released ${cat.attributes.release_year_start}`
                        : null,
          }
        : null;

    const releaseInfo =
        cat && cat.item_type === "plastic_release"
            ? {
                  name: cat.title,
                  modelNumber: cat.attributes?.model_number as string | null,
                  color: cat.attributes?.color_description as string | null,
                  yearStart: cat.attributes?.release_year_start as number | null,
                  yearEnd: cat.attributes?.release_year_end as number | null,
              }
            : null;

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
            {/* Breadcrumb */}
            <nav className="text-muted animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
                <Link href="/dashboard">Digital Stable</Link>
                <span className="separator" aria-hidden="true">
                    /
                </span>
                <span>{horse.custom_name}</span>
            </nav>

            {/* Wishlist demand banner */}
            {wishlistDemand > 0 && (
                <div className="animate-fade-in-up mt-4 mb-6 rounded-lg border border-[rgba(44,85,69,0.2)] border-[rgba(239,68,68,0.3)] bg-[rgba(44,85,69,0.08)] bg-[rgba(239,68,68,0.1)] px-6 py-4 text-sm leading-relaxed">
                    🔥{" "}
                    <strong>
                        {wishlistDemand} collector{wishlistDemand > 1 ? "s" : ""}
                    </strong>{" "}
                    {wishlistDemand > 1 ? "are" : "is"} looking for this model! List it for sale to notify them.
                </div>
            )}

            {/* Two-column layout: Gallery | Info */}
            <div className="grid-cols-[1fr 420px] animate-fade-in-up grid items-stretch gap-[0] overflow-hidden rounded-lg shadow-lg">
                {/* Left: Gallery */}
                <div>
                    <PassportGallery images={galleryImages} />
                </div>

                {/* Right: Info sidebar */}
                <div className="flex min-h-[100%] flex-col gap-2 bg-[#C8B596] px-6 py-8">
                    {/* Title */}
                    <div>
                        <h1 className="mb-1 text-[calc(1.75rem*var(--font-scale))] leading-[1.15] font-extrabold tracking-[-0.02em] text-[#2D2318]">
                            {horse.custom_name}
                        </h1>
                        {refInfo ? (
                            <p className="mb-1 text-[calc(var(--font-size-md)*var(--font-scale))] text-[#59493A]">
                                {refInfo.maker} — {refInfo.name}
                            </p>
                        ) : (
                            <p
                                className="mb-1 text-[calc(var(--font-size-md)*var(--font-scale))] text-[#59493A] opacity-[0.6]"
                                style={{ fontStyle: "italic" }}
                            >
                                Unlisted / Custom Entry
                            </p>
                        )}
                    </div>

                    {/* Model Details Card */}
                    <div className="passport-detail-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                        <h3>
                            <span aria-hidden="true">📋</span>{" "}
                            {(horse.asset_category || "model") === "model"
                                ? "Model Details"
                                : `${(horse.asset_category || "model").charAt(0).toUpperCase() + (horse.asset_category || "model").slice(1)} Details`}
                        </h3>

                        {horse.asset_category && horse.asset_category !== "model" && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Category
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.asset_category === "tack"
                                        ? "🏇 Tack & Gear"
                                        : horse.asset_category === "prop"
                                          ? "🌲 Prop"
                                          : "🎭 Diorama"}
                                </span>
                            </div>
                        )}

                        {horse.finish_type && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Finish Type
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.finish_type}
                                </span>
                            </div>
                        )}

                        {horse.condition_grade && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Condition
                                </span>
                                <span className="text-success inline-flex items-center gap-[4px] rounded-full border border-[rgba(92,224,160,0.25)] bg-[rgba(92,224,160,0.1)] px-[10px] py-[2px] text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.condition_grade}
                                </span>
                            </div>
                        )}

                        {refInfo ? (
                            <>
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        {refInfo.type}
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {refInfo.name}
                                    </span>
                                </div>

                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        {refInfo.type === "Mold" ? "Manufacturer" : "Sculptor"}
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {refInfo.maker}
                                    </span>
                                </div>

                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Scale
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {refInfo.scale}
                                    </span>
                                </div>

                                {refInfo.extra && (
                                    <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                        <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                            {refInfo.type === "Mold" ? "Released" : "Medium"}
                                        </span>
                                        <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                            {refInfo.extra}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Reference
                                </span>
                                <span
                                    className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold opacity-[0.6]"
                                    style={{ fontStyle: "italic" }}
                                >
                                    Not linked to database — Custom Entry
                                </span>
                            </div>
                        )}

                        {releaseInfo && (
                            <>
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Release
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {releaseInfo.name}
                                    </span>
                                </div>

                                {releaseInfo.modelNumber && (
                                    <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                        <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                            Model #
                                        </span>
                                        <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                            #{releaseInfo.modelNumber}
                                        </span>
                                    </div>
                                )}

                                {releaseInfo.color && (
                                    <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                        <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                            Color
                                        </span>
                                        <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                            {releaseInfo.color}
                                        </span>
                                    </div>
                                )}

                                {releaseInfo.yearStart && (
                                    <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                        <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                            Release Years
                                        </span>
                                        <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                            {releaseInfo.yearStart}
                                            {releaseInfo.yearEnd && releaseInfo.yearEnd !== releaseInfo.yearStart
                                                ? `–${releaseInfo.yearEnd}`
                                                : ""}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                            <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">Added</span>
                            <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                {new Date(horse.created_at).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        </div>

                        <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                            <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">Photos</span>
                            <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                {images.length} uploaded
                            </span>
                        </div>

                        {horse.sculptor && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Sculptor / Artist
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.sculptor}
                                </span>
                            </div>
                        )}

                        {horse.finishing_artist && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    🎨 Finished by
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.finishing_artist}
                                    {horse.finishing_artist_verified && (
                                        <span
                                            className="verified-badge"
                                            title="Verified via commission delivery"
                                            style={{
                                                marginLeft: 6,
                                                color: "var(--color-accent-success, #22c55e)",
                                                fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                            }}
                                        >
                                            ✅ Verified
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}

                        {(horse.edition_number || horse.edition_size) && (
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    📋 Edition
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.edition_number && horse.edition_size
                                        ? `${horse.edition_number} of ${horse.edition_size}`
                                        : horse.edition_size
                                          ? `Limited to ${horse.edition_size}`
                                          : `#${horse.edition_number}`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Finish Details */}
                    {horse.finish_details && (
                        <div className="passport-detail-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                            <h3>
                                <span aria-hidden="true">✨</span> Finish
                            </h3>
                            <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                    Finish Details
                                </span>
                                <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                    {horse.finish_details}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Show Bio */}
                    {(horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
                        <div className="passport-detail-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                            <h3>
                                <span aria-hidden="true">🏅</span> Show Identity
                            </h3>
                            {horse.assigned_breed && (
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Breed
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {horse.assigned_breed}
                                    </span>
                                </div>
                            )}
                            {horse.assigned_gender && (
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Gender
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {horse.assigned_gender}
                                    </span>
                                </div>
                            )}
                            {horse.assigned_age && (
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Age
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {horse.assigned_age}
                                    </span>
                                </div>
                            )}
                            {horse.regional_id && (
                                <div className="border-[rgba(255, 255, 255, 0.04)] flex items-center justify-between border-b px-[0] py-[5px]">
                                    <span className="text-muted text-[calc(0.8rem*var(--font-scale))] font-medium">
                                        Regional ID
                                    </span>
                                    <span className="text-ink max-w-[60%] text-right text-[calc(0.8rem*var(--font-scale))] font-semibold">
                                        {horse.regional_id}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Public Notes */}
                    {horse.public_notes && (
                        <div className="passport-detail-bg-card border-edge rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                            <h3>
                                <span aria-hidden="true">📝</span> Notes
                            </h3>
                            <p className="text-ink-light m-0 leading-[1.6] whitespace-pre-wrap">{horse.public_notes}</p>
                        </div>
                    )}

                    {/* Market Value Badge */}
                    {horse.catalog_id && <MarketValueBadge catalogId={horse.catalog_id} />}

                    {/* Show Records */}
                    <ShowRecordTimeline horseId={horseId} records={showRecords} isOwner={true} />

                    {/* Pedigree Card */}
                    <PedigreeCard horseId={horseId} pedigree={pedigree} isOwner={true} />

                    {/* 🐾 Hoofprint™ Timeline */}
                    <HoofprintTimeline
                        horseId={horseId}
                        timeline={timeline}
                        ownershipChain={ownershipChain}
                        lifeStage={lifeStage}
                        isOwner={true}
                        currentUserId={user.id}
                    />

                    {/* Financial Vault */}
                    <VaultReveal vault={vault} currencySymbol={currencySymbol} />

                    {/* Actions */}
                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/dashboard"
                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                            id="back-to-stable"
                        >
                            ← Back to Stable
                        </Link>
                        <Link
                            href={`/stable/${horseId}/edit`}
                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                            id="edit-horse-button"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit Details
                        </Link>
                        <ParkedExportPanel
                            horseId={horseId}
                            horseName={horse.custom_name}
                            isParked={isParked}
                            existingPin={existingPin}
                        />
                        <TransferModal horseId={horseId} horseName={horse.custom_name} />
                        <DeleteHorseModal
                            horseId={horseId}
                            horseName={horse.custom_name}
                            imageUrls={images.map((img) => img.image_url)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
