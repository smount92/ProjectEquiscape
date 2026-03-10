import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import RichText from "@/components/RichText";
import LikeToggle from "@/components/LikeToggle";
import { toggleActivityLike } from "@/app/actions/likes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: post } = await supabase
        .from("activity_events")
        .select("metadata, users!activity_events_actor_id_fkey(alias_name)")
        .eq("id", id)
        .single();

    const text = ((post as Record<string, unknown>)?.metadata as { text?: string })?.text || "";
    const alias = ((post as Record<string, unknown>)?.users as { alias_name: string } | null)?.alias_name ?? "Unknown";

    return {
        title: text ? `${alias}: ${text.slice(0, 60)}… — Model Horse Hub` : "Post — Model Horse Hub",
        description: text.slice(0, 160) || "A post on Model Horse Hub",
    };
}

export default async function FeedPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: post } = await supabase
        .from("activity_events")
        .select("id, actor_id, event_type, metadata, image_urls, likes_count, created_at, users!activity_events_actor_id_fkey(alias_name)")
        .eq("id", id)
        .single();

    if (!post) notFound();

    const p = post as Record<string, unknown>;
    const actorAlias = (p.users as { alias_name: string } | null)?.alias_name ?? "Unknown";
    const text = ((p.metadata as { text?: string })?.text) || "";
    const imageUrls = (p.image_urls as string[]) || [];

    // Check if user liked
    const { data: liked } = await supabase
        .from("activity_likes")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("activity_id", id)
        .maybeSingle();

    // Sign image URLs
    let signedUrls: string[] = [];
    if (imageUrls.length > 0) {
        const { data: batch } = await supabase.storage.from("horse-images").createSignedUrls(imageUrls, 3600);
        signedUrls = batch?.map(b => b.signedUrl || "") || [];
    }

    return (
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <Link href="/feed" className="btn btn-ghost" style={{ marginBottom: "var(--space-md)" }}>← Back to Feed</Link>

                <div className="glass-card" style={{ padding: "var(--space-lg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/profile/${encodeURIComponent(actorAlias)}`} style={{ fontWeight: 600 }}>
                            @{actorAlias}
                        </Link>
                        <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {new Date(p.created_at as string).toLocaleString()}
                        </span>
                    </div>

                    {text && <div style={{ marginTop: "var(--space-md)" }}><RichText content={text} /></div>}

                    {signedUrls.length > 0 && (
                        <div className="feed-image-collage" data-count={Math.min(signedUrls.length, 4)} style={{ marginTop: "var(--space-md)" }}>
                            {signedUrls.slice(0, 4).map((url, i) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={i} src={url} alt={`Image ${i + 1}`} loading="lazy" />
                            ))}
                        </div>
                    )}

                    <div className="feed-action-row" style={{ marginTop: "var(--space-md)" }}>
                        <LikeToggle
                            initialLiked={!!liked}
                            initialCount={(p.likes_count as number) || 0}
                            onToggle={() => toggleActivityLike(id)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
