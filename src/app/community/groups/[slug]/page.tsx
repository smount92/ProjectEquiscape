import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import {
    getBarnJoinRequests,
    getGroup,
    getGroupChannels,
    getGroupMembers,
} from "@/app/actions/groups";
import { getGroupBoard } from "@/app/actions/groups-forum";
import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import { getPosts } from "@/app/actions/posts";
import GroupDetailClient from "@/components/GroupDetailClient";
import GroupMasthead from "@/components/groups/GroupMasthead";
import BarnJoinButton from "@/components/groups/BarnJoinButton";
import BarnMembersPanel from "@/components/groups/BarnMembersPanel";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const group = await getGroup(slug);
    return {
        title: group ? `${group.name}` : "Barn Not Found",
        description: group?.description || "A Model Horse Hub barn",
    };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const group = await getGroup(slug);
    if (!group) notFound();

    const isStaff = ["owner", "admin", "moderator"].includes(group.memberRole || "");

    const [posts, channels, boardResult, members, joinRequests] = await Promise.all([
        group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
        group.isMember ? getGroupChannels(group.id) : Promise.resolve([]),
        group.isMember ? getGroupBoard({ groupId: group.id }) : Promise.resolve(null),
        group.isPrivate && !group.isMember ? Promise.resolve([]) : getGroupMembers(group.id),
        isStaff ? getBarnJoinRequests(group.id) : Promise.resolve([]),
    ]);

    // Board failure (e.g. migration 122 not applied) degrades to the
    // flat feed inside GroupDetailClient rather than breaking the barn.
    const board = boardResult && boardResult.success
        ? { threads: boardResult.threads, hasMore: boardResult.hasMore }
        : null;

    return (
        // noHeader: the leather masthead below IS this page's header.
        // Without it the page rendered two mastheads stacked.
        <ExplorerLayout noHeader frameless>
            <div className="mx-auto max-w-6xl">
                <GroupMasthead
                    name={group.name}
                    typeLabel={GROUP_TYPE_LABELS[group.groupType] || group.groupType}
                    region={group.region ?? null}
                    memberCount={group.memberCount}
                    creatorAlias={group.creatorAlias}
                    description={group.description ?? null}
                    isPrivate={group.isPrivate}
                    actions={
                        <BarnJoinButton
                            groupId={group.id}
                            isMember={group.isMember}
                            memberRole={group.memberRole}
                            isPrivate={group.isPrivate}
                            joinRequestStatus={group.joinRequestStatus}
                        />
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                    {/* The room itself — notice board front and centre */}
                    <div className="min-w-0">
                        {group.isMember ? (
                            <GroupDetailClient
                                group={group}
                                initialPosts={posts}
                                channels={channels}
                                currentUserId={user.id}
                                board={board}
                            />
                        ) : (
                            <div className="ledger-card text-center">
                                <span className="ledger-tab">Notice Board</span>
                                <p className="text-secondary-foreground m-0 text-sm">
                                    {group.isPrivate
                                        ? "This is a private barn. Ask to join and an owner or moderator will let you in."
                                        : "Join this barn to read the notice board and post."}
                                </p>
                            </div>
                        )}
                    </div>

                    <BarnMembersPanel
                        groupId={group.id}
                        members={members}
                        joinRequests={joinRequests}
                        currentUserId={user.id}
                        memberRole={group.memberRole}
                        isPrivate={group.isPrivate}
                        isMember={group.isMember}
                    />
                </div>
            </div>
        </ExplorerLayout>
    );
}
