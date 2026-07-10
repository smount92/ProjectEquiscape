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
            rulesMd: longText.nullable().optional(),
            feeInfo: longText.nullable().optional(),
            capacity: z.number().int().positive().max(10000).nullable().optional(),
            isMhhQualifying: z.boolean().optional(),
            sanctioningNote: shortText.nullable().optional(),
        })
        .refine((p) => Object.keys(p).length > 0, {
            message: "Nothing to update.",
        }),
});

export const transitionShowStatusSchema = z.object({
    showId: uuidSchema,
    to: showStatusSchema,
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

export const findUserByAliasSchema = z.object({
    alias: z.string().trim().min(1, "Enter an alias to look up.").max(60),
});

/** First zod issue as a user-facing error string. */
export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
