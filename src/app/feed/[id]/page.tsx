import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import RichText from "@/components/RichText";
import LikeToggle from "@/components/LikeToggle";
import { togglePostLike } from "@/app/actions/posts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: post } = await supabase
        .from("posts")
        .select("content, users!posts_author_id_fkey(alias_name)")
        .eq("id", id)
        .single();

    const p = post as Record<string, unknown> | null;
    const content = (p?.content as string) || "";
    const alias = (p?.users as { alias_name: string } | null)?.alias_name ?? "Unknown";

    return {
        title: content ? `${alias}: ${content.slice(0, 60)}… — Model Horse Hub` : "Post — Model Horse Hub",
        description: content.slice(0, 160) || "A post on Model Horse Hub",
    };
}

export default async function FeedPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: post } = await supabase
        .from("posts")
        .select("id, author_id, content, likes_count, created_at, users!posts_author_id_fkey(alias_name)")
        .eq("id", id)
        .single();

    if (!post) notFound();

    const p = post as Record<string, unknown>;
    const actorAlias = (p.users as { alias_name: string } | null)?.alias_name ?? "Unknown";
    const content = (p.content as string) || "";

    // Check if user liked
    const { data: liked } = await supabase
        .from("likes")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle();

    // Fetch media
    const { data: media } = await supabase
        .from("media_attachments")
        .select("id, storage_path, caption")
        .eq("post_id", id);

    let signedUrls: { url: string; caption: string | null }[] = [];
    if (media && media.length > 0) {
        const { getPublicImageUrl } = await import("@/lib/utils/storage");
        signedUrls = (media as { storage_path: string; caption: string | null }[]).map((m) => ({
            url: getPublicImageUrl(m.storage_path),
            caption: m.caption,
        }));
    }

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <Link href="/feed" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ marginBottom: "var(--space-md)" }}>← Back to Feed</Link>

                <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/profile/${encodeURIComponent(actorAlias)}`} style={{ fontWeight: 600 }}>
                            @{actorAlias}
                        </Link>
                        <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {new Date(p.created_at as string).toLocaleString()}
                        </span>
                    </div>

                    {content && <div style={{ marginTop: "var(--space-md)" }}><RichText content={content} /></div>}

                    {signedUrls.length > 0 && (
                        <div className="grid gap-[4px] mt-2 rounded-md overflow-hidden" data-count={Math.min(signedUrls.length, 4)} style={{ marginTop: "var(--space-md)" }}>
                            {signedUrls.slice(0, 4).map((item, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={item.url} alt={item.caption || `Image ${i + 1}`} loading="lazy" />
                            ))}
                        </div>
                    )}

                    <div className="feed-action-row" style={{ marginTop: "var(--space-md)" }}>
                        <LikeToggle
                            initialLiked={!!liked}
                            initialCount={(p.likes_count as number) || 0}
                            onToggle={() => togglePostLike(id)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
