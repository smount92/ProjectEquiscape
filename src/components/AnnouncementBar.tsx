"use client";

/**
 * The rolling announcement strap — sits directly under the header,
 * site-wide. Owner-authored notices (phase 1); dismissible per
 * announcement id (localStorage), so it informs without nagging.
 * Multiple live announcements rotate by stacking (newest first) —
 * each dismisses independently.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Announcement } from "@/lib/announcements";

const DISMISS_KEY = "mhh-dismissed-announcements";

function loadDismissed(): Set<string> {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set();
    }
}

export default function AnnouncementBar({ announcements }: { announcements: Announcement[] }) {
    // Render nothing on the server AND the first client paint —
    // dismissal state lives in localStorage, and rendering before
    // reading it would flash dismissed banners back at the user
    // (the CookieConsent hydration pattern: appear only once the
    // effect confirms there is something undismissed to show).
    const [visible, setVisible] = useState<Announcement[]>([]);
    useEffect(() => {
        const dismissed = loadDismissed();
        const undismissed = announcements.filter((a) => !dismissed.has(a.id));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-gate:
        // dismissal lives in localStorage, unreadable during SSR/first paint;
        // one post-mount set is the hydration-safe reveal (CookieConsent's shape).
        if (undismissed.length > 0) setVisible(undismissed);
    }, [announcements]);

    if (visible.length === 0) return null;

    const dismiss = (id: string) => {
        setVisible((prev) => prev.filter((a) => a.id !== id));
        try {
            const next = new Set([...loadDismissed(), id]);
            localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
        } catch {
            // Private browsing — dismissal just won't persist.
        }
    };

    return (
        <div aria-label="Site announcements">
            {visible.map((a) => (
                <div
                    key={a.id}
                    className="flex items-center gap-3 border-b border-black/20 bg-forest px-4 py-2 text-sm text-primary-foreground"
                    role="status"
                >
                    <span aria-hidden="true">📣</span>
                    <p className="m-0 min-w-0 flex-1">
                        {a.message}
                        {a.linkUrl && (
                            <>
                                {" "}
                                <Link
                                    href={a.linkUrl}
                                    className="font-semibold text-primary-foreground underline underline-offset-2"
                                >
                                    More →
                                </Link>
                            </>
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={() => dismiss(a.id)}
                        aria-label="Dismiss announcement"
                        className="shrink-0 cursor-pointer rounded p-1 text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
