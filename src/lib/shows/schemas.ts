/**
 * Shows domain — zod input schemas for the shows-v2 server
 * actions. Kept OUT of the "use server" file (which may only
 * export async functions) so they are importable and directly
 * unit-testable.
 */

import { z } from "zod";

// ── Shared atoms ──

export const uuidSchema = z.uuid();

export const showModeSchema = z.enum(["live", "online"]);
export const showJudgingSchema = z.enum(["judged", "community_vote"]);
export const showStatusSchema = z.enum([
    "draft",
    "published",
    "entries_open",
    "entries_closed",
    "running",
    "judging",
    "results_review",
    "completed",
    "archived",
]);
export const classStatusSchema = z.enum([
    "scheduled",
    "called",
    "judging",
    "placed",
    "combined",
    "cancelled",
]);
export const divisionAxisSchema = z.enum([
    "halter",
    "performance",
    "workmanship",
    "collectibility",
    "other",
]);
/** Roles a host can grant. 'host' itself lives on shows.host_id and is not grantable. */
export const grantableStaffRoleSchema = z.enum(["co_host", "steward", "judge"]);

const title = z.string().trim().min(3, "Title must be at least 3 characters.").max(120);
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(20000);
const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();

// ── createShow / updateShowSettings ──

export const createShowSchema = z
    .object({
        title,
        mode: showModeSchema,
        judging: showJudgingSchema.default("judged"),
        venueName: shortText.optional(),
        venueAddress: z.string().trim().max(500).optional(),
        showDate: isoDate.optional(),
        entriesOpenAt: isoDateTime.optional(),
        entriesCloseAt: isoDateTime.optional(),
        judgingEndsAt: isoDateTime.optional(),
        aboutMd: longText.optional(),
        rulesMd: longText.optional(),
        feeInfo: longText.optional(),
        capacity: z.number().int().positive().max(10000).optional(),
        isMhhQualifying: z.boolean().default(true),
        sanctioningNote: shortText.optional(),
    })
    .refine(
        (v) =>
            !v.entriesOpenAt ||
            !v.entriesCloseAt ||
            new Date(v.entriesOpenAt) < new Date(v.entriesCloseAt),
        { message: "Entries must open before they close." },
    );

export const updateShowSettingsSchema = z.object({
    showId: uuidSchema,
    patch: z
        .object({
            title: title.optional(),
            // Mode changes are only legal while the show is a draft —
            // enforced in the action against the loaded show.
            mode: showModeSchema.optional(),
            judging: showJudgingSchema.optional(),
            venueName: shortText.nullable().optional(),
            venueAddress: z.string().trim().max(500).nullable().optional(),
            showDate: isoDate.nullable().optional(),
            entriesOpenAt: isoDateTime.nullable().optional(),
            entriesCloseAt: isoDateTime.nullable().optional(),
            judgingEndsAt: isoDateTime.nullable().optional(),
            aboutMd: longText.nullable().optional(),
            rulesMd: longText.nullable().optional(),
            feeInfo: longText.nullable().optional(),
            capacity: z.number().int().positive().max(10000).nullable().optional(),
            isMhhQualifying: z.boolean().optional(),
            sanctioningNote: shortText.nullable().optional(),
            /** Blind entry gallery during judging (119; default ON). */
            blindBrowsing: z.boolean().optional(),
        })
        .refine((p) => Object.keys(p).length > 0, {
            message: "Nothing to update.",
        })
        // When a patch carries BOTH dates, the window must be ordered.
        // A patch carrying only one is checked in the action against
        // the stored other half (the schema can't see the DB).
        .refine(
            (p) =>
                !p.entriesOpenAt ||
                !p.entriesCloseAt ||
                new Date(p.entriesOpenAt) < new Date(p.entriesCloseAt),
            { message: "Entries must open before they close." },
        ),
});

export const transitionShowStatusSchema = z.object({
    showId: uuidSchema,
    to: showStatusSchema,
});

export const deleteShowSchema = z.object({
    showId: uuidSchema,
});

export const setFeePaidSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
    paid: z.boolean(),
});

// ── Classlist structure ──

export const addDivisionSchema = z.object({
    showId: uuidSchema,
    name: z.string().trim().min(1, "Division name is required.").max(120),
    axis: divisionAxisSchema.default("other"),
    sortOrder: z.number().int().min(0).optional(),
});

export const addSectionSchema = z.object({
    divisionId: uuidSchema,
    name: z.string().trim().min(1, "Section name is required.").max(120),
    sortOrder: z.number().int().min(0).optional(),
});

export const updateDivisionSchema = z.object({
    divisionId: uuidSchema,
    name: z.string().trim().min(1, "Division name is required.").max(120),
});

export const updateSectionSchema = z.object({
    sectionId: uuidSchema,
    name: z.string().trim().min(1, "Section name is required.").max(120),
});

