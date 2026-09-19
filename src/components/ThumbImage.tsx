"use client";

import type { ImgHTMLAttributes, SyntheticEvent } from "react";

import { getThumbUrl } from "@/lib/utils/imageUrl";

/**
 * A card thumbnail that never shows as broken.
 *
 * Cards ask for the `_thumb.webp` variant of a photo. Uploads from before
 * thumbnails were generated (and any upload whose thumbnail step failed)
 * have no such file: storage answers 400, the card showed a broken image,
 * and the full photo one click away was fine (market, 2026-09-19). When
 * the variant is missing this falls back to the original once.
 */
export default function ThumbImage({ src, alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
    const thumb = getThumbUrl(src);
    const onError = (e: SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        if (img.dataset.fellBack === "1") return;
        img.dataset.fellBack = "1";
        img.src = src;
    };
    // eslint-disable-next-line @next/next/no-img-element -- storage URLs; sizing is the card's job
    return <img src={thumb} alt={alt} loading="lazy" onError={thumb === src ? undefined : onError} {...rest} />;
}
