/**
 * Show Ring v2 — zod input schemas for the showring server actions.
 * Kept OUT of the "use server" file (which may only export async
 * functions) so they are importable and directly unit-testable.
 * Mirrors src/lib/stable/schemas.ts.
 */

import { z } from "zod";
import {
    SHOWRING_FINISH_OPTIONS,
    SHOWRING_SORTS,
    SHOWRING_TRADE_OPTIONS,
} from "./filterParams";

/** The filterable dimensions of the Show Ring page query. */
export const showRingFiltersSchema = z.object({
    q: z.string().trim().max(100).optional(),
    finish: z.enum(SHOWRING_FINISH_OPTIONS).optional(),
    maker: z.string().trim().min(1).max(80).optional(),
    scale: z.string().trim().min(1).max(40).optional(),
    trade: z.enum(SHOWRING_TRADE_OPTIONS).optional(),
    sort: z.enum(SHOWRING_SORTS).default("newest"),
});

export const getShowRingPageSchema = showRingFiltersSchema.extend({
    offset: z.number().int().min(0).max(100_000).default(0),
    limit: z.number().int().min(1).max(24).default(24),
});

export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
