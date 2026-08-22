/**
 * Notification KINDS — the reader-facing shape of the `type` column.
 *
 * The emission engine (src/lib/notifications/**) is deliberately flat: it
 * writes an open-ended `type` string and asks prefs.ts whether the type is
 * muted. That was fine when three systems emitted. It is not fine now that
 * shows, the market, deal rooms, commissions, barns and moderation all
 * write into one stream — a reader scrolling forty rows of undifferentiated
 * "🔔 New notification" cannot tell a scratched entry from a purchase offer.
 *
 * This module is the DISPLAY layer's answer, and only that: it maps a type
 * onto a kind (the badge and the filter), an icon, and a destination. It
 * writes nothing, changes no stored shape, and must never be imported by
 * the emission engine — a display grouping that fed back into delivery
 * would silently become a second, undocumented pref system.
 *
 * Unknown types are handled honestly rather than hidden: `show_`-prefixed
 * types file themselves under Shows automatically (the show domain adds
 * types faster than anything else), and everything else falls to Account,
 * which is the "something happened on your account" catch-all. A type this
 * module has never heard of still renders, still links, still reads.
 */

export type NotificationKindId = "shows" | "market" | "social" | "community" | "account";

export interface NotificationKind {
    id: NotificationKindId;
    /** Filter-chip and badge label. */
    label: string;
    /** Longer label for the bell dropdown's section headings. */
    heading: string;
    icon: string;
}

/** Display order — Shows first because it is the loudest emitter. */
export const NOTIFICATION_KINDS: NotificationKind[] = [
    { id: "shows", label: "Shows", heading: "Shows", icon: "🏆" },
    { id: "market", label: "Market", heading: "Market & deals", icon: "💰" },
    { id: "social", label: "Social", heading: "Social", icon: "💬" },
    { id: "community", label: "Barns", heading: "Barns & community", icon: "🏘️" },
    { id: "account", label: "Account", heading: "Account", icon: "🔔" },
];

const KIND_BY_ID: Record<NotificationKindId, NotificationKind> = Object.fromEntries(
    NOTIFICATION_KINDS.map((k) => [k.id, k]),
) as Record<NotificationKindId, NotificationKind>;

export function notificationKindMeta(id: NotificationKindId): NotificationKind {
    return KIND_BY_ID[id];
}

/**
 * type → kind. Every type emitted anywhere in the codebase as of the
 * settings/notifications rebuild is listed; the fallbacks below cover
 * anything added after.
 */
const TYPE_KIND: Record<string, NotificationKindId> = {
    // ── Shows (legacy, v2, v4, championship program) ──
    // Every `show_*` type also resolves via the prefix fallback; they are
    // spelled out here so the map doubles as an inventory.
    show_vote: "shows",
    show_voting_open: "shows",
    show_result: "shows",
    show_card: "shows",
    show_title: "shows",
    show_staff: "shows",
    show_judging_open: "shows",
    show_handler: "shows",
    show_class_change: "shows",
    show_entry_scratched: "shows",
    show_announcement: "shows",
    show_deadline: "shows",
    show_entries_closed: "shows",
    show_judging_started: "shows",
    show_results_posted: "shows",
    show_moderation: "shows",
    judge_assigned: "shows",
    photo_show: "shows",

    // ── Market, deals, transfers, commissions ──
    offer: "market",
    commission: "market",
    transfer: "market",
    transfer_claimed: "market",
    marketplace_sale: "market",
    parked_sale: "market",
    demand_alert: "market",
    wishlist_match: "market",
    escrow: "market",
    payment_plan: "market",
    promote_listing: "market",
    boost_iso: "market",

    // ── Social ──
    follow: "social",
    favorite: "social",
    like: "social",
    comment: "social",
    reply: "social",
    rating: "social",
    message: "social",
    mention: "social",
    feature: "social",

    // ── Barns, groups, events, the paddock ──
    group: "community",
    group_invite: "community",
    group_post: "community",
    event: "community",
    event_reminder: "community",
    post: "community",

    // ── Account, moderation, housekeeping ──
    achievement: "account",
    system: "account",
    help_id: "account",
    supporter: "account",
    moderation: "account",
    removal: "account",
    status_change: "account",
    insurance_report: "account",
};

/**
 * Which kind a notification belongs to. Never throws, never returns
 * undefined — an unrecognised type is still a real row someone must read.
 */
export function notificationKind(type: string): NotificationKindId {
    const known = TYPE_KIND[type];
    if (known) return known;
    // The show domain grows fastest; let its future types file themselves.
    if (type.startsWith("show_")) return "shows";
    return "account";
}

