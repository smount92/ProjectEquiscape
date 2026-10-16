// PLACEHOLDER for Package A/C: replaced at merge
/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder signatures; the real module uses its arguments */
/**
 * The one Registry writer (Package A builds it; signatures from
 * docs/design/registry-desk-phase1-plan.md §2). Every function here throws
 * until Package A's file replaces this one, so nothing can write through it.
 */
import "server-only";

import type { ActionKind, ActionStatus, RegistryActor } from "@/lib/registry/types";

/** A catalog_items row as the writer reads and returns it. */
export interface CatalogRow {
    id: string;
    item_type: string;
    parent_id: string | null;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    artist: string | null;
    manufacturer: string | null;
    attributes: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

/** What points at a row; any count above zero means merge, never remove. */
export interface LinkCounts {
    horses: number;
    want_lists: number;
    children: number;
    id_suggestions: number;
    pending_suggestions: number;
    sale_reports: number;
    price_flags: number;
    set_pieces: number;
}

export type WriteFailure =
    | { ok: false; code: "conflict"; error: string; current: CatalogRow | null }
    | {
          ok: false;
          code: "refused" | "not_found" | "linked" | "limit" | "missing_migration" | "failed";
          error: string;
          counts?: LinkCounts;
      };

export type WriteResult<T extends object = object> = ({ ok: true } & T) | WriteFailure;

const NOT_BUILT = "Placeholder: Package A's write.ts replaces this file at merge.";

export function validateChanges(
    _row: CatalogRow,
    _changes: Record<string, unknown>,
): { ok: true; changes: Record<string, unknown> } | { ok: false; error: string } {
    throw new Error(NOT_BUILT);
}

export async function updateItem(
    _actor: RegistryActor,
    _input: {
        id: string;
        expectedUpdatedAt: string;
        changes: Record<string, unknown>;
        note?: string;
        suggestionId?: string;
        kind: ActionKind;
    },
): Promise<WriteResult<{ item: CatalogRow; actionId: string | null }>> {
    throw new Error(NOT_BUILT);
}

export async function insertItem(
    _actor: RegistryActor,
    _input: { payload: Record<string, unknown>; note?: string; suggestionId?: string },
): Promise<WriteResult<{ id: string }>> {
    throw new Error(NOT_BUILT);
}

export async function requestMerge(
    _actor: RegistryActor,
    _input: { keepId: string; removeId: string; note: string; suggestionId?: string },
): Promise<WriteResult<{ actionId: string; status: ActionStatus }>> {
    throw new Error(NOT_BUILT);
}

export async function confirmMerge(_actor: RegistryActor, _actionId: string): Promise<WriteResult> {
    throw new Error(NOT_BUILT);
}

export async function declineMerge(_actor: RegistryActor, _actionId: string, _note: string): Promise<WriteResult> {
    throw new Error(NOT_BUILT);
}

export async function removeItem(
    _actor: RegistryActor,
    _input: { id: string; reason: string },
): Promise<WriteResult<{ actionId: string }>> {
    throw new Error(NOT_BUILT);
}

export async function linkCounts(_id: string): Promise<LinkCounts> {
    throw new Error(NOT_BUILT);
}
