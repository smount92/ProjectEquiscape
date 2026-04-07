"use client";

import { useState, useEffect, useCallback } from"react";
import { createPortal } from"react-dom";
import { getFriendlyPhotoUrl } from "@/lib/utils/storage";

interface PhotoLightboxProps {
 images: { url: string; label?: string; shareSlug?: string }[];
 initialIndex: number;
 onClose: () => void;
}

export default function PhotoLightbox({ images, initialIndex, onClose }: PhotoLightboxProps) {
 const [currentIndex, setCurrentIndex] = useState(initialIndex);

 const goNext = useCallback(() => {
 setCurrentIndex((prev) => (prev + 1) % images.length);
 }, [images.length]);

 const goPrev = useCallback(() => {
 setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
 }, [images.length]);

 // Keyboard navigation
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key ==="Escape") onClose();
 else if (e.key ==="ArrowRight") goNext();
 else if (e.key ==="ArrowLeft") goPrev();
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [onClose, goNext, goPrev]);

 // Prevent body scroll while open
 useEffect(() => {
 const originalOverflow = document.body.style.overflow;
 document.body.style.overflow ="hidden";
 return () => {
 document.body.style.overflow = originalOverflow;
 };
 }, []);

 const current = images[currentIndex];
 if (!current) return null;

 return createPortal(
 <div
 className="lightbox-overlay"
 onClick={onClose}
 role="dialog"
 aria-modal="true"
 aria-label={`Photo viewer — ${current.label || `Image ${currentIndex + 1}`}`}
 >
 {/* Close */}
 <button
 className="bg-white/10 fixed top-4 right-4 z-[1001] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-full border-0 text-[1.2rem] text-white transition-colors"
 onClick={onClose}
 aria-label="Close lightbox"
 >
 ✕
 </button>

 {/* Prev arrow */}
 {images.length > 1 && (
 <button
 className="hover:0.2)] fixed top-[50%] left-4 z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-[1.4rem] text-white transition-all"
 onClick={(e) => {
 e.stopPropagation();
 goPrev();
 }}
 aria-label="Previous photo"
 >
 ‹
 </button>
 )}

 {/* Image */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={current.url}
 alt={current.label || `Photo ${currentIndex + 1}`}
 className="lightbox-image"
 onClick={(e) => e.stopPropagation()}
 draggable={false}
 />

 {/* Next arrow */}
 {images.length > 1 && (
 <button
 className="hover:0.2)] fixed top-[50%] right-4 z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-[1.4rem] text-white transition-all"
 onClick={(e) => {
 e.stopPropagation();
 goNext();
 }}
 aria-label="Next photo"
 >
 ›
 </button>
 )}

 {/* Label */}
 {current.label && (
 <div className="bottom-10 fixed left-[50%] z-[1001] translate-x-[-50%] text-sm font-semibold text-white/85">
 {current.label}
 </div>
 )}

 {/* Counter */}
 {images.length > 1 && (
 <div className="fixed bottom-4 left-[50%] z-[1001] translate-x-[-50%] text-sm text-white/60">
 {currentIndex + 1} of {images.length}
 </div>
 )}

 {/* Share button */}
 {current.shareSlug && (
  <ShareLightboxButton slug={current.shareSlug} />
 )}
 </div>,
 document.body,
 );
}

/** Inline share button for the lightbox — handles clipboard + visual feedback */
function ShareLightboxButton({ slug }: { slug: string }) {
 const [copied, setCopied] = useState(false);
 const url = getFriendlyPhotoUrl(slug);

 return (
  <button
   className="fixed bottom-4 right-4 z-[1001] flex items-center gap-2
              rounded-full bg-white/20 px-4 py-2 text-sm text-white
              backdrop-blur transition-colors hover:bg-white/30 cursor-pointer"
   onClick={(e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
    });
   }}
   aria-label="Copy share link"
  >
   {copied ? "✅ Copied!" : "🔗 Share"}
  </button>
 );
}
