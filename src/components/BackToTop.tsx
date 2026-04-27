"use client";

import { useState, useEffect } from"react";

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
 window.scrollTo({ top: 0, behavior:"smooth" });
 };

 return (
 <button
 className={`border-input text-secondary-foreground hover:bg-forest hover:border-emerald-700 fixed right-7 bottom-7 z-90 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-[var(--color-bg-card)] shadow-md transition-all hover:-translate-y-0.5 hover:text-white hover:shadow-[0_4px_20px_var(--color-accent-primary-glow)] ${visible ?"visible translate-y-0 opacity-100" :"invisible translate-y-3 opacity-0"}`}
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
