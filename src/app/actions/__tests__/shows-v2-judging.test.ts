/**
 * Phase E1 — online judging action tests: the entry gallery's
 * server-side blind rule, community voting (cast/remove), the
 * judge queue's recordPlacings, finalizeCommunityVotes, and the
 * results-publish path of transitionShowStatus.
 *
 * Mock notes: maybeSingle calls are queued per action's fixed load
 * order; list reads (implicit awaits) are queued via queueList()
 * because these actions read several different lists in sequence.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import {
    createMockAdminClient,
    createMockSupabaseClient,
} from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));

import {
    castVote,
    finalizeCommunityVotes,
    getShowGallery,
    recordPlacings,
    removeVote,
    transitionShowStatus,
} from "@/app/actions/shows-v2";

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";
const CLASS_ID = "223e4567-e89b-42d3-a456-426614174000";
const SECTION_ID = "423e4567-e89b-42d3-a456-426614174000";
const DIVISION_ID = "523e4567-e89b-42d3-a456-426614174000";
const ENTRY_ID = "623e4567-e89b-42d3-a456-426614174000";
const ENTRY_ID_2 = "723e4567-e89b-42d3-a456-426614174000";
const HORSE_ID = "823e4567-e89b-42d3-a456-426614174000";
const PHOTO_ID = "923e4567-e89b-42d3-a456-426614174000";

/** Queue ONE list-read result (implicit await) in call order. */
function queueList(data: unknown, error: unknown = null) {
    mockClient._mockQuery.then.mockImplementationOnce(((
        resolve: (value: unknown) => unknown,
    ) => Promise.resolve({ data, error }).then(resolve)) as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const client of [mockClient, mockAdmin]) {
        client._mockQuery.single.mockReset();
        client._mockQuery.single.mockResolvedValue({ data: null, error: null });
        client._mockQuery.maybeSingle.mockReset();
        client._mockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
        client._mockQuery.then.mockReset();
        client.rpc.mockReset();
        client.rpc.mockResolvedValue({ data: null, error: null });
        client._setImplicitResolve({ data: null, error: null });
    }
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "viewer@test.com" } },
    });
});

// ══════════════════════════════════════════════════════════════
// castVote / removeVote
// ══════════════════════════════════════════════════════════════

/** entry → show maybeSingle pair for the vote context. */
function mockVoteContext(
    entry: Record<string, unknown> | null,
    show: Record<string, unknown> | null,
) {
    mockClient._mockQuery.maybeSingle
        .mockResolvedValueOnce({ data: entry, error: null })
        .mockResolvedValueOnce({ data: show, error: null });
}

const liveEntry = {
    id: ENTRY_ID,
    owner_id: "someone-else",
    status: "entered",
    show_id: SHOW_ID,
};

describe("shows-v2 — castVote", () => {
    it("rejects invalid input before touching auth", async () => {
        const result = await castVote({ entryId: "not-a-uuid" });
        expect(result.success).toBe(false);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(castVote({ entryId: ENTRY_ID })).rejects.toThrow(AuthError);
    });

    it("refuses voting on expert-judged shows", async () => {
        mockVoteContext(liveEntry, { status: "judging", judging: "judged" });
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/expert-judged/i);
    });

    it("refuses voting outside the judging window (wrong status)", async () => {
        mockVoteContext(liveEntry, { status: "entries_open", judging: "community_vote" });
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/while the show is judging/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses voting for your own entry", async () => {
        mockVoteContext(
            { ...liveEntry, owner_id: "user-1" },
            { status: "judging", judging: "community_vote" },
        );
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/own entry/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses voting on a scratched entry", async () => {
        mockVoteContext(
            { ...liveEntry, status: "scratched" },
            { status: "judging", judging: "community_vote" },
        );
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/scratched/i);
    });

    it("casts a vote as the caller", async () => {
        mockVoteContext(liveEntry, { status: "judging", judging: "community_vote" });
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith({
            entry_id: ENTRY_ID,
            voter_id: "user-1",
        });
    });

    it("maps the unique-violation to a friendly double-vote message", async () => {
        mockVoteContext(liveEntry, { status: "judging", judging: "community_vote" });
        mockClient._setImplicitResolve({
            data: null,
            error: { code: "23505", message: "duplicate key value" },
        });
        const result = await castVote({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: false, error: "You already voted for this entry." });
    });
});

