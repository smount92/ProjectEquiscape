"use client";

import { useState, useEffect, useTransition } from "react";
import { getGroupMembers, updateMemberRole, removeMember, togglePinPost, type GroupMember } from "@/app/actions/groups";

interface Props {
    groupId: string;
    currentUserId: string;
    memberRole: string;
}

const roleBadge = (role: string) => {
    switch (role) {
        case "owner":
            return "👑 Owner";
        case "admin":
            return "⭐ Admin";
        case "moderator":
            return "🛡️ Mod";
        case "judge":
            return "⚖️ Judge";
        default:
            return "👤 Member";
    }
};

export default function GroupAdminPanel({ groupId, currentUserId, memberRole }: Props) {
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isOwner = memberRole === "owner";
    const isAdmin = memberRole === "admin" || isOwner;

    useEffect(() => {
        if (!expanded) return;
        setLoading(true);
        getGroupMembers(groupId).then((data) => {
            setMembers(data);
            setLoading(false);
        });
    }, [expanded, groupId]);

    if (!isAdmin) return null;

    const handleRoleChange = (userId: string, newRole: "admin" | "moderator" | "member") => {
        startTransition(async () => {
            const result = await updateMemberRole(groupId, userId, newRole);
            if (result.success) {
                setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
            } else {
                alert(result.error);
            }
        });
    };

    const handleRemove = (userId: string, alias: string) => {
        if (!confirm(`Remove @${alias} from this group?`)) return;
        startTransition(async () => {
            const result = await removeMember(groupId, userId);
            if (result.success) {
                setMembers((prev) => prev.filter((m) => m.userId !== userId));
            } else {
                alert(result.error);
            }
        });
    };

    return (
        <div className="bg-bg-card border-edge border-edge mt-6 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
            <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 className="text-muted m-0 text-xs font-bold tracking-[0.08em] uppercase">⚙️ Admin Panel</h3>
                <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">{expanded ? "▲" : "▼"}</span>
            </div>

            {expanded && (
                <div className="mt-4">
                    {loading ? (
                        <p className="text-muted">Loading members…</p>
                    ) : (
                        <>
                            <div className="text-muted mb-2 text-xs">
                                👥 {members.length} member{members.length !== 1 ? "s" : ""}
                            </div>
                            <div className="flex flex-col gap-[2px]">
                                {members.map((m) => (
                                    <div
                                        key={m.userId}
                                        className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-ink text-sm font-semibold">@{m.alias}</span>
                                            <span className="text-muted text-xs">{roleBadge(m.role)}</span>
                                        </div>
                                        {m.userId !== currentUserId && m.role !== "owner" && (
                                            <div className="flex items-center gap-1">
                                                {isOwner && (
                                                    <select
                                                        className="form-select"
                                                        value={m.role}
                                                        onChange={(e) =>
                                                            handleRoleChange(
                                                                m.userId,
                                                                e.target.value as "admin" | "moderator" | "member",
                                                            )
                                                        }
                                                        disabled={isPending}
                                                        style={{
                                                            fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                                            padding: "4px 28px 4px 8px",
                                                            minHeight: "unset",
                                                        }}
                                                    >
                                                        <option value="member">Member</option>
                                                        <option value="moderator">Moderator</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                )}
                                                <button
                                                    className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
                                                    onClick={() => handleRemove(m.userId, m.alias)}
                                                    disabled={isPending}
                                                    title="Remove member"
                                                    style={{ color: "var(--color-accent-danger)" }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/** Pin/Unpin button for individual posts */
export function PinPostButton({ postId, isPinned }: { postId: string; isPinned: boolean }) {
    const [pinned, setPinned] = useState(isPinned);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        startTransition(async () => {
            const result = await togglePinPost(postId);
            if (result.success) setPinned(!pinned);
        });
    };

    return (
        <button
            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
            onClick={handleToggle}
            disabled={isPending}
            title={pinned ? "Unpin post" : "Pin post"}
            style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}
        >
            📌 {pinned ? "Unpin" : "Pin"}
        </button>
    );
}
