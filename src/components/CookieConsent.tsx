"use client";

import { useState, useEffect } from"react";
import Link from"next/link";

const COOKIE_CONSENT_KEY ="mhh-cookie-consent";

/**
 * CookieConsent — GDPR/CCPA-compliant cookie notice.
 *
 * Shows once, remembers the user's choice in localStorage.
 * We only use essential cookies (auth session) and Google Analytics.
 * No advertising cookies, no third-party trackers.
 */
export default function CookieConsent() {
 const [visible, setVisible] = useState(false);

 useEffect(() => {
 // Don't show if user has already consented
 const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
 if (!consent) {
 // Small delay so it doesn't flash on initial load
 const timer = setTimeout(() => setVisible(true), 1500);
 return () => clearTimeout(timer);
 }
 }, []);

 const handleAccept = () => {
 localStorage.setItem(COOKIE_CONSENT_KEY,"accepted");
 setVisible(false);
 };

 const handleDecline = () => {
 localStorage.setItem(COOKIE_CONSENT_KEY,"declined");
 // Disable GA if declined
 if (typeof window !=="undefined") {
 // @ts-expect-error — gtag global
 window["ga-disable-G-7DWKBT1JV9"] = true;
 }
 setVisible(false);
 };

 if (!visible) return null;

 return (
 <div
 className="border-edge animate-fade-in-up fixed right-0 bottom-0 left-0 z-[9999] border-t bg-[rgba(10,10,18,0.92)] px-8 py-4 shadow-[0_-4px_30px_rgba(0,0,0,0.3)]"
 role="dialog"
 aria-label="Cookie consent"
 >
 <div className="mx-auto flex max-w-[var(--max-width)] items-center justify-between gap-8 max-md:flex-col max-md:gap-4 max-md:text-center">
 <div className="[&_p]:text-ink-light [&_p:first-child]:text-ink [&_a]:text-forest min-w-0 flex-1 [&_p]:m-0 [&_p]:text-sm [&_p]:leading-relaxed [&_p:first-child]:mb-1">
 <p>
 <strong>🍪 Cookies &amp; Privacy</strong>
 </p>
 <p>
 We use essential cookies for authentication and Google Analytics to understand how the site is
 used. No advertising or tracking cookies. See our <Link href="/privacy">Privacy Policy</Link>{""}
 for details.
 </p>
 </div>
 <div className="flex shrink-0 gap-2 max-md:w-full max-md:justify-center">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleAccept}
 id="cookie-accept"
 >
 Accept
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleDecline}
 id="cookie-decline"
 >
 Decline Analytics
 </button>
 </div>
 </div>
 </div>
 );
}