const classFields = {
    name: z.string().trim().min(1, "Class name is required.").max(120),
    classNumber: z.string().trim().max(20).optional(),
    maxPerEntrant: z.number().int().positive().max(100).nullable().optional(),
    allowedScales: z.array(z.string().trim().min(1)).max(30).nullable().optional(),
    allowedFinishes: z.array(z.string().trim().min(1)).max(30).nullable().optional(),
    isQualifying: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
};

export const addClassSchema = z.object({
    sectionId: uuidSchema,
    ...classFields,
});

export const updateClassSchema = z.object({
    classId: uuidSchema,
    patch: z
        .object({
            ...classFields,
            name: classFields.name.optional(),
            status: classStatusSchema.optional(),
        })
        .refine((p) => Object.keys(p).length > 0, {
            message: "Nothing to update.",
        }),
});

export const reorderClasslistSchema = z.object({
    showId: uuidSchema,
    kind: z.enum(["division", "section", "class"]),
    items: z
        .array(z.object({ id: uuidSchema, sortOrder: z.number().int().min(0) }))
        .min(1, "Nothing to reorder.")
        .max(500),
});

// ── Split / combine ──

export const splitClassSchema = z.object({
    classId: uuidSchema,
    newClassName: z.string().trim().min(1, "New class name is required.").max(120),
    newClassNumber: z.string().trim().max(20).optional(),
    /** Entries that MOVE to the new class; the rest stay. */
    entryIdsToMove: z.array(uuidSchema).min(1, "Select at least one entry to move.").max(500),
});

export const combineClassesSchema = z.object({
    classIds: z
        .array(uuidSchema)
        .min(2, "Combining requires at least two classes.")
        .max(20)
        .refine((ids) => new Set(ids).size === ids.length, {
            message: "Duplicate class in combine list.",
        }),
    newClassName: z.string().trim().min(1, "New class name is required.").max(120),
    newClassNumber: z.string().trim().max(20).optional(),
});

// ── Template ──

export const loadTemplateSchema = z.object({
    showId: uuidSchema,
    templateKey: z.string().trim().min(1).default("namhsa_core"),
});

// ── Staff ──

export const addShowStaffSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
    role: grantableStaffRoleSchema,
    coiFlag: z.boolean().default(false),
    coiNote: shortText.optional(),
});

export const removeShowStaffSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
});

// ── Console reads ──

export const getShowConsoleSchema = z.object({
    showId: uuidSchema,
});

// ── Public + entrant flow (Phase D) ──

export const getPublicShowSchema = z.object({
    showId: uuidSchema,
});

export const getMyShowEntriesSchema = z.object({
    showId: uuidSchema,
});

export const enterClassSchema = z.object({
    classId: uuidSchema,
    horseId: uuidSchema,
    /** Online shows: the judged photo (horse_images.id). */
    photoId: uuidSchema.nullable().optional(),
    /** Proxy showing: someone else handles this horse. */
    handlerId: uuidSchema.nullable().optional(),
});

export const scratchEntrySchema = z.object({
    entryId: uuidSchema,
    /** Optional short reason — surfaced to the owner when staff scratch. */
    reason: z.string().trim().max(200, "Keep the reason under 200 characters.").optional(),
});

/** Host/co-host broadcast to every current entrant (Batch 2). */
export const announceToEntrantsSchema = z.object({
    showId: uuidSchema,
    message: z
        .string()
        .trim()
        .min(1, "The announcement can't be empty.")
        .max(1000, "Announcements are capped at 1000 characters."),
});

export const findUserByAliasSchema = z.object({
    alias: z.string().trim().min(1, "Enter an alias to look up.").max(60),
});

// ── Online judging (Phase E1) ──

export const getShowGallerySchema = z.object({
    showId: uuidSchema,
});

export const castVoteSchema = z.object({
    entryId: uuidSchema,
});

export const removeVoteSchema = z.object({
    entryId: uuidSchema,
});

export const finalizeCommunityVotesSchema = z.object({
    showId: uuidSchema,
});

export const getJudgeQueueSchema = z.object({
    showId: uuidSchema,
});

/** Whole-class batch: the judge's full slate for one class.
 *  An empty slate is legal (clears recorded placings). */
export const recordPlacingsSchema = z.object({
    classId: uuidSchema,
    placings: z
        .array(
            z.object({
                entryId: uuidSchema,
                place: z.number().int().min(1).max(6),
                /** Optional per-entry critique (the MEPSA tradition). */
                note: z.string().trim().max(2000).optional(),
            }),
        )
        .max(6)
        .refine(
            (rows) => new Set(rows.map((r) => r.place)).size === rows.length,
            { message: "Each place can only be assigned once." },
        )
        .refine(
            (rows) => new Set(rows.map((r) => r.entryId)).size === rows.length,
            { message: "An entry can only take one place." },
        ),
    /**
     * Placing notes for EVERY entry the judge wrote one on — placed or
     * not. Unplaced entries' notes persist as participation rows
     * (place NULL, the 117 vocabulary): a judge notes each horse as
     * she evaluates, BEFORE ribbons exist, and those notes used to
     * evaporate because the slate only carried the pinned six.
     */
    notes: z.record(z.string(), z.string().trim().max(2000)).optional(),
    /** Also mark the class 'placed' (the per-class done tick). */
    markDone: z.boolean().default(false),
});

