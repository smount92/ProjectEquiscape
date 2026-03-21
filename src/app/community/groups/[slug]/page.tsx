import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getGroup, getGroupChannels } from "@/app/actions/groups";
import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import { getPosts } from "@/app/actions/posts";
import GroupDetailClient from "@/components/GroupDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const group = await getGroup(slug);
    return {
        title: group ? `${group.name} — Model Horse Hub` : "Group Not Found",
        description: group?.description || "Model Horse Hub group",
    };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const group = await getGroup(slug);
    if (!group) notFound();

    const [posts, channels] = await Promise.all([
        group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
        group.isMember ? getGroupChannels(group.id) : Promise.resolve([]),
    ]);

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content">
                {/* Group Header */}
                <div className="pb-6 border-b border-edge mb-6">
                    <Link href="/community/groups" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge mb-4">← All Groups</Link>
                    <h1>{group.name}</h1>
                    <div className="gap-4 mt-2 text-muted text-[calc(0.85rem*var(--font-scale))]" style={{ display: "flex", flexWrap: "wrap" }}>
                        <span>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}</span>
                        {group.region && <span>📍 {group.region}</span>}
                        <span>👥 {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
                        <span>Created by @{group.creatorAlias}</span>
                    </div>
                    {group.description && (
                        <p className="mt-4 leading-[1.6]" >{group.description}</p>
                    )}
                </div>

                {/* Content */}
                {group.isMember ? (
                    <GroupDetailClient
                        group={group}
                        initialPosts={posts}
                        channels={channels}
                        currentUserId={user.id}
                    />
                ) : (
                    <div className="empty-state mt-8">
                        <p>Join this group to see posts and participate.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