/** Per-type emoji. Falls back to the kind's icon, then the bell. */
const TYPE_ICON: Record<string, string> = {
    // Shows
    show_vote: "📸",
    show_voting_open: "🗳️",
    show_result: "🏆",
    show_card: "🎖️",
    show_title: "👑",
    show_staff: "🧑‍⚖️",
    show_judging_open: "⚖️",
    show_handler: "🤝",
    show_class_change: "🔀",
    show_entry_scratched: "✂️",
    show_announcement: "📣",
    show_deadline: "⏳",
    show_entries_closed: "🔒",
    show_judging_started: "⚖️",
    show_results_posted: "🏆",
    show_moderation: "🛡️",
    judge_assigned: "🏅",
    // Market
    offer: "🤝",
    commission: "🎨",
    transfer: "📦",
    transfer_claimed: "📦",
    marketplace_sale: "💰",
    parked_sale: "🅿️",
    demand_alert: "🎯",
    wishlist_match: "🔖",
    escrow: "🔐",
    payment_plan: "💳",
    // Social
    follow: "👤",
    favorite: "❤️",
    like: "❤️",
    comment: "💬",
    reply: "↩️",
    rating: "⭐",
    message: "✉️",
    mention: "📌",
    feature: "🌟",
    // Community
    group: "🏘️",
    group_invite: "🏘️",
    event: "📅",
    post: "📝",
    // Account
    achievement: "🏆",
    system: "📋",
    help_id: "🔍",
    supporter: "💛",
};

export function notificationIcon(type: string): string {
    return TYPE_ICON[type] ?? notificationKindMeta(notificationKind(type)).icon;
}

/** The subset of a notification row the display layer needs. */
export interface NotificationLinkFields {
    type: string;
    actorAlias: string | null;
    horseId: string | null;
    conversationId: string | null;
    linkUrl: string | null;
}

/**
 * Is this `link_url` safe to hand to <Link>?
 *
 * Only same-origin absolute paths. `link_url` is written by a dozen
 * server call sites and is never shown to the user before they click,
 * so a protocol-relative "//evil.example" or a "javascript:" value
 * would be an open redirect wearing a bell icon. Rejecting anything
 * that is not a single-slash-prefixed path costs nothing (every real
 * emitter writes "/shows/…", "/inbox/…", "/stable/…") and closes it.
 */
export function isSafeNotificationLink(linkUrl: string | null | undefined): boolean {
    if (!linkUrl) return false;
    if (!linkUrl.startsWith("/")) return false;
    if (linkUrl.startsWith("//")) return false;
    return true;
}

/**
 * Where a notification row goes when clicked.
 *
 * The deep link the emitter wrote wins — that is the whole point of
 * `link_url`, and v2+ show notifications, deal rooms and commissions all
 * set it. The chain below only catches rows that predate `link_url` or
 * were written without one, so that nothing ever dead-ends by linking
 * /notifications back to itself.
 */
export function resolveNotificationHref(n: NotificationLinkFields): string {
    // 1. The emitter's own deep link, when it is a safe in-app path.
    if (isSafeNotificationLink(n.linkUrl)) return n.linkUrl as string;
    // 2. A horse — its passport is the canonical page for it.
    if (n.horseId) return `/community/${n.horseId}`;
    // 3. A conversation — the thread.
    if (n.conversationId) return `/inbox/${n.conversationId}`;
    // 4. A follow is about a person, not a thing.
    if (n.type === "follow" && n.actorAlias) {
        return `/profile/${encodeURIComponent(n.actorAlias)}`;
    }
    // 5. Show rows without a link at least reach the show listing.
    if (notificationKind(n.type) === "shows") return "/shows";
    // 6. Someone did this — go and see who.
    if (n.actorAlias) return `/profile/${encodeURIComponent(n.actorAlias)}`;
    // 7. Nothing to open. Stay put rather than pretend.
    return "/notifications";
}

/** Compact relative time for a list row. */
export function timeAgo(dateStr: string, now: number = Date.now()): string {
    const parsed = new Date(dateStr).getTime();
    if (Number.isNaN(parsed)) return "";
    const seconds = Math.floor((now - parsed) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Day bucket heading for the list ("Today" / "Yesterday" / a date). */
export function dayBucket(dateStr: string, now: number = Date.now()): string {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return "Undated";
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(new Date(now)) - startOfDay(parsed)) / 86_400_000);
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "This week";
    return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