describe("shows-v2 — removeVote", () => {
    it("refuses once voting has closed (tally frozen)", async () => {
        mockVoteContext(liveEntry, { status: "results_review", judging: "community_vote" });
        const result = await removeVote({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/frozen/i);
        expect(mockClient._mockQuery.delete).not.toHaveBeenCalled();
    });

    it("removes only the caller's own vote", async () => {
        mockVoteContext(liveEntry, { status: "judging", judging: "community_vote" });
        const result = await removeVote({ entryId: ENTRY_ID });
        expect(result).toEqual({ success: true });
        expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("entry_id", ENTRY_ID);
        expect(mockClient._mockQuery.eq).toHaveBeenCalledWith("voter_id", "user-1");
    });
});

// ══════════════════════════════════════════════════════════════
// recordPlacings
// ══════════════════════════════════════════════════════════════

/** class → section → division → show(+staff) maybeSingle chain. */
function mockPlacingContext({
    classStatus = "scheduled",
    show = {},
    staffRole = null,
}: {
    classStatus?: string;
    show?: Record<string, unknown>;
    staffRole?: string | null;
}) {
    mockClient._mockQuery.maybeSingle
        .mockResolvedValueOnce({
            data: { id: CLASS_ID, section_id: SECTION_ID, status: classStatus },
            error: null,
        })
        .mockResolvedValueOnce({
            data: { id: SECTION_ID, division_id: DIVISION_ID },
            error: null,
        })
        .mockResolvedValueOnce({
            data: { id: DIVISION_ID, show_id: SHOW_ID },
            error: null,
        })
        .mockResolvedValueOnce({
            data: {
                id: SHOW_ID,
                host_id: "user-1",
                status: "judging",
                mode: "online",
                judging: "judged",
                ...show,
            },
            error: null,
        });
    if (staffRole !== undefined && (show as { host_id?: string }).host_id) {
        // Non-host viewer: the staff lookup follows the show load.
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: staffRole ? { role: staffRole } : null,
            error: null,
        });
    }
}

describe("shows-v2 — recordPlacings", () => {
    it("rejects duplicate places via zod", async () => {
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [
                { entryId: ENTRY_ID, place: 1 },
                { entryId: ENTRY_ID_2, place: 1 },
            ],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/each place/i);
        expect(mockClient.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects an entry taking two places via zod", async () => {
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [
                { entryId: ENTRY_ID, place: 1 },
                { entryId: ENTRY_ID, place: 2 },
            ],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/one place/i);
    });

    it("refuses a viewer with no role on the show", async () => {
        mockPlacingContext({ show: { host_id: "someone-else" }, staffRole: null });
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [{ entryId: ENTRY_ID, place: 1 }],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/only show staff/i);
    });

    it("refuses recording while the show is not judging (wrong status)", async () => {
        mockPlacingContext({ show: { status: "entries_open" } });
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [{ entryId: ENTRY_ID, place: 1 }],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/while the show is judging/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("refuses entries that are not live members of the class", async () => {
        mockPlacingContext({});
        // The class's live entries do NOT include the placed entry.
        queueList([{ id: ENTRY_ID_2, status: "entered" }]);
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [{ entryId: ENTRY_ID, place: 1 }],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/do not belong/i);
    });

    it("records the slate, flips the class through the state machine, and marks done", async () => {
        mockPlacingContext({ classStatus: "scheduled" });
        queueList([
            { id: ENTRY_ID, status: "entered" },
            { id: ENTRY_ID_2, status: "entered" },
        ]);
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [
                { entryId: ENTRY_ID_2, place: 1, note: "Clean mold, lovely photo." },
                { entryId: ENTRY_ID, place: 2 },
            ],
            markDone: true,
        });
        expect(result).toEqual({ success: true, recorded: 2 });
        // scheduled → judging when recording starts, → placed on done.
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "judging" });
        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "placed" });
        // Replace-all slate: old placings cleared, new batch inserted.
        expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith([
            {
                class_id: CLASS_ID,
                entry_id: ENTRY_ID_2,
                place: 1,
                judge_id: "user-1",
                note: "Clean mold, lovely photo.",
            },
            {
                class_id: CLASS_ID,
                entry_id: ENTRY_ID,
                place: 2,
                judge_id: "user-1",
                note: null,
            },
        ]);
    });

    it("lets a JUDGE record placings", async () => {
        mockPlacingContext({
            classStatus: "judging",
            show: { host_id: "someone-else" },
            staffRole: "judge",
        });
        queueList([{ id: ENTRY_ID, status: "entered" }]);
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [{ entryId: ENTRY_ID, place: 1 }],
        });
        expect(result).toEqual({ success: true, recorded: 1 });
        // Class already judging — no status flip without markDone.
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("refuses a cancelled class", async () => {
        mockPlacingContext({ classStatus: "cancelled" });
        const result = await recordPlacings({
            classId: CLASS_ID,
            placings: [{ entryId: ENTRY_ID, place: 1 }],
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/cancelled/i);
    });
});

