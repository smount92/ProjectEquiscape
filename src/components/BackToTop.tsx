"use client";

import { useState, useEffect } from "react";

/**
 * BackToTop — A floating button that appears after scrolling down,
 * smoothly scrolls the user back to the top of the page.
 */
export default function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 400);
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <button
            className={`fixed bottom-7 right-7 w-11 h-11 rounded-full border border-edge bg-[var(--color-bg-card)] text-ink-light flex items-center justify-center cursor-pointer transition-all z-90 shadow-md hover:bg-forest hover:text-white hover:border-forest hover:shadow-[0_4px_20px_var(--color-accent-primary-glow)] hover:-translate-y-0.5 ${visible ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-3"}`}
            onClick={scrollToTop}
            aria-label="Scroll to top"
            title="Back to top"
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <polyline points="18 15 12 9 6 15" />
            </svg>
        </button>
    );
}
