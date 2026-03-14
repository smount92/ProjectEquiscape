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
            className={`back-to-top ${visible ? "back-to-top-visible" : ""}`}
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
