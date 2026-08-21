import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFeedStream, getFeedCapabilities } from "@/app/actions/posts";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import FeedStream from "@/components/feed/FeedStream";
import Link from "next/link";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import { Globe, Users } from "lucide-react";

export const metadata = {
    title: "Activity Feed",
    description: "See the latest activity from the Model Horse Hub community.",
};

/**
 * ONE FEED.
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

    const [page, capabilities, profile] = await Promise.all([
        getFeedStream({ scope, limit: 25 }),
        getFeedCapabilities(),
        supabase.from("users").select("alias_name, avatar_url").eq("id", user.id).maybeSingle(),
    ]);

    const me = (profile.data as { alias_name: string; avatar_url: string | null } | null) ?? null;
    const avatarMap = await resolveAvatarUrls([me?.avatar_url ?? null]);
    const myAvatar = me?.avatar_url ? avatarMap.get(me.avatar_url) || me.avatar_url : null;

    const tabClass = (active: boolean) =>
        `inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm whitespace-nowrap no-underline transition-all ${
            active
                ? "bg-forest font-semibold text-white shadow-sm"
                : "text-secondary-foreground hover:bg-card hover:text-foreground"
        }`;

    return (
        <ExplorerLayout
            title={<span className="text-forest">Activity Feed</span>}
            description="Stay up to date with what's happening in the community."
            /* The feed brings its own leather panel — skip the archetype's
               ledger surface so leather sits directly on the page
               background (fixes the double-framing artifact). */
            frameless
            controls={
                <div className="flex w-fit gap-1 rounded-lg border border-input bg-muted/60 p-1">
                    <Link href="/feed" className={tabClass(scope === "everyone")}>
                        <Globe className="h-4 w-4" /> Everyone
                    </Link>
                    <Link href="/feed?tab=following" className={tabClass(scope === "following")}>
                        <Users className="h-4 w-4" /> Following
                    </Link>
                </div>
            }
        >
            <div className="feed-leather leather-panel stitched mt-6">
                <h2 className="feed-leather-title">Stable Activity Feed</h2>
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
                    variant="leather"
                    emptyMessage={
                        scope === "following"
                            ? "Follow collectors on the Discover page to see their posts here!"
                            : "Nothing here yet — be the first to post!"
                    }
                />
            </div>
        </ExplorerLayout>
    );
}
