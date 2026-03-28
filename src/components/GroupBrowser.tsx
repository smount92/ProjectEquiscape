"use client";

import { useState } from"react";
import Link from"next/link";
import { joinGroup, leaveGroup, type Group } from"@/app/actions/groups";
import { useRouter } from"next/navigation";
import { Input } from "@/components/ui/input";

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
 <div className="mb-6 flex gap-1 border-b border-stone-200">
 <button
 className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${tab ==="browse" ?"border-forest text-forest" :"border-transparent text-stone-600 hover:text-stone-900"}`}
 onClick={() => setTab("browse")}
 >
 🌐 Browse All
 <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">
 {allGroups.length}
 </span>
 </button>
 <button
 className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${tab ==="mine" ?"border-forest text-forest" :"border-transparent text-stone-600 hover:text-stone-900"}`}
 onClick={() => setTab("mine")}
 >
 ⭐ My Groups
 <span className="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">
 {myGroups.length}
 </span>
 </button>
 </div>

 {/* Search */}
 <div className="sticky top-[calc(var(--header-height)+0.75rem)] z-[10] mb-8 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-2 shadow-md transition-all max-sm:py-0">
 <Input
 type="text"
 
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
 <div className="flex flex-col items-center justify-center rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
 <p>{tab ==="mine" ?"You haven't joined any groups yet." :"No groups found."}</p>
 </div>
 ) : (
 <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
 {filtered.map((g) => (
 <div
 key={g.id}
 className="flex flex-col rounded-lg border border-stone-200 bg-white p-5 transition-shadow hover:shadow-md"
 >
 {/* Card Header */}
 <div className="mb-3 flex items-start gap-3">
 <span className="text-2xl">
 {TYPE_ICONS[g.groupType] ||"📂"}
 </span>
 <div className="min-w-0 flex-1">
 <Link
 href={`/community/groups/${g.slug}`}
 className="text-base font-semibold text-forest hover:underline"
 >
 {g.name}
 </Link>
 <div className="text-xs text-stone-600">
 {typeLabels[g.groupType] || g.groupType}
 {g.region && <> · {g.region}</>}
 </div>
 </div>
 </div>
 {g.description && (
 <p className="mb-3 text-sm leading-relaxed text-stone-600">
 {g.description.slice(0, 120)}
 {g.description.length > 120 ?"..." :""}
 </p>
 )}
 {/* Card Footer */}
 <div className="mt-auto flex items-center justify-between pt-3 border-t border-stone-200">
 <span className="text-xs text-stone-600">
 👥 {g.memberCount} member{g.memberCount !== 1 ?"s" :""}
 </span>
 {g.isMember ? (
 <div className="flex items-center gap-2">
 <span
 className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-[#22c55e] border border-emerald-200"
 >
 ✓ {g.memberRole ||"Member"}
 </span>
 {g.memberRole !=="owner" && (
 <button
 className="rounded-md border border-stone-200 bg-transparent px-3 py-1 text-xs font-medium text-stone-500 transition-colors hover:text-stone-900"
 onClick={() => handleLeave(g.id)}
 disabled={joining === g.id}
 >
 Leave
 </button>
 )}
 </div>
 ) : (
 <button
 className="rounded-md bg-forest px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-forest-dark"
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
