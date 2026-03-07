"use client";

import { useState } from "react";

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
  Front_Chest: "Front",
  Back_Hind: "Back",
  Detail_Face_Eyes: "Face & Eyes",
  Detail_Ears: "Ears",
  Detail_Hooves: "Hooves",
  Flaw_Rub_Damage: "Flaws & Details",
  Other: "Other",
};

export default function PassportGallery({ images }: PassportGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div>
        <div className="passport-hero">
          <div className="passport-hero-placeholder">
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

  return (
    <div>
      {/* Hero Image */}
      <div className="passport-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImage.signedUrl}
          alt={ANGLE_LABELS[activeImage.angle_profile] || activeImage.angle_profile}
          key={activeImage.signedUrl}
        />
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="passport-thumbs">
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
              <img
                src={img.signedUrl}
                alt={ANGLE_LABELS[img.angle_profile] || img.angle_profile}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
