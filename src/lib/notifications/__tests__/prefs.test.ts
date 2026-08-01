import { describe, expect, it } from "vitest";

import {
    isNotificationTypeEnabled,
    NOTIFICATION_TYPE_PREF_KEYS,
} from "../prefs";

describe("NOTIFICATION_TYPE_PREF_KEYS", () => {
    it("maps every settings-page pref key from at least one type", () => {
        // The keys offered as defaults in settings.ts getProfile — each
        // must be reachable from some notification type or the toggle
        // would be decoration again (the audit's original finding).
        const settingsKeys = [
            "show_votes",
            "favorites",
            "comments",
            "new_followers",
            "messages",
            "show_results",
            "transfers",
            "demand_alerts",
            "show_staff",
            "show_updates",
            "show_announcements",
            "show_deadlines",
        ];
        const mapped = new Set(Object.values(NOTIFICATION_TYPE_PREF_KEYS));
        for (const key of settingsKeys) {
            expect(mapped, `no notification type maps to pref "${key}"`).toContain(key);
        }
    });

    it("maps the Batch 2 show types", () => {
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_result).toBe("show_results");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_card).toBe("show_results");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_staff).toBe("show_staff");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_class_change).toBe("show_updates");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_entry_scratched).toBe("show_updates");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_announcement).toBe("show_announcements");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_deadline).toBe("show_deadlines");
        expect(NOTIFICATION_TYPE_PREF_KEYS.show_voting_open).toBe("show_votes");
    });
});

describe("isNotificationTypeEnabled", () => {
    it("delivers when the mapped key is true", () => {
        expect(isNotificationTypeEnabled("show_result", { show_results: true })).toBe(true);
    });

    it("mutes only on an explicit false", () => {
        expect(isNotificationTypeEnabled("show_result", { show_results: false })).toBe(false);
        expect(isNotificationTypeEnabled("show_announcement", { show_announcements: false })).toBe(
            false,
        );
    });

    it("defaults ON when the key is missing from saved prefs", () => {
        // Users saved prefs before newer keys existed — absence must
        // never silence a category they were never asked about.
        expect(isNotificationTypeEnabled("show_deadline", { show_results: false })).toBe(true);
    });

    it("defaults ON with no prefs at all", () => {
        expect(isNotificationTypeEnabled("show_result", null)).toBe(true);
        expect(isNotificationTypeEnabled("show_result", undefined)).toBe(true);
    });

    it("defaults ON for unmapped types, whatever the prefs say", () => {
        expect(isNotificationTypeEnabled("achievement", { show_results: false })).toBe(true);
        expect(isNotificationTypeEnabled("brand_new_type", {})).toBe(true);
    });

    it("an unrelated false never mutes a different type", () => {
        expect(isNotificationTypeEnabled("show_result", { messages: false })).toBe(true);
    });
});
