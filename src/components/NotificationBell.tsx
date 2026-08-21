"use client";

/**
 * The header bell.
 *
 * It used to be a bare link with a count on it: to find out what the "3"
 * meant you had to leave the page you were on. It is now a peek — the
 * most recent rows, badged by kind, each deep-linking straight to the
 * thing that happened, with mark-all-read in reach.
 *
 * Two constraints shape the implementation:
 *
 *  1. Header.tsx renders <NotificationBell /> twice — once in the desktop
 *     icon cluster and once inside the mobile menu column — and this
 *     component takes no props in either place. So the panel is rendered
 *     through a portal and positioned from the trigger's own rect, which
 *     means it cannot be clipped by whichever container it happens to sit
 *     in and needs no change to Header.tsx at all.
 *
 *  2. Rows are fetched only when the panel opens (getNotifications is the
 *     existing server action, consumed unchanged). A bell that prefetched
 *     on every page load would put a query behind every navigation for a
 *     panel most people never open.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getNotifications, markAllNotificationsRead } from "@/app/actions/notifications";
import { useNotifications } from "@/lib/context/NotificationProvider";
import {
    notificationIcon,
    notificationKind,
    notificationKindMeta,
    resolveNotificationHref,
    timeAgo,
} from "@/components/notifications/notificationKinds";

interface PeekItem {
    id: string;
    type: string;
    content: string | null;
    actorAlias: string | null;
    horseId: string | null;
    conversationId: string | null;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: string;
}

const PEEK_LIMIT = 8;

export default function NotificationBell() {
    const { unreadNotifications, refreshNotificationCount } = useNotifications();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<PeekItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [rect, setRect] = useState<{ top: number; right: number } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const place = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await getNotifications(PEEK_LIMIT);
            setItems(rows);
        } catch {
            // A failed peek must never take the header down with it.
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        place();
        setOpen(true);
        load();
    };

    // Close on outside click, close on Escape, and keep the panel pinned to
    // the trigger while the page moves under it.
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [open, place]);

    const handleMarkAllRead = async () => {
        setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev);
        await markAllNotificationsRead();
        await refreshNotificationCount();
    };

    const badge = unreadNotifications > 9 ? "9+" : String(unreadNotifications);

    const panel =
        open && rect ? (
            <div
                ref={panelRef}
                role="dialog"
                aria-label="Notifications"
                className="border-input bg-card fixed z-[100] w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-xl border shadow-lg"
                style={{ top: rect.top, right: rect.right }}
            >
                {/* Leather header band — the same material as a page masthead,
                    at dropdown scale. */}
                <div className="leather-band flex items-center justify-between gap-3 px-4 py-2.5">
                    <span
                        className="text-engraved-light font-serif text-[0.75rem] font-bold tracking-[0.16em] uppercase"
                    >
                        Notifications
                    </span>
                    {unreadNotifications > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="relative z-[1] cursor-pointer font-serif text-[0.68rem] tracking-[0.14em] uppercase underline-offset-2 hover:underline"
                            style={{ color: "var(--leather-text-muted)" }}
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
                    {loading && items === null ? (
                        <p className="text-secondary-foreground px-4 py-8 text-center text-sm">
                            Looking…
                        </p>
                    ) : !items || items.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <div className="mb-2 text-2xl" aria-hidden="true">
                                🔔
                            </div>
                            <p className="text-secondary-foreground text-sm">
                                Nothing has come in yet.
                            </p>
                        </div>
                    ) : (
                        items.map((n) => {
                            const kind = notificationKindMeta(notificationKind(n.type));
                            return (
                                <Link
                                    key={n.id}
                                    href={resolveNotificationHref(n)}
                                    onClick={() => setOpen(false)}
                                    className={`border-input flex items-start gap-2.5 border-b px-3 py-2.5 text-inherit no-underline transition-colors last:border-b-0 hover:bg-black/[0.04] ${
                                        n.isRead ? "" : "border-l-forest bg-forest/[0.06] border-l-[3px]"
                                    }`}
                                >
                                    <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">
                                        {notificationIcon(n.type)}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span
                                            className={`line-clamp-2 text-[0.8rem] leading-snug ${n.isRead ? "" : "font-semibold"}`}
                                        >
                                            {n.content || "Something happened — open to see."}
                                        </span>
                                        <span className="text-muted-foreground font-serif text-[0.68rem] tracking-[0.1em] uppercase">
                                            {kind.label} · {timeAgo(n.createdAt)}
                                        </span>
                                    </span>
                                </Link>
                            );
                        })
                    )}
                </div>

                <Link
                    href="/notifications"
                    onClick={() => setOpen(false)}
                    className="border-input text-forest block border-t px-4 py-2.5 text-center text-xs font-semibold no-underline hover:underline"
                >
                    See all notifications →
                </Link>
            </div>
        ) : null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open ? "true" : "false"}
                aria-label={
                    unreadNotifications > 0
                        ? `Notifications, ${unreadNotifications} unread`
                        : "Notifications"
                }
                title="Notifications"
                id="nav-notifications"
                className="leather-icon-btn bg-card border-input text-muted-foreground relative flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all"
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] animate-[notification-pop_0.3s_ease-out] rounded-lg bg-[#ef4444] px-1 text-center text-[10px] leading-4 font-bold text-white">
                        {badge}
                    </span>
                )}
            </button>
            {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
        </>
    );
}
