"use client";

import { useState } from "react";
import Link from "next/link";
import { joinGroup, leaveGroup, type Group } from "@/app/actions/groups";
import { useRouter } from "next/navigation";

interface Props {
    allGroups: Group[];
    myGroups: Group[];
    typeLabels: Record<string, string>;
}

const TYPE_ICONS: Record<string, string> = {
    regional_club: "📍",
    breed_interest: "🐴",
    scale_interest: "📏",
    show_circuit: "🏆",
    artist_collective: "🎨",
    general: "💬",
};

export default function GroupBrowser({ allGroups, myGroups, typeLabels }: Props) {
    const router = useRouter();
    const [tab, setTab] = useState<"browse" | "mine">("browse");
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [joining, setJoining] = useState<string | null>(null);

    const groups = tab === "mine" ? myGroups : allGroups;
    const filtered = groups
        .filter(g => filter === "all" || g.groupType === filter)
        .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())
            || g.description?.toLowerCase().includes(search.toLowerCase()));

    async function handleJoin(groupId: string) {
        setJoining(groupId);
        await joinGroup(groupId);
        router.refresh();
        setJoining(null);
    }

    async function handleLeave(groupId: string) {
        if (!confirm("Leave this group?")) return;
        setJoining(groupId);
        await leaveGroup(groupId);
        router.refresh();
        setJoining(null);
    }

    return (
        <div>
            {/* Tabs */}
            <div className="studio-tabs" style={{ marginBottom: "var(--space-lg)" }}>
                <button className={`studio-tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
                    🌐 Browse All
                    <span className="studio-tab-badge">{allGroups.length}</span>
                </button>
                <button className={`studio-tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
                    ⭐ My Groups
                    <span className="studio-tab-badge">{myGroups.length}</span>
                </button>
            </div>

            {/* Search */}
            <div className="search-bar" style={{ marginBottom: "var(--space-md)" }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="🔍 Search groups by name or description…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    id="group-search"
                />
            </div>

            {/* Type Filter */}
            <div className="studio-chip-grid" style={{ marginBottom: "var(--space-lg)" }}>
                <button className={`studio-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All</button>
                {Object.entries(typeLabels).map(([key, label]) => (
                    <button key={key} className={`studio-chip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
                        {TYPE_ICONS[key] || "📂"} {label}
                    </button>
                ))}
            </div>

            {/* Group Cards */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <p>{tab === "mine" ? "You haven't joined any groups yet." : "No groups found."}</p>
                </div>
            ) : (
                <div className="group-card-grid">
                    {filtered.map(g => (
                        <div key={g.id} className="group-card">
                            <div className="group-card-header">
                                <span className="group-card-icon">{TYPE_ICONS[g.groupType] || "📂"}</span>
                                <div>
                                    <Link href={`/community/groups/${g.slug}`} className="group-card-name">{g.name}</Link>
                                    <div className="group-card-meta">
                                        {typeLabels[g.groupType] || g.groupType}
                                        {g.region && <> · {g.region}</>}
                                    </div>
                                </div>
                            </div>
                            {g.description && (
                                <p className="group-card-desc">{g.description.slice(0, 120)}{g.description.length > 120 ? "..." : ""}</p>
                            )}
                            <div className="group-card-footer">
                                <span className="group-card-members">👥 {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</span>
                                {g.isMember ? (
                                    <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                                        <span className="commission-status-badge" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                                            ✓ {g.memberRole || "Member"}
                                        </span>
                                        {g.memberRole !== "owner" && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleLeave(g.id)} disabled={joining === g.id}>Leave</button>
                                        )}
                                    </div>
                                ) : (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleJoin(g.id)} disabled={joining === g.id}>
                                        {joining === g.id ? "Joining..." : "+ Join"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
