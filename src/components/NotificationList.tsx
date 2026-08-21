"use client";

/**
 * The notifications page list.
 *
 * When this list was written, three systems emitted into it. Now shows,
 * the market, deal rooms, commissions, barns and moderation all do, and
 * forty undifferentiated rows of "🔔" is not a record anyone can read.
 * So the `type` column now earns its keep twice: as a kind badge on each
 * row, and as a filter rail across the top. Neither changes what is
 * stored — the grouping is computed at render time in notificationKinds.
 *
 * Deep links: every row resolves through resolveNotificationHref, which
 * prefers the emitter's own `link_url` and only falls back down a chain
 * when the row has none. Nothing dead-ends on /notifications.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/lib/context/NotificationProvider";
import {
    NOTIFICATION_KINDS,
    dayBucket,
    notificationIcon,
    notificationKind,
    notificationKindMeta,
    resolveNotificationHref,
    timeAgo,
    type NotificationKindId,
} from "@/components/notifications/notificationKinds";

export interface NotifItem {
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

interface NotificationListProps {
    initialNotifications: NotifItem[];
}

type Filter = "all" | NotificationKindId;

/** Kraft index tab, lit when it is the active filter. */
function FilterTab({
    active,
    label,
    count,
    unread,
    onClick,
}: {
    active: boolean;
    label: string;
    count: number;
    unread: number;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active ? "true" : "false"}
            className={
                active
                    ? "ledger-tab mb-0 cursor-pointer border-0"
                    : "border-input bg-card text-secondary-foreground hover:border-forest hover:text-forest mb-0 cursor-pointer rounded-[3px_10px_3px_3px] border px-4 py-[5px] font-serif text-[0.8125rem] tracking-[0.18em] uppercase transition-colors"
            }
        >
            {label}
            <span className="ml-2 font-sans text-[0.7rem] tracking-normal tabular-nums opacity-80">
                {count}
                {unread > 0 && <span className="text-destructive ml-1 font-bold">•{unread}</span>}
            </span>
        </button>
    );
}

