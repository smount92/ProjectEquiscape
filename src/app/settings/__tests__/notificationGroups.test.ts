/**
 * The drift guard.
 *
 * The old settings page listed a hand-typed dozen notification labels
 * while src/lib/notifications/prefs.ts kept growing. This test makes that
 * failure mode impossible: if a pref key the ENGINE honours has no toggle
 * in the settings UI, the suite fails and names the key.
 */

import { describe, it, expect } from "vitest";

import { NOTIFICATION_TYPE_PREF_KEYS } from "@/lib/notifications/prefs";
import {
    NOTIFICATION_PREF_GROUPS,
    isNotifPrefOn,
    notificationPrefKeys,
    toggledKeys,
    toggledPrefs,
    typesForPrefKey,
} from "@/app/settings/notificationGroups";

describe("settings notification groups — coverage of the real taxonomy", () => {
    it("draws a toggle for every pref key the delivery engine honours", () => {
        const engineKeys = notificationPrefKeys();
        const uiKeys = new Set(toggledKeys());
        const missing = engineKeys.filter((k) => !uiKeys.has(k));
        expect(missing, `pref keys with no toggle in /settings: ${missing.join(", ")}`).toEqual([]);
    });

    it("never draws a toggle for a key the engine ignores", () => {
        // A switch that writes a key nothing reads is a lie in the UI.
        const engineKeys = new Set(notificationPrefKeys());
        const orphans = toggledKeys().filter((k) => !engineKeys.has(k));
        expect(orphans, `toggles that mute nothing: ${orphans.join(", ")}`).toEqual([]);
    });

    it("lists each key exactly once across all groups", () => {
        const keys = toggledKeys();
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("gives every toggle a human label and a hint", () => {
        for (const group of NOTIFICATION_PREF_GROUPS) {
            for (const t of group.toggles) {
                expect(t.label.length, `${t.key} label`).toBeGreaterThan(3);
                expect(t.hint.length, `${t.key} hint`).toBeGreaterThan(10);
                // The raw jsonb key must never leak into the UI wording.
                expect(t.label).not.toContain("_");
            }
        }
    });

    it("keeps a group for each of Shows / Market / Social / Account", () => {
        expect(NOTIFICATION_PREF_GROUPS.map((g) => g.id)).toEqual([
            "shows",
            "market",
            "social",
            "account",
        ]);
    });

    it("explains itself wherever a group has ungated types", () => {
        // Account and Market both carry types with no pref key (achievement,
        // system, offer, commission). Those groups must say so rather than
        // look empty or complete.
        const account = NOTIFICATION_PREF_GROUPS.find((g) => g.id === "account")!;
        expect(account.toggles).toHaveLength(0);
        expect(account.alwaysOn).toBeTruthy();

        const market = NOTIFICATION_PREF_GROUPS.find((g) => g.id === "market")!;
        expect(market.alwaysOn).toMatch(/offer/i);

        // Guard the premise: if `offer` ever gains a pref key, the note above
        // becomes false and this test should force it to be rewritten.
        expect(NOTIFICATION_TYPE_PREF_KEYS["offer"]).toBeUndefined();
        expect(NOTIFICATION_TYPE_PREF_KEYS["commission"]).toBeUndefined();
        expect(NOTIFICATION_TYPE_PREF_KEYS["achievement"]).toBeUndefined();
    });
});

describe("typesForPrefKey", () => {
    it("reports the types a key mutes", () => {
        expect(typesForPrefKey("comments")).toEqual(["comment", "reply"]);
        expect(typesForPrefKey("favorites")).toEqual(["favorite", "like"]);
    });

    it("shows that show_updates now covers the v4 additions", () => {
        // The exact drift the old hand-typed list missed.
        expect(typesForPrefKey("show_updates")).toContain("show_moderation");
        expect(typesForPrefKey("show_updates")).toContain("show_handler");
    });

    it("returns nothing for a key no type maps to", () => {
        expect(typesForPrefKey("not_a_real_key")).toEqual([]);
    });
});

describe("pref read/write semantics match the engine", () => {
    it("treats a missing key as ON", () => {
        expect(isNotifPrefOn({}, "comments")).toBe(true);
        expect(isNotifPrefOn({ comments: true }, "comments")).toBe(true);
    });

    it("treats only an explicit false as OFF", () => {
        expect(isNotifPrefOn({ comments: false }, "comments")).toBe(false);
    });

    it("flips the EFFECTIVE value, so a first tap on a never-saved key mutes it", () => {
        expect(toggledPrefs({}, "show_updates")).toEqual({ show_updates: false });
    });

    it("flips a muted key back on and leaves siblings alone", () => {
        expect(toggledPrefs({ show_updates: false, messages: false }, "show_updates")).toEqual({
            show_updates: true,
            messages: false,
        });
    });

    it("never drops keys it does not know about (storage shape is preserved)", () => {
        const stored = { legacy_key: false, comments: true };
        expect(toggledPrefs(stored, "comments")).toEqual({ legacy_key: false, comments: false });
    });
});
