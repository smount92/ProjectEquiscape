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

/** Zoom factor a double-tap toggles to; pinch can go a bit past it. */
const DOUBLE_TAP_ZOOM = 2;
const MAX_ZOOM = 3;
const DOUBLE_TAP_MS = 300;

export default function PhotoLightbox({ images, initialIndex, onClose }: PhotoLightboxProps) {
 const [currentIndex, setCurrentIndex] = useState(initialIndex);
 const overlayRef = useRef<HTMLDivElement>(null);
 const closeButtonRef = useRef<HTMLButtonElement>(null);
 const imgRef = useRef<HTMLImageElement>(null);
 // Swipe tracking (pointer events, so touch and pen both work).
 const pointerStart = useRef<{ x: number; y: number } | null>(null);
 // A swipe must not ALSO count as the overlay tap that closes.
 const suppressClick = useRef(false);

 // ── Zoom & pan (double-tap toggles 2×; pinch zooms continuously) ──
 const [zoom, setZoom] = useState(1);
 const [pan, setPan] = useState({ x: 0, y: 0 });
 const lastTapAt = useRef(0);
 // All pointers currently down on the overlay — two of them = a pinch.
 const activePointers = useRef(new Map<number, { x: number; y: number }>());
 const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
 const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

 const resetZoom = useCallback(() => {
 setZoom(1);
 setPan({ x: 0, y: 0 });
 }, []);

 const goNext = useCallback(() => {
 setCurrentIndex((prev) => (prev + 1) % images.length);
 resetZoom();
 }, [images.length, resetZoom]);

 const goPrev = useCallback(() => {
 setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
 resetZoom();
 }, [images.length, resetZoom]);

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
 // A finished swipe/pan ends in a click on the overlay — eat it.
 if (suppressClick.current) {
 suppressClick.current = false;
 return;
 }
 onClose();
 }}
 onPointerDown={(e) => {
 activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
 const pointers = [...activePointers.current.values()];
 if (pointers.length === 2) {
 // Second finger down → this is a pinch, not a swipe/pan.
 pointerStart.current = null;
 panStart.current = null;
 pinchStart.current = {
 dist: Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y),
 zoom,
 };
 return;
 }
 if (zoom > 1) {
 // Zoomed: a single-finger drag pans the photo.
 panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
 return;
 }
 pointerStart.current = { x: e.clientX, y: e.clientY };
 }}
 onPointerMove={(e) => {
 if (activePointers.current.has(e.pointerId)) {
 activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
 }
 // Pinch: scale from the starting finger distance, clamped.
 if (pinchStart.current && activePointers.current.size >= 2) {
 const pointers = [...activePointers.current.values()];
 const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
 if (pinchStart.current.dist > 0) {
 const next = Math.min(
 MAX_ZOOM,
 Math.max(1, (pinchStart.current.zoom * dist) / pinchStart.current.dist),
 );
 setZoom(next);
 if (next === 1) setPan({ x: 0, y: 0 });
 }
 return;
 }
 // Pan while zoomed.
 if (panStart.current) {
 const dx = e.clientX - panStart.current.x;
 const dy = e.clientY - panStart.current.y;
 if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick.current = true;
 setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
 }
 }}
 onPointerUp={(e) => {
 activePointers.current.delete(e.pointerId);
 if (pinchStart.current) {
 if (activePointers.current.size < 2) {
 pinchStart.current = null;
 // Snap back to 1:1 from a near-1 pinch.
 setZoom((z) => {
 if (z < 1.15) {
 setPan({ x: 0, y: 0 });
 return 1;
 }
 return z;
 });
 // The tap that ends a pinch must not close the lightbox.
 suppressClick.current = true;
 }
 return;
 }
 if (panStart.current) {
 panStart.current = null;
 return;
 }
 const start = pointerStart.current;
 pointerStart.current = null;
 if (!start || images.length <= 1 || zoom > 1) return;
 const action = swipeAction(e.clientX - start.x, e.clientY - start.y);
 if (action) {
 suppressClick.current = true;
 if (action === "next") goNext();
 else goPrev();
 }
 }}
 onPointerCancel={(e) => {
 activePointers.current.delete(e.pointerId);
 if (activePointers.current.size < 2) pinchStart.current = null;
 pointerStart.current = null;
 panStart.current = null;
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
 ref={imgRef}
 src={current.url}
 alt={current.label || `Photo ${currentIndex + 1}`}
 className="lightbox-image"
 style={
 zoom > 1
 ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor:"grab" }
 : undefined
 }
 onClick={(e) => {
 e.stopPropagation();
 // stopPropagation means the overlay's click handler never runs
 // for taps on the photo — clear a swipe/pan flag HERE too, or a
 // swipe ending on the image strands it and silently eats the
 // next background tap (the close gesture).
 const wasSuppressed = suppressClick.current;
 suppressClick.current = false;
 if (wasSuppressed) return;
 // Double-tap toggles 2× zoom centered on the tapped point.
 const now = Date.now();
 if (now - lastTapAt.current < DOUBLE_TAP_MS) {
 lastTapAt.current = 0;
 if (zoom > 1) {
 resetZoom();
 } else {
 const rect = imgRef.current?.getBoundingClientRect();
 if (rect) {
 const cx = rect.left + rect.width / 2;
 const cy = rect.top + rect.height / 2;
 setZoom(DOUBLE_TAP_ZOOM);
 setPan({
 x: (cx - e.clientX) * DOUBLE_TAP_ZOOM,
 y: (cy - e.clientY) * DOUBLE_TAP_ZOOM,
 });
 }
 }
 } else {
 lastTapAt.current = now;
 }
 }}
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
