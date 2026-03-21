"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

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
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowRight") goNext();
            else if (e.key === "ArrowLeft") goPrev();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, goNext, goPrev]);

    // Prevent body scroll while open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = originalOverflow; };
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
            <button className="fixed top-[var(--space-lg)] right-[var(--space-lg)] bg-[rgba(255, 255, 255, 0.12)] border-0 text-white w-[40px] h-[40px] rounded-full cursor-pointer text-[1.2rem] flex items-center justify-center transition-colors z-[1001]" onClick={onClose} aria-label="Close lightbox">
                ✕
            </button>

            {/* Prev arrow */}
            {images.length > 1 && (
                <button
                    className="lightbox-nav left-[var(--space-lg)]"
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
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
                    className="lightbox-nav right-[var(--space-lg)]"
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    aria-label="Next photo"
                >
                    ›
                </button>
            )}

            {/* Label */}
            {current.label && (
                <div className="lightbox-label">{current.label}</div>
            )}

            {/* Counter */}
            {images.length > 1 && (
                <div className="lightbox-counter">
                    {currentIndex + 1} of {images.length}
                </div>
            )}
        </div>,
        document.body
    );
}
