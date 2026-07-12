import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { Button } from "@/components/ui/button";

// Read-only public profile for logged-OUT visitors (FUNNEL-4 / MOVE-6). The full
// interactive profile (follow/message/block/rate/edit) stays in
// profile/[alias_name]/page.tsx untouched for members. All reads here go through
// the service-role client scoped STRICTLY to public data — public profile fields
// (never email/full_name), visibility='public' horses, aggregate follower count.
// No vault, no private horses. Additive; no new migration.

interface ProfileHorse {
    id: string;
    custom_name: string;
    finish_type: string | null;
    condition_grade: string | null;
    created_at: string;
    trade_status: string | null;
    listing_price: number | null;
    catalog_items: { title: string; maker: string } | null;
    horse_images: { image_url: string; angle_profile: string }[] | null;
}

export default async function AnonProfile({ alias }: { alias: string }) {
    const admin = getAdminClient();

    const { data: profileUser } = await admin
        .from("users")
        .select("id, alias_name, created_at, bio, avatar_url, show_badges, account_status")
        .eq("alias_name", alias)
        .maybeSingle<{
            id: string;
            alias_name: string;
            created_at: string;
            bio: string | null;
            avatar_url: string | null;
            show_badges: boolean | null;
            account_status: string;
        }>();

    if (!profileUser || profileUser.account_status === "deleted") notFound();

    // Avatar → signed URL (service role can read the avatars bucket).
    let avatarUrl = profileUser.avatar_url;
    if (avatarUrl && !avatarUrl.startsWith("http")) {
        const { data: signed } = await admin.storage.from("avatars").createSignedUrl(avatarUrl, 3600);
        avatarUrl = signed?.signedUrl ?? null;
    }

    const { data: rawHorses, count: publicHorseCount } = await admin
        .from("user_horses")
        .select(
            `id, custom_name, finish_type, condition_grade, created_at, trade_status, listing_price,
             catalog_items:catalog_id(title, maker), horse_images(image_url, angle_profile)`,
            { count: "exact" },
        )
        .eq("owner_id", profileUser.id)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(0, 23);
    const horses = (rawHorses ?? []) as unknown as ProfileHorse[];

    const { count: totalHorseCount } = await admin
        .from("user_horses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", profileUser.id)
        .is("deleted_at", null);

    const { count: followerCount } = await admin
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", profileUser.id);

    const thumbPaths = horses
        .map((h) => h.horse_images?.find((i) => i.angle_profile === "Primary_Thumbnail")?.image_url || h.horse_images?.[0]?.image_url)
        .filter((p): p is string => Boolean(p));
    const urlMap = getPublicImageUrls(thumbPaths);

    const memberSince = new Date(profileUser.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
    const loginHref = `/login?redirectTo=${encodeURIComponent(`/profile/${profileUser.alias_name}`)}`;

    const strapStats = [
        { num: String(totalHorseCount ?? 0), label: "Horses" },
        { num: String(publicHorseCount ?? 0), label: "Public" },
        { num: String(followerCount ?? 0), label: (followerCount ?? 0) === 1 ? "Follower" : "Followers" },
    ];

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
            <header className="leather-panel stitched animate-fade-in-up relative rounded-[14px] px-6 pt-8 pb-9 text-center">
                <div className="brass-medallion mx-auto mb-3">
                    {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt={profileUser.alias_name} className="h-full w-full object-cover" />
                    ) : (
                        <span aria-hidden="true">{profileUser.alias_name.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <h1 className="text-engraved-light mb-1 font-serif text-[clamp(1.5rem,4vw,2.3rem)] font-bold tracking-[0.13em] uppercase text-balance">
                    {profileUser.alias_name}
                </h1>
                <div className="font-serif text-[0.78rem] tracking-[0.2em] uppercase text-(--leather-text-soft)">
                    @{profileUser.alias_name} · Member since {memberSince}
                </div>
                {profileUser.bio && (
                    <p className="mx-auto mt-3 mb-0 max-w-[52ch] text-[0.92rem] italic text-(--leather-text)">
                        {profileUser.bio}
                    </p>
                )}
                <div className="masthead-cta mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Button asChild>
                        <Link href={loginHref}>Log in to follow or message</Link>
                    </Button>
                    <a href="#stable" className="btn-ghostleather">
                        Browse Stable →
                    </a>
                </div>
            </header>

            <div className="stats-strap relative -mt-4 mx-6 sm:mx-10" role="group" aria-label="Stable statistics">
                {strapStats.map((s) => (
                    <div key={s.label}>
                        <div className="stat-num">{s.num}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            <section className="animate-fade-in-up mt-8 scroll-mt-24" id="stable">
                <div className="brass-heading mb-3">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h2 className="font-serif text-base font-bold text-foreground">The Stable</h2>
                    <span className="ml-auto text-xs italic text-muted-foreground">
                        {publicHorseCount ?? 0} public model{(publicHorseCount ?? 0) !== 1 ? "s" : ""}
                    </span>
                </div>
                {horses.length === 0 ? (
                    <div className="ledger-paper px-8 py-12 text-center">
                        <div className="mb-4 text-5xl">🔒</div>
                        <h3 className="mb-2 text-lg font-bold text-foreground">
                            @{profileUser.alias_name} hasn&apos;t made any models public yet
                        </h3>
                        <p className="text-secondary-foreground">Check back later — they may share some soon!</p>
                    </div>
                ) : (
                    <div className="shelfwrap">
                        <div className="shelf-strip" role="region" aria-label="Public horses shelf">
                            {horses.map((h) => {
                                const path =
                                    h.horse_images?.find((i) => i.angle_profile === "Primary_Thumbnail")?.image_url ||
                                    h.horse_images?.[0]?.image_url;
                                const thumb = path ? urlMap.get(path) : null;
                                const forSale = h.trade_status === "For Sale" || h.trade_status === "Open to Offers";
                                return (
                                    <Link key={h.id} href={`/community/${h.id}`} className="polaroid w-[220px]">
                                        <div className="polaroid-photo">
                                            {thumb ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={thumb} alt={h.custom_name} loading="lazy" />
                                            ) : (
                                                <span>No Photo</span>
                                            )}
                                        </div>
                                        <div className="polaroid-name">{h.custom_name}</div>
                                        <div className="polaroid-breed">
                                            {h.catalog_items ? `${h.catalog_items.maker} ${h.catalog_items.title}` : "Unlisted Mold"}
                                            {h.finish_type ? ` · ${h.finish_type}` : ""}
                                        </div>
                                        {forSale && (
                                            <div className="mt-1 text-center">
                                                <span className="stamp stamp-red">
                                                    {h.trade_status === "For Sale" ? "For Sale" : "Open to Offers"}
                                                    {h.listing_price ? ` $${h.listing_price.toLocaleString("en-US")}` : ""}
                                                </span>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            <div className="mt-10 rounded-lg border border-input bg-card/60 p-6 text-center">
                <p className="mb-3 text-secondary-foreground">
                    Log in to follow @{profileUser.alias_name}, message them, and see their reviews &amp; trophies.
                </p>
                <Button asChild>
                    <Link href={loginHref}>Log in or create a free account</Link>
                </Button>
            </div>
        </div>
    );
}
