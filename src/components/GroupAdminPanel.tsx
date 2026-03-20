"use client";

import { useState, useEffect, useTransition } from "react";
import {
    getGroupMembers, updateMemberRole, removeMember, togglePinPost,
    type GroupMember
} from "@/app/actions/groups";


interface Props {
    groupId: string;
    currentUserId: string;
    memberRole: string;
}

const roleBadge = (role: string) => {
    switch (role) {
        case "owner": return "👑 Owner";
        case "admin": return "⭐ Admin";
        case "moderator": return "🛡️ Mod";
        case "judge": return "⚖️ Judge";
        default: return "👤 Member";
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
        getGroupMembers(groupId).then(data => {
            setMembers(data);
            setLoading(false);
        });
    }, [expanded, groupId]);

    if (!isAdmin) return null;

    const handleRoleChange = (userId: string, newRole: "admin" | "moderator" | "member") => {
        startTransition(async () => {
            const result = await updateMemberRole(groupId, userId, newRole);
            if (result.success) {
                setMembers(prev => prev.map(m =>
                    m.userId === userId ? { ...m, role: newRole } : m
                ));
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
                setMembers(prev => prev.filter(m => m.userId !== userId));
            } else {
                alert(result.error);
            }
        });
    };

    return (
        <div className="sidebar-section" style={{ marginTop: "var(--space-lg)" }}>
            <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(!expanded)}
            >
                <h3 className="sidebar-section-title" style={{ margin: 0 }}>⚙️ Admin Panel</h3>
                <span style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                    {expanded ? "▲" : "▼"}
                </span>
            </div>

            {expanded && (
                <div style={{ marginTop: "var(--space-md)" }}>
                    {loading ? (
                        <p style={{ color: "var(--color-text-muted)" }}>Loading members…</p>
                    ) : (
                        <>
                            <div style={{ marginBottom: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>
                                👥 {members.length} member{members.length !== 1 ? "s" : ""}
                            </div>
                            <div className="flex flex-col gap-[2px]">
                                {members.map(m => (
                                    <div key={m.userId} className="flex justify-between items-center py-sm px-xs rounded-sm transition-colors hover:bg-black/[0.03]">
                                        <div className="flex items-center gap-sm">
                                            <span className="text-sm font-semibold text-text-primary">@{m.alias}</span>
                                            <span className="text-xs text-text-muted">{roleBadge(m.role)}</span>
                                        </div>
                                        {m.userId !== currentUserId && m.role !== "owner" && (
                                            <div className="flex items-center gap-xs">
                                                {isOwner && (
                                                    <select
                                                        className="form-select"
                                                        value={m.role}
                                                        onChange={e => handleRoleChange(m.userId, e.target.value as "admin" | "moderator" | "member")}
                                                        disabled={isPending}
                                                        style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", padding: "4px 28px 4px 8px", minHeight: "unset" }}
                                                    >
                                                        <option value="member">Member</option>
                                                        <option value="moderator">Moderator</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                )}
                                                <button
                                                    className="btn btn-ghost btn-sm"
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
            className="btn btn-ghost btn-sm"
            onClick={handleToggle}
            disabled={isPending}
            title={pinned ? "Unpin post" : "Pin post"}
            style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}
        >
            📌 {pinned ? "Unpin" : "Pin"}
        </button>
    );
}
