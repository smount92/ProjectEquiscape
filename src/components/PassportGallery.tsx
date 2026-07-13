"use client";

import { useState } from"react";
import Image from "next/image";
import { Camera } from "lucide-react";
import PhotoLightbox from"@/components/PhotoLightbox";

interface GalleryImage {
 signedUrl: string;
 angle_profile: string;
 shortSlug?: string | null;
}

interface PassportGalleryProps {
 images: GalleryImage[];
}

const ANGLE_LABELS: Record<string, string> = {
 Primary_Thumbnail:"Near-Side",
 Left_Side:"Left Side",
 Right_Side:"Off-Side",
 Front_Chest:"Front / Chest",
 Back_Hind:"Hindquarters",
 Belly_Makers_Mark:"Belly / Mark",
 Detail_Face_Eyes:"Face & Eyes",
 Detail_Ears:"Ears",
 Detail_Hooves:"Hooves",
 Flaw_Rub_Damage:"Flaws",
 extra_detail:"Detail",
 Other:"Other",
};

export default function PassportGallery({ images }: PassportGalleryProps) {
 const [activeIndex, setActiveIndex] = useState(0);
 const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

 if (images.length === 0) {
 return (
 <div className="flex aspect-[4/3] w-full min-h-[320px] max-w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/50 text-muted-foreground">
 <Camera className="h-8 w-8" aria-hidden="true" />
 <p className="text-sm">No photos yet</p>
 </div>
 );
 }

 const activeImage = images[activeIndex];

 const lightboxImages = images.map((img) => ({
 url: img.signedUrl,
 label: ANGLE_LABELS[img.angle_profile] || img.angle_profile,
 shareSlug: img.shortSlug || undefined,
 }));

 return (
 <div>
 {/* Hero Image — click to open lightbox */}
 <div
 className="relative aspect-[4/3] w-full bg-black/15"
 onClick={() => setLightboxIndex(activeIndex)}
 style={{ cursor:"zoom-in" }}
 >
 <Image
 src={activeImage.signedUrl}
 alt={ANGLE_LABELS[activeImage.angle_profile] || activeImage.angle_profile}
 key={activeImage.signedUrl}
 fill
 sizes="(min-width: 1024px) 60vw, 100vw"
 className="object-contain"
 priority
 />
 </div>

 {/* Thumbnail Strip */}
 {images.length > 1 && (
 <div className="grid-cols-[repeat(auto-fill,minmax(72px,1fr))] grid gap-1">
 {images.map((img, i) => (
 <div
 key={img.signedUrl}
 className={`passport-thumb ${i === activeIndex ?"active" :""}`}
 onClick={() => setActiveIndex(i)}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => {
 if (e.key ==="Enter" || e.key ==="") setActiveIndex(i);
 }}
 aria-label={`View ${ANGLE_LABELS[img.angle_profile] || img.angle_profile} photo`}
 title={ANGLE_LABELS[img.angle_profile] || img.angle_profile}
 >
 <div className="relative aspect-square w-full">
 <Image
 src={img.signedUrl}
 alt={ANGLE_LABELS[img.angle_profile] || img.angle_profile}
 fill
 sizes="72px"
 className="object-contain"
 />
 </div>
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