export default function NotificationList({ initialNotifications }: NotificationListProps) {
    const [notifs, setNotifs] = useState(initialNotifications);
    const [filter, setFilter] = useState<Filter>("all");
    const [clearing, setClearing] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const { refreshNotificationCount } = useNotifications();

    // Kind is derived once per row and reused by the rail, the badges and
    // the filter — one pass, one source of truth.
    const decorated = useMemo(
        () => notifs.map((n) => ({ ...n, kind: notificationKind(n.type) })),
        [notifs],
    );

    const counts = useMemo(() => {
        const totals = new Map<NotificationKindId, { count: number; unread: number }>();
        for (const n of decorated) {
            const entry = totals.get(n.kind) ?? { count: 0, unread: 0 };
            entry.count += 1;
            if (!n.isRead) entry.unread += 1;
            totals.set(n.kind, entry);
        }
        return totals;
    }, [decorated]);

    const visible = useMemo(
        () => (filter === "all" ? decorated : decorated.filter((n) => n.kind === filter)),
        [decorated, filter],
    );

    // Day buckets, in the order the rows already arrive (newest first).
    const buckets = useMemo(() => {
        const out: { label: string; rows: typeof visible }[] = [];
        for (const n of visible) {
            const label = dayBucket(n.createdAt);
            const last = out[out.length - 1];
            if (last && last.label === label) last.rows.push(n);
            else out.push({ label, rows: [n] });
        }
        return out;
    }, [visible]);

    const unreadCount = decorated.filter((n) => !n.isRead).length;

    const handleMarkAllRead = async () => {
        setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
        await markAllNotificationsRead();
        await refreshNotificationCount();
    };

    const handleClear = async () => {
        setClearing(true);
        await clearNotifications();
        setNotifs([]);
        setConfirmClear(false);
        setClearing(false);
        await refreshNotificationCount();
    };

    const handleClick = async (id: string) => {
        setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        await markNotificationRead(id);
        await refreshNotificationCount();
    };

    // ── Genuinely empty ──
    if (notifs.length === 0) {
        return (
            <div className="ledger-card py-12 text-center">
                <div className="mb-4 text-[2.5rem]" aria-hidden="true">
                    🔔
                </div>
                <h2 className="mb-2 font-serif text-xl font-bold">Nothing has come in</h2>
                <p className="text-secondary-foreground mx-auto max-w-[460px] text-sm leading-relaxed">
                    Show results, offers on your horses, comments and transfers all land here. When
                    something happens, this is where you will hear about it.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Button asChild variant="outline" size="wide">
                        <Link href="/shows">Find a show to enter →</Link>
                    </Button>
                    <Button asChild variant="outline" size="wide">
                        <Link href="/settings#notifications">Notification settings →</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* ── Filter rail + actions ── */}
            <div className="flex flex-wrap items-center gap-2">
                <FilterTab
                    active={filter === "all"}
                    label="All"
                    count={decorated.length}
                    unread={unreadCount}
                    onClick={() => setFilter("all")}
                />
                {NOTIFICATION_KINDS.filter((k) => counts.has(k.id)).map((k) => {
                    const c = counts.get(k.id)!;
                    return (
                        <FilterTab
                            key={k.id}
                            active={filter === k.id}
                            label={`${k.icon} ${k.label}`}
                            count={c.count}
                            unread={c.unread}
                            onClick={() => setFilter(k.id)}
                        />
                    );
                })}

                <div className="ml-auto flex flex-wrap gap-2">
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                            ✓ Mark all read
                        </Button>
                    )}
                    {confirmClear ? (
                        <>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleClear}
                                disabled={clearing}
                            >
                                {clearing ? "Clearing…" : `Delete all ${notifs.length}`}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmClear(false)}
                                disabled={clearing}
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setConfirmClear(true)}
                        >
                            🗑️ Clear all
                        </Button>
                    )}
                </div>
            </div>

            {/* Clearing is a delete, not a dismiss — say so before it happens. */}
            {confirmClear && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 rounded-md border px-4 py-2 text-xs leading-relaxed">
                    This permanently deletes all {notifs.length} notifications, read and unread.
                    They cannot be brought back — the underlying shows, offers and messages are
                    unaffected.
                </p>
            )}

            {/* ── The ledger ── */}
            <section className="ledger-card">
                <span className="ledger-tab">
                    {filter === "all" ? "Activity" : notificationKindMeta(filter).heading}
                </span>

                {visible.length === 0 ? (
                    <p className="text-secondary-foreground py-8 text-center text-sm">
                        Nothing under{" "}
                        <strong>{notificationKindMeta(filter as NotificationKindId).heading}</strong>
                        .{" "}
                        <button
                            type="button"
                            className="text-forest cursor-pointer font-semibold underline"
                            onClick={() => setFilter("all")}
                        >
                            Show everything
                        </button>
                    </p>
                ) : (
                    buckets.map((bucket) => (
                        <div key={bucket.label}>
                            <h2 className="text-muted-foreground border-input mt-5 mb-1 border-b pb-1 font-serif text-[0.7rem] tracking-[0.18em] uppercase first:mt-0">
                                {bucket.label}
                            </h2>
                            {bucket.rows.map((n) => {
                                const kind = notificationKindMeta(n.kind);
                                return (
                                    <Link
                                        key={n.id}
                                        href={resolveNotificationHref(n)}
                                        onClick={() => handleClick(n.id)}
                                        className={`border-input flex items-start gap-3 border-b py-3 pr-2 text-inherit no-underline transition-colors last:border-b-0 hover:bg-black/[0.04] ${
                                            n.isRead
                                                ? "pl-2"
                                                : "border-l-forest bg-forest/[0.06] border-l-[3px] pl-2"
                                        }`}
                                    >
                                        <span className="mt-0.5 shrink-0 text-xl" aria-hidden="true">
                                            {notificationIcon(n.type)}
                                        </span>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span
                                                className={`text-sm leading-snug ${n.isRead ? "" : "font-semibold"}`}
                                            >
                                                {n.content || "Something happened — open to see."}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-2">
                                                {/* .stamp keeps its own a11y size floor — do
                                                    not shrink it to fit more per row. */}
                                                <span className="stamp">{kind.label}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {timeAgo(n.createdAt)}
                                                </span>
                                            </span>
                                        </div>
                                        {!n.isRead && (
                                            <span
                                                className="bg-forest mt-2 h-2 w-2 shrink-0 rounded-full"
                                                aria-label="Unread"
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))
                )}
            </section>

            <p className="text-muted-foreground text-xs">
                Showing the {notifs.length} most recent.{" "}
                <Link
                    href="/settings#notifications"
                    className="text-forest font-semibold no-underline hover:underline"
                >
                    Choose what lands here →
                </Link>
            </p>
        </div>
    );
}
