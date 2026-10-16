// PLACEHOLDER for Package A/C: replaced at merge
/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder signatures; the real module uses its arguments */
/**
 * Applying and deciding member suggestions (Package A builds it; signatures
 * from docs/design/registry-desk-phase1-plan.md §2). Throws until Package
 * A's file replaces this one.
 */
import "server-only";

import type { RegistryActor } from "@/lib/registry/types";

export type ApplyResult =
    | { ok: true; status: "applied" | "awaiting_second_look"; itemId?: string | null }
    | { ok: false; error: string };

const NOT_BUILT = "Placeholder: Package A's suggestionApply.ts replaces this file at merge.";

/** Puts an approved suggestion into the Registry; `edited` is the reviewer's copy of field_changes. */
export async function applySuggestion(
    _id: string,
    _opts: { reviewer: RegistryActor | null; edited?: Record<string, unknown> | null },
): Promise<ApplyResult> {
    throw new Error(NOT_BUILT);
}

/** Records the decision (status, decided_role) and tells the member, with the diff when edited. */
export async function decideSuggestion(
    _id: string,
    _opts: {
        reviewer: RegistryActor;
        decision: "approved" | "rejected";
        note?: string | null;
        edited?: Record<string, unknown> | null;
    },
): Promise<{ ok: true } | { ok: false; error: string }> {
    throw new Error(NOT_BUILT);
}
