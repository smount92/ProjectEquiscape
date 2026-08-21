import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFeedStream, getFeedCapabilities } from "@/app/actions/posts";
import { getMyGroups } from "@/app/actions/groups";
import { getEvents } from "@/app/actions/events";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import FeedStream from "@/components/feed/FeedStream";
import PaddockRail from "@/components/feed/PaddockRail";
import ShowRingDoor, { type ShowRingPreviewHorse } from "@/components/feed/ShowRingDoor";
import { getPublicImageUrls } from "@/lib/utils/storage";
import Link from "next/link";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Globe, Users } from "lucide-react";

export const metadata = {
    title: "The Paddock",
    description: "The Model Horse Hub community's gathering place — posts, barns, events and the show ring.",
};

/**
 * THE PADDOCK — one feed, and the room it stands in.
 *
 * This page used to be two feeds pretending to be tabs: a "Global"
 * tab reading `posts` with every contextual post deliberately
 * excluded, and a "Following" tab reading the entirely separate
 * legacy `activity_events` table. A comment on a horse, a post in a
 * group, a show publishing its results — none of it reached either.
 *
 * Now both tabs are the same stream with a different author filter,
 * and the stream includes public contextual posts. Private and
 * unlisted horses, and private/restricted groups, never appear:
 * see isGloballyVisible in lib/feed/stream.ts.
 *
 * Composition (owner, 2026-08): the Paddock IS the community room,
 * so the barns, the events board and the show ring are folded in as
 * a rail beside the stream rather than living off in unrelated URLs.
 * Rail data is read-only and fetched here, once, in the same
 * Promise.all as the stream — no per-item fetching downstream.
 */
export default async function FeedPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?redirectTo=" + encodeURIComponent("/feed"));

    const { tab } = await searchParams;
    const scope = tab === "following" ? "following" : "everyone";

    const [page, capabilities, profile, barns, upcoming, ringRows, myBlocks] = await Promise.all([
        getFeedStream({ scope, limit: 25 }),
        getFeedCapabilities(),
        supabase.from("users").select("alias_name, avatar_url").eq("id", user.id).maybeSingle(),
        // The rail is decoration, not the page — a barn or events read
        // that fails must not take the feed down with it.
        getMyGroups().catch(() => []),
        getEvents({ upcoming: true, limit: 4 }).catch(() => []),
        // Show Ring preview: the latest public horses WITH photos
        // (!inner requires at least one image — a strip of 🐴
        // placeholders sells nothing). Same failure rule as the rail.
        supabase
            .from("user_horses")
            .select("id, owner_id, custom_name, created_at, horse_images!inner(image_url, angle_profile)")
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(8)
            .then((r) => r.data ?? [])
            .catch(() => []),
        supabase
            .from("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", user.id)
            .then((r) => r.data ?? [])
            .catch(() => []),
    ]);

    // Collector-designated main shot, else the first photo — then one
    // batched signing pass for the whole strip. Blocked users' horses
    // are hidden here like everywhere else (fetched 8, shown ≤6).
    const blockedOwnerIds = new Set(
        (myBlocks as { blocked_id: string }[]).map((b) => b.blocked_id),
    );
    const ringRaw = (ringRows as unknown as {
        id: string;
        owner_id: string;
        custom_name: string | null;
        horse_images: { image_url: string; angle_profile: string | null }[] | null;
    }[])
        .filter((h) => !blockedOwnerIds.has(h.owner_id))
        .slice(0, 6)
        .map((h) => {
            const imgs = h.horse_images ?? [];
            const primary = imgs.find((i) => i.angle_profile === "Primary_Thumbnail") ?? imgs[0];
            return { id: h.id, name: h.custom_name || "Unnamed horse", raw: primary?.image_url ?? null };
        });
    const ringUrlMap = getPublicImageUrls(ringRaw.flatMap((h) => (h.raw ? [h.raw] : [])));
    const ringHorses: ShowRingPreviewHorse[] = ringRaw
        .filter((h) => h.raw)
        .map((h) => ({ id: h.id, name: h.name, thumbnailUrl: ringUrlMap.get(h.raw!) ?? h.raw! }));

    const me = (profile.data as { alias_name: string; avatar_url: string | null } | null) ?? null;
    const avatarMap = await resolveAvatarUrls([me?.avatar_url ?? null]);
    const myAvatar = me?.avatar_url ? avatarMap.get(me.avatar_url) || me.avatar_url : null;

    /* Everyone / Following is a lens on one stream, so it gets the
       site's chip vocabulary (.studio-chip, as on the events board and
       the catalog filters) rather than two browser-default buttons. */
    const scopeChip = (active: boolean) =>
        `studio-chip no-underline ${active ? "active" : ""}`;

    return (
        // noHeader + frameless: the leather masthead below IS this
        // page's header, and each column brings its own ledger paper.
        <ExplorerLayout noHeader frameless>
            <div className="animate-fade-in-up mx-auto max-w-6xl">
                <PageMasthead
                    icon="🐴"
                    title="The Paddock"
                    subtitle="Where the hobby gathers — barns, events and the show ring"
                />

                {/* THE SHOW RING DOOR — the room people actually walk to
                    first (owner), with a preview strip of the latest
                    horses so the door shows what's inside. */}
                <ShowRingDoor horses={ringHorses} />

                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
                    {/* ── The stream ── */}
                    <div className="min-w-0">
                        <nav
                            aria-label="Feed scope"
                            className="mb-5 flex flex-wrap items-center gap-1.5"
                        >
                            <Link href="/feed" className={scopeChip(scope === "everyone")}>
                                <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Everyone
                            </Link>
                            <Link
                                href="/feed?tab=following"
                                className={scopeChip(scope === "following")}
                            >
                                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Following
                            </Link>
                        </nav>

                        <FeedStream
                            initialItems={page.items}
                            initialCursor={page.nextCursor}
                            initialAliases={page.knownAliases}
                            scope={scope}
                            currentUserId={user.id}
                            currentUserAlias={me?.alias_name ?? "You"}
                            currentUserAvatar={myAvatar}
                            visibilityEnabled={capabilities.visibility}
                            /* Following is a lens on the same stream, not a place to
                               write to — composing always posts to the one feed. */
                            showComposer={scope === "everyone"}
                            label={scope === "following" ? "From People You Follow" : "Community Posts"}
                            emptyMessage={
                                scope === "following"
                                    ? "Follow collectors on the Discover page to see their posts here!"
                                    : "Nothing here yet — be the first to post!"
                            }
                        />
                    </div>

                    {/* ── The rooms that open off it ── */}
                    <PaddockRail barns={barns} events={upcoming} />
                </div>
            </div>
        </ExplorerLayout>
    );
}
