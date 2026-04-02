"use client";

import { useState, useMemo, useCallback } from"react";
import Link from"next/link";
import RatingBadge from"@/components/RatingBadge";
import UserAvatar from"@/components/UserAvatar";
import { toggleFollow } from"@/app/actions/follows";
import { Input } from "@/components/ui/input";

interface DiscoverUser {
 id: string;
 alias_name: string;
 created_at: string;
 avatar_url: string | null;
 bio: string | null;
 public_horse_count: number;
 total_horse_count: number;
 avg_rating: number;
 rating_count: number;
 has_studio: boolean;
}

interface DiscoverGridProps {
 users: DiscoverUser[];
 currentUserId: string;
 followedIds: string[];
}

type TagKey ="all" |"art_studio" |"top_rated" |"new_members" |"big_stables";

const TAGS: { key: TagKey; emoji: string; label: string }[] = [
 { key:"all", emoji:"👥", label:"All" },
 { key:"art_studio", emoji:"🎨", label:"Art Studios" },
 { key:"top_rated", emoji:"⭐", label:"Top Rated" },
 { key:"new_members", emoji:"🆕", label:"New Members" },
 { key:"big_stables", emoji:"🐴", label:"Big Stables" },
];

const memberSince = (dateStr: string) =>
 new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 year:"numeric",
 });

