/**
 * The notification preference UI's own taxonomy.
 *
 * Kept out of the page component so it can be tested against the real
 * engine: `notificationPrefKeys()` reads the delivery map in
 * src/lib/notifications/prefs.ts, and the test in __tests__ fails the
 * build if a key the engine honours has no toggle here. That is the
 * drift this file exists to prevent — the old settings page listed a
 * hand-typed dozen and quietly fell behind every time the show domain
 * added a type.
 *
 * Storage shape is untouched: these are the same `users.notification_prefs`
 * jsonb keys, written by updateNotificationPrefs exactly as before. This
 * module only decides how they are worded and grouped.
 */

import { NOTIFICATION_TYPE_PREF_KEYS } from "@/lib/notifications/prefs";

export interface NotificationPrefToggle {
    /** The jsonb key in users.notification_prefs. */
    key: string;
    icon: string;
    label: string;
    /** One line of plain English about what actually arrives. */
    hint: string;
}

export interface NotificationPrefGroup {
    id: string;
    icon: string;
    title: string;
    /** Shown under the group heading. */
    blurb: string;
    toggles: NotificationPrefToggle[];
    /**
     * Honest footnote for categories that deliver regardless of prefs —
     * see ALWAYS_ON below. Absent on groups where every type is muteable.
     */
    alwaysOn?: string;
}

/**
 * Every pref key the delivery engine actually honours, deduped.
 * Derived, never hand-listed — this is the set the UI must cover.
 */
export function notificationPrefKeys(): string[] {
    return [...new Set(Object.values(NOTIFICATION_TYPE_PREF_KEYS))].sort();
}

/** Which notification types a given pref key mutes. Used by the tests. */
export function typesForPrefKey(key: string): string[] {
    return Object.entries(NOTIFICATION_TYPE_PREF_KEYS)
        .filter(([, prefKey]) => prefKey === key)
        .map(([type]) => type)
        .sort();
}

/**
 * Delivery semantics, mirrored from prefs.ts: a key missing from the saved
 * jsonb is ON — only an explicit `false` mutes. The toggles must render the
 * same truth, or every pref added after a user last saved would show "off"
 * while still delivering.
 */
export function isNotifPrefOn(prefs: Record<string, boolean>, key: string): boolean {
    return prefs[key] !== false;
}

/**
 * Flip the EFFECTIVE value, so the first tap on a never-saved pref turns
 * it off rather than appearing to "re-enable" something already on.
 */
export function toggledPrefs(
    prefs: Record<string, boolean>,
    key: string,
): Record<string, boolean> {
    return { ...prefs, [key]: !isNotifPrefOn(prefs, key) };
}

/**
 * Types with no entry in NOTIFICATION_TYPE_PREF_KEYS are ungated: the
 * engine delivers them to everyone, always. Rather than draw a toggle
 * that would write a key nothing reads, the groups below say so out loud.
 */
export const NOTIFICATION_PREF_GROUPS: NotificationPrefGroup[] = [
    {
        id: "shows",
        icon: "🏆",
        title: "Shows",
        blurb: "Entries, judging, results and anything a host announces.",
        toggles: [
            {
                key: "show_updates",
                icon: "🔀",
                label: "Changes to your entries",
                hint: "A class was renamed or merged, an entry was scratched, a handler was assigned, or a host acted on one of your entries.",
            },
            {
                key: "show_deadlines",
                icon: "⏳",
                label: "Entry deadlines",
                hint: "The reminder before entries close on a show you are watching or entered.",
            },
            {
                key: "show_announcements",
                icon: "📣",
                label: "Host announcements",
                hint: "Notices posted by the people running a show you are in.",
            },
            {
                key: "show_votes",
                icon: "📸",
                label: "Photo-show voting",
                hint: "Voting opening on a show, and votes landing on your entries.",
            },
            {
                key: "show_results",
                icon: "🥇",
                label: "Results, cards and titles",
                hint: "Placings published, qualification cards minted, championship titles granted.",
            },
            {
                key: "show_staff",
                icon: "🧑‍⚖️",
                label: "Judging and staff invitations",
                hint: "Being asked to judge or steward, and your judging panel opening.",
            },
        ],
    },
    {
        id: "market",
        icon: "💰",
        title: "Market & deals",
        blurb: "Handovers, want-list matches and the models you are hunting.",
        toggles: [
            {
                key: "transfers",
                icon: "📦",
                label: "Transfers and handovers",
                hint: "A model is being transferred to you, or a transfer you started was claimed.",
            },
            {
                key: "demand_alerts",
                icon: "🎯",
                label: "Someone wants a model you own",
                hint: "A collector adds a model to their want list and you have one in your stable.",
            },
        ],
        alwaysOn:
            "Offers, deal-room replies and commission updates always reach you. Each one belongs to a transaction already in progress with a named person, so muting it would leave the other side waiting on a reply you never saw.",
    },
    {
        id: "social",
        icon: "💬",
        title: "Social",
        blurb: "What other collectors do with your horses and your posts.",
        toggles: [
            {
                key: "comments",
                icon: "💬",
                label: "Comments and replies",
                hint: "Comments on your horses and posts, and replies to yours in barn forums.",
            },
            {
                key: "favorites",
                icon: "❤️",
                label: "Favorites and likes",
                hint: "Someone favorites one of your horses or likes a post.",
            },
            {
                key: "new_followers",
                icon: "👥",
                label: "New followers",
                hint: "Someone starts following your stable.",
            },
            {
                key: "messages",
                icon: "✉️",
                label: "Direct messages",
                hint: "New messages in your inbox. The inbox badge is separate and always counts.",
            },
        ],
    },
    {
        id: "account",
        icon: "🔔",
        title: "Account",
        blurb: "Notices about you rather than about a horse.",
        toggles: [],
        alwaysOn:
            "Badges you earn, moderation outcomes, catalog suggestions you filed and system notices are always delivered. They are a record of something that happened to your account, so there is nothing here to switch off.",
    },
];

/** Flat list of every key with a toggle drawn for it. */
export function toggledKeys(): string[] {
    return NOTIFICATION_PREF_GROUPS.flatMap((g) => g.toggles.map((t) => t.key)).sort();
}
