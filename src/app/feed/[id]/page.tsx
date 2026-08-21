import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import RichText from"@/components/RichText";
import LikeToggle from"@/components/LikeToggle";
import { togglePostLike, getFeedPost } from"@/app/actions/posts";
import { resolveAvatarUrls } from"@/lib/utils/avatars.server";
import FeedPostPermalink from"@/components/feed/FeedPostPermalink";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import PageMasthead from "@/components/layouts/PageMasthead";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase = await createClient();
 const { data: post } = await supabase
 .from("posts")
 .select("content, users!posts_author_id_fkey(alias_name)")
 .eq("id", id)
 .single();

 let p = post as Record<string, unknown> | null;
 if (!p) {
 // Activity-feed text posts live in activity_events (the feed links
 // /feed/<event id>) — fall back so their permalinks resolve too.
 const { data: event } = await supabase
 .from("activity_events")
 .select("metadata, users!actor_id(alias_name)")
 .eq("id", id)
 .eq("event_type","text_post")
 .maybeSingle();
 if (event) {
 const e = event as Record<string, unknown>;
 p = { content: (e.metadata as { text?: string } | null)?.text ??"", users: e.users };
 }
 }
 const content = (p?.content as string) ||"";
 const alias = (p?.users as { alias_name: string } | null)?.alias_name ??"Unknown";

 return {
 title: content ? `${alias}: ${content.slice(0, 60)}…` :"Post",
 description: content.slice(0, 160) ||"A post on Model Horse Hub",
 };
}

/**
 * Resolve the real aliases mentioned in a body so RichText links
 * "@black fox farm" as one name. Best-effort — a failure here just
 * means the page falls back to the legacy single-word behaviour.
 */
async function aliasesIn(content: string): Promise<string[]> {
 if (!content.includes("@")) return [];
 try {
 const { resolveMentionedAliases } = await import("@/app/actions/mentions");
 return (await resolveMentionedAliases(content)).map((m) => m.alias);
 } catch {
 return [];
 }
}

