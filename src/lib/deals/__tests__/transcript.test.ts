import { describe, it, expect } from "vitest";

import {
    CONVERSATIONAL_KINDS,
    MESSAGE_KINDS,
    coerceKind,
    coercePayload,
    describeEvent,
    evidenceLine,
    eventSummaryLine,
    isEventKind,
    previewLine,
} from "../transcript";

const ctx = { actorName: "@amanda" };

describe("mixed transcript", () => {
    it("defaults an unknown or missing kind to chat, which is what every existing row is", () => {
        expect(coerceKind(undefined)).toBe("chat");
        expect(coerceKind(null)).toBe("chat");
        expect(coerceKind("from_the_future")).toBe("chat");
        expect(coerceKind(42)).toBe("chat");
        expect(coerceKind("offer")).toBe("offer");
    });

    it("treats only chat and photo as things a person typed", () => {
        expect([...CONVERSATIONAL_KINDS].sort()).toEqual(["chat", "photo"]);
        for (const kind of MESSAGE_KINDS) {
            expect(isEventKind(kind)).toBe(kind !== "chat" && kind !== "photo");
        }
    });

    it("reads a jsonb payload however the driver hands it over", () => {
        expect(coercePayload({ a: 1 })).toEqual({ a: 1 });
        expect(coercePayload('{"a":1}')).toEqual({ a: 1 });
        expect(coercePayload(null)).toEqual({});
        expect(coercePayload("not json")).toEqual({});
        expect(coercePayload([1, 2])).toEqual({});
    });

    it("describes every event kind without throwing, whatever the payload", () => {
        for (const kind of MESSAGE_KINDS) {
            for (const payload of [null, {}, { nonsense: true }, "junk"]) {
                const d = describeEvent(kind, payload, ctx, "fallback text");
                expect(d.headline).toBeTruthy();
                expect(d.icon).toBeTruthy();
                expect(["note", "money", "good", "warn"]).toContain(d.tone);
            }
        }
    });

    it("writes the sentence the thread has been missing since 2024", () => {
        const d = describeEvent("offer", { amount: 300, note: "Love this one" }, ctx);
        expect(d.headline).toBe("@amanda offered $300");
        expect(d.lines).toContainEqual({ label: "Message", value: "Love this one" });
    });

    it("names what a counter is countering", () => {
        const d = describeEvent("counter_offer", { amount: 275, previousAmount: 300 }, ctx);
        expect(d.headline).toBe("@amanda countered at $275");
        expect(d.lines).toContainEqual({ label: "Countering", value: "$300" });
    });

    it("tells declined, cancelled and retracted apart", () => {
        // OfferCard rendered every terminal state as "❌ Offer Declined".
        const declined = describeEvent("offer_response", { action: "decline", amount: 300 }, ctx);
        const cancelled = describeEvent("offer_response", { action: "cancel", amount: 300 }, ctx);
        const retracted = describeEvent("offer_response", { action: "retract", amount: 300 }, ctx);
        const expired = describeEvent("offer_response", { action: "expire", amount: 300 }, ctx);
        const headlines = [declined, cancelled, retracted, expired].map((d) => d.headline);
        expect(new Set(headlines).size).toBe(4);
        expect(declined.headline).toMatch(/declined/);
        expect(retracted.headline).toMatch(/retracted/);
    });

    it("carries the dates payment entries exist to record", () => {
        const sent = describeEvent(
            "payment_sent",
            { seq: 2, amount: 75, onDate: "2026-09-01" },
            ctx,
        );
        expect(sent.headline).toBe("@amanda marked payment 2 sent — $75");
        expect(sent.lines).toContainEqual({ label: "Sent on", value: "Sep 1, 2026" });

        const got = describeEvent(
            "payment_confirmed",
            { seq: 2, amount: 75, onDate: "2026-09-03", remaining: 225 },
            ctx,
        );
        expect(got.headline).toMatch(/confirmed payment 2 received — \$75/);
        expect(got.lines).toContainEqual({ label: "Received on", value: "Sep 3, 2026" });
        expect(got.lines).toContainEqual({ label: "Still outstanding", value: "$225" });
    });

    it("says a dispute freezes the record, and marks it as the one warning tone", () => {
        const raised = describeEvent("dispute", { reason: "Never shipped" }, ctx);
        expect(raised.tone).toBe("warn");
        expect(raised.headline).toMatch(/frozen/i);
        expect(raised.lines).toContainEqual({ label: "Stated reason", value: "Never shipped" });

        const stoodDown = describeEvent("dispute", { resolved: true }, ctx);
        expect(stoodDown.tone).toBe("note");
        expect(stoodDown.headline).toMatch(/stood the dispute down/i);
    });

    it("reserves the warning tone for closures and disputes, never for money moving", () => {
        expect(describeEvent("payment_sent", { seq: 1, amount: 10 }, ctx).tone).toBe("money");
        expect(describeEvent("plan_created", { installmentCount: 6, total: 400 }, ctx).tone).toBe(
            "money",
        );
        expect(describeEvent("terms_agreed", { agreedPrice: 300 }, ctx).tone).toBe("good");
    });

    it("falls back to the row's own content for a system entry", () => {
        expect(describeEvent("system", {}, ctx, "The offer expired").headline).toBe(
            "The offer expired",
        );
        expect(describeEvent("system", {}, ctx, null).headline).toBe("Recorded");
    });

    // ── Derived lines ──

    it("summarises an event and passes a chat message through untouched", () => {
        expect(eventSummaryLine("offer", { amount: 300 }, ctx)).toBe("@amanda offered $300");
        expect(eventSummaryLine("chat", {}, ctx, "  hello there  ")).toBe("hello there");
    });

    it("previews an event by its sentence and a photo by name", () => {
        expect(previewLine("offer", { amount: 300 }, null, ctx)).toBe("@amanda offered $300");
        expect(previewLine("photo", null, "", ctx)).toBe("Sent a photo");
        expect(previewLine("photo", null, "look at this", ctx)).toBe("look at this");
    });

    it("collapses whitespace and truncates a long preview", () => {
        expect(previewLine("chat", null, "a\n\n   b", ctx)).toBe("a b");
        const long = "x".repeat(200);
        const preview = previewLine("chat", null, long, ctx, 20);
        expect(preview).toHaveLength(20);
        expect(preview.endsWith("…")).toBe(true);
    });

    it("stamps an evidence line with its exact time and its detail", () => {
        const line = evidenceLine(
            "payment_confirmed",
            { seq: 1, amount: 75, onDate: "2026-09-03" },
            ctx,
            "2026-09-03T14:22:00Z",
        );
        expect(line).toMatch(/^Sep 3, 2026 at .*UTC — @amanda confirmed payment 1 received/);
        expect(line).toMatch(/\(Received on: Sep 3, 2026\)/);
    });
});
