/**
 * The member's recent posts — only the ones the whole site can see.
 *
 * fetchProfilePosts runs the feed's own `isGloballyVisible` rule
 * over the rows, because RLS admits a private barn's posts to that
 * barn's members and a profile is a public page. Read-only: this
 * consumes the feed, it never writes to it.
 */

import Link from "next/link";

import type { ProfilePost } from "@/app/profile/reads";
import { EmptyNote, SectionHeading } from "./ProfileSection";

const EXCERPT = 240;

function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const days = Math.floor((Date.now() - then) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function RecentPosts({
    alias,
    isOwnProfile,
    posts,
    blockedByViewer,
}: {
    alias: string;
    isOwnProfile: boolean;
    posts: ProfilePost[];
    /** The viewer has blocked this member — their words stay hidden. */
    blockedByViewer: boolean;
}) {
    return (
        <section className="animate-fade-in-up mt-10" id="posts">
            <SectionHeading title="From the Feed" />

            {blockedByViewer ? (
                <EmptyNote icon="🔇" title="You've blocked this member">
                    Their posts are hidden while the block is on. Unblock above to see them again.
                </EmptyNote>
            ) : posts.length === 0 ? (
                <EmptyNote
                    icon="📣"
                    title={isOwnProfile ? "You haven't posted publicly yet" : "Quiet in the aisle"}
                >
                    {isOwnProfile
                        ? "Posts you make to the public feed land here. Barn talk and passport comments stay where you wrote them."
                        : `@${alias} hasn't posted to the public feed lately.`}
                </EmptyNote>
            ) : (
                <div className="flex flex-col gap-3">
                    {posts.map((post) => (
                        <article key={post.id} className="ledger-paper px-5 py-4">
                            <p className="m-0 text-sm whitespace-pre-line text-foreground">
                                {post.content.length > EXCERPT
                                    ? `${post.content.slice(0, EXCERPT).trimEnd()}…`
                                    : post.content}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
                                <span>{timeAgo(post.createdAt)}</span>
                                {post.likesCount > 0 && <span>♥ {post.likesCount}</span>}
                                {post.repliesCount > 0 && (
                                    <span>
                                        💬 {post.repliesCount}{" "}
                                        {post.repliesCount === 1 ? "reply" : "replies"}
                                    </span>
                                )}
                            </div>
                        </article>
                    ))}
                    <div>
                        <Link href="/feed" className="text-sm font-semibold text-forest hover:underline">
                            Open the feed →
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
}
