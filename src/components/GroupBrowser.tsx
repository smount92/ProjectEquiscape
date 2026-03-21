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
                    <span className="flex items-center gap-1 py-2 px-4 rounded-md border border-[transparent] bg-card max-[480px]:rounded-[var(--radius-md)] text-muted text-[calc(0.85rem*var(--font-scale))] cursor-pointer whitespace-nowrap transition-all-badge">{allGroups.length}</span>
                </button>
                <button className={`studio-tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
                    ⭐ My Groups
                    <span className="flex items-center gap-1 py-2 px-4 rounded-md border border-[transparent] bg-card max-[480px]:rounded-[var(--radius-md)] text-muted text-[calc(0.85rem*var(--font-scale))] cursor-pointer whitespace-nowrap transition-all-badge">{myGroups.length}</span>
                </button>
            </div>

            {/* Search */}
            <div className="sticky top-[calc(var(--header max-sm:py-[0] max-sm:px-4-height) + var(--space-md))] z-[10] flex items-center gap-2 py-2 px-6 mb-8 bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-xl transition-all shadow-md" style={{ marginBottom: "var(--space-md)" }}>
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
            <div className="flex flex-wrap gap-1" style={{ marginBottom: "var(--space-lg)" }}>
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
                <div className="grid grid-cols-[repeat(auto-fill, minmax(320px, 1fr))] gap-4">
                    {filtered.map(g => (
                        <div key={g.id} className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors">
                            <div className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
                                <span className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-icon">{TYPE_ICONS[g.groupType] || "📂"}</span>
                                <div>
                                    <Link href={`/community/groups/${g.slug}`} className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-name">{g.name}</Link>
                                    <div className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-meta">
                                        {typeLabels[g.groupType] || g.groupType}
                                        {g.region && <> · {g.region}</>}
                                    </div>
                                </div>
                            </div>
                            {g.description && (
                                <p className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-desc">{g.description.slice(0, 120)}{g.description.length > 120 ? "..." : ""}</p>
                            )}
                            <div className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-footer">
                                <span className="flex flex-col p-6 rounded-lg bg-elevated border border-edge transition-colors-members">👥 {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</span>
                                {g.isMember ? (
                                    <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                                        <span className="inline-flex items-center py-[3px] px-[10px] rounded-full text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                                            ✓ {g.memberRole || "Member"}
                                        </span>
                                        {g.memberRole !== "owner" && (
                                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={() => handleLeave(g.id)} disabled={joining === g.id}>Leave</button>
                                        )}
                                    </div>
                                ) : (
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={() => handleJoin(g.id)} disabled={joining === g.id}>
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
