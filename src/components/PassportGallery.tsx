"use client";

import { useState } from "react";
import PhotoLightbox from "@/components/PhotoLightbox";

interface GalleryImage {
    signedUrl: string;
    angle_profile: string;
}

interface PassportGalleryProps {
    images: GalleryImage[];
}

const ANGLE_LABELS: Record<string, string> = {
    Primary_Thumbnail: "Near-Side",
    Left_Side: "Left Side",
    Right_Side: "Off-Side",
    Front_Chest: "Front / Chest",
    Back_Hind: "Hindquarters",
    Belly_Makers_Mark: "Belly / Mark",
    Detail_Face_Eyes: "Face & Eyes",
    Detail_Ears: "Ears",
    Detail_Hooves: "Hooves",
    Flaw_Rub_Damage: "Flaws",
    extra_detail: "Detail",
    Other: "Other",
};

export default function PassportGallery({ images }: PassportGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (images.length === 0) {
        return (
            <div>
                <div className="bg-[rgba(0, 0, 0, 0.15)] h-full w-full object-contain">
                    <div className="bg-[rgba(0, 0, 0, 0.15)]-placeholder h-full w-full object-contain">
                        <span>📷</span>
                        <p
                            style={{
                                fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                            }}
                        >
                            No photos uploaded
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const activeImage = images[activeIndex];

    const lightboxImages = images.map((img) => ({
        url: img.signedUrl,
        label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
    }));

    return (
        <div>
            {/* Hero Image — click to open lightbox */}
            <div
                className="bg-[rgba(0, 0, 0, 0.15)] h-full w-full object-contain"
                onClick={() => setLightboxIndex(activeIndex)}
                style={{ cursor: "zoom-in" }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={activeImage.signedUrl}
                    alt={ANGLE_LABELS[activeImage.angle_profile] || activeImage.angle_profile}
                    key={activeImage.signedUrl}
                />
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
                <div className="grid-cols-[repeat(auto-fill, minmax(72px, 1fr))] grid gap-1">
                    {images.map((img, i) => (
                        <div
                            key={img.signedUrl}
                            className={`passport-thumb ${i === activeIndex ? "active" : ""}`}
                            onClick={() => setActiveIndex(i)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setActiveIndex(i);
                            }}
                            aria-label={`View ${ANGLE_LABELS[img.angle_profile] || img.angle_profile} photo`}
                            title={ANGLE_LABELS[img.angle_profile] || img.angle_profile}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.signedUrl} alt={ANGLE_LABELS[img.angle_profile] || img.angle_profile} />
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxIndex !== null && (
                <PhotoLightbox
                    images={lightboxImages}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
        </div>
    );
}
