import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFeedStream, getFeedCapabilities } from "@/app/actions/posts";
import { getMyGroups } from "@/app/actions/groups";
import { getEvents } from "@/app/actions/events";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import FeedStream from "@/components/feed/FeedStream";
import PaddockRail from "@/components/feed/PaddockRail";
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

    const [page, capabilities, profile, barns, upcoming] = await Promise.all([
        getFeedStream({ scope, limit: 25 }),
        getFeedCapabilities(),
        supabase.from("users").select("alias_name, avatar_url").eq("id", user.id).maybeSingle(),
        // The rail is decoration, not the page — a barn or events read
        // that fails must not take the feed down with it.
        getMyGroups().catch(() => []),
        getEvents({ upcoming: true, limit: 4 }).catch(() => []),
    ]);

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
                    first (owner, 2026-08-21), so it is the first thing on
                    the Paddock: a full leather band, not a rail line. */}
                <Link
                    href="/community"
                    className="leather-band stitched mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl px-6 py-5 no-underline transition-all hover:shadow-lg"
                    id="paddock-show-ring-door"
                >
                    <span aria-hidden="true" className="text-[2.2rem] leading-none">🏆</span>
                    <span className="min-w-0 flex-1">
                        <span className="text-engraved-light block font-serif text-xl font-bold tracking-[0.02em]">
                            The Show Ring
                        </span>
                        <span className="block text-sm" style={{ color: "var(--leather-text-soft)" }}>
                            The community&rsquo;s horses on show — browse, favorite, and find your
                            next obsession.
                        </span>
                    </span>
                    <span className="btn-brass inline-flex shrink-0 items-center gap-1.5">
                        Step into the ring →
                    </span>
                </Link>

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
