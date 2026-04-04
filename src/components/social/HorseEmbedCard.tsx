"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getHorseEmbedData } from "@/app/actions/posts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface HorseEmbedCardProps {
    /** Horse UUID extracted from post content */
    horseId: string;
}

const TRADE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    not_for_sale: { label: "Not For Sale", variant: "outline" },
    for_sale: { label: "For Sale", variant: "default" },
    open_to_offers: { label: "Open to Offers", variant: "secondary" },
    for_trade: { label: "For Trade", variant: "secondary" },
};

export default function HorseEmbedCard({ horseId }: HorseEmbedCardProps) {
    const [data, setData] = useState<{
        name: string;
        refName: string | null;
        thumbnailUrl: string | null;
        tradeStatus: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getHorseEmbedData(horseId).then((result: { name: string; refName: string | null; thumbnailUrl: string | null; tradeStatus: string } | null) => {
            if (!cancelled) {
                setData(result);
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [horseId]);

    if (loading) {
        return (
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-edge bg-card p-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        );
    }

    if (!data) return null; // Horse doesn't exist or isn't public

    const badgeInfo = TRADE_BADGE[data.tradeStatus];

    return (
        <Link
            href={`/community/${horseId}`}
            className="mt-2 flex items-center gap-3 rounded-lg border border-edge bg-card p-3 no-underline shadow-sm transition-all hover:shadow-md"
        >
            {data.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={data.thumbnailUrl}
                    alt={data.name}
                    className="h-16 w-16 shrink-0 rounded-md border border-edge object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-edge bg-parchment text-2xl">
                    🐴
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{data.name}</span>
                    {badgeInfo && (
                        <Badge variant={badgeInfo.variant} className="shrink-0 text-[0.6rem]">
                            {badgeInfo.label}
                        </Badge>
                    )}
                </div>
                {data.refName && (
                    <p className="mt-0.5 truncate text-xs text-muted">{data.refName}</p>
                )}
            </div>
        </Link>
    );
}
