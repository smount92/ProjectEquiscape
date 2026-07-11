"use client";

import { useState } from "react";

/**
 * Reference-page photo gallery. Shows one collector photo at a time with
 * prev/next arrows + dots when multiple owners have contributed photos.
 */
export default function ReferencePhotoGallery({
    photos,
    alt,
}: {
    photos: string[];
    alt: string;
}) {
    const [idx, setIdx] = useState(0);
    const has = photos.length > 0;
    const multi = photos.length > 1;
    const go = (d: number) => setIdx((i) => (i + d + photos.length) % photos.length);

    return (
        <div className="overflow-hidden rounded-xl border border-input bg-card shadow-md">
            <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                {has ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos[idx]} alt={alt} className="h-full w-full object-contain" />
                ) : (
                    <span className="text-5xl opacity-40">🐴</span>
                )}

                {multi && (
                    <>
                        <button
                            type="button"
                            onClick={() => go(-1)}
                            aria-label="Previous photo"
                            className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card/85 text-lg text-foreground shadow-sm hover:bg-card"
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            onClick={() => go(1)}
                            aria-label="Next photo"
                            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card/85 text-lg text-foreground shadow-sm hover:bg-card"
                        >
                            ›
                        </button>
                        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                            {photos.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    aria-label={`Photo ${i + 1}`}
                                    onClick={() => setIdx(i)}
                                    className={`h-2 w-2 rounded-full ${
                                        i === idx ? "bg-forest" : "bg-foreground/25"
                                    }`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {has && (
                <p className="px-3 py-2 text-xs text-muted-foreground italic">
                    {multi
                        ? `Photo ${idx + 1} of ${photos.length} — contributed by collectors who own this model.`
                        : "Photo contributed by a collector who owns this model."}
                </p>
            )}
        </div>
    );
}
