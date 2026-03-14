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
        <div className="cookie-banner animate-fade-in-up" role="dialog" aria-label="Cookie consent">
            <div className="cookie-banner-inner">
                <div className="cookie-banner-text">
                    <p>
                        <strong>🍪 Cookies &amp; Privacy</strong>
                    </p>
                    <p>
                        We use essential cookies for authentication and Google Analytics to
                        understand how the site is used. No advertising or tracking cookies.
                        See our <Link href="/privacy">Privacy Policy</Link> for details.
                    </p>
                </div>
                <div className="cookie-banner-actions">
                    <button
                        className="btn btn-primary cookie-btn"
                        onClick={handleAccept}
                        id="cookie-accept"
                    >
                        Accept
                    </button>
                    <button
                        className="btn btn-ghost cookie-btn"
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
