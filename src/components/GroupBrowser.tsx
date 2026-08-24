"use client";

import { useState } from "react";
import Link from "next/link";
import { joinGroup, leaveGroup, type Group } from "@/app/actions/groups";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

// ============================================================
// BARN DIRECTORY — every barn is listed, including private ones.
// A private barn shows its name, type and size behind a "Private"
// badge; its roster and notice board stay behind the door.
// ============================================================

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
    const [busy, setBusy] = useState<string | null>(null);
    const [pending, setPending] = useState<Set<string>>(
        () => new Set(allGroups.filter((g) => g.joinRequestStatus === "pending").map((g) => g.id)),
    );

    const groups = tab === "mine" ? myGroups : allGroups;
    const filtered = groups
        .filter((g) => filter === "all" || g.groupType === filter)
        .filter(
            (g) =>
                !search ||
                g.name.toLowerCase().includes(search.toLowerCase()) ||
                g.description?.toLowerCase().includes(search.toLowerCase()),
        );

    async function handleJoin(group: Group) {
        setBusy(group.id);
        const result = await joinGroup(group.id);
        if (result.pending) {
            setPending((prev) => new Set(prev).add(group.id));
        }
        router.refresh();
        setBusy(null);
    }

    async function handleLeave(groupId: string) {
        if (!confirm("Leave this barn?")) return;
        setBusy(groupId);
        await leaveGroup(groupId);
        router.refresh();
        setBusy(null);
    }

    return (
        <div>
            {/* Tabs */}
            <div className="border-input mb-6 flex gap-1 border-b">
                <button
                    className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${tab === "browse" ? "border-forest text-forest" : "text-secondary-foreground hover:text-foreground border-transparent"}`}
                    onClick={() => setTab("browse")}
                >
                    🌐 All Barns
                    <span className="bg-forest/10 text-forest rounded-full px-2 py-0.5 text-xs font-bold">
                        {allGroups.length}
                    </span>
                </button>
                <button
                    className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${tab === "mine" ? "border-forest text-forest" : "text-secondary-foreground hover:text-foreground border-transparent"}`}
                    onClick={() => setTab("mine")}
                >
                    ⭐ My Barns
                    <span className="bg-forest/10 text-forest rounded-full px-2 py-0.5 text-xs font-bold">
                        {myGroups.length}
                    </span>
                </button>
            </div>

            {/* Search */}
            <div className="border-input bg-card sticky top-[calc(var(--header-height)+0.75rem)] z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 shadow-md transition-all max-sm:py-0">
                <Input
                    type="text"
                    placeholder="🔍 Search barns by name or description…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    id="barn-search"
                />
            </div>

            {/* Type Filter */}
            <div className="mb-6 flex flex-wrap gap-1">
                <button className={`studio-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                    All
                </button>
                {Object.entries(typeLabels).map(([key, label]) => (
                    <button
                        key={key}
                        className={`studio-chip ${filter === key ? "active" : ""}`}
                        onClick={() => setFilter(key)}
                    >
                        {TYPE_ICONS[key] || "📂"} {label}
                    </button>
                ))}
            </div>

            {/* Barn Cards */}
            {filtered.length === 0 ? (
                <div className="border-input bg-card flex flex-col items-center justify-center rounded-lg border p-8 text-center shadow-sm">
                    <p>
                        {tab === "mine"
                            ? "You haven't joined a barn yet. Browse the directory and find your people."
                            : "No barns found."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
                    {filtered.map((g) => (
                        <div
                            key={g.id}
                            className="border-input bg-card flex flex-col overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
                        >
                            {/* Banner — a barn with a face. The image is a
                                signed URL from the avatars bucket; cards
                                without one keep the old all-text layout. */}
                            {g.bannerUrl && (
                                <Link
                                    href={`/community/groups/${g.slug}`}
                                    className="block"
                                    aria-hidden="true"
                                    tabIndex={-1}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={g.bannerUrl}
                                        alt=""
                                        className="h-28 w-full object-cover"
                                        loading="lazy"
                                    />
                                </Link>
                            )}
                            <div className="flex flex-1 flex-col p-5">
                            {/* Card Header */}
                            <div className="mb-3 flex items-start gap-3">
                                <span className="text-2xl">{TYPE_ICONS[g.groupType] || "📂"}</span>
                                <div className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/community/groups/${g.slug}`}
                                            className="text-forest text-base font-semibold hover:underline"
                                        >
                                            {g.name}
                                        </Link>
                                        {g.isFeatured && (
                                            <span
                                                className="stamp !text-[0.62rem]"
                                                title="An official Model Horse Hub barn"
                                            >
                                                📌 Official
                                            </span>
                                        )}
                                        {g.isPrivate && (
                                            <span
                                                className="stamp !text-[0.62rem]"
                                                title="Private barn — members only"
                                            >
                                                🔒 Private
                                            </span>
                                        )}
                                    </span>
                                    <div className="text-secondary-foreground text-xs">
                                        {typeLabels[g.groupType] || g.groupType}
                                        {g.region && <> · {g.region}</>}
                                    </div>
                                </div>
                            </div>
                            {g.description && (
                                <p className="text-secondary-foreground mb-3 text-sm leading-relaxed">
                                    {g.description.slice(0, 120)}
                                    {g.description.length > 120 ? "..." : ""}
                                </p>
                            )}
                            {/* Card Footer */}
                            <div className="border-input mt-auto flex items-center justify-between border-t pt-3">
                                <span className="text-secondary-foreground text-xs">
                                    👥 {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}
                                </span>
                                {g.isMember ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#22c55e]">
                                            ✓ {g.memberRole || "Member"}
                                        </span>
                                        {g.memberRole !== "owner" && (
                                            <button
                                                className="border-input text-muted-foreground hover:text-foreground rounded-md border bg-transparent px-3 py-1 text-xs font-medium transition-colors"
                                                onClick={() => handleLeave(g.id)}
                                                disabled={busy === g.id}
                                            >
                                                Leave
                                            </button>
                                        )}
                                    </div>
                                ) : pending.has(g.id) ? (
                                    <span className="text-muted-foreground text-xs font-semibold italic">
                                        ⏳ Request pending
                                    </span>
                                ) : (
                                    <button
                                        className="bg-forest hover:bg-forest-dark rounded-md px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all"
                                        onClick={() => handleJoin(g)}
                                        disabled={busy === g.id}
                                    >
                                        {busy === g.id
                                            ? (g.isPrivate ? "Requesting..." : "Joining...")
                                            : (g.isPrivate ? "🔒 Ask to Join" : "+ Join")}
                                    </button>
                                )}
                            </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
