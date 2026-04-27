"use client";

import { useState } from"react";

interface TrophyCaseProps {
 badges: {
 id: string;
 name: string;
 description: string;
 icon: string;
 category: string;
 tier: number;
 earnedAt: string;
 }[];
}

const CATEGORY_ORDER = ["exclusive","collection","social","commerce","shows"];

const CATEGORY_LABELS: Record<string, string> = {
 exclusive:"🏅 Exclusive",
 collection:"🐴 Collection",
 social:"🦋 Social",
 commerce:"💰 Commerce",
 shows:"📷 Shows",
};

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

function getTierClasses(tier: number): string {
 switch (tier) {
 case 1:
 return"border-[#cd7f32] hover:shadow-[0_0_12px_rgba(205,127,50,0.3)]";
 case 2:
 return"border-[#c0c0c0] hover:shadow-[0_0_12px_rgba(192,192,192,0.4)]";
 case 3:
 return"border-[#ffd700] hover:shadow-[0_0_16px_rgba(255,215,0,0.4)]";
 case 4:
 return"border-[#b9f2ff] hover:shadow-[0_0_20px_rgba(185,242,255,0.5)]";
 case 5:
 return"border-forest bg-muted/80 hover:shadow-[0_0_24px_rgba(212,165,116,0.5)]";
 default:
 return"border-input";
 }
}

export default function TrophyCase({ badges }: TrophyCaseProps) {
 const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

 if (badges.length === 0) {
 return (
 <div className="text-muted-foreground py-8 text-center">
 <span className="mb-2 block text-[2.5rem]">🏆</span>
 <p>No badges earned yet — keep collecting!</p>
 </div>
 );
 }

 // Group badges by category
 const grouped = new Map<string, typeof badges>();
 for (const badge of badges) {
 if (!grouped.has(badge.category)) grouped.set(badge.category, []);
 grouped.get(badge.category)!.push(badge);
 }

 // Sort categories by predefined order
 const sortedCategories = [...grouped.keys()].sort(
 (a, b) => (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99),
 );

 return (
 <div className="mt-2">
 {sortedCategories.map((category) => (
 <div key={category}>
 <h4 className="text-muted-foreground my-6 mb-2 text-sm font-semibold tracking-[0.05em] uppercase first:mt-0">
 {CATEGORY_LABELS[category] || category}
 </h4>
 <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 max-[480px]:grid-cols-[repeat(auto-fill,minmax(90px,1fr))] max-[480px]:gap-2">
 {grouped.get(category)!.map((badge) => (
 <div
 key={badge.id}
 className={`bg-muted relative cursor-default rounded-lg border p-4 text-center transition-transform hover:-translate-y-0.5 max-[480px]:p-2 ${getTierClasses(badge.tier)}`}
 onMouseEnter={() => setHoveredBadge(badge.id)}
 onMouseLeave={() => setHoveredBadge(null)}
 >
 <span className="mb-1 block text-[2rem] max-[480px]:text-2xl">{badge.icon}</span>
 <span className="block text-xs font-semibold">
 {badge.name}
 </span>
 <span className="text-muted-foreground mt-0.5 block text-xs">
 {formatDate(badge.earnedAt)}
 </span>
 {hoveredBadge === badge.id && (
 <div className="border-input [&_p]:text-secondary-foreground [&>span]:text-muted-foreground pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 max-w-[260px] min-w-[200px] -translate-x-1/2 animate-[fadeInUp_0.15s_ease] rounded-md border bg-[var(--color-bg-muted)] px-4 py-2 text-left shadow-lg max-[480px]:hidden [&_p]:m-0 [&_p]:mb-1 [&_p]:text-xs [&_p]:leading-snug [&_strong]:mb-1 [&_strong]:block [&_strong]:text-sm [&>span]:text-xs">
 <strong>{badge.name}</strong>
 <p>{badge.description}</p>
 <span>Earned {formatDate(badge.earnedAt)}</span>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 );
}
