/**
 * The contact form (MHH-021, MHH-027): category, the error-page reference
 * and the signed-in sender's account travel with the message; the owner's
 * bell rings; before migration 236 the message still arrives.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_CATEGORIES } from "@/lib/contact/categories";

const inserts: Record<string, unknown>[] = [];
let insertResults: { error: { code?: string; message?: string } | null }[] = [];
let viewer: { id: string } | null = null;
vi.mock("@/lib/auth", () => ({
    optionalAuth: vi.fn(async () => ({
        user: viewer,
        supabase: {
            from: () => ({
                insert: async (row: Record<string, unknown>) => {
                    inserts.push(row);
                    return insertResults.shift() ?? { error: null };
                },
            }),
        },
    })),
}));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: vi.fn(async () => true) }));
const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => deferred.push(fn) }));
const notified: { userId: string; content: string; linkUrl?: string }[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string; linkUrl?: string }) => notified.push(n)),
}));
vi.mock("@/lib/notifications/adminTargets", () => ({ adminNotificationTargets: vi.fn(async () => ["owner-1"]) }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn(() => ({})) }));

import { submitContactForm } from "@/app/actions/contact";

const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
};
const base = { name: "Pat", email: "pat@example.com", subject: "Broken page", message: "The Registry page errored." };

describe("submitContactForm", () => {
    beforeEach(() => {
        inserts.length = 0;
        insertResults = [];
        notified.length = 0;
        deferred.length = 0;
        viewer = null;
    });

    it("keeps the category, the error reference and the signed-in account", async () => {
        viewer = { id: "member-1" };
        const r = await submitContactForm(
            { error: null, success: false },
            form({ ...base, category: "problem", error_ref: "1234567890" }),
        );
        expect(r.success).toBe(true);
        expect(inserts[0]).toMatchObject({ category: "problem", error_ref: "1234567890", user_id: "member-1" });
    });

    it("falls back to 'question' and drops a malformed reference", async () => {
        await submitContactForm(
            { error: null, success: false },
            form({ ...base, category: "nonsense", error_ref: "<script>" }),
        );
        expect(inserts[0]).toMatchObject({ category: "question", error_ref: null, user_id: null });
    });

    it("rings the owner's bell, linking to the mailbox", async () => {
        await submitContactForm({ error: null, success: false }, form({ ...base, category: "billing" }));
        for (const run of deferred) await run();
        expect(notified[0]).toMatchObject({ userId: "owner-1", linkUrl: "/admin#mailbox" });
        // The owner's word for it, not the member-facing "Payments or my membership".
        expect(notified[0].content).toBe("✉️ New message from Pat (Billing): Broken page");
    });

    it("still delivers the message before migration 236", async () => {
        insertResults = [
            { error: { code: "PGRST204", message: "Could not find the 'category' column" } },
            { error: null },
        ];
        const r = await submitContactForm({ error: null, success: false }, form(base));
        expect(r.success).toBe(true);
        expect(inserts[1]).toEqual({
            name: "Pat",
            email: "pat@example.com",
            subject: "Broken page",
            message: "The Registry page errored.",
        });
    });

    it("lists the same categories as the database (migration 236)", () => {
        const sql = readFileSync(
            path.join(process.cwd(), "supabase", "migrations", "236_contact_messages_triage.sql"),
            "utf8",
        );
        const list = sql.slice(
            sql.indexOf("CHECK (category IN ("),
            sql.indexOf("));", sql.indexOf("CHECK (category IN (")),
        );
        const inDb = [...list.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
        expect(inDb).toEqual(CONTACT_CATEGORIES.map((c) => c.value));
    });
});
