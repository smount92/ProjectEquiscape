/**
 * External shows (calendar of record) — zod input schemas for the
 * server actions in src/app/actions/external-shows.ts. Kept OUT of
 * the "use server" file (which may only export async functions) so
 * they are importable and directly unit-testable — same convention
 * as src/lib/shows/schemas.ts.
 */

import { z } from "zod";

export const externalVenueTypeSchema = z.enum(["online_photo", "live", "mail_in"]);
export const externalPlatformSchema = z.enum([
    "facebook",
    "omhps",
    "mepsa",
    "website",
    "other",
]);

export type ExternalVenueType = z.infer<typeof externalVenueTypeSchema>;
export type ExternalPlatform = z.infer<typeof externalPlatformSchema>;

const isoDate = z.iso.date();

/**
 * The submission floor: yesterday (UTC). A show dated today must
 * submit fine from every timezone, so we allow one day of grace —
 * "starts_on ≥ today − 1".
 */
export function earliestAllowedStart(now: Date = new Date()): string {
    const floor = new Date(now);
    floor.setUTCHours(0, 0, 0, 0);
    floor.setUTCDate(floor.getUTCDate() - 1);
    return floor.toISOString().slice(0, 10);
}

/**
 * Outbound show link. z.url() alone accepts ANY scheme (javascript:,
 * data:, ftp:) — the explicit http/https pin is the security
 * boundary here; the migration's CHECK and the page's
 * rel="noopener nofollow" back it up.
 */
const httpUrl = z
    .url()
    .trim()
    .max(2000, "Link must be under 2000 characters.")
    .refine((u) => /^https?:\/\//i.test(u), {
        message: "Link must start with http:// or https://.",
    });

export const submitExternalShowSchema = z
    .object({
        title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
        url: httpUrl,
        venueType: externalVenueTypeSchema,
        hostName: z.string().trim().min(2, "Host name must be at least 2 characters.").max(80),
        platform: externalPlatformSchema,
        startsOn: isoDate.refine((d) => d >= earliestAllowedStart(), {
            message: "The show date can't be in the past.",
        }),
        entriesCloseOn: isoDate.optional(),
        location: z.string().trim().max(160).optional(),
        description: z.string().trim().max(500, "Description must be 500 characters or fewer.").optional(),
    })
    // ISO dates (YYYY-MM-DD) compare correctly as strings.
    .refine((v) => !v.entriesCloseOn || v.entriesCloseOn <= v.startsOn, {
        message: "Entries must close on or before the show date.",
    });

export type SubmitExternalShowInput = z.input<typeof submitExternalShowSchema>;

export const reviewExternalShowSchema = z.object({
    id: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).optional(),
});

export type ReviewExternalShowInput = z.input<typeof reviewExternalShowSchema>;

export function firstZodError(error: z.ZodError): string {
    return error.issues[0]?.message ?? "Invalid input.";
}
