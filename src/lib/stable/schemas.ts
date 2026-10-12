/**
 * Digital Stable v2 — zod input schemas for the stable server actions.
 * Kept OUT of the "use server" file (which may only export async
 * functions) so they are importable and directly unit-testable.
 * Mirrors src/lib/shows/schemas.ts and src/lib/groups/schemas.ts.
 */

import { z } from "zod";
import {
    CATEGORY_OPTIONS,
    DEFAULT_STABLE_PER,
    FINISH_OPTIONS,
    MAX_STABLE_PAGE,
    STABLE_SORTS,
    TRADE_OPTIONS,
} from "./filterParams";

export const uuidSchema = z.uuid();

/** The filterable dimensions of the stable page query. */
export const stableFiltersSchema = z.object({
    q: z.string().trim().max(100).optional(),
    finish: z.enum(FINISH_OPTIONS).optional(),
    maker: z.string().trim().min(1).max(80).optional(),
    scale: z.string().trim().min(1).max(40).optional(),
    category: z.enum(CATEGORY_OPTIONS).optional(),
    trade: z.enum(TRADE_OPTIONS).optional(),
    collection: uuidSchema.optional(),
    /** A mold's catalog id: every horse on it, whichever release it is linked to. */
    mold: uuidSchema.optional(),
    hasRecords: z.boolean().optional(),
    unlinked: z.boolean().optional(),
    sort: z.enum(STABLE_SORTS).default("newest"),
});

/**
 * One page of the stable. Paging is by page number (1-based) and page
 * size, the same shape the URL carries; the server computes the offset
 * and clamps a page past the end to the last page.
 */
export const getStablePageSchema = stableFiltersSchema.extend({
    page: z.number().int().min(1).max(MAX_STABLE_PAGE).default(1),
    /** 192 is the cap — the largest page-size option the controls offer. */
    per: z.number().int().min(1).max(192).default(DEFAULT_STABLE_PER),
});

export const getMatchingHorseIdsSchema = stableFiltersSchema;

// ── Saved views ──

const savedViewName = z
    .string()
    .trim()
    .min(1, "Give the view a name.")
    .max(60, "View names max out at 60 characters.");

/**
 * Stored view params: the URL-param form of the filters. Only known
 * string keys survive; anything else is rejected so arbitrary JSON
 * can't be smuggled into the JSONB column.
 */
export const savedViewParamsSchema = z
    .object({
        q: z.string().max(100).optional(),
        finish: z.string().max(40).optional(),
        maker: z.string().max(80).optional(),
        scale: z.string().max(40).optional(),
        category: z.string().max(40).optional(),
        trade: z.string().max(40).optional(),
        collection: z.string().max(40).optional(),
        mold: z.string().max(40).optional(),
        records: z.string().max(4).optional(),
        unlinked: z.string().max(4).optional(),
        sort: z.string().max(20).optional(),
        /** Page size travels with a view; the page number never does. */
        per: z.string().max(4).optional(),
    })
    .strict();

export const saveStableViewSchema = z.object({
    name: savedViewName,
    params: savedViewParamsSchema,
});

export const deleteStableViewSchema = z.object({
    id: uuidSchema,
});

export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
