import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { fakeDb, OK } from "@/__tests__/mocks/fakeDb";

/**
 * MHH-024: the person who raised something hears how it ended, in plain
 * words. One file for the resolutions outside moderation.ts: external
 * show reviews, sanctioning dismissals, barn thread marks, suspensions.
 */

const db = fakeDb();

const { getUser, createNotification, authAdmin } = vi.hoisted(() => ({
    getUser: vi.fn(),
    createNotification: vi.fn(),
    authAdmin: {
        getUserById: vi.fn(),
        updateUserById: vi.fn(),
        signOut: vi.fn(),
    },
}));

const client = {
    from: (table: string) => db.from(table),
    auth: { getUser, admin: authAdmin },
    rpc: vi.fn(async () => OK),
};

vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => client }));
vi.mock("@/lib/supabase/anon", () => ({ createAnonClient: () => client }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn() } })) }));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: <T>(fn: T) => fn,
}));

import { reviewExternalShow } from "@/app/actions/external-shows";
import { resolveSanctioningRequest, suspendUser, unsuspendUser } from "@/app/actions/admin";
import { setThreadStatus } from "@/app/actions/groups";
import { SANCTIONING_REQUEST_MARKER } from "@/lib/shows/sanctioning";

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
afterAll(() => {
    process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

const ADMIN = { id: "admin-1", email: "admin@test.com" };
const SHOW = "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b";

beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    process.env.ADMIN_EMAIL = ADMIN.email;
    getUser.mockResolvedValue({ data: { user: ADMIN } });
    createNotification.mockResolvedValue(undefined);
    authAdmin.getUserById.mockResolvedValue({ data: { user: { id: "u-9", app_metadata: {} } }, error: null });
    authAdmin.updateUserById.mockResolvedValue({ error: null });
    authAdmin.signOut.mockResolvedValue({ error: null });
});

describe("external show reviews tell the member who sent the show", () => {
    it("approval: on the calendar, with the admin's note", async () => {
        db.on("external_shows", () => ({ data: [{ title: "Autumn Gold", submitted_by: "u-1" }], error: null }));
        const result = await reviewExternalShow({ id: SHOW, decision: "approved", note: "Added the entry link." });
        expect(result).toEqual({ success: true });
        expect(createNotification).toHaveBeenCalledWith({
            userId: "u-1",
            type: "moderation",
            content:
                '"Autumn Gold" is on the calendar now. Thank you for adding it. A note from us: Added the entry link.',
            linkUrl: "/calendar",
        });
    });

    it("rejection: says so, with the reason and the way to reach us", async () => {
        db.on("external_shows", () => ({ data: [{ title: "Spam Show", submitted_by: "u-1" }], error: null }));
        await reviewExternalShow({ id: SHOW, decision: "rejected", note: "The link goes to a shop, not a show." });
        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "u-1",
                content: expect.stringMatching(
                    /^We didn't add "Spam Show" to the calendar\. The reason: The link goes to a shop, not a show\..*contact page/,
                ),
                linkUrl: "/contact",
            }),
        );
    });

    it("tells them once: a second click on an already-reviewed show sends nothing", async () => {
        db.on("external_shows", () => ({ data: [], error: null }));
        await reviewExternalShow({ id: SHOW, decision: "approved" });
        expect(createNotification).not.toHaveBeenCalled();
    });
});

describe("a dismissed sanctioning request tells the host", () => {
    it("dismissal of a real request notifies; a grant still sends its own notice", async () => {
        db.on("shows", (q) =>
            q.op === "select"
                ? {
                      data: {
                          id: SHOW,
                          title: "Region 4 Live",
                          host_id: "host-1",
                          sanctioning_note: `Please ${SANCTIONING_REQUEST_MARKER}`,
                          is_mhh_qualifying: false,
                      },
                      error: null,
                  }
                : OK,
        );
        expect(await resolveSanctioningRequest(SHOW, "dismiss")).toEqual({ success: true });
        expect(createNotification).toHaveBeenCalledWith({
            userId: "host-1",
            type: "show_moderation",
            content: expect.stringMatching(/request to make "Region 4 Live" MHH Sanctioned and haven't granted it/),
            linkUrl: `/shows/host/${SHOW}`,
        });
    });

    it("says nothing when there was no request to dismiss", async () => {
        db.on("shows", (q) =>
            q.op === "select"
                ? { data: { id: SHOW, title: "X", host_id: "host-1", sanctioning_note: null }, error: null }
                : OK,
        );
        await resolveSanctioningRequest(SHOW, "dismiss");
        expect(createNotification).not.toHaveBeenCalled();
    });
});

describe("suspension tells the member, with the reason and the contact page", () => {
    it("suspend", async () => {
        expect(await suspendUser("u-9", "Repeated harassment in barn threads")).toEqual({ success: true });
        expect(createNotification).toHaveBeenCalledWith({
            userId: "u-9",
            type: "moderation",
            content: expect.stringMatching(
                /^Your account has been suspended\. The reason: Repeated harassment in barn threads\. .*contact page/,
            ),
            linkUrl: "/contact",
        });
    });

    it("unsuspend", async () => {
        expect(await unsuspendUser("u-9")).toEqual({ success: true });
        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "u-9", content: expect.stringMatching(/active again/) }),
        );
    });

    it("says nothing when the suspension didn't happen", async () => {
        authAdmin.updateUserById.mockResolvedValueOnce({ error: { message: "auth down" } });
        const result = await suspendUser("u-9", "Spam");
        expect(result.success).toBe(false);
        expect(createNotification).not.toHaveBeenCalled();
    });
});

describe("a barn thread's new mark tells its author", () => {
    const POST = "44444444-4444-4444-8444-444444444444";

    beforeEach(() => {
        getUser.mockResolvedValue({ data: { user: { id: "barn-admin", email: "m@test.com" } } });
        db.on("posts", (q) =>
            q.op === "select"
                ? {
                      data: { group_id: "g-1", author_id: "author-1", title: "Add a dark mode", content: "Please" },
                      error: null,
                  }
                : OK,
        );
        db.on("group_memberships", () => ({ data: { role: "admin" }, error: null }));
        db.on("groups", () => ({ data: { name: "Site Suggestions", slug: "suggestions" }, error: null }));
    });

    it("marked: the author hears which mark, with a link to the thread", async () => {
        expect(await setThreadStatus(POST, "implemented")).toEqual({ success: true });
        expect(createNotification).toHaveBeenCalledWith({
            userId: "author-1",
            type: "group_post",
            actorId: "barn-admin",
            content: 'Your thread "Add a dark mode" in Site Suggestions was marked implemented.',
            linkUrl: `/community/groups/suggestions/thread/${POST}`,
        });
    });

    it("cleared: no notice", async () => {
        expect(await setThreadStatus(POST, null)).toEqual({ success: true });
        expect(createNotification).not.toHaveBeenCalled();
    });
});
