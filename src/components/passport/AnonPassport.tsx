import { notFound } from "next/navigation";
import Link from "next/link";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPublicImageUrls } from "@/lib/utils/storage";
import PassportGallery from "@/components/PassportGallery";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { referenceHref, referencePagesEnabled } from "@/lib/catalog/referenceUrl";
import { PARCHMENT_INK } from "@/lib/theme/parchment";

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
        referencePagesEnabled() && horse.catalog_id && cat
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

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                compact
                icon="🏆"
                title="Show Ring"
                subtitle="Public passport"
                backHref="/community"
                backLabel="Show Ring"
            />
            <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
                {/* Gallery */}
                <div className="overflow-hidden rounded-2xl shadow-md">
                    <PassportGallery images={galleryImages} />
                </div>

                {/* Ledger card (read-only) */}
                <div
                    className="flex min-h-[100%] flex-col gap-4 rounded-3xl border border-input bg-[#C8B596] px-6 py-8 shadow-sm md:px-10"
                    style={PARCHMENT_INK}
                >
                    <div>
                        <h1 className="mb-1 font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                            {horse.custom_name}
                        </h1>
                        {cat ? (
                            <p className="mb-1 text-base text-secondary-foreground">
                                {refHref ? (
                                    <Link
                                        href={refHref}
                                        className="font-semibold text-forest underline decoration-2 underline-offset-2"
                                    >
                                        {cat.maker} — {cat.title}{" "}
                                        <span aria-hidden="true" className="text-forest">
                                            →
                                        </span>
                                    </Link>
                                ) : (
                                    <>
                                        {cat.maker} — {cat.title}
                                    </>
                                )}
                            </p>
                        ) : (
                            <p className="mb-1 text-base italic text-secondary-foreground opacity-60">
                                Unlisted / Custom Entry
                            </p>
                        )}
                    </div>

                    <div className="text-sm text-secondary-foreground">
                        Owned by <span className="font-semibold">@{ownerAlias}</span>
                    </div>

                    {forSale && (
                        <div className="rounded-lg border border-forest/30 bg-forest/5 p-4">
                            <div className="text-lg font-bold text-foreground">
                                {horse.listing_price != null ? `$${horse.listing_price}` : "Open to offers"}
                            </div>
                            <div className="text-sm text-secondary-foreground">{horse.trade_status}</div>
                        </div>
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
        </ExplorerLayout>
    );
}