//"New" = joined within the last 30 days
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function DiscoverGrid({ users, currentUserId, followedIds }: DiscoverGridProps) {
 const [searchQuery, setSearchQuery] = useState("");
 const [activeTag, setActiveTag] = useState<TagKey>("all");
 const [followSet, setFollowSet] = useState<Set<string>>(new Set(followedIds));

 const handleFollow = useCallback(
 async (userId: string, e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 const wasFollowing = followSet.has(userId);
 // Optimistic toggle
 setFollowSet((prev) => {
 const next = new Set(prev);
 if (wasFollowing) next.delete(userId);
 else next.add(userId);
 return next;
 });
 await toggleFollow(userId);
 },
 [followSet],
 );

 const filteredUsers = useMemo(() => {
 let result = users;

 // Tag filter
 switch (activeTag) {
 case"art_studio":
 result = result.filter((u) => u.has_studio);
 break;
 case"top_rated":
 result = result
 .filter((u) => u.rating_count > 0)
 .sort((a, b) => b.avg_rating - a.avg_rating || b.rating_count - a.rating_count);
 break;
 case"new_members":
 result = result.filter((u) => Date.now() - new Date(u.created_at).getTime() < THIRTY_DAYS_MS);
 break;
 case"big_stables":
 result = result
 .filter((u) => u.total_horse_count >= 5)
 .sort((a, b) => b.total_horse_count - a.total_horse_count);
 break;
 }

 // Search filter — matches name or bio
 if (searchQuery.trim()) {
 const q = searchQuery.toLowerCase();
 result = result.filter(
 (u) => u.alias_name.toLowerCase().includes(q) || (u.bio && u.bio.toLowerCase().includes(q)),
 );
 }

 return result;
 }, [users, searchQuery, activeTag]);

 // Tag counts for badges
 const tagCounts = useMemo(
 () => ({
 all: users.length,
 art_studio: users.filter((u) => u.has_studio).length,
 top_rated: users.filter((u) => u.rating_count > 0).length,
 new_members: users.filter((u) => Date.now() - new Date(u.created_at).getTime() < THIRTY_DAYS_MS).length,
 big_stables: users.filter((u) => u.total_horse_count >= 5).length,
 }),
 [users],
 );

 return (
 <>
 {/* Search Bar */}
 <div className="sticky top-[calc(var(--header-height)+0.75rem)] bg-white border-stone-200 shadow-md z-[10] mb-8 flex items-center gap-2 rounded-xl border px-6 py-2 transition-all max-sm:py-0">
 <Input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="🔍 Search by name or bio…"
 className="max-w-[500px]"
 id="discover-search-bar"
 />
 </div>

 {/* Tag Chips */}
 <div className="mb-6 flex gap-1 overflow-x-auto pb-1">
 {TAGS.map((tag) => (
 <button
 key={tag.key}
 className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${activeTag === tag.key ?"bg-forest border-forest text-white shadow-[0_2px_8px_rgba(129,140,248,0.25)]" :"border-stone-200 text-stone-600 hover:border-emerald-700 hover:text-stone-900 bg-stone-50"}`}
 onClick={() => setActiveTag(tag.key)}
 >
 <span>{tag.emoji}</span>
 <span>{tag.label}</span>
 <span className="text-[0.7rem]">{tagCounts[tag.key]}</span>
 </button>
 ))}
 </div>

 {/* Results count */}
 {(searchQuery.trim() || activeTag !=="all") && (
 <div className="text-stone-500 mb-4 mb-6 pl-1 text-sm">
 {filteredUsers.length === 0
 ? searchQuery.trim()
 ? `No collectors match"${searchQuery}"`
 :"No collectors match this filter"
 : `Showing ${filteredUsers.length} collector${filteredUsers.length !== 1 ?"s" :""}`}
 </div>
 )}

 {/* Grid */}
 {filteredUsers.length === 0 && !searchQuery.trim() && activeTag ==="all" ? (
 <div className="bg-white border-stone-200 animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">👥</div>
 <h2>No Active Collectors Yet</h2>
 <p>Be the first to make your models public!</p>
 </div>
 ) : filteredUsers.length === 0 ? (
 <div className="bg-white border-stone-200 animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-4 text-5xl">🔍</div>
 <h2>No Results</h2>
 <p>Try a different search or filter.</p>
 </div>
 ) : (
 <div className="animate-fade-in-up grid grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
 {filteredUsers.map((u) => {
 const isMe = u.id === currentUserId;

 return (
 <Link
 key={u.id}
 href={`/profile/${encodeURIComponent(u.alias_name)}`}
 className="bg-white border-stone-200 hover:border-emerald-700 flex items-start gap-4 rounded-lg border p-6 text-inherit no-underline shadow-md transition-all duration-250 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(129,140,248,0.12)]"
 id={`discover-${u.id}`}
 >
 <div className="text-forest flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(129,140,248,0.2),rgba(167,139,250,0.1))]">
 <UserAvatar avatarUrl={u.avatar_url} aliasName={u.alias_name} size={40} />
 </div>
 <div className="min-w-0 flex-1">
 <div className="mb-1 text-base font-semibold">
 @{u.alias_name}
 {isMe && (
 <span
 className="bg-forest ml-1.5 inline-flex rounded-sm px-2 py-[2px] text-xs font-bold tracking-wider text-white uppercase"
 >
 You
 </span>
 )}
 {u.has_studio && (
 <span className="ml-1 text-[0.85em]" title="Has an Art Studio">
 🎨
 </span>
 )}
 </div>
 {u.bio && (
 <div className="text-stone-600 flex gap-4 text-xs italic">
 {u.bio.length > 80 ? `${u.bio.slice(0, 80)}…` : u.bio}
 </div>
 )}
 <div className="text-stone-600 flex gap-4 text-xs">
 <span>
 🐴 {u.total_horse_count} model{u.total_horse_count !== 1 ?"s" :""}
 {u.public_horse_count > 0 && u.public_horse_count < u.total_horse_count && (
 <span className="text-stone-500"> ({u.public_horse_count} public)</span>
 )}
 </span>
 <span>📅 {memberSince(u.created_at)}</span>
 </div>
 {u.rating_count > 0 && (
 <div className="mt-1">
 <RatingBadge
 average={Number(Number(u.avg_rating).toFixed(1))}
 count={u.rating_count}
 />
 </div>
 )}
 {!isMe && (
 <button
 className={`btn btn-sm mt-1 text-xs p-[3px_10px] ${followSet.has(u.id) ?"btn-ghost follow-btn-following" :"btn-primary"}`}
 onClick={(e) => handleFollow(u.id, e)}
 >
 {followSet.has(u.id) ?"✓ Following" :"+ Follow"}
 </button>
 )}
 </div>
 </Link>
 );
 })}
 </div>
 )}
 </>
 );
}
