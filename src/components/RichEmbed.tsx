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
            className="embed-card"
            id={`embed-${horseId}`}
        >
            {data.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={data.thumbnailUrl}
                    alt={data.name}
                    className="embed-card-image"
                    loading="lazy"
                />
            )}
            <div className="embed-card-body">
                <div className="embed-card-title">🐴 {data.name}</div>
                <div className="embed-card-desc">
                    {data.finish} · {data.maker}
                </div>
                <div className="embed-card-domain">Model Horse Hub</div>
            </div>
        </Link>
    );
}
