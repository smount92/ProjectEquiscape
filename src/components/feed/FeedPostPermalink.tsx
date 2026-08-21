"use client";

/**
 * The permalink page's interactive shell — renders the SAME card the
 * feed does (replies, likes, media, mentions, admin pin) instead of
 * the old read-only copy. Exists because FeedPostCard needs an
 * onRemoved callback, which a server component can't provide.
 */

import { useRouter } from "next/navigation";

import FeedPostCard from "@/components/feed/FeedPostCard";
import type { FeedStreamItem } from "@/app/actions/posts";

export default function FeedPostPermalink({
    item,
    knownAliases,
    currentUserId,
    currentUserAlias,
    currentUserAvatar,
    viewerIsAdmin,
}: {
    item: FeedStreamItem;
    knownAliases: string[];
    currentUserId: string;
    currentUserAlias: string;
    currentUserAvatar: string | null;
    viewerIsAdmin: boolean;
}) {
    const router = useRouter();
    return (
        <FeedPostCard
            item={item}
            currentUserId={currentUserId}
            currentUserAlias={currentUserAlias}
            currentUserAvatar={currentUserAvatar}
            knownAliases={knownAliases}
            viewerIsAdmin={viewerIsAdmin}
            onRemoved={() => router.push("/feed")}
        />
    );
}
