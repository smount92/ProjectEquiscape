/**
 * Groups forum — zod input schemas for the groups-forum server
 * actions. Kept OUT of the "use server" file (which may only
 * export async functions) so they are importable and directly
 * unit-testable. Mirrors src/lib/shows/schemas.ts.
 */

import { z } from "zod";

export const uuidSchema = z.uuid();

const threadTitle = z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer.");

/** Forum replies get room to breathe — the old 500-char cap dies here. */
const threadContent = z
    .string()
    .trim()
    .min(1, "Content cannot be empty.")
    .max(2000, "Content is too long (2000 char max).");

export const getGroupBoardSchema = z.object({
    groupId: uuidSchema,
    channelId: uuidSchema.optional(),
    offset: z.number().int().min(0).default(0),
});

export const getThreadSchema = z.object({
    postId: uuidSchema,
    repliesOffset: z.number().int().min(0).default(0),
});

export const createThreadSchema = z.object({
    groupId: uuidSchema,
    channelId: uuidSchema.optional(),
    title: threadTitle,
    content: threadContent,
});

export const replyToThreadSchema = z.object({
    postId: uuidSchema,
    content: threadContent,
});

export const markGroupReadSchema = z.object({
    groupId: uuidSchema,
});

export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