export default async function FeedPostPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 // Posts render the SAME interactive card the feed uses — replies,
 // likes, media, mentions — so a banner link lands somewhere people
 // can actually comment. Legacy activity rows keep the read-only
 // fallback below.
 const hydrated = await getFeedPost(id).catch(() => null);
 if (hydrated) {
 const { data: me } = await supabase
 .from("users")
 .select("alias_name, avatar_url")
 .eq("id", user.id)
 .maybeSingle();
 const viewer = me as { alias_name: string; avatar_url: string | null } | null;
 let viewerAvatar = viewer?.avatar_url ?? null;
 if (viewerAvatar) {
 const avatarMap = await resolveAvatarUrls([viewerAvatar]);
 viewerAvatar = avatarMap.get(viewerAvatar) || viewerAvatar;
 }
 return (
  <ExplorerLayout title="Post" description="View and join the conversation.">
 <div className="mx-auto max-w-6xl px-6 max-w-[640px]">
 <Button asChild variant="outline" size="wide"><Link
 href="/feed"
 >
 ← Back to The Paddock
 </Link></Button>

 <FeedPostPermalink
 item={hydrated.item}
 knownAliases={hydrated.knownAliases}
 currentUserId={user.id}
 currentUserAlias={viewer?.alias_name ?? "You"}
 currentUserAvatar={viewerAvatar}
 viewerIsAdmin={user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()}
 />
 </div>
 </ExplorerLayout>
 );
 }

 const { data: post } = await supabase
 .from("posts")
 .select("id, author_id, content, likes_count, created_at, users!posts_author_id_fkey(alias_name)")
 .eq("id", id)
 .maybeSingle();

 // The activity feed links its text posts as /feed/<activity_events id>
 // — those ids aren't in posts, and this page 404'd every one of them.
 // Render the event read-only (its likes use the activity like system,
 // not post likes, so no toggle here).
 if (!post) {
 const { data: event } = await supabase
 .from("activity_events")
 .select("id, actor_id, metadata, image_urls, created_at, users!actor_id(alias_name)")
 .eq("id", id)
 .eq("event_type","text_post")
 .maybeSingle();
 if (!event) notFound();

 const e = event as Record<string, unknown>;
 const eventAlias = (e.users as { alias_name: string } | null)?.alias_name ??"Unknown";
 const eventText = (e.metadata as { text?: string } | null)?.text ??"";
 const eventImages = (e.image_urls as string[] | null) ?? [];
 const eventAliases = await aliasesIn(eventText);

 return (
            <ExplorerLayout noHeader frameless>
                <div className="mx-auto max-w-[680px]">
                    <PageMasthead
                        icon="🐴"
                        title="A post"
                        subtitle="From the Paddock"
                        backHref="/feed"
                        backLabel="The Paddock"
                        compact
                    />

                    <article className="ledger-card paddock-post">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                            <Link
                                href={`/profile/${encodeURIComponent(eventAlias)}`}
                                className="text-foreground max-w-[200px] truncate font-semibold no-underline hover:underline"
                            >
                                @{eventAlias}
                            </Link>
                            <span className="text-muted-foreground font-serif text-xs tracking-[0.1em] uppercase">
                                {new Date(e.created_at as string).toLocaleString()}
                            </span>
                        </div>

                        {eventText && (
                            <div className="mt-4">
                                <RichText content={eventText} knownAliases={eventAliases} />
                            </div>
                        )}

                        {eventImages.length > 0 && (
                            <div
                                className={`mt-4 grid gap-1.5 ${
                                    eventImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                }`}
                            >
                                {eventImages.slice(0, 4).map((url, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={i}
                                        src={url}
                                        alt={`Image ${i + 1}`}
                                        loading="lazy"
                                        className="border-input bg-muted h-full max-h-[380px] w-full rounded-lg border object-cover"
                                    />
                                ))}
                            </div>
                        )}
                    </article>
                </div>
            </ExplorerLayout>
 );
 }

 const p = post as Record<string, unknown>;
 const actorAlias = (p.users as { alias_name: string } | null)?.alias_name ??"Unknown";
 const content = (p.content as string) ||"";
 const postAliases = await aliasesIn(content);

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
            <ExplorerLayout noHeader frameless>
                <div className="mx-auto max-w-[680px]">
                    <PageMasthead
                        icon="🐴"
                        title="A post"
                        subtitle="From the Paddock"
                        backHref="/feed"
                        backLabel="The Paddock"
                        compact
                    />

                    <article className="ledger-card paddock-post">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                            <Link
                                href={`/profile/${encodeURIComponent(actorAlias)}`}
                                className="text-foreground max-w-[200px] truncate font-semibold no-underline hover:underline"
                            >
                                @{actorAlias}
                            </Link>
                            <span className="text-muted-foreground font-serif text-xs tracking-[0.1em] uppercase">
                                {new Date(p.created_at as string).toLocaleString()}
                            </span>
                        </div>

                        {content && (
                            <div className="mt-4">
                                <RichText content={content} knownAliases={postAliases} />
                            </div>
                        )}

                        {signedUrls.length > 0 && (
                            <div
                                className={`mt-4 grid gap-1.5 ${
                                    signedUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                }`}
                            >
                                {signedUrls.slice(0, 4).map((item, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={i}
                                        src={item.url}
                                        alt={item.caption || `Image ${i + 1}`}
                                        loading="lazy"
                                        className="border-input bg-muted h-full max-h-[380px] w-full rounded-lg border object-cover"
                                    />
                                ))}
                            </div>
                        )}

                        <div className="border-forest/15 mt-4 flex items-center gap-3 border-t pt-2">
                            <LikeToggle
                                initialLiked={!!liked}
                                initialCount={(p.likes_count as number) || 0}
                                onToggle={togglePostLike.bind(null, id)}
                            />
                        </div>
                    </article>
                </div>
            </ExplorerLayout>
 );
}
