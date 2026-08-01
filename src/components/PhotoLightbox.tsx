"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getFriendlyPhotoUrl } from "@/lib/utils/storage";

interface PhotoLightboxProps {
 images: { url: string; label?: string; shareSlug?: string }[];
 initialIndex: number;
 onClose: () => void;
}

/** Swipe threshold in px — under this a touch is a tap, not a swipe. */
export const SWIPE_THRESHOLD_PX = 40;

/**
 * Pure swipe decision (unit-tested): a horizontal move of at least
 * `threshold` px that outruns its vertical drift flips the reel —
 * left ("next") or right ("prev"). Anything else is null (a tap or a
 * vertical gesture).
 */
export function swipeAction(
 dx: number,
 dy: number,
 threshold: number = SWIPE_THRESHOLD_PX,
): "prev" | "next" | null {
 if (Math.abs(dx) < threshold) return null;
 if (Math.abs(dx) <= Math.abs(dy)) return null;
 return dx < 0 ? "next" : "prev";
}

export default function PhotoLightbox({ images, initialIndex, onClose }: PhotoLightboxProps) {
 const [currentIndex, setCurrentIndex] = useState(initialIndex);
 const overlayRef = useRef<HTMLDivElement>(null);
 const closeButtonRef = useRef<HTMLButtonElement>(null);
 // Swipe tracking (pointer events, so touch and pen both work).
 const pointerStart = useRef<{ x: number; y: number } | null>(null);
 // A swipe must not ALSO count as the overlay tap that closes.
 const suppressClick = useRef(false);

 const goNext = useCallback(() => {
 setCurrentIndex((prev) => (prev + 1) % images.length);
 }, [images.length]);

 const goPrev = useCallback(() => {
 setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
 }, [images.length]);

 // Keyboard navigation + focus trap (Tab loops inside the dialog,
 // matching the dialog primitive's behavior).
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === "Escape") onClose();
 else if (e.key === "ArrowRight") goNext();
 else if (e.key === "ArrowLeft") goPrev();
 else if (e.key === "Tab") {
 const root = overlayRef.current;
 if (!root) return;
 const focusables = Array.from(
 root.querySelectorAll<HTMLElement>("button, [href]"),
 );
 if (focusables.length === 0) return;
 const first = focusables[0];
 const last = focusables[focusables.length - 1];
 const active = document.activeElement;
 if (e.shiftKey) {
 if (active === first || !root.contains(active)) {
 e.preventDefault();
 last.focus();
 }
 } else if (active === last || !root.contains(active)) {
 e.preventDefault();
 first.focus();
 }
 }
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [onClose, goNext, goPrev]);

 // Initial focus lands on the close button; the opener gets focus
 // back when the lightbox unmounts (dialog-primitive behavior).
 useEffect(() => {
 const previouslyFocused =
 document.activeElement instanceof HTMLElement ? document.activeElement : null;
 closeButtonRef.current?.focus();
 return () => previouslyFocused?.focus();
 }, []);

 // Prevent body scroll while open
 useEffect(() => {
 const originalOverflow = document.body.style.overflow;
 document.body.style.overflow = "hidden";
 return () => {
 document.body.style.overflow = originalOverflow;
 };
 }, []);

 const current = images[currentIndex];
 if (!current) return null;

 return createPortal(
 <div
 ref={overlayRef}
 className="lightbox-overlay touch-none"
 onClick={() => {
 // A finished swipe ends in a click on the overlay — eat it.
 if (suppressClick.current) {
 suppressClick.current = false;
 return;
 }
 onClose();
 }}
 onPointerDown={(e) => {
 pointerStart.current = { x: e.clientX, y: e.clientY };
 }}
 onPointerUp={(e) => {
 const start = pointerStart.current;
 pointerStart.current = null;
 if (!start || images.length <= 1) return;
 const action = swipeAction(e.clientX - start.x, e.clientY - start.y);
 if (action) {
 suppressClick.current = true;
 if (action === "next") goNext();
 else goPrev();
 }
 }}
 onPointerCancel={() => {
 pointerStart.current = null;
 }}
 role="dialog"
 aria-modal="true"
 aria-label={`Photo viewer — ${current.label || `Image ${currentIndex + 1}`}`}
 >
 {/* Close */}
 <button
 ref={closeButtonRef}
 className="fixed top-4 right-4 z-[1001] flex h-[40px] w-[40px] cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-[1.2rem] text-white transition-colors hover:bg-white/20"
 onClick={onClose}
 aria-label="Close lightbox"
 >
 ✕
 </button>

 {/* Prev arrow */}
 {images.length > 1 && (
 <button
 className="fixed top-[50%] left-4 z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-[1.4rem] text-white transition-all hover:bg-white/20"
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
 className="fixed top-[50%] right-4 z-[1001] flex h-[48px] w-[48px] translate-y-[-50%] cursor-pointer items-center justify-center rounded-full border-0 bg-white/10 text-[1.4rem] text-white transition-all hover:bg-white/20"
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
