import { describe, it, expect } from "vitest";
import {
    validateEntry,
    type ClassFacts,
    type ExistingEntry,
    type HorseFacts,
    type ShowFacts,
    type ValidateEntryInput,
} from "@/lib/shows/entryRules";

const horse: HorseFacts = {
    id: "horse-1",
    ownerId: "user-1",
    scale: "Traditional",
    finish: "OF",
};

const show: ShowFacts = {
    id: "show-1",
    mode: "live",
    status: "entries_open",
    entriesCloseAt: "2026-08-01T00:00:00Z",
};

const halterClass: ClassFacts = {
    id: "class-qh",
    status: "scheduled",
    maxPerEntrant: null,
    allowedScales: null,
    allowedFinishes: null,
    divisionAxis: "halter",
};

const now = new Date("2026-07-01T12:00:00Z");

function input(overrides: Partial<ValidateEntryInput> = {}): ValidateEntryInput {
    return {
        candidate: { horseId: "horse-1", ownerId: "user-1" },
        horse,
        show,
        targetClass: halterClass,
        existingEntries: [],
        now,
        ...overrides,
    };
}

function errorsOf(result: ReturnType<typeof validateEntry>): string[] {
    return result.ok ? [] : result.errors;
}

describe("entryRules — validateEntry", () => {
    it("accepts a clean first entry", () => {
        expect(validateEntry(input())).toEqual({ ok: true });
    });

    describe("entry window", () => {
        it("rejects when the show is not entries_open", () => {
            for (const status of ["draft", "published", "entries_closed", "running", "completed"] as const) {
                const r = validateEntry(input({ show: { ...show, status } }));
                expect(r.ok).toBe(false);
                expect(errorsOf(r).join(" ")).toMatch(/not open/i);
            }
        });
        it("rejects after the entries_close_at deadline even if status lags", () => {
            const r = validateEntry(input({ now: new Date("2026-08-02T00:00:00Z") }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/deadline/i);
        });
        it("accepts exactly at the deadline", () => {
            const r = validateEntry(input({ now: new Date("2026-08-01T00:00:00Z") }));
            expect(r.ok).toBe(true);
        });
        it("no deadline set → status alone governs", () => {
            const r = validateEntry(input({
                show: { ...show, entriesCloseAt: null },
                now: new Date("2030-01-01T00:00:00Z"),
            }));
            expect(r.ok).toBe(true);
        });
    });

    describe("class status", () => {
        it("rejects cancelled and combined classes with pointed messages", () => {
            const cancelled = validateEntry(input({ targetClass: { ...halterClass, status: "cancelled" } }));
            expect(errorsOf(cancelled).join(" ")).toMatch(/cancelled/i);
            const combined = validateEntry(input({ targetClass: { ...halterClass, status: "combined" } }));
            expect(errorsOf(combined).join(" ")).toMatch(/combined/i);
        });
        it("rejects classes already called or judging", () => {
            for (const status of ["called", "judging", "placed"] as const) {
                expect(validateEntry(input({ targetClass: { ...halterClass, status } })).ok).toBe(false);
            }
        });
    });

    describe("ownership and proxy", () => {
        it("rejects entering a horse you do not own", () => {
            const r = validateEntry(input({
                candidate: { horseId: "horse-1", ownerId: "user-2" },
                horse: { ...horse, ownerId: "user-1" },
            }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/own/i);
        });
        it("proxy showing: handler ≠ owner is legal", () => {
            const r = validateEntry(input({
                candidate: { horseId: "horse-1", ownerId: "user-1", handlerId: "user-99" },
            }));
            expect(r).toEqual({ ok: true });
        });
    });

    describe("the breed-halter rule", () => {
        const existingHalterEntry: ExistingEntry = {
            classId: "class-arab",
            horseId: "horse-1",
            ownerId: "user-1",
            status: "entered",
            divisionAxis: "halter",
        };

        it("rejects a second breed-halter class for the same horse in the same show", () => {
            const r = validateEntry(input({ existingEntries: [existingHalterEntry] }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/already entered in a breed halter/i);
        });

        it("a scratched halter entry does not block re-entering halter", () => {
            const r = validateEntry(input({
                existingEntries: [{ ...existingHalterEntry, status: "scratched" }],
            }));
            expect(r).toEqual({ ok: true });
        });

        it("the SAME horse may still enter performance/workmanship/collectibility", () => {
            for (const axis of ["performance", "workmanship", "collectibility", "other"] as const) {
                const r = validateEntry(input({
                    targetClass: { ...halterClass, id: "class-x", divisionAxis: axis },
                    existingEntries: [existingHalterEntry],
                }));
                expect(r).toEqual({ ok: true });
            }
        });

        it("a DIFFERENT horse in halter is unaffected", () => {
            const r = validateEntry(input({
                existingEntries: [{ ...existingHalterEntry, horseId: "horse-2" }],
            }));
            expect(r).toEqual({ ok: true });
        });

        it("existing performance entries do not block a first halter entry", () => {
            const r = validateEntry(input({
                existingEntries: [{ ...existingHalterEntry, divisionAxis: "performance" }],
            }));
            expect(r).toEqual({ ok: true });
        });
    });

    describe("duplicate entry", () => {
        it("rejects the same horse twice in one class", () => {
            const r = validateEntry(input({
                targetClass: { ...halterClass, divisionAxis: "performance" },
                existingEntries: [{
                    classId: halterClass.id,
                    horseId: "horse-1",
                    ownerId: "user-1",
                    status: "entered",
                    divisionAxis: "performance",
                }],
            }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/already entered in this class/i);
        });
    });

    describe("max_per_entrant", () => {
        const perfClass: ClassFacts = {
            ...halterClass,
            id: "class-wp",
            divisionAxis: "performance",
            maxPerEntrant: 2,
        };
        const mkEntry = (horseId: string, ownerId = "user-1"): ExistingEntry => ({
            classId: "class-wp",
            horseId,
            ownerId,
            status: "entered",
            divisionAxis: "performance",
        });

        it("rejects when the entrant is at the cap", () => {
            const r = validateEntry(input({
                targetClass: perfClass,
                existingEntries: [mkEntry("horse-2"), mkEntry("horse-3")],
            }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/at most 2/i);
        });
        it("allows under the cap", () => {
            const r = validateEntry(input({
                targetClass: perfClass,
                existingEntries: [mkEntry("horse-2")],
            }));
            expect(r).toEqual({ ok: true });
        });
        it("other entrants' entries do not count against my cap", () => {
            const r = validateEntry(input({
                targetClass: perfClass,
                existingEntries: [mkEntry("horse-8", "user-9"), mkEntry("horse-9", "user-9")],
            }));
            expect(r).toEqual({ ok: true });
        });
        it("scratched entries do not count against the cap", () => {
            const r = validateEntry(input({
                targetClass: perfClass,
                existingEntries: [
                    { ...mkEntry("horse-2"), status: "scratched" },
                    { ...mkEntry("horse-3"), status: "scratched" },
                ],
            }));
            expect(r).toEqual({ ok: true });
        });
    });

    describe("scale and finish eligibility", () => {
        it("rejects a scale outside allowed_scales", () => {
            const r = validateEntry(input({
                targetClass: { ...halterClass, allowedScales: ["Stablemate", "Classic"] },
            }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/Stablemate, Classic/);
        });
        it("accepts a matching scale", () => {
            const r = validateEntry(input({
                targetClass: { ...halterClass, allowedScales: ["Traditional"] },
            }));
            expect(r).toEqual({ ok: true });
        });
        it("rejects unknown scale when the class restricts scales", () => {
            const r = validateEntry(input({
                horse: { ...horse, scale: null },
                targetClass: { ...halterClass, allowedScales: ["Traditional"] },
            }));
            expect(r.ok).toBe(false);
        });
        it("rejects a finish outside allowed_finishes", () => {
            const r = validateEntry(input({
                targetClass: { ...halterClass, allowedFinishes: ["CM", "AR"] },
            }));
            expect(r.ok).toBe(false);
            expect(errorsOf(r).join(" ")).toMatch(/CM, AR/);
        });
        it("empty arrays mean unrestricted", () => {
            const r = validateEntry(input({
                targetClass: { ...halterClass, allowedScales: [], allowedFinishes: [] },
            }));
            expect(r).toEqual({ ok: true });
        });
    });

    it("collects MULTIPLE violations in one pass", () => {
        const r = validateEntry(input({
            show: { ...show, status: "entries_closed" },
            targetClass: { ...halterClass, status: "cancelled", allowedFinishes: ["CM"] },
        }));
        expect(r.ok).toBe(false);
        expect(errorsOf(r).length).toBeGreaterThanOrEqual(3);
    });
});
