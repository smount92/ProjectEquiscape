/**
 * One collector, as an index card in the Members room.
 *
 * A directory card has to answer "who is this?" before it asks you to
 * follow anyone: face, name, how long they've been here, how big their
 * public shelf is, what they've earned, and whether they've been around
 * lately. Everything on it is data the page already batched — the card
 * itself makes no queries.
 *
 * Ledger paper + rubber stamps, matching the Paddock and market rooms.
 */

import Link from "next/link";

import UserAvatar from "@/components/social/UserAvatar";
import type { MemberCard } from "@/app/discover/queries";
import {
    formatLastActive,
    formatMemberSince,
    formatPublicModelCount,
} from "@/lib/members/directory";

import MemberFollowButton from "./MemberFollowButton";

const TIER_TONE: Record<number, string> = {
    1: "border-amber-700/60 text-amber-800",
    2: "border-slate-500/60 text-slate-600",
    3: "border-yellow-600/70 text-yellow-700",
    4: "border-sky-500/60 text-sky-700",
    5: "border-forest/60 text-forest",
};

export default function CollectorCard({ member }: { member: MemberCard }) {
    const profileHref = `/profile/${encodeURIComponent(member.aliasName)}`;
    const memberSince = formatMemberSince(member.createdAt);
    const lastActive = formatLastActive(member.lastActiveAt);

    return (
        <article className="ledger-card flex h-full w-full flex-col gap-3">
            <div className="flex items-start gap-3">
                <UserAvatar
                    src={member.avatarUrl}
                    alias={member.aliasName}
                    size="lg"
                    href={profileHref}
                />
                <div className="min-w-0 flex-1">
                    <Link
                        href={profileHref}
                        className="text-foreground block truncate font-serif text-base font-bold no-underline hover:underline"
                    >
                        {member.aliasName}
                        {member.isVerified && (
                            <span className="text-forest ml-1" title="Verified" aria-label="Verified">
                                ✓
                            </span>
                        )}
                    </Link>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        {memberSince && <span>{memberSince}</span>}
                        {memberSince && lastActive && <span aria-hidden="true">·</span>}
                        {lastActive && <span className="text-forest/80">{lastActive}</span>}
                    </div>
                </div>
                {member.isSelf ? (
                    <span className="stamp shrink-0">You</span>
                ) : (
                    <MemberFollowButton
                        targetUserId={member.id}
                        aliasName={member.aliasName}
                        initialIsFollowing={member.isFollowing}
                    />
                )}
            </div>

            {member.bio && (
                <p className="text-secondary-foreground m-0 line-clamp-2 text-sm">{member.bio}</p>
            )}

            {(member.hasStudio ||
                member.isSupporter ||
                member.isTrustedCurator ||
                member.ratingCount > 0 ||
                member.badges.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {member.hasStudio && <span className="stamp">🎨 Studio</span>}
                    {member.isTrustedCurator && <span className="stamp">Curator</span>}
                    {member.isSupporter && <span className="stamp stamp-red">Supporter</span>}
                    {member.ratingCount > 0 && (
                        <span className="stamp" title={`${member.ratingCount} reviews`}>
                            ★ {member.avgRating.toFixed(1)}
                        </span>
                    )}
                    {member.badges.map((badge) => (
                        <span
                            key={badge.id}
                            className={`stamp ${TIER_TONE[badge.tier ?? 0] ?? ""}`}
                            title={badge.name}
                        >
                            <span aria-hidden="true">{badge.icon}</span>{" "}
                            <span className="sr-only">Badge:</span>
                            {badge.name}
                        </span>
                    ))}
                </div>
            )}

            <div className="border-forest/15 mt-auto flex items-baseline justify-between gap-2 border-t pt-2">
                <span className="text-secondary-foreground text-sm tabular-nums">
                    {formatPublicModelCount(member.publicHorseCount)}
                </span>
                <Link
                    href={profileHref}
                    className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                >
                    Stable →
                </Link>
            </div>
        </article>
    );
}