// ── Live ring console + callbacks (Phase E2) ──

export const getRingConsoleSchema = z.object({
    showId: uuidSchema,
});

export const getRingBoardSchema = z.object({
    showId: uuidSchema,
});

export const getShowChampionsSchema = z.object({
    showId: uuidSchema,
});

export const callbackScopeSchema = z.enum(["section", "division", "show"]);

/**
 * One callback round's pick. scopeId is the section/division id
 * and must be absent exactly when scope='show' (mirrors the 117
 * CHECK + trigger). Champion is required; reserve optional but
 * never the same entry.
 */
export const recordCallbackSchema = z
    .object({
        showId: uuidSchema,
        scope: callbackScopeSchema,
        scopeId: uuidSchema.nullable().optional(),
        championEntryId: uuidSchema,
        reserveEntryId: uuidSchema.nullable().optional(),
    })
    .refine((v) => (v.scope === "show" ? !v.scopeId : !!v.scopeId), {
        message:
            "Section and division callbacks need their section/division id; the show callback must not have one.",
    })
    .refine((v) => !v.reserveEntryId || v.reserveEntryId !== v.championEntryId, {
        message: "Champion and reserve must be different entries.",
    });

// ══════════════════════════════════════════════════════════════
// V4 — safety-native showing + the class room (migration 148)
// ══════════════════════════════════════════════════════════════

export const barEntrantSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
    reason: z.string().trim().max(500).optional(),
    /** Also staff-scratch every live entry the user has at this show. */
    scratchEntries: z.boolean().default(true),
});

/**
 * Remove-and-bar in one motion (the sloptrough fix). No `scratchEntries`
 * switch: removal is the whole point, and the reason is optional because
 * it is host bookkeeping — it never reaches the removed member.
 */
export const removeEntrantFromShowSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
    reason: z.string().trim().max(500).optional(),
});

export const liftBarSchema = z.object({
    showId: uuidSchema,
    userId: uuidSchema,
});

export const listBarredEntrantsSchema = z.object({
    showId: uuidSchema,
});

export const voidCardSchema = z.object({
    code: z
        .string()
        .regex(/^[A-HJ-NP-Za-km-z2-9]{8}$/, "That is not a valid card code."),
    reason: z.string().trim().min(3, "Give a short reason — it lands on the card's audit trail.").max(500),
});

export const strikeEntrySchema = z.object({
    entryId: uuidSchema,
    reason: z.string().trim().min(3, "Give a short reason — it lands on the entry's audit trail.").max(500),
});

export const writeCritiqueSchema = z
    .object({
        entryId: uuidSchema,
        /** Feedback about the MODEL (conformation, breed fit, condition). */
        critique: z.string().trim().max(2000).nullable().optional(),
        /** Feedback about the PHOTO (angle, light, footing) — kept separate
         * so photography skill never masquerades as model faults. */
        photoCritique: z.string().trim().max(2000).nullable().optional(),
    })
    .refine((v) => (v.critique ?? "") !== "" || (v.photoCritique ?? "") !== "", {
        message: "Write at least one of the two critique fields.",
    });

export const publishClassResultsSchema = z.object({
    classId: uuidSchema,
});

/** Staff undo for an accidental scratch — the mirror of scratchEntry. */
export const restoreEntrySchema = z.object({
    entryId: uuidSchema,
});

/** Scored judging (205): pick a rubric template for a class, or clear it. */
export const setClassRubricSchema = z.object({
    classId: uuidSchema,
    /** A template key from RUBRIC_TEMPLATES, or null to return the class to plain tray judging. */
    templateKey: z.string().trim().min(2).max(40).nullable(),
});

/** Scored judging (205): the judge's sheet for one entry. */
export const writeEntryScoreSchema = z.object({
    entryId: uuidSchema,
    /** {criterionKey: 1..10} — keys outside the class rubric are dropped server-side. */
    scores: z.record(z.string().max(40), z.number().int().min(1).max(10)),
});

export const unpublishClassResultsSchema = z.object({
    classId: uuidSchema,
});

export const documentKindSchema = z.enum([
    "breed",
    "performance",
    "collectibility",
    "other",
]);

export const createHorseDocumentSchema = z.object({
    horseId: uuidSchema,
    kind: documentKindSchema.default("breed"),
    title: z.string().trim().min(1, "Give the document a title.").max(120),
    bodyMd: z.string().trim().min(1, "Write the documentation body.").max(4000),
});

export const updateHorseDocumentSchema = z.object({
    documentId: uuidSchema,
    kind: documentKindSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    bodyMd: z.string().trim().min(1).max(4000).optional(),
});

export const deleteHorseDocumentSchema = z.object({
    documentId: uuidSchema,
});

export const attachDocumentToEntrySchema = z.object({
    entryId: uuidSchema,
    /** null detaches. */
    documentId: uuidSchema.nullable(),
});

/** First zod issue as a user-facing error string. */
export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
