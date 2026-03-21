"use client";

import { useState } from"react";
import Link from"next/link";
import { joinGroup, leaveGroup, type Group } from"@/app/actions/groups";
import { useRouter } from"next/navigation";

interface Props {
 allGroups: Group[];
 myGroups: Group[];
 typeLabels: Record<string, string>;
}

const TYPE_ICONS: Record<string, string> = {
 regional_club:"📍",
 breed_interest:"🐴",
 scale_interest:"📏",
 show_circuit:"🏆",
 artist_collective:"🎨",
 general:"💬",
};

export default function GroupBrowser({ allGroups, myGroups, typeLabels }: Props) {
 const router = useRouter();
 const [tab, setTab] = useState<"browse" |"mine">("browse");
 const [filter, setFilter] = useState("all");
 const [search, setSearch] = useState("");
 const [joining, setJoining] = useState<string | null>(null);

 const groups = tab ==="mine" ? myGroups : allGroups;
 const filtered = groups
 .filter((g) => filter ==="all" || g.groupType === filter)
 .filter(
 (g) =>
 !search ||
 g.name.toLowerCase().includes(search.toLowerCase()) ||
 g.description?.toLowerCase().includes(search.toLowerCase()),
 );

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
 <div className="studio-tabs mb-6">
 <button className={`studio-tab ${tab ==="browse" ?"active" :""}`} onClick={() => setTab("browse")}>
 🌐 Browse All
 <span className="flex cursor-pointer items-center gap-1 rounded-md border border-edge bg-card px-2 py-1 text-xs text-muted transition-all">
 {allGroups.length}
 </span>
 </button>
 <button className={`studio-tab ${tab ==="mine" ?"active" :""}`} onClick={() => setTab("mine")}>
 ⭐ My Groups
 <span className="flex cursor-pointer items-center gap-1 rounded-md border border-edge bg-card px-2 py-1 text-xs text-muted transition-all">
 {myGroups.length}
 </span>
 </button>
 </div>

 {/* Search */}
 <div className="sticky top-[calc(var(--header-height)+var(--space-md))] bg-card border-edge z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 shadow-md transition-all max-sm:py-[0]">
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
 <div className="mb-6 flex flex-wrap gap-1">
 <button className={`studio-chip ${filter ==="all" ?"active" :""}`} onClick={() => setFilter("all")}>
 All
 </button>
 {Object.entries(typeLabels).map(([key, label]) => (
 <button
 key={key}
 className={`studio-chip ${filter === key ?"active" :""}`}
 onClick={() => setFilter(key)}
 >
 {TYPE_ICONS[key] ||"📂"} {label}
 </button>
 ))}
 </div>

 {/* Group Cards */}
 {filtered.length === 0 ? (
 <div className="empty-state">
 <p>{tab ==="mine" ?"You haven't joined any groups yet." :"No groups found."}</p>
 </div>
 ) : (
 <div className="grid-cols-[repeat(auto-fill,minmax(320px,1fr))] grid gap-4">
 {filtered.map((g) => (
 <div
 key={g.id}
 className="bg-elevated border-edge flex flex-col rounded-lg border p-6 transition-colors"
 >
 <div className="bg-elevated border-edge sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <span className="bg-elevated border-edge transition-colors-icon flex flex-col rounded-lg border p-6">
 {TYPE_ICONS[g.groupType] ||"📂"}
 </span>
 <div>
 <Link
 href={`/community/groups/${g.slug}`}
 className="bg-elevated border-edge transition-colors-name flex flex-col rounded-lg border p-6"
 >
 {g.name}
 </Link>
 <div className="bg-elevated border-edge transition-colors-meta flex flex-col rounded-lg border p-6">
 {typeLabels[g.groupType] || g.groupType}
 {g.region && <> · {g.region}</>}
 </div>
 </div>
 </div>
 {g.description && (
 <p className="bg-elevated border-edge transition-colors-desc flex flex-col rounded-lg border p-6">
 {g.description.slice(0, 120)}
 {g.description.length > 120 ?"..." :""}
 </p>
 )}
 <div className="bg-elevated border-edge transition-colors-footer flex flex-col rounded-lg border p-6">
 <span className="bg-elevated border-edge transition-colors-members flex flex-col rounded-lg border p-6">
 👥 {g.memberCount} member{g.memberCount !== 1 ?"s" :""}
 </span>
 {g.isMember ? (
 <div className="gap-1" style={{ display:"flex" }}>
 <span
 className="inline-flex items-center rounded-full bg-[rgba(34,197,94,0.12)] px-[10px] py-[3px] text-[calc(0.7rem*var(--font-scale))] font-semibold whitespace-nowrap text-[#22c55e]"
 style={{ border:"1px solid rgba(34,197,94,0.3)" }}
 >
 ✓ {g.memberRole ||"Member"}
 </span>
 {g.memberRole !=="owner" && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => handleLeave(g.id)}
 disabled={joining === g.id}
 >
 Leave
 </button>
 )}
 </div>
 ) : (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleJoin(g.id)}
 disabled={joining === g.id}
 >
 {joining === g.id ?"Joining..." :"+ Join"}
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
