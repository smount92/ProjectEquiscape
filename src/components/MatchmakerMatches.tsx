"use client";

import { useState } from"react";
import Link from"next/link";
import MessageSellerButton from"@/components/MessageSellerButton";

interface MarketplaceMatch {
 id: string;
 custom_name: string;
 trade_status: string;
 listing_price: number | null;
 marketplace_notes: string | null;
 thumbnailUrl: string | null;
 ownerAlias: string;
 ownerId: string;
}

export default function MatchmakerMatches({
 matchCount,
 matches,
}: {
 matchCount: number;
 matches: MarketplaceMatch[];
}) {
 const [expanded, setExpanded] = useState(false);

 return (
 <div className="mt-4">
 <button className="matchmaker-badge" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
 <span className="matchmaker-badge-fire">🔥</span>
 <span className="flex-1">{matchCount} Available in Marketplace</span>
 <svg
 className={`matchmaker-chevron ${expanded ?"expanded" :""}`}
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </button>

 {expanded && (
 <div className="animate-fade-in-up mt-2 flex flex-col gap-2">
 {matches.map((match) => (
 <div
 key={match.id}
 className="bg-muted border-input flex gap-2 rounded-md border p-2 transition-all duration-200 hover:border-orange-300 hover:shadow-[0_2px_12px_rgba(251,146,60,0.1)]"
 >
 <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-sm bg-black/[0.03]">
 {match.thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={match.thumbnailUrl}
 alt={match.custom_name}
 loading="lazy"
 className="h-full w-full object-cover"
 />
 ) : (
 <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">
 🐴
 </div>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <Link
 href={`/community/${match.id}`}
 className="text-forest block text-sm font-semibold no-underline hover:underline"
 >
 {match.custom_name}
 </Link>
 <div className="mt-[2px] flex items-center gap-2">
 <span
 className={`rounded-full px-2 py-[2px] text-xs font-bold ${match.trade_status ==="For Sale" ?"bg-emerald-100 text-[#22c55e]" :"bg-blue-50 text-[#3b82f6]"}`}
 >
 {match.trade_status ==="For Sale" ?"💲" :"🤝"}{""}
 {match.listing_price
 ? `$${match.listing_price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
 : match.trade_status}
 </span>
 <Link
 href={`/profile/${encodeURIComponent(match.ownerAlias)}`}
 className="text-muted-foreground hover:text-forest text-xs no-underline hover:underline"
 >
 @{match.ownerAlias}
 </Link>
 </div>
 {match.marketplace_notes && (
 <div className="text-muted-foreground mt-1 text-xs leading-snug italic">
 {match.marketplace_notes}
 </div>
 )}
 <div className="mt-[6px]">
 <MessageSellerButton
 sellerId={match.ownerId}
 horseId={match.id}
 horseName={match.custom_name}
 tradeStatus={match.trade_status}
 askingPrice={match.listing_price}
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
