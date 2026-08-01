import { describe, expect, it } from "vitest";

import { deriveReadinessState, type ShowReadiness } from "@/lib/shows/readiness";

function counts(partial: Partial<ShowReadiness>): ShowReadiness {
    return {
        totalHorses: 0,
        publicHorses: 0,
        horsesWithPhotos: 0,
        eligibleCount: 0,
        ...partial,
    };
}

describe("deriveReadinessState — the first-entry ramp", () => {
    it("no horses at all → empty (the checklist card)", () => {
        expect(deriveReadinessState(counts({}), "online")).toEqual({ kind: "empty" });
        expect(deriveReadinessState(counts({}), "live")).toEqual({ kind: "empty" });
    });

    it("online: public horse with a photo → ready", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 3, publicHorses: 1, horsesWithPhotos: 1, eligibleCount: 1 }),
            "online",
        );
        expect(state).toEqual({ kind: "ready", readyCount: 1 });
    });

    it("live: a public horse is enough — no photo required", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 2, publicHorses: 2, horsesWithPhotos: 0, eligibleCount: 0 }),
            "live",
        );
        expect(state).toEqual({ kind: "ready", readyCount: 2 });
    });

    it("all horses private → the private bucket, with counts", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 3, publicHorses: 0, horsesWithPhotos: 2 }),
            "online",
        );
        expect(state.kind).toBe("gaps");
        if (state.kind !== "gaps") return;
        expect(state.privateCount).toBe(3);
        expect(state.publicNoPhotoCount).toBe(0);
        expect(state.messages).toEqual(["3 horses are private — make one public to enter."]);
    });

    it("singular phrasing for a single private horse", () => {
        const state = deriveReadinessState(counts({ totalHorses: 1, publicHorses: 0 }), "live");
        expect(state.kind).toBe("gaps");
        if (state.kind !== "gaps") return;
        expect(state.messages).toEqual(["1 horse is private — make it public to enter."]);
    });

    it("online: public horses without photos → the photo bucket", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 2, publicHorses: 2, horsesWithPhotos: 0, eligibleCount: 0 }),
            "online",
        );
        expect(state.kind).toBe("gaps");
        if (state.kind !== "gaps") return;
        expect(state.publicNoPhotoCount).toBe(2);
        expect(state.messages).toEqual([
            "2 public horses have no photo yet — online shows judge the photo.",
        ]);
    });

    it("online: both buckets can appear together", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 5, publicHorses: 2, horsesWithPhotos: 3, eligibleCount: 0 }),
            "online",
        );
        expect(state.kind).toBe("gaps");
        if (state.kind !== "gaps") return;
        expect(state.privateCount).toBe(3);
        expect(state.publicNoPhotoCount).toBe(2);
        expect(state.messages).toHaveLength(2);
        expect(state.messages[0]).toMatch(/3 horses are private/);
        expect(state.messages[1]).toMatch(/2 public horses have no photo/);
    });

    it("live mode never nags about photos", () => {
        const state = deriveReadinessState(
            counts({ totalHorses: 4, publicHorses: 0, horsesWithPhotos: 0 }),
            "live",
        );
        expect(state.kind).toBe("gaps");
        if (state.kind !== "gaps") return;
        expect(state.messages.every((m) => !m.includes("photo"))).toBe(true);
    });

    it("gaps never renders blank (defensive fallback line)", () => {
        // Contradictory counts (shouldn't happen) still yield a message.
        const state = deriveReadinessState(
            counts({ totalHorses: 2, publicHorses: 2, horsesWithPhotos: 2, eligibleCount: 0 }),
            "live",
        );
        // live + publicHorses > 0 is actually ready; force the odd case on online:
        const odd = deriveReadinessState(
            counts({ totalHorses: 2, publicHorses: 2, horsesWithPhotos: 2, eligibleCount: 0 }),
            "online",
        );
        expect(state.kind).toBe("ready");
        expect(odd.kind).toBe("gaps");
        if (odd.kind !== "gaps") return;
        expect(odd.messages.length).toBeGreaterThan(0);
    });
});
