import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getGroup } from "@/app/actions/groups";
import { getThread } from "@/app/actions/groups-forum";
import { groupsForumEnabled } from "@/lib/groups/flags";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";
import ThreadView from "@/components/groups/ThreadView";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; postId: string }> }) {
    if (!groupsForumEnabled()) return { title: "Not Found" };
    const { slug } = await params;
    const group = await getGroup(slug);
    return { title: group ? `Thread — ${group.name} — Model Horse Hub` : "Thread — Model Horse Hub" };
}

export default async function GroupThreadPage({
    params,
}: {
    params: Promise<{ slug: string; postId: string }>;
}) {
    // Flag off = this route does not exist.
    if (!groupsForumEnabled()) notFound();

    const { slug, postId } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const group = await getGroup(slug);
    if (!group || !group.isMember) notFound();

    const result = await getThread({ postId });
    // notFound covers: missing post, reply ids, non-group posts, and
    // roots that belong to a different group than the URL's slug.
    if (!result.success || result.thread.groupId !== group.id) notFound();

    // Viewer identity for the composer + optimistic replies
    const { data: me } = await supabase
        .from("users")
        .select("alias_name, avatar_url")
        .eq("id", user.id)
        .single();
    const viewer = me as { alias_name: string; avatar_url: string | null } | null;
    let viewerAvatar = viewer?.avatar_url ?? null;
    if (viewerAvatar) {
        const avatarMap = await resolveAvatarUrls([viewerAvatar]);
        viewerAvatar = avatarMap.get(viewerAvatar) || viewerAvatar;
    }

    const canPin = ["owner", "admin", "moderator"].includes(group.memberRole || "");

    return (
        <ExplorerLayout title={result.thread.displayTitle} description={group.name}>
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                <ThreadView
                    thread={result.thread}
                    groupName={group.name}
                    groupSlug={group.slug}
                    currentUserId={user.id}
                    currentUserAlias={viewer?.alias_name ?? "You"}
                    currentUserAvatar={viewerAvatar}
                    canPin={canPin}
                />
            </div>
        </ExplorerLayout>
    );
}
