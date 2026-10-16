// PLACEHOLDER for Package A: replaced at merge
//
// The one Registry writer (docs/design/registry-desk-phase1-plan.md §2,
// Package A). This stand-in carries only the two exports Package C uses,
// with the plan's names, so Package C compiles and tests on its own. It
// writes nothing: validateChanges passes every value through unchanged,
// and undoAction refuses.
import "server-only";

import type { RegistryActor } from "@/lib/registry/types";

/** The row a change is checked against: a catalog_items row (real columns plus attributes). */
export interface WritableRow {
    id: string;
    item_type: string;
    title?: string | null;
    maker?: string | null;
    scale?: string | null;
    parent_id?: string | null;
    attributes?: Record<string, unknown> | null;
    [column: string]: unknown;
}

export type ValidateResult =
    | { ok: true; changes: Record<string, unknown> }
    | { ok: false; error: string; field?: string };

/** PLACEHOLDER for Package A: accepts every change as given. */
export function validateChanges(row: WritableRow, changes: Record<string, unknown>): ValidateResult {
    void row;
    return { ok: true, changes };
}

/** PLACEHOLDER for Package A: refuses until A's version is merged. */
export async function undoAction(
    actor: RegistryActor,
    actionId: string,
    reason: string,
): Promise<{ restored: number; drifted: number }> {
    void actor;
    void actionId;
    void reason;
    throw new Error("Undo opens once the Registry writer (Package A) is merged.");
}
