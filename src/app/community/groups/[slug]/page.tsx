import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getGroup } from "@/app/actions/groups";
import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import { getPosts } from "@/app/actions/posts";
import UniversalFeed from "@/components/UniversalFeed";

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

    const posts = group.isMember ? await getPosts({ groupId: group.id }, { includeReplies: true }) : [];

    return (
        <div className="page-container">
            <div className="page-content">
                {/* Group Header */}
                <div className="group-detail-header">
                    <Link href="/community/groups" className="btn btn-ghost" style={{ marginBottom: "var(--space-md)" }}>← All Groups</Link>
                    <h1>{group.name}</h1>
                    <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap", marginTop: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                        <span>{GROUP_TYPE_LABELS[group.groupType] || group.groupType}</span>
                        {group.region && <span>📍 {group.region}</span>}
                        <span>👥 {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
                        <span>Created by @{group.creatorAlias}</span>
                    </div>
                    {group.description && (
                        <p style={{ marginTop: "var(--space-md)", lineHeight: 1.6 }}>{group.description}</p>
                    )}
                </div>

                {/* Content */}
                {group.isMember ? (
                    <UniversalFeed
                        initialPosts={posts}
                        context={{ groupId: group.id }}
                        currentUserId={user.id}
                        showComposer={true}
                        composerPlaceholder="Share with the group…"
                        label="Group Posts"
                    />
                ) : (
                    <div className="empty-state" style={{ marginTop: "var(--space-xl)" }}>
                        <p>Join this group to see posts and participate.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
