"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "mhh-cookie-consent";

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
        localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
        setVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
        // Disable GA if declined
        if (typeof window !== "undefined") {
            // @ts-expect-error — gtag global
            window["ga-disable-G-7DWKBT1JV9"] = true;
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] py-4 px-8 bg-[rgba(10,10,18,0.92)] border-t border-edge shadow-[0_-4px_30px_rgba(0,0,0,0.3)] animate-fade-in-up" role="dialog" aria-label="Cookie consent">
            <div className="max-w-[var(--max-width)] mx-auto flex items-center justify-between gap-8 max-md:flex-col max-md:text-center max-md:gap-4">
                <div className="flex-1 min-w-0 [&_p]:text-sm [&_p]:text-ink-light [&_p]:leading-relaxed [&_p]:m-0 [&_p:first-child]:text-ink [&_p:first-child]:mb-1 [&_a]:text-forest">
                    <p>
                        <strong>🍪 Cookies &amp; Privacy</strong>
                    </p>
                    <p>
                        We use essential cookies for authentication and Google Analytics to
                        understand how the site is used. No advertising or tracking cookies.
                        See our <Link href="/privacy">Privacy Policy</Link> for details.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0 max-md:w-full max-md:justify-center">
                    <button
                        className="btn btn-primary text-sm !py-2 !px-6 whitespace-nowrap"
                        onClick={handleAccept}
                        id="cookie-accept"
                    >
                        Accept
                    </button>
                    <button
                        className="btn btn-ghost text-sm !py-2 !px-6 whitespace-nowrap"
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
