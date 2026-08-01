"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { swipeAction } from "@/components/PhotoLightbox";

export interface GalleryPhoto {
    url: string;
    name: string;
    /** The owner's public horse id — links the photo to its passport. */
    horseId?: string;
}

/**
 * Reference-page photo gallery. Shows one collector photo at a time with
 * prev/next arrows + dots when multiple owners have contributed photos. Each
 * photo is captioned with the owner's horse name — important on a mold page,
 * where the photos are different finishes on the same sculpture.
 */
export default function ReferencePhotoGallery({
    photos,
    alt,
    contextLabel = "contributed by a collector who owns this model",
}: {
    photos: GalleryPhoto[];
    alt: string;
    contextLabel?: string;
}) {
    const [idx, setIdx] = useState(0);
    const has = photos.length > 0;
    const multi = photos.length > 1;
    const current = has ? photos[Math.min(idx, photos.length - 1)] : null;
    const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);
    // Same pointer-swipe pattern as PhotoLightbox (touch + pen flip the reel).
    const pointerStart = useRef<{ x: number; y: number } | null>(null);

    return (
        <div className="overflow-hidden rounded-xl border border-input bg-card shadow-md">
            <div
                className="relative flex aspect-[4/3] touch-pan-y items-center justify-center bg-muted"
                onPointerDown={(e) => {
                    if (multi) pointerStart.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                    const start = pointerStart.current;
                    pointerStart.current = null;
                    if (!start || !multi) return;
                    const action = swipeAction(e.clientX - start.x, e.clientY - start.y);
                    if (action === "next") go(1);
                    else if (action === "prev") go(-1);
                }}
                onPointerCancel={() => {
                    pointerStart.current = null;
                }}
            >
                {current ? (
                    <Image
                        src={current.url}
                        alt={current.name || alt}
                        fill
                        sizes="(min-width: 768px) 360px, 100vw"
                        className="object-contain"
                        priority
                        draggable={false}
                    />
                ) : (
                    <span className="text-5xl opacity-40">🐴</span>
                )}

                {multi && (
                    <>
                        {/* 44px arrows (WCAG 2.5.5 touch targets — were 32px) */}
                        <button
                            type="button"
                            onClick={() => go(-1)}
                            aria-label="Previous photo"
                            className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card/85 text-xl text-foreground shadow-sm hover:bg-card"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={() => go(1)}
                            aria-label="Next photo"
                            className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card/85 text-xl text-foreground shadow-sm hover:bg-card"
                        >
                            ›
                        </button>
                        {/* "N of M" counter — replaces the 8px dot targets */}
                        <div
                            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums"
                            aria-live="polite"
                        >
                            {idx + 1} of {photos.length}
                        </div>
                    </>
                )}
            </div>

            {current && (
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <p className="m-0 text-xs text-muted-foreground italic">
                        {current.name && <span className="text-foreground not-italic">“{current.name}”</span>}
                        {current.name ? " — " : ""}
                        {multi ? `${idx + 1} of ${photos.length}, ` : ""}
                        {contextLabel}.
                    </p>
                    {current.horseId && (
                        <a
                            href={`/community/${current.horseId}`}
                            className="shrink-0 text-xs font-semibold whitespace-nowrap text-forest hover:underline"
                        >
                            View passport →
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
