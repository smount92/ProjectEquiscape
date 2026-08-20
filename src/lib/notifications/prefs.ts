/**
 * Notification preferences — the type→pref-key map and the gate.
 * Pure, no I/O: createNotification (and its bulk variant) load the
 * recipient's `users.notification_prefs` jsonb and ask this module
 * whether the type is enabled.
 *
 * Semantics: a type maps to at most one pref key. A type with no
 * mapping, a recipient with no prefs row, or a pref key missing
 * from the jsonb all default ON — only an explicit `false` mutes.
 * (Users saved their prefs before newer keys existed; absence must
 * never silence a category they were never asked about.)
 */

export type NotificationPrefs = Record<string, boolean> | null | undefined;

/**
 * type → settings key (`users.notification_prefs`). Keys mirror the
 * defaults in src/app/actions/settings.ts getProfile.
 */
export const NOTIFICATION_TYPE_PREF_KEYS: Record<string, string> = {
    // ── Social ──
    follow: "new_followers",
    favorite: "favorites",
    like: "favorites",
    comment: "comments",
    reply: "comments",
    // ── Messaging ──
    message: "messages",
    // ── Trading ──
    transfer: "transfers",
    transfer_claimed: "transfers",
    demand_alert: "demand_alerts",
    // ── Shows (legacy + v2) ──
    show_vote: "show_votes",
    show_voting_open: "show_votes",
    show_result: "show_results",
    show_card: "show_results",
    show_staff: "show_staff",
    show_judging_open: "show_staff",
    show_class_change: "show_updates",
    show_entry_scratched: "show_updates",
    show_announcement: "show_announcements",
    show_deadline: "show_deadlines",
    // ── Shows (v4 + championship program) ──
    show_moderation: "show_updates",
    show_handler: "show_updates",
    show_title: "show_results",
};

/**
 * Should a notification of `type` reach a user with `prefs`?
 * Unknown types and missing keys default ON; only an explicit
 * `false` on the mapped key mutes the type.
 */
export function isNotificationTypeEnabled(
    type: string,
    prefs: NotificationPrefs,
): boolean {
    const key = NOTIFICATION_TYPE_PREF_KEYS[type];
    if (!key) return true;
    if (!prefs || typeof prefs !== "object") return true;
    return prefs[key] !== false;
}
