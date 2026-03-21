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
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const group = await getGroup(slug);
    if (!group) notFound();

    const [posts, channels] = await Promise.all([
        group.isMember ? getPosts({ groupId: group.id }, { includeReplies: true }) : Promise.resolve([]),
        group.isMember ? getGroupChannels(group.id) : Promise.resolve([]),
    ]);

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="page-content">
                {/* Group Header */}
                <div className="border-edge mb-6 border-b pb-6">
                    <Link
                        href="/community/groups"
                        className="hover:no-underline-min-h)] text-ink-light border-edge mb-4 inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
                        ← All Groups
                    </Link>
                    <h1>{group.name}</h1>
                    <div
                        className="text-muted mt-2 gap-4 text-[calc(0.85rem*var(--font-scale))]"
                        style={{ display: "flex", flexWrap: "wrap" }}
                    >
                        <span>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}</span>
                        {group.region && <span>📍 {group.region}</span>}
                        <span>
                            👥 {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                        </span>
                        <span>Created by @{group.creatorAlias}</span>
                    </div>
                    {group.description && <p className="mt-4 leading-[1.6]">{group.description}</p>}
                </div>

                {/* Content */}
                {group.isMember ? (
                    <GroupDetailClient group={group} initialPosts={posts} channels={channels} currentUserId={user.id} />
                ) : (
                    <div className="empty-state mt-8">
                        <p>Join this group to see posts and participate.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
