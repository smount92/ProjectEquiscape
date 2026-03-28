"use client";

import Link from"next/link";

/**
 * Detects internal horse passport URLs in text and renders them
 * as rich embed cards. Falls back to plain text for non-matching content.
 */

const HORSE_URL_RE = /\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

interface RichEmbedProps {
 text: string;
 /** Pre-fetched embed data (horse name, finish, thumbnail URL) keyed by horse ID */
 embedData?: Map<
 string,
 {
 name: string;
 finish: string;
 maker: string;
 thumbnailUrl: string | null;
 }
 >;
}

export default function RichEmbed({ text, embedData }: RichEmbedProps) {
 const match = text.match(HORSE_URL_RE);

 if (!match || !embedData) return null;

 const horseId = match[1];
 const data = embedData.get(horseId);
 if (!data) return null;

 return (
 <Link
 href={`/community/${horseId}`}
 className="border-stone-200 bg-surface-secondary hover:border-emerald-700 mt-2 flex gap-4 overflow-hidden rounded-lg border text-inherit no-underline transition-colors"
 id={`embed-${horseId}`}
 >
 {data.thumbnailUrl && (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={data.thumbnailUrl}
 alt={data.name}
 className="min-h-[80px] w-[100px] shrink-0 object-cover"
 loading="lazy"
 />
 )}
 <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
 <div className="overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
 🐴 {data.name}
 </div>
 <div className="text-stone-500 line-clamp-2 text-xs">
 {data.finish} · {data.maker}
 </div>
 <div className="text-forest text-xs">Model Horse Hub</div>
 </div>
 </Link>
 );
}