// ══════════════════════════════════════════════════════════════
// finalizeCommunityVotes
// ══════════════════════════════════════════════════════════════

/** getShowRole pair (show + optional staff row). */
function mockShowRole(
    show: Record<string, unknown>,
    staffRole: string | null | undefined = undefined,
) {
    mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
        data: {
            id: SHOW_ID,
            host_id: "user-1",
            status: "results_review",
            mode: "online",
            judging: "community_vote",
            ...show,
        },
        error: null,
    });
    if (staffRole !== undefined) {
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: staffRole ? { role: staffRole } : null,
            error: null,
        });
    }
}

describe("shows-v2 — finalizeCommunityVotes", () => {
    it("refuses a steward (managers only)", async () => {
        mockShowRole({ host_id: "someone-else" }, "steward");
        const result = await finalizeCommunityVotes({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/host or a co-host/i);
    });

    it("refuses expert-judged shows", async () => {
        mockShowRole({ judging: "judged" });
        const result = await finalizeCommunityVotes({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/judge queue/i);
    });

    it("refuses outside results_review (wrong status)", async () => {
        mockShowRole({ status: "judging" });
        const result = await finalizeCommunityVotes({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/results review/i);
        expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
    });

    it("derives top-6 placings from the tally (ties to the earliest entry)", async () => {
        mockShowRole({});
        // loadClassContexts: divisions → sections → classes.
        queueList([{ id: DIVISION_ID, name: "Halter", sort_order: 0 }]);
        queueList([
            { id: SECTION_ID, name: "Stock", division_id: DIVISION_ID, sort_order: 0 },
        ]);
        queueList([
            {
                id: CLASS_ID,
                name: "OF Quarter Horse",
                class_number: "1",
                status: "scheduled",
                section_id: SECTION_ID,
                sort_order: 0,
            },
        ]);
        // Live entries: entry-2 arrived first.
        queueList([
            {
                id: ENTRY_ID_2,
                class_id: CLASS_ID,
                status: "entered",
                created_at: "2026-07-01T00:00:00Z",
            },
            {
                id: ENTRY_ID,
                class_id: CLASS_ID,
                status: "entered",
                created_at: "2026-07-02T00:00:00Z",
            },
        ]);
        // The tally: one vote each — the tie breaks to entry-2.
        queueList([{ entry_id: ENTRY_ID }, { entry_id: ENTRY_ID_2 }]);

        const result = await finalizeCommunityVotes({ showId: SHOW_ID });
        expect(result).toEqual({ success: true, classesPlaced: 1, placingsWritten: 2 });
        // Provisional slate re-derived from scratch: clear then insert.
        expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith([
            {
                class_id: CLASS_ID,
                entry_id: ENTRY_ID_2,
                place: 1,
                judge_id: "user-1",
                note: null,
            },
            {
                class_id: CLASS_ID,
                entry_id: ENTRY_ID,
                place: 2,
                judge_id: "user-1",
                note: null,
            },
        ]);
    });
});

// ══════════════════════════════════════════════════════════════
// The gallery's server-side blind rule
// ══════════════════════════════════════════════════════════════

function mockGalleryShow(overrides: Record<string, unknown> = {}) {
    mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
        data: {
            id: SHOW_ID,
            mode: "online",
            status: "judging",
            judging: "community_vote",
            blind_browsing: true,
            ...overrides,
        },
        error: null,
    });
}

/** Queue the gallery's standard list sequence up through votes. */
function queueGalleryLists() {
    queueList([{ id: DIVISION_ID, name: "Halter", sort_order: 0 }]);
    queueList([
        { id: SECTION_ID, name: "Stock", division_id: DIVISION_ID, sort_order: 0 },
    ]);
    queueList([
        {
            id: CLASS_ID,
            name: "OF Quarter Horse",
            class_number: "1",
            status: "judging",
            section_id: SECTION_ID,
            sort_order: 0,
        },
    ]);
    queueList([
        {
            id: ENTRY_ID,
            class_id: CLASS_ID,
            horse_id: HORSE_ID,
            owner_id: "owner-9",
            entry_number: 12,
            photo_id: PHOTO_ID,
            status: "entered",
            created_at: "2026-07-01T00:00:00Z",
        },
    ]);
    queueList([{ id: PHOTO_ID, image_url: "horses/h1/photo.webp" }]);
    queueList([{ id: HORSE_ID, custom_name: "Dash of Cash" }]);
    queueList([{ entry_id: ENTRY_ID, voter_id: "user-1" }]); // the votes
}

describe("shows-v2 — getShowGallery (blind rule, server-side)", () => {
    it("refuses live shows (no entry photos by design)", async () => {
        mockGalleryShow({ mode: "live" });
        const result = await getShowGallery({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/live shows/i);
    });

    it("refuses before entries open", async () => {
        mockGalleryShow({ status: "published" });
        const result = await getShowGallery({ showId: SHOW_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/entries open/i);
    });

    it("BLIND: while judging with blind_browsing on, the payload carries NO owner identity", async () => {
        mockGalleryShow();
        queueGalleryLists();

        const result = await getShowGallery({ showId: SHOW_ID });
        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.gallery.revealed).toBe(false);
        expect(result.gallery.votingOpen).toBe(true);
        const entry = result.gallery.classes[0].entries[0];
        // The blind rule is a property of the DATA, not the CSS.
        expect(entry.ownerAlias).toBeNull();
        expect(entry.ownerId).toBeNull();
        // The aliases table was never even queried.
        expect(mockClient.from).not.toHaveBeenCalledWith("users");
        // Photos, horse names, and the live tally still flow.
        expect(entry.horseName).toBe("Dash of Cash");
        expect(entry.photoUrl).toContain("horses/h1/photo.webp");
        expect(entry.voteCount).toBe(1);
        expect(entry.viewerHasVoted).toBe(true);
    });

    it("REVEALED: blind_browsing off includes owner aliases", async () => {
        mockGalleryShow({ blind_browsing: false });
        queueGalleryLists();
        queueList([{ id: "owner-9", alias_name: "pattycakes" }]); // aliases

        const result = await getShowGallery({ showId: SHOW_ID });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.gallery.revealed).toBe(true);
        expect(result.gallery.classes[0].entries[0].ownerAlias).toBe("pattycakes");
        expect(mockClient.from).toHaveBeenCalledWith("users");
    });
});

// ══════════════════════════════════════════════════════════════
// Results publish (transitionShowStatus → completed)
// ══════════════════════════════════════════════════════════════

describe("shows-v2 — results publish on completed", () => {
    function mockPublishReads() {
        // getShowRole (host) then writeShowRecordsForShow's show load.
        mockClient._mockQuery.maybeSingle
            .mockResolvedValueOnce({
                data: {
                    id: SHOW_ID,
                    host_id: "user-1",
                    status: "results_review",
                    mode: "online",
                    judging: "judged",
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: SHOW_ID,
                    title: "July Photo Classic",
                    mode: "online",
                    show_date: null,
                    entries_close_at: "2026-07-01T12:00:00Z",
                    judging_ends_at: "2026-07-08T12:00:00Z",
                },
                error: null,
            });
        queueList([{ id: DIVISION_ID, name: "Halter" }]);
        queueList([{ id: SECTION_ID, name: "Stock", division_id: DIVISION_ID }]);
        queueList([{ id: CLASS_ID, name: "OF Quarter Horse", section_id: SECTION_ID }]);
        queueList([
            {
                id: ENTRY_ID,
                class_id: CLASS_ID,
                horse_id: HORSE_ID,
                owner_id: "owner-9",
                status: "entered",
            },
        ]);
        queueList([
            { entry_id: ENTRY_ID, class_id: CLASS_ID, place: 1, note: "Lovely." },
        ]);
        queueList([]); // callbacks — no championship ladder recorded
    }

    /** Queue the card-issuance reads that follow the records write
     *  (Phase F — same publish step, user client). */
    function mockCardIssuanceReads() {
        // issueQualificationCardsForShow's show load (3rd maybeSingle).
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { id: SHOW_ID, is_mhh_qualifying: true, show_year: 2026 },
            error: null,
        });
        queueList([{ id: DIVISION_ID }]);
        queueList([{ id: SECTION_ID }]);
        queueList([{ id: CLASS_ID, is_qualifying: true }]);
        queueList([
            {
                id: ENTRY_ID,
                class_id: CLASS_ID,
                horse_id: HORSE_ID,
                owner_id: "owner-9",
                status: "entered",
            },
        ]);
        queueList([{ entry_id: ENTRY_ID, class_id: CLASS_ID, place: 1 }]);
        queueList([]); // no cards issued yet
        queueList([]); // code collision check — all free
        // card insert + status update ride the default implicit resolve
    }

    it("writes trophy-case rows via the admin client, issues cards, then completes the show", async () => {
        mockPublishReads();
        mockCardIssuanceReads();
        mockAdmin._setImplicitResolve({ data: [], error: null }); // no existing rows; insert ok

        const result = await transitionShowStatus({ showId: SHOW_ID, to: "completed" });
        expect(result).toEqual({ success: true });

        expect(mockAdmin.from).toHaveBeenCalledWith("show_records");
        expect(mockAdmin._mockQuery.insert).toHaveBeenCalledWith([
            {
                horse_id: HORSE_ID,
                user_id: "owner-9",
                show_name: "July Photo Classic",
                show_date: "2026-07-08",
                division: "Halter",
                class_name: "OF Quarter Horse",
                placing: "1st",
                ribbon_color: "Blue",
                total_entries: 1,
                judge_critique: "Lovely.",
                verification_tier: "platform_generated",
            },
        ]);

        // The 1st place in the qualifying class minted a card — on the
        // USER client (RLS 118 was built for the publishing host).
        expect(mockClient.from).toHaveBeenCalledWith("qualification_cards");
        expect(mockClient._mockQuery.insert).toHaveBeenCalledWith([
            expect.objectContaining({
                show_id: SHOW_ID,
                class_id: CLASS_ID,
                horse_id: HORSE_ID,
                earned_place: 1,
                earned_by_owner_id: "owner-9",
                current_owner_id: "owner-9",
                status: "issued",
                show_year: 2026,
            }),
        ]);

        expect(mockClient._mockQuery.update).toHaveBeenCalledWith({ status: "completed" });
    });

    it("keeps the show in results_review when the record write fails", async () => {
        mockPublishReads();
        mockAdmin._setImplicitResolve({ data: null, error: { message: "boom" } });

        const result = await transitionShowStatus({ showId: SHOW_ID, to: "completed" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/results review/i);
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });

    it("keeps the show in results_review when card issuance fails", async () => {
        mockPublishReads();
        mockAdmin._setImplicitResolve({ data: [], error: null }); // records write succeeds
        // Card issuance's show load errors out.
        mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: { message: "cards read denied" },
        });

        const result = await transitionShowStatus({ showId: SHOW_ID, to: "completed" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toMatch(/qualification cards could not be issued/i);
            expect(result.error).toMatch(/results review/i);
        }
        expect(mockClient._mockQuery.update).not.toHaveBeenCalled();
    });
});
