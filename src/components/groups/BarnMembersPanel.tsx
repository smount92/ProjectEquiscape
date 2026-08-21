"use client";

/**
 * Who's in the barn. A ledger-card roster with role stamps, plus the
 * gate queue (pending join requests) for owner/admin/moderator.
 *
 * Data is fetched server-side and handed down, so this renders
 * instantly; the panel only talks to the server when staff act.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import {
    decideBarnJoinRequest,
    removeMember,
    updateMemberRole,
    type BarnJoinRequest,
    type GroupMember,
} from "@/app/actions/groups";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<string, string> = {
    owner: "👑 Owner",
    admin: "⭐ Admin",
    moderator: "🛡️ Mod",
    judge: "⚖️ Judge",
    member: "👤 Member",
};

export default function BarnMembersPanel({
    groupId,
    members: initialMembers,
    joinRequests: initialRequests,
    currentUserId,
    memberRole,
    isPrivate,
    isMember,
}: {
    groupId: string;
    members: GroupMember[];
    joinRequests: BarnJoinRequest[];
    currentUserId: string;
    memberRole: string | null;
    isPrivate: boolean;
    isMember: boolean;
}) {
    const [members, setMembers] = useState(initialMembers);
    const [requests, setRequests] = useState(initialRequests);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const isOwner = memberRole === "owner";
    const isAdmin = isOwner || memberRole === "admin";
    const isStaff = isAdmin || memberRole === "moderator";

    // A private barn keeps its roster behind the door.
    if (isPrivate && !isMember) {
        return (
            <aside className="ledger-card">
                <span className="ledger-tab">Members</span>
                <p className="text-muted-foreground m-0 text-sm italic">
                    This barn is private. Join to see who&apos;s inside.
                </p>
            </aside>
        );
    }

    const decide = (userId: string, decision: "approved" | "denied", alias: string) => {
        setError(null);
        startTransition(async () => {
            const result = await decideBarnJoinRequest(groupId, userId, decision);
            if (!result.success) {
                setError(result.error || "Could not answer that request.");
                return;
            }
            setRequests((prev) => prev.filter((r) => r.userId !== userId));
            if (decision === "approved") {
                setMembers((prev) => [
                    ...prev,
                    { userId, alias, role: "member", joinedAt: new Date().toISOString() },
                ]);
            }
        });
    };

    const changeRole = (userId: string, role: "admin" | "moderator" | "member") => {
        setError(null);
        startTransition(async () => {
            const result = await updateMemberRole(groupId, userId, role);
            if (!result.success) {
                setError(result.error || "Could not change that role.");
                return;
            }
            setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
        });
    };

    const remove = (userId: string, alias: string) => {
        if (!confirm(`Remove @${alias} from this barn?`)) return;
        setError(null);
        startTransition(async () => {
            const result = await removeMember(groupId, userId);
            if (!result.success) {
                setError(result.error || "Could not remove that member.");
                return;
            }
            setMembers((prev) => prev.filter((m) => m.userId !== userId));
        });
    };

    return (
        <aside className="flex flex-col gap-4">
            {/* Gate queue — staff only */}
            {isStaff && requests.length > 0 && (
                <div className="ledger-card">
                    <span className="ledger-tab">At the Gate ({requests.length})</span>
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                        {requests.map((r) => (
                            <li key={r.userId} className="flex flex-col gap-1.5">
                                <Link
                                    href={`/profile/${encodeURIComponent(r.alias)}`}
                                    className="text-saddle text-sm font-bold hover:underline"
                                >
                                    @{r.alias}
                                </Link>
                                {r.message && (
                                    <p className="text-secondary-foreground m-0 text-xs italic">
                                        &ldquo;{r.message}&rdquo;
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="text-xs"
                                        disabled={isPending}
                                        onClick={() => decide(r.userId, "approved", r.alias)}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs"
                                        disabled={isPending}
                                        onClick={() => decide(r.userId, "denied", r.alias)}
                                    >
                                        Decline
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Roster */}
            <div className="ledger-card">
                <span className="ledger-tab">
                    Members ({members.length})
                </span>
                {error && <p className="text-destructive mb-2 text-xs">{error}</p>}
                {members.length === 0 ? (
                    <p className="text-muted-foreground m-0 text-sm italic">No one has moved in yet.</p>
                ) : (
                    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                        {members.map((m) => (
                            <li
                                key={m.userId}
                                className="flex items-center justify-between gap-2 rounded-sm px-1 py-1.5 hover:bg-black/[0.03]"
                            >
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Link
                                        href={`/profile/${encodeURIComponent(m.alias)}`}
                                        className="text-saddle truncate text-sm font-bold hover:underline"
                                    >
                                        @{m.alias}
                                    </Link>
                                    <span className="text-muted-foreground text-[0.68rem] tracking-[0.1em] uppercase">
                                        {ROLE_LABEL[m.role] || m.role}
                                    </span>
                                </span>
                                {isAdmin && m.userId !== currentUserId && m.role !== "owner" && (
                                    <span className="flex shrink-0 items-center gap-1">
                                        {isOwner && (
                                            <select
                                                className="border-input bg-card text-foreground rounded-md border py-0.5 pr-6 pl-1.5 text-[0.68rem]"
                                                value={m.role}
                                                disabled={isPending}
                                                title={`Role for ${m.alias}`}
                                                onChange={(e) =>
                                                    changeRole(
                                                        m.userId,
                                                        e.target.value as "admin" | "moderator" | "member",
                                                    )
                                                }
                                            >
                                                <option value="member">Member</option>
                                                <option value="moderator">Moderator</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        )}
                                        <Button
                                            variant="destructive-outline"
                                            size="sm"
                                            className="text-[0.68rem]"
                                            disabled={isPending}
                                            title={`Remove @${m.alias}`}
                                            onClick={() => remove(m.userId, m.alias)}
                                        >
                                            ✕
                                        </Button>
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
