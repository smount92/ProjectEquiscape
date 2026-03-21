"use client";

import { useState, useEffect, useCallback } from"react";
import { createPortal } from"react-dom";

interface PhotoLightboxProps {
 images: { url: string; label?: string }[];
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
 className="bg-[rgba(255,255,255,0.12)] fixed top-[var(--space-lg)] right-[var(--space-lg)] z-[1001] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-full border-0 text-[1.2rem] text-white transition-colors"
 onClick={onClose}
 aria-label="Close lightbox"
 >
 ✕
 </button>

 {/* Prev arrow */}
 {images.length > 1 && (
 <button
 className="hover:0.2)] fixed top-[50%] left-[var(--space-lg)] z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(255,255,255,0.1)] text-[1.4rem] text-white transition-all"
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
 className="hover:0.2)] fixed top-[50%] right-[var(--space-lg)] z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-[rgba(255,255,255,0.1)] text-[1.4rem] text-white transition-all"
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
 <div className="bottom-[calc(var(--space-lg) + 24px)] fixed left-[50%] z-[1001] translate-x-[-50%] text-sm font-semibold text-[rgba(255,255,255,0.85)]">
 {current.label}
 </div>
 )}

 {/* Counter */}
 {images.length > 1 && (
 <div className="fixed bottom-[var(--space-lg)] left-[50%] z-[1001] translate-x-[-50%] text-sm text-[rgba(255,255,255,0.6)]">
 {currentIndex + 1} of {images.length}
 </div>
 )}
 </div>,
 document.body,
 );
}
