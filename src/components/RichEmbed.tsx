"use client";

import Link from "next/link";

/**
 * Detects internal horse passport URLs in text and renders them
 * as rich embed cards. Falls back to plain text for non-matching content.
 */

const HORSE_URL_RE = /\/community\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

interface RichEmbedProps {
    text: string;
    /** Pre-fetched embed data (horse name, finish, thumbnail URL) keyed by horse ID */
    embedData?: Map<string, {
        name: string;
        finish: string;
        maker: string;
        thumbnailUrl: string | null;
    }>;
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
            className="flex gap-4 border border-edge rounded-lg overflow-hidden bg-surface-secondary no-underline text-inherit mt-2 transition-colors hover:border-forest"
            id={`embed-${horseId}`}
        >
            {data.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={data.thumbnailUrl}
                    alt={data.name}
                    className="w-[100px] min-h-[80px] object-cover shrink-0"
                    loading="lazy"
                />
            )}
            <div className="py-2.5 px-3 flex flex-col gap-1 min-w-0">
                <div className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">🐴 {data.name}</div>
                <div className="text-xs text-muted line-clamp-2">
                    {data.finish} · {data.maker}
                </div>
                <div className="text-xs text-forest">Model Horse Hub</div>
            </div>
        </Link>
    );
}
