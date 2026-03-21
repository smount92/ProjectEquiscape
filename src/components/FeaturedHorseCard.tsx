"use client";

import Link from"next/link";

interface FeaturedHorseCardProps {
 horseId: string;
 horseName: string;
 title: string;
 description: string | null;
 ownerAlias: string;
 thumbnailUrl: string | null;
 finishType: string;
}

export default function FeaturedHorseCard({
 horseId,
 horseName,
 title,
 description,
 ownerAlias,
 thumbnailUrl,
 finishType,
}: FeaturedHorseCardProps) {
 return (
 <Link
 href={`/community/${horseId}`}
 className="animate-fade-in-up mb-8 flex gap-8 overflow-hidden rounded-lg border border-[rgba(245,158,11,0.2)] bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,179,8,0.03))] p-8 text-inherit no-underline transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.4)] hover:shadow-[0_4px_24px_rgba(245,158,11,0.12)] max-sm:flex-col"
 id="featured-horse"
 >
 <div className="relative h-[200px] w-[200px] shrink-0 overflow-hidden rounded-md max-sm:h-[180px] max-sm:w-full">
 {thumbnailUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={thumbnailUrl}
 alt={horseName}
 loading="eager"
 className="h-full w-full bg-black/15 object-contain"
 />
 ) : (
 <div className="rounded-lg border border-edge bg-card p-4 shadow-md transition-all">
 <span className="flex items-center justify-center rounded-lg border border-edge bg-card text-4xl shadow-md">
 🐴
 </span>
 </div>
 )}
 <div className="absolute top-2 left-2 rounded-sm bg-[linear-gradient(135deg,#F59E0B,#D97706)] px-2.5 py-1 text-[0.7rem] font-bold whitespace-nowrap text-white">
 🌟 {title}
 </div>
 </div>
 <div className="flex min-w-0 flex-1 flex-col justify-center">
 <div className="mb-1 text-[1.4rem] font-bold">{horseName}</div>
 <div className="text-muted mb-4 text-sm">
 by @{ownerAlias} · {finishType}
 </div>
 {description && <p className="text-muted m-0 text-sm leading-relaxed italic">{description}</p>}
 </div>
 </Link>
 );
}
