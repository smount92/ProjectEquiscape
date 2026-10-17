import "server-only";

/**
 * THE ONLY WRITER of `catalog_items` and `catalog_changelog`.
 *
 * Suggestions (approved or auto-applied), the owner's admin console, the
 * Registry Desk and its undo all write the Registry through these
 * functions, so every write passes the same checks, lands in the history
 * with a name and a role, clears the reference-page cache, and counts
 * toward the moderator's limits. src/__tests__/registry-single-writer.test.ts
 * fails if any other file in src/ writes either table.
 *
 * Every function uses the service-role client: catalog_items has no
 * member write policy, by design. Callers have already checked who the
 * actor is (requireRegistryModerator, the owner's verifyAdmin, or the
 * suggestion pipeline's own rules).
 *
 * Feature detection (docs/design/registry-desk-phase1-plan.md §1):
 * - before 242, history rows are skipped and changelog rows are written
 *   without actor_role / action_id;
 * - before 243, the owner's merge is the old one-way merge (legacyMerge),
 *   and moderators are told merging and removing open with update 243.
 */

import { revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CACHE_TAGS } from "@/lib/cache/tags";
import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";
import {
    CATALOG_REAL_COLUMNS,
    canonicalVocabulary,
    fieldValueProblem,
    normalizeFactValue,
} from "@/lib/catalog/corrections";
import * as editableFields from "@/lib/catalog/editableFields";
import { CATALOG_CATEGORIES, isCatalogGender, normalizeCatalogBreed, normalizeRunCount } from "@/lib/catalog/taxonomy";
import { mentionsMold, rosterPrefilterWords, setLabel, stripGeneration } from "@/lib/linker/model";
import { alertOwner } from "@/lib/registry/alerts";
import { checkRegistryLimit, noteRegistryAction } from "@/lib/registry/limits";
import type { ActionKind, ActionStatus, RegistryActor } from "@/lib/registry/types";

// ══════════════════════════════════════════════════════════════
// Shapes
// ══════════════════════════════════════════════════════════════

/** One Registry row, as every writer reads it. */
export interface CatalogRow {
    id: string;
    item_type: string;
    parent_id: string | null;
    title: string;
    maker: string;
    maker_slug: string | null;
    slug: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
    artist: string | null;
    manufacturer: string | null;
    created_at: string;
    updated_at: string;
}

/** The columns of CatalogRow, for a select. */
export const CATALOG_ROW_COLUMNS =
    "id, item_type, parent_id, title, maker, maker_slug, slug, scale, attributes, artist, manufacturer, created_at, updated_at";

export type WriteErrorCode =
    | "invalid"
    | "conflict"
    | "not_found"
    | "forbidden"
    | "limit"
    | "linked"
    | "not_ready"
    | "failed"
    /** The member changed the suggestion while the reviewer was looking at it. */
    | "changed";

/** A value a suggested addition carried that the Registry did not keep, and why. */
export interface DroppedValue {
    key: string;
    /** The field's name, as people read it. */
    label: string;
    /** What was sent, as text. */
    value: string;
    error: string;
}

/** A refused write. `error` is a sentence a person can read; the extras help the screen. */
export interface WriteFailure {
    success: false;
    error: string;
    code: WriteErrorCode;
    /** The field a refused value belongs to. */
    field?: string;
    /** On a conflict: the row as it is now. */
    current?: CatalogRow;
    /** On a refused removal: what points at the row. */
    counts?: LinkCounts;
    /** Fields left alone because they changed since. */
    drifted?: string[];
}

/** Every writer returns this: an ActionResult a server action can pass straight on. */
export type WriteResult<T extends object = object> = ({ success: true } & T) | WriteFailure;

/** What points at a row. A removal needs every count at 0. */
export interface LinkCounts {
    horses: number;
    wishlists: number;
    children: number;
    id_suggestions: number;
    pending_suggestions: number;
    sale_reports: number;
    price_flags: number;
    /** A mold: set rows on other molds whose roster names it. */
    set_mentions: number;
    /** A set piece: the other pieces of the same set. */
    set_siblings: number;
    total: number;
}

/** What moderators read before update 243 is pasted. */
export const MERGE_REMOVE_NOT_READY = "Merging and removing open once the owner adds update 243.";

const GENERIC_REFUSAL = "The Registry refused the change. Please try again.";

// ══════════════════════════════════════════════════════════════
// Plumbing
// ══════════════════════════════════════════════════════════════

/** Service role: catalog_items has no member write policy (see the header). */
function db(): SupabaseClient {
    return getAdminClient() as unknown as SupabaseClient;
}

type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

/** A table, column or function the database does not have yet (an unpasted migration). */
export function isMissingSchema(error: DbError): boolean {
    const code = error?.code ?? "";
    return ["42P01", "PGRST205", "PGRST202", "42883", "42703", "PGRST204"].includes(code);
}

function fail(code: WriteErrorCode, error: string, extra: Partial<WriteFailure> = {}): WriteFailure {
    return { success: false, error, code, ...extra };
}

/** A database refusal, in words. The real error is logged for us. */
function dbFailure(context: string, error: DbError): WriteFailure {
    logger.error("RegistryWrite", context, error);
    const code = error?.code;
    if (code === "23514")
        return fail("invalid", "A value is not in the Registry's lists (scale, run type or material).");
    if (code === "23505") return fail("invalid", "An entry at that page address already exists.");
    if (code === "23503") return fail("linked", "Something still points at that entry, so it can't change that way.");
    return fail("failed", GENERIC_REFUSAL);
}

/** Codes our database functions raise, with their words in DETAIL. */
const RPC_CODES = new Set([
    "same",
    "missing",
    "keep_is_child",
    "mixed",
    "mismatch",
    "not_waiting",
    "already_applied",
    "exists",
    "not_found",
    "not_merge",
    "already_undone",
    "not_applied",
    "too_late",
    "reason",
    "not_removed",
    "already_restored",
]);

function rpcFailure(context: string, error: DbError): WriteFailure {
    const message = error?.message ?? "";
    if (RPC_CODES.has(message) && error?.details) {
        const code: WriteErrorCode = message === "missing" || message === "not_found" ? "not_found" : "invalid";
        return fail(code, error.details);
    }
    return dbFailure(context, error);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readRow(id: string): Promise<CatalogRow | null> {
    if (!UUID_RE.test(id)) return null;
    const { data } = await db().from("catalog_items").select(CATALOG_ROW_COLUMNS).eq("id", id).maybeSingle();
    return (data as CatalogRow | null) ?? null;
}

/** Is update 243 in? One cheap probe. */
async function mergeUndoReady(): Promise<boolean> {
    const { error } = await db().from("catalog_removed_items").select("id").limit(1);
    return !error || !isMissingSchema(error);
}

/**
 * Is update 243 in (the archive table that makes merges and removals
 * undoable)? For the Desk: show Merge, Remove and Undo only when true.
 */
export async function undoReady(): Promise<boolean> {
    return mergeUndoReady();
}

/** JSON with its keys sorted, so two copies of the same object compare equal. */
function stable(v: unknown): string {
    return JSON.stringify(v ?? null, (_k, value: unknown) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
            : value,
    );
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Same as `same`, exported for the suggestion pipeline's "did the member change it?" check. */
export function sameValue(a: unknown, b: unknown): boolean {
    return same(a, b);
}

function quote(v: unknown): string {
    if (v === null || v === undefined || v === "") return "(empty)";
    return typeof v === "string" ? v : JSON.stringify(v);
}

// ══════════════════════════════════════════════════════════════
// Checks (pure)
// ══════════════════════════════════════════════════════════════

/** Columns nobody edits by hand: the database keeps them. */
const READ_ONLY = new Set([
    "id",
    "slug",
    "maker_slug",
    "created_at",
    "updated_at",
    "sort_key",
    "search_key",
    "attributes",
]);

/** Prose fields that may run long. */
const LONG_TEXT = new Set(["registry_notes", "documentation_notes"]);

/**
 * Attribute keys the Registry keeps, beyond those already on a row. The
 * member form's fields, the import plumbing, the Desk's fields (read from
 * editableFields when that list exists) and keys the live data carries.
 */
const EXTRA_ATTRIBUTE_KEYS = [
    "set_name",
    "run_detail",
    "mold_name",
    "sculptor",
    "cast_medium",
    "edition_size",
    "finish",
    "finish_type",
    "discipline",
    "species",
    "dimensions",
    "base_dimensions",
    "working_parts",
    "tack_type",
    "prop_category",
    "terrain_setting",
    "scene_theme",
    "coa",
    "components",
    "fits_molds",
    "documentation_notes",
    "materials",
    "auction_sale_price",
];

export function knownAttributeKeys(): Set<string> {
    const keys = new Set<string>(EXTRA_ATTRIBUTE_KEYS);
    for (const f of editableFields.CATALOG_EDITABLE_FIELDS) if (!CATALOG_REAL_COLUMNS.has(f.key)) keys.add(f.key);
    for (const k of editableFields.HIDDEN_ATTRIBUTES) keys.add(k);
    // The Desk's own field list (Package B) is picked up when it exists.
    const desk = (editableFields as unknown as Record<string, unknown>).DESK_FIELDS;
    if (Array.isArray(desk)) {
        for (const f of desk as { key?: unknown }[])
            if (typeof f?.key === "string" && !CATALOG_REAL_COLUMNS.has(f.key)) keys.add(f.key);
    }
    return keys;
}

const CATEGORY_VALUES = new Set<string>(CATALOG_CATEGORIES.map((c) => c.value));

/**
 * Attribute keys that hold a list of words (a diorama's components, what a
 * piece of tack fits, the materials and working parts the asset form
 * offers as chips), plus any field the Desk's registry marks as a list.
 * Only these may hold an array; every other value is text.
 */
const BASE_LIST_KEYS = ["components", "fits_molds", "materials", "working_parts"];

export function listAttributeKeys(): Set<string> {
    const keys = new Set(BASE_LIST_KEYS);
    const desk = (editableFields as unknown as Record<string, unknown>).DESK_FIELDS;
    if (Array.isArray(desk)) {
        for (const f of desk as { key?: unknown; kind?: unknown }[])
            if (typeof f?.key === "string" && f.kind === "list") keys.add(f.key);
    }
    return keys;
}

/** Keys that would reach an object's prototype, never a Registry field. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const own = (o: object, k: string) => Object.hasOwn(o, k);

export interface ValidateContext {
    /**
     * The mold the row will be filed under after the change (its current
     * mold when parent_id is not changing). null = that id names no row;
     * undefined = not looked up.
     */
    parent?: { id: string; item_type: string; scale: string | null; title?: string | null } | null;
    /** How many rows are filed under this one (needed to change a mold's type). */
    childCount?: number;
}

export type Validation =
    | {
          ok: true;
          /** Real-column updates. */
          columns: Record<string, unknown>;
          /** The whole new attributes object, or null when no attribute changed. */
          attributes: Record<string, unknown> | null;
          /** Touched columns and attribute keys, before and after (null = empty). */
          before: Record<string, unknown>;
          after: Record<string, unknown>;
          touched: string[];
          /** Lenient mode only: attribute values dropped, with why. */
          dropped: DroppedValue[];
      }
    | { ok: false; field: string; error: string };

/** A value as people read it in a "dropped" list. */
function asText(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try {
        return JSON.stringify(v).slice(0, 200);
    } catch {
        return "(a value that can't be shown)";
    }
}

/**
 * Check and tidy a set of changes to one row (or a new row, when `row` is
 * null). `changes` maps a column or attribute key to its new value; an
 * empty value clears the field (an attribute key is deleted). Values are
 * tidied by normalizeFactValue, then judged by the Registry's rules in
 * words (fieldValueProblem, the vocabulary lists, parseYearRange). Pure:
 * pass the parent mold in `ctx` to check a re-file.
 *
 * `lenient`: an attribute value that fails is dropped instead of refusing
 * the whole write (the suggestion pipeline's long-standing rule for new
 * entries: a bad value costs its own field, never the approval).
 */
export function validateChanges(
    row: CatalogRow | null,
    changes: Record<string, unknown>,
    ctx: ValidateContext = {},
    opts: { lenient?: boolean } = {},
): Validation {
    const attrsNow: Record<string, unknown> = { ...(row?.attributes ?? {}) };
    const attrsNext: Record<string, unknown> = { ...attrsNow };
    const columns: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const touched: string[] = [];
    const dropped: DroppedValue[] = [];
    const known = knownAttributeKeys();
    const lists = listAttributeKeys();
    let attributesChanged = false;

    const isEmpty = (v: unknown) =>
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
    const drop = (key: string, raw: unknown, error: string) =>
        dropped.push({ key, label: labelOf(key), value: asText(raw), error });

    for (const [key, raw] of Object.entries(changes ?? {})) {
        if (UNSAFE_KEYS.has(key)) {
            const error = `"${key}" is not a field the Registry keeps.`;
            if (opts.lenient) {
                drop(key, raw, error);
                continue;
            }
            return { ok: false, field: key, error };
        }
        if (READ_ONLY.has(key))
            return { ok: false, field: key, error: `${labelOf(key)} is kept by the Registry itself.` };

        if (CATALOG_REAL_COLUMNS.has(key)) {
            const current = row ? ((row as unknown as Record<string, unknown>)[key] ?? null) : null;
            // Columns hold text (or nothing): a number is read as its text;
            // a list or an object is never a name, a scale or a mold.
            if (raw !== null && typeof raw === "object")
                return { ok: false, field: key, error: `${labelOf(key)} takes plain text, not a list.` };
            const result = checkColumn(key, raw, isEmpty(raw), row, ctx);
            if (!result.ok) return { ok: false, field: key, error: result.error };
            if (row && same(current, result.value)) continue;
            if (!row && result.value === null) continue;
            columns[key] = result.value;
            before[key] = current;
            after[key] = result.value;
            touched.push(key);
            continue;
        }

        // An attribute. Object.hasOwn, not `in`: "constructor" and
        // "toString" are on every object's prototype, never on a row.
        if (!own(attrsNow, key) && !known.has(key)) {
            const error = `"${key}" is not a field the Registry keeps.`;
            if (opts.lenient) {
                drop(key, raw, error);
                continue;
            }
            return { ok: false, field: key, error };
        }
        if (isEmpty(raw)) {
            if (own(attrsNow, key)) {
                delete attrsNext[key];
                before[key] = attrsNow[key] ?? null;
                after[key] = null;
                touched.push(key);
                attributesChanged = true;
            }
            continue;
        }
        const result = lists.has(key) ? checkList(key, raw) : checkAttribute(key, raw);
        if (!result.ok) {
            if (opts.lenient) {
                drop(key, raw, result.error);
                continue;
            }
            return { ok: false, field: key, error: result.error };
        }
        if (own(attrsNow, key) && same(attrsNow[key], result.value)) continue;
        attrsNext[key] = result.value;
        before[key] = own(attrsNow, key) ? (attrsNow[key] ?? null) : null;
        after[key] = result.value;
        touched.push(key);
        attributesChanged = true;
    }

    // ── Rules across fields ──
    const nextType = (columns.item_type as string | undefined) ?? row?.item_type;
    if (!row) {
        if (isEmpty(columns.title)) return { ok: false, field: "title", error: "A new entry needs a name." };
        if (isEmpty(columns.maker)) return { ok: false, field: "maker", error: "A new entry needs a maker." };
        if (!nextType) return { ok: false, field: "item_type", error: "A new entry needs a type." };
    }

    const nextParent = "parent_id" in columns ? (columns.parent_id as string | null) : (row?.parent_id ?? null);
    // Judged only when the filing or the type changes, so an older row
    // that breaks the rule can still have its other fields corrected.
    if (nextParent && nextType === "plastic_mold" && ("parent_id" in columns || "item_type" in columns))
        return { ok: false, field: "parent_id", error: "A mold isn't filed under another mold." };

    // Scale follows the mold.
    if (nextParent && ctx.parent && ctx.parent.scale) {
        const moldScale = ctx.parent.scale;
        const refiled = "parent_id" in columns;
        const asked = "scale" in columns ? columns.scale : undefined;
        if (asked !== undefined && asked !== moldScale) {
            const mold = ctx.parent.title ? `"${ctx.parent.title}"` : "its mold";
            const wanted = asked ? String(asked) : "no scale";
            return {
                ok: false,
                field: "scale",
                error: refiled
                    ? `A release takes its mold's scale. ${mold} is ${moldScale}, so this release would be ${moldScale} too.`
                    : `This release is filed under ${mold}, which is ${moldScale}, and a release always has its mold's scale. ` +
                      (asked
                          ? `If it really is ${wanted}, it belongs under the ${wanted} mold: re-file it there instead (the suggestion can be filed again under that mold).`
                          : `To clear it, re-file it under a mold with no scale, or change the mold's own scale.`),
            };
        }
        if (refiled && asked === undefined && (row?.scale ?? null) !== moldScale) {
            columns.scale = moldScale;
            before.scale = row?.scale ?? null;
            after.scale = moldScale;
            touched.push("scale");
        }
    }

    // Years run forward.
    const start = Number(attrsNext.release_year_start);
    const end = Number(attrsNext.release_year_end);
    if (
        (touched.includes("release_year_start") || touched.includes("release_year_end")) &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        attrsNext.release_year_start !== undefined &&
        attrsNext.release_year_end !== undefined &&
        end < start
    ) {
        return {
            ok: false,
            field: "release_year_end",
            error: `The last year (${end}) is before the first (${start}).`,
        };
    }

    return {
        ok: true,
        columns,
        attributes: attributesChanged ? attrsNext : null,
        before,
        after,
        touched,
        dropped,
    };
}

function labelOf(key: string): string {
    return editableFields.fieldLabel(key);
}

function checkColumn(
    key: string,
    raw: unknown,
    empty: boolean,
    row: CatalogRow | null,
    ctx: ValidateContext,
): { ok: true; value: unknown } | { ok: false; error: string } {
    switch (key) {
        case "title":
        case "maker": {
            if (empty)
                return { ok: false, error: key === "title" ? "The name can't be empty." : "The maker can't be empty." };
            const value = normalizeFactValue(key, String(raw));
            const problem = fieldValueProblem(key, value);
            return problem ? { ok: false, error: problem } : { ok: true, value };
        }
        case "artist":
        case "manufacturer": {
            if (empty) return { ok: true, value: null };
            const value = normalizeFactValue(key, String(raw));
            const problem = fieldValueProblem(key, value);
            return problem ? { ok: false, error: problem } : { ok: true, value };
        }
        case "scale": {
            if (empty) return { ok: true, value: null };
            const value = canonicalVocabulary("scale", raw);
            return value
                ? { ok: true, value }
                : { ok: false, error: `"${String(raw)}" is not a scale the Registry knows. Pick one from the list.` };
        }
        case "item_type": {
            if (empty) return { ok: false, error: "Every entry needs a type." };
            const value = String(raw).trim();
            if (!CATEGORY_VALUES.has(value)) return { ok: false, error: "Pick a type from the list." };
            if (row?.item_type === "plastic_mold" && value !== "plastic_mold" && (ctx.childCount ?? 0) > 0) {
                return {
                    ok: false,
                    error: `This mold has ${ctx.childCount} release${ctx.childCount === 1 ? "" : "s"} filed under it. Re-file them before changing its type.`,
                };
            }
            return { ok: true, value };
        }
        case "parent_id": {
            if (empty) return { ok: true, value: null };
            const value = String(raw).trim();
            if (!UUID_RE.test(value)) return { ok: false, error: "Pick the mold from the list." };
            if (row && value === row.id) return { ok: false, error: "An entry can't be filed under itself." };
            if (ctx.parent === null) return { ok: false, error: "That mold is no longer in the Registry." };
            if (ctx.parent && ctx.parent.item_type !== "plastic_mold")
                return { ok: false, error: "A release can only be filed under a mold." };
            return { ok: true, value };
        }
        default:
            return { ok: false, error: `${labelOf(key)} can't be edited here.` };
    }
}

function checkAttribute(key: string, input: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
    // Every attribute below is text: a list or an object never is, and a
    // number or a yes/no is judged as the text it reads as.
    if (input !== null && typeof input === "object")
        return { ok: false, error: `${labelOf(key)} takes plain text, not a list.` };
    const raw = typeof input === "number" || typeof input === "boolean" ? String(input) : input;
    switch (key) {
        case "release_year_start":
        case "release_year_end": {
            const text = String(raw).trim();
            const problem = fieldValueProblem(key, text);
            return problem ? { ok: false, error: problem } : { ok: true, value: Number(text) };
        }
        case "run_count": {
            const value = normalizeRunCount(raw);
            return value
                ? { ok: true, value }
                : { ok: false, error: fieldValueProblem("run_count", "x") ?? "Pieces made is a whole number." };
        }
        case "run_type":
        case "material": {
            const value = canonicalVocabulary(key, raw);
            return value
                ? { ok: true, value }
                : {
                      ok: false,
                      error: `"${String(raw)}" is not a ${key === "run_type" ? "run type" : "material"} the Registry knows. Pick one from the list.`,
                  };
        }
        case "gender":
            return isCatalogGender(raw)
                ? { ok: true, value: raw }
                : { ok: false, error: "Pick a gender from the list." };
        case "breed": {
            const problem = fieldValueProblem("breed", raw);
            if (problem) return { ok: false, error: problem };
            return { ok: true, value: normalizeCatalogBreed(raw) };
        }
        default: {
            const text = String(raw);
            const value = normalizeFactValue(key, text);
            const problem = fieldValueProblem(key, value);
            if (problem) return { ok: false, error: problem };
            const max = LONG_TEXT.has(key) ? 4000 : 500;
            if (String(value).length > max)
                return { ok: false, error: `${labelOf(key)} is up to ${max.toLocaleString("en-US")} characters.` };
            return { ok: true, value };
        }
    }
}

/**
 * A list field (components, fits_molds, materials, working parts): a
 * list of short words, or one line of text. Each entry is tidied and
 * checked like text; empty entries are dropped; objects never pass.
 */
function checkList(key: string, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
    if (typeof raw === "string" || typeof raw === "number") {
        const value = normalizeFactValue(key, String(raw));
        if (String(value).length > 500) return { ok: false, error: `${labelOf(key)} is up to 500 characters.` };
        return { ok: true, value };
    }
    if (!Array.isArray(raw)) return { ok: false, error: `${labelOf(key)} is a list of words, one per entry.` };
    if (raw.length > 50) return { ok: false, error: `${labelOf(key)} holds up to 50 entries.` };
    const out: string[] = [];
    for (const entry of raw) {
        if (entry === null || entry === undefined) continue;
        if (typeof entry !== "string" && typeof entry !== "number")
            return { ok: false, error: `Each entry in ${labelOf(key)} is a word or a short phrase.` };
        const text = String(entry).trim();
        if (!text) continue;
        if (text.length > 200) return { ok: false, error: `Each entry in ${labelOf(key)} is up to 200 characters.` };
        if (!out.includes(text)) out.push(text);
    }
    return { ok: true, value: out };
}

/** "Colour and markings: Bay → Black, Run type: (empty) → Special Run". */
export function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>): string {
    return Object.keys(after)
        .map((k) => `${labelOf(k)}: ${quote(before[k])} → ${quote(after[k])}`)
        .join(", ");
}

// ══════════════════════════════════════════════════════════════
// History and changelog (internal)
// ══════════════════════════════════════════════════════════════

interface ActionInput {
    kind: ActionKind;
    status?: ActionStatus;
    itemId: string | null;
    itemTitle?: string | null;
    relatedItemId?: string | null;
    suggestionId?: string | null;
    summary: string;
    note?: string | null;
    undoOf?: string | null;
    applied?: boolean;
    rows?: { catalog_item_id: string | null; before: unknown; after: unknown; outcome?: string }[];
}

/** One History entry and its rows. Null before 242 (or on a failure, which is logged). */
async function recordAction(actor: RegistryActor, input: ActionInput): Promise<string | null> {
    const status = input.status ?? "applied";
    const { data, error } = await db()
        .from("registry_actions")
        .insert({
            kind: input.kind,
            status,
            actor_id: actor.userId,
            actor_role: actor.role,
            catalog_item_id: input.itemId,
            item_title: input.itemTitle ?? null,
            related_item_id: input.relatedItemId ?? null,
            suggestion_id: input.suggestionId ?? null,
            summary: input.summary.slice(0, 2000),
            note: input.note ? input.note.slice(0, 2000) : null,
            row_count: Math.max(1, input.rows?.length ?? 1),
            undo_of: input.undoOf ?? null,
            applied_at: status === "applied" && input.applied !== false ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
    if (error || !data) {
        if (!isMissingSchema(error)) logger.error("RegistryWrite", "History entry failed (continuing)", error);
        return null;
    }
    const id = (data as { id: string }).id;
    if (input.rows?.length) {
        const { error: rowsError } = await db()
            .from("registry_action_rows")
            .insert(
                input.rows.map((r) => ({
                    action_id: id,
                    catalog_item_id: r.catalog_item_id,
                    before: r.before ?? null,
                    after: r.after ?? null,
                    outcome: r.outcome ?? "applied",
                })),
            );
        if (rowsError) logger.error("RegistryWrite", "History rows failed (continuing)", rowsError);
    }
    return id;
}

/** Change types the changelog took before 242 widened it. */
const LEGACY_CHANGE_TYPE: Record<string, string> = { merge: "removal", restore: "addition", revert: "correction" };

export interface ChangeInput {
    itemId: string | null;
    changeType: string;
    summary: string;
    suggestionId?: string | null;
    actionId?: string | null;
    /** Whose work it is, when not the actor's (a member's approved suggestion). */
    contributor?: { userId: string; alias: string } | null;
}

/**
 * One public changelog line. Never throws; before 242 it is written
 * without the role. Exported for the suggestion pipeline's photo and
 * removal notes, which change no row; every other caller is in this file.
 */
export async function recordChange(actor: RegistryActor, input: ChangeInput): Promise<void> {
    const base = {
        suggestion_id: input.suggestionId ?? null,
        catalog_item_id: input.itemId,
        change_summary: input.summary,
        contributed_by: input.contributor?.userId ?? actor.userId,
        contributor_alias: input.contributor?.alias ?? actor.alias,
        // Who decided: the actor (MHH-070: never the contributor by default).
        approved_by: actor.userId,
    };
    const { error } = await db()
        .from("catalog_changelog")
        .insert({ ...base, change_type: input.changeType, actor_role: actor.role, action_id: input.actionId ?? null });
    if (!error) return;
    if (isMissingSchema(error) || error.code === "23514") {
        const { error: retry } = await db()
            .from("catalog_changelog")
            .insert({ ...base, change_type: LEGACY_CHANGE_TYPE[input.changeType] ?? input.changeType });
        if (retry) logger.error("RegistryWrite", "Changelog write failed (continuing)", retry);
        return;
    }
    logger.error("RegistryWrite", "Changelog write failed (continuing)", error);
}

/** The end of every write: clear the reference pages, stamp the seat, count toward the speed alarm. */
async function finishWrite(actor: RegistryActor): Promise<void> {
    revalidateTag(CACHE_TAGS.referencePages, "max");
    if (actor.role === "moderator") {
        const { error } = await db()
            .from("registry_moderators")
            .update({ last_action_at: new Date().toISOString() })
            .eq("user_id", actor.userId);
        if (error && !isMissingSchema(error)) logger.error("RegistryWrite", "Seat stamp failed (continuing)", error);
    }
    await noteRegistryAction(actor);
}

async function markUndone(actor: RegistryActor, actionId: string): Promise<void> {
    await db()
        .from("registry_actions")
        .update({ status: "undone", undone_by: actor.userId, undone_at: new Date().toISOString() })
        .eq("id", actionId)
        .eq("status", "applied");
}

/**
 * Mark a merge or removal that did not happen as failed. Guarded: only an
 * entry still in the state this caller left it in (a pending entry, or a
 * merge still waiting for its second look) and never one the database
 * already applied. A second "Confirm" that finds the merge done can never
 * mark the applied merge failed and lose its undo.
 */
async function markFailed(actionId: string | null, from: "pending" | "awaiting_second_look"): Promise<void> {
    if (!actionId) return;
    const { error } = await db()
        .from("registry_actions")
        .update({ status: "failed" })
        .eq("id", actionId)
        .eq("status", from)
        .is("applied_at", null);
    if (error) logger.error("RegistryWrite", "Marking a History entry failed did not save (continuing)", error);
}

// ══════════════════════════════════════════════════════════════
// Edit and add
// ══════════════════════════════════════════════════════════════

async function lookupParent(id: unknown): Promise<ValidateContext["parent"]> {
    if (typeof id !== "string" || !UUID_RE.test(id.trim())) return undefined;
    const { data } = await db()
        .from("catalog_items")
        .select("id, item_type, scale, title")
        .eq("id", id.trim())
        .maybeSingle();
    return (data as { id: string; item_type: string; scale: string | null; title: string | null } | null) ?? null;
}

/**
 * A mold's scale changed: its releases follow it (a release always has
 * its mold's scale). Moved one group of old scales at a time, so each
 * release's old scale is known exactly and the History can put it back.
 */
async function moveReleasesToScale(
    moldId: string,
    scale: string | null,
): Promise<{ rows: { catalog_item_id: string; before: unknown; after: unknown }[]; error?: DbError }> {
    const { data: kids, error } = await db().from("catalog_items").select("id, scale").eq("parent_id", moldId);
    if (error) return { rows: [], error };
    const olds = [...new Set(((kids ?? []) as { scale: string | null }[]).map((k) => k.scale ?? null))].filter(
        (s) => s !== scale,
    );
    const rows: { catalog_item_id: string; before: unknown; after: unknown }[] = [];
    for (const old of olds) {
        let q = db().from("catalog_items").update({ scale }).eq("parent_id", moldId);
        q = old === null ? q.is("scale", null) : q.eq("scale", old);
        const { data, error: moveError } = await q.select("id");
        if (moveError) return { rows, error: moveError };
        for (const r of (data ?? []) as { id: string }[])
            rows.push({ catalog_item_id: r.id, before: { scale: old }, after: { scale } });
    }
    return { rows };
}

export interface UpdateItemInput {
    id: string;
    /** The updated_at the editor loaded; null = guard on the row as read now. */
    expectedUpdatedAt: string | null;
    changes: Record<string, unknown>;
    note?: string;
    suggestionId?: string | null;
    /** Defaults to "refile" when the mold changes, else "edit". */
    kind?: ActionKind;
    /** A member's approved suggestion: the changelog credits them. */
    contributor?: { userId: string; alias: string } | null;
    /** The changelog line, when the caller words it. */
    summary?: string;
}

/**
 * Change one row. Guarded on updated_at: if anyone saved since the editor
 * loaded it, nothing changes and the current row comes back with code
 * "conflict".
 */
export async function updateItem(
    actor: RegistryActor,
    input: UpdateItemInput,
): Promise<WriteResult<{ item: CatalogRow; actionId: string | null; touched: string[] }>> {
    const limit = await checkRegistryLimit(actor, "edit");
    if (!limit.ok) return fail("limit", limit.error);

    const row = await readRow(input.id);
    if (!row) return fail("not_found", "That entry is no longer in the Registry.");
    if (input.expectedUpdatedAt && row.updated_at !== input.expectedUpdatedAt) {
        return fail("conflict", "Someone saved this entry since you opened it. Here it is as it is now.", {
            current: row,
        });
    }

    const changes = input.changes ?? {};
    const ctx: ValidateContext = {};
    const parentTarget = "parent_id" in changes ? changes.parent_id : row.parent_id;
    if (parentTarget) ctx.parent = await lookupParent(parentTarget);
    if ("item_type" in changes && row.item_type === "plastic_mold") {
        const { count } = await db()
            .from("catalog_items")
            .select("id", { count: "exact", head: true })
            .eq("parent_id", row.id);
        ctx.childCount = count ?? 0;
    }

    const v = validateChanges(row, changes, ctx);
    if (!v.ok) return fail("invalid", v.error, { field: v.field });
    if (v.touched.length === 0) return { success: true, item: row, actionId: null, touched: [] };

    const payload: Record<string, unknown> = { ...v.columns };
    if (v.attributes) payload.attributes = JSON.parse(JSON.stringify(v.attributes));
    const { data, error } = await db()
        .from("catalog_items")
        .update(payload)
        .eq("id", row.id)
        .eq("updated_at", row.updated_at)
        .select(CATALOG_ROW_COLUMNS);
    if (error) return dbFailure("Update failed", error);
    const updated = (Array.isArray(data) ? data[0] : null) as CatalogRow | null;
    if (!updated) {
        const current = await readRow(row.id);
        if (!current) return fail("not_found", "That entry is no longer in the Registry.");
        return fail("conflict", "Someone saved this entry since you opened it. Here it is as it is now.", { current });
    }

    // A mold's scale is its releases' scale: they move with it, in the
    // same History entry, so one undo puts all of them back.
    let followers: { catalog_item_id: string; before: unknown; after: unknown }[] = [];
    if (updated.item_type === "plastic_mold" && v.touched.includes("scale")) {
        const moved = await moveReleasesToScale(row.id, (v.columns.scale as string | null) ?? null);
        followers = moved.rows;
        if (moved.error) logger.error("RegistryWrite", "Moving releases to the mold's new scale stopped", moved.error);
    }
    const followWords = followers.length
        ? ` (and ${followers.length} release${followers.length === 1 ? "" : "s"} filed under it)`
        : "";

    const kind: ActionKind = input.kind ?? (v.touched.includes("parent_id") ? "refile" : "edit");
    const described = describeChanges(v.before, v.after);
    const actionId = await recordAction(actor, {
        kind,
        itemId: row.id,
        itemTitle: updated.title,
        suggestionId: input.suggestionId ?? null,
        summary: `${updated.title}: ${described}${followWords}`,
        note: input.note ?? null,
        rows: [{ catalog_item_id: row.id, before: v.before, after: v.after }, ...followers],
    });
    await recordChange(actor, {
        itemId: row.id,
        changeType: kind === "revert" ? "revert" : "correction",
        summary: (input.summary ?? `🔧 Correction: ${described}`) + followWords,
        suggestionId: input.suggestionId ?? null,
        actionId,
        contributor: input.contributor ?? null,
    });
    await finishWrite(actor);
    return { success: true, item: updated, actionId, touched: v.touched };
}

export interface InsertItemInput {
    /** The new row: columns plus an `attributes` object. */
    payload: Record<string, unknown>;
    note?: string;
    suggestionId?: string | null;
    /** Drop attribute values that fail a check instead of refusing (suggested additions). */
    lenient?: boolean;
    contributor?: { userId: string; alias: string } | null;
    summary?: string;
}

/** Add one row. */
export async function insertItem(
    actor: RegistryActor,
    input: InsertItemInput,
): Promise<WriteResult<{ id: string; item: CatalogRow; actionId: string | null; dropped: DroppedValue[] }>> {
    const limit = await checkRegistryLimit(actor, "edit");
    if (!limit.ok) return fail("limit", limit.error);

    const { attributes, ...columnsIn } = input.payload ?? {};
    const flat: Record<string, unknown> = { ...columnsIn };
    if (attributes && typeof attributes === "object") Object.assign(flat, attributes as Record<string, unknown>);

    const ctx: ValidateContext = {};
    if (flat.parent_id) ctx.parent = await lookupParent(flat.parent_id);
    const v = validateChanges(null, flat, ctx, { lenient: input.lenient });
    if (!v.ok) return fail("invalid", v.error, { field: v.field });

    const newAttributes: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.after)) if (!CATALOG_REAL_COLUMNS.has(k)) newAttributes[k] = val;
    const insert = { ...v.columns, attributes: JSON.parse(JSON.stringify(newAttributes)) };
    const { data, error } = await db().from("catalog_items").insert(insert).select(CATALOG_ROW_COLUMNS).single();
    if (error || !data) return dbFailure("Insert failed", error);
    const item = data as CatalogRow;

    const actionId = await recordAction(actor, {
        kind: "add",
        itemId: item.id,
        itemTitle: item.title,
        suggestionId: input.suggestionId ?? null,
        summary: `Added "${item.title}" (${item.maker})`,
        note: input.note ?? null,
        rows: [{ catalog_item_id: item.id, before: null, after: v.after }],
    });
    await recordChange(actor, {
        itemId: item.id,
        changeType: "addition",
        summary: input.summary ?? `📗 New entry added: ${item.title}`,
        suggestionId: input.suggestionId ?? null,
        actionId,
        contributor: input.contributor ?? null,
    });
    await finishWrite(actor);
    return { success: true, id: item.id, item, actionId, dropped: v.dropped };
}

// ══════════════════════════════════════════════════════════════
// Revert an applied correction (expect-guarded)
// ══════════════════════════════════════════════════════════════

/**
 * Put back the values a correction replaced. A field is reverted only
 * while the entry STILL HOLDS the correction's `to` value; a field
 * changed again since is left alone and reported as drifted.
 */
export async function revertFields(
    actor: RegistryActor,
    input: { itemId: string; fieldChanges: Record<string, unknown>; suggestionId: string | null; reason: string },
): Promise<WriteResult<{ reverted: string[]; drifted: string[]; actionId: string | null }>> {
    const limit = await checkRegistryLimit(actor, "edit");
    if (!limit.ok) return fail("limit", limit.error);

    const row = await readRow(input.itemId);
    if (!row) return fail("not_found", "The catalog entry no longer exists.");

    const attrs = { ...(row.attributes ?? {}) };
    const columnUpdates: Record<string, unknown> = {};
    let attributesTouched = false;
    const reverted: string[] = [];
    const drifted: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input.fieldChanges ?? {})) {
        if (typeof value !== "object" || value === null || !("to" in value)) continue;
        const { from, to } = value as { from?: unknown; to: unknown };
        const isColumn = CATALOG_REAL_COLUMNS.has(key);
        const current = isColumn ? (row as unknown as Record<string, unknown>)[key] : attrs[key];

        // The guard: only revert what the correction actually left behind.
        if (String(current ?? "") !== String(normalizeFactValue(key, to) ?? "")) {
            drifted.push(key);
            continue;
        }

        const restored = from == null ? "" : String(from);
        // A value the Registry's lists no longer accept can't be put back.
        if (
            restored &&
            (key === "scale" || key === "run_type" || key === "material") &&
            canonicalVocabulary(key, restored) === null
        ) {
            drifted.push(key);
            continue;
        }
        if (isColumn) {
            // Title and maker cannot be emptied; scale can go back to null.
            if (restored === "" && (key === "title" || key === "maker")) {
                drifted.push(key);
                continue;
            }
            columnUpdates[key] = restored === "" ? null : restored;
        } else if (restored === "") {
            // The correction ADDED this field; reverting removes it.
            delete attrs[key];
            attributesTouched = true;
        } else {
            attrs[key] = restored;
            attributesTouched = true;
        }
        before[key] = current ?? null;
        after[key] = restored === "" ? null : restored;
        reverted.push(key);
    }

    if (reverted.length === 0) {
        return fail("conflict", "Nothing left to revert: every field has been changed again since this correction.", {
            drifted,
        });
    }

    const updates: Record<string, unknown> = { ...columnUpdates };
    if (attributesTouched) updates.attributes = JSON.parse(JSON.stringify(attrs));
    const { data, error } = await db()
        .from("catalog_items")
        .update(updates)
        .eq("id", row.id)
        .eq("updated_at", row.updated_at)
        .select("id");
    if (error) return dbFailure("Revert failed", error);
    if (!Array.isArray(data) || data.length === 0) {
        return fail("conflict", "Someone saved this entry a moment ago. Try the revert again.", { drifted });
    }

    const actionId = await recordAction(actor, {
        kind: "revert",
        itemId: row.id,
        itemTitle: row.title,
        suggestionId: input.suggestionId,
        summary: `${row.title}: reverted ${reverted.map(labelOf).join(", ")}`,
        note: input.reason,
        rows: [{ catalog_item_id: row.id, before, after }],
    });
    // The revert is itself a change, so it goes in the public changelog.
    await recordChange(actor, {
        itemId: row.id,
        changeType: "revert",
        summary: `↩️ Reverted a correction (${reverted.join(", ")}): ${input.reason}`,
        suggestionId: input.suggestionId,
        actionId,
    });
    await finishWrite(actor);
    return { success: true, reverted, drifted, actionId };
}

// ══════════════════════════════════════════════════════════════
// What points at a row
// ══════════════════════════════════════════════════════════════

const EMPTY_COUNTS: Omit<LinkCounts, "total"> = {
    horses: 0,
    wishlists: 0,
    children: 0,
    id_suggestions: 0,
    pending_suggestions: 0,
    sale_reports: 0,
    price_flags: 0,
    set_mentions: 0,
    set_siblings: 0,
};

/** Before 243: the same counts, one head-count each. */
async function countLinksByHand(id: string): Promise<Omit<LinkCounts, "set_mentions" | "set_siblings" | "total">> {
    const head = async (table: string, column: string, statuses?: string[]) => {
        let q = db().from(table).select("id", { count: "exact", head: true }).eq(column, id);
        if (statuses) q = q.in("status", statuses);
        const { count } = await q;
        return count ?? 0;
    };
    const [horses, wishlists, children, id_suggestions, pending_suggestions, sale_reports, price_flags] =
        await Promise.all([
            head("user_horses", "catalog_id"),
            head("user_wishlists", "catalog_id"),
            head("catalog_items", "parent_id"),
            head("id_suggestions", "catalog_id"),
            head("catalog_suggestions", "catalog_item_id", ["pending", "under_review"]),
            head("catalog_sale_reports", "catalog_item_id"),
            head("catalog_price_signal_flags", "catalog_item_id"),
        ]);
    return { horses, wishlists, children, id_suggestions, pending_suggestions, sale_reports, price_flags };
}

/**
 * Everything that points at a row: the database's links (horses,
 * including deleted ones; want lists; releases filed under it; Help ID
 * answers; pending suggestions; sale reports; price flags) plus set
 * pieces read from titles: for a mold, set rows on other molds whose
 * roster names it; for a set piece, the other pieces of its set.
 */
export async function linkCounts(id: string): Promise<LinkCounts> {
    const row = await readRow(id);
    if (!row) return { ...EMPTY_COUNTS, total: 0 };

    let base: Omit<LinkCounts, "set_mentions" | "set_siblings" | "total">;
    const { data, error } = await db().rpc("registry_link_counts", { p_item: id });
    if (!error && data && typeof data === "object") {
        const d = data as Record<string, number>;
        base = {
            horses: Number(d.horses ?? 0),
            wishlists: Number(d.wishlists ?? 0),
            children: Number(d.children ?? 0),
            id_suggestions: Number(d.id_suggestions ?? 0),
            pending_suggestions: Number(d.pending_suggestions ?? 0),
            sale_reports: Number(d.sale_reports ?? 0),
            price_flags: Number(d.price_flags ?? 0),
        };
    } else {
        base = await countLinksByHand(id);
    }

    let set_mentions = 0;
    let set_siblings = 0;
    if (row.item_type === "plastic_mold") {
        // The linker's candidate query: titles with "with" and every word of the mold's name.
        // Set rows filed under another mold, AND set rows filed under no
        // mold at all: `neq` alone skips NULL, and an unfiled set that
        // lists this mold is still one of its pieces.
        let q = db()
            .from("catalog_items")
            .select("id, title, scale")
            .eq("item_type", "plastic_release")
            .or(`parent_id.is.null,parent_id.neq.${row.id}`)
            .ilike("title", "%with%");
        for (const w of rosterPrefilterWords(row.title)) q = q.ilike("title", `%${w.replace(/[%_]/g, "")}%`);
        const { data: sets } = await q.limit(400);
        set_mentions = ((sets ?? []) as { title: string; scale: string | null }[]).filter(
            (r) =>
                mentionsMold(r.title, stripGeneration(row.title)) && (!row.scale || !r.scale || r.scale === row.scale),
        ).length;
    } else {
        const label = setLabel(row.title);
        if (label) {
            const model = (row.attributes ?? {}).model_number;
            const { data: pieces } = await db()
                .from("catalog_items")
                .select("id, title, attributes")
                .eq("maker", row.maker)
                .neq("id", row.id)
                .ilike("title", `${label.replace(/[%_]/g, "")}%`)
                .limit(100);
            set_siblings = ((pieces ?? []) as { title: string; attributes: Record<string, unknown> | null }[]).filter(
                (p) => {
                    if (setLabel(p.title) !== label) return false;
                    const theirs = (p.attributes ?? {}).model_number;
                    return model == null || theirs == null || String(model) === String(theirs);
                },
            ).length;
        }
    }

    const counts = { ...base, set_mentions, set_siblings };
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return { ...counts, total };
}

/** "3 horses, 1 want list and 2 releases filed under it". */
export function linkWords(c: Omit<LinkCounts, "total">): string {
    const parts: string[] = [];
    const add = (n: number, one: string, many: string) => {
        if (n > 0) parts.push(`${n.toLocaleString("en-US")} ${n === 1 ? one : many}`);
    };
    add(c.horses, "horse", "horses");
    add(c.wishlists, "want list", "want lists");
    add(c.children, "release filed under it", "releases filed under it");
    add(c.set_mentions, "set that lists this mold", "sets that list this mold");
    add(c.set_siblings, "other piece of the same set", "other pieces of the same set");
    add(c.id_suggestions, "Help ID answer", "Help ID answers");
    add(c.pending_suggestions, "waiting suggestion", "waiting suggestions");
    add(c.sale_reports, "member sale report", "member sale reports");
    add(c.price_flags, "price flag", "price flags");
    if (parts.length <= 1) return parts.join("");
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ══════════════════════════════════════════════════════════════
// Merge
// ══════════════════════════════════════════════════════════════

/**
 * Tables whose rows point at a catalog item, in the order the one-way
 * merge moves them (before 243 only). registry_merge (243) moves the same
 * tables in one transaction and saves every id so the merge can be undone.
 */
export const MERGE_REPOINTS: [table: string, column: string][] = [
    ["user_horses", "catalog_id"],
    ["user_wishlists", "catalog_id"],
    ["id_suggestions", "catalog_id"],
    ["catalog_suggestions", "catalog_item_id"],
    ["catalog_changelog", "catalog_item_id"],
    ["catalog_items", "parent_id"],
    // Member data the old merge cascade-deleted with the duplicate.
    ["catalog_sale_reports", "catalog_item_id"],
    ["catalog_price_signal_flags", "catalog_item_id"],
];

/**
 * The one-way merge, for the owner before 243 is pasted: links move,
 * the duplicate's address forwards, the duplicate is deleted. Not undoable.
 */
async function legacyMerge(
    actor: RegistryActor,
    dup: CatalogRow,
    keep: CatalogRow,
    opts: { suggestionId?: string | null; contributor?: { userId: string; alias: string } | null; note?: string },
): Promise<WriteResult<{ moved: number; summary: string; actionId: string | null }>> {
    const client = db();
    // One want-list row per member per model (233), one price flag per member
    // per model (196): the duplicate's row goes where the member has both.
    const fold = async (table: string, idColumn: string, whoColumn: string) => {
        const who = async (id: string) => {
            const { data } = await client.from(table).select(whoColumn).eq(idColumn, id);
            return new Set(((data as Record<string, string>[] | null) ?? []).map((r) => r[whoColumn]));
        };
        const keepers = await who(keep.id);
        const both = [...(await who(dup.id))].filter((u) => keepers.has(u));
        if (both.length === 0) return null;
        const { error } = await client.from(table).delete().eq(idColumn, dup.id).in(whoColumn, both);
        return error;
    };
    const wishError = await fold("user_wishlists", "catalog_id", "user_id");
    if (wishError) return dbFailure("Folding want lists failed", wishError);
    const flagError = await fold("catalog_price_signal_flags", "catalog_item_id", "reporter_id");
    if (flagError && !isMissingSchema(flagError)) return dbFailure("Folding price flags failed", flagError);

    // Two molds: the duplicate's releases move to the kept mold below and
    // take its scale (a release always has its mold's scale).
    if (keep.item_type === "plastic_mold" && keep.scale) {
        const moved = await moveReleasesToScale(dup.id, keep.scale);
        if (moved.error) return dbFailure("Moving releases to the kept mold's scale failed", moved.error);
    }

    let moved = 0;
    for (const [table, column] of MERGE_REPOINTS) {
        const { data, error } = await client
            .from(table)
            .update({ [column]: keep.id })
            .eq(column, dup.id)
            .select("id");
        if (error) {
            if (isMissingSchema(error)) continue;
            return dbFailure(`Repointing ${table}.${column} failed`, error);
        }
        moved += Array.isArray(data) ? data.length : 0;
    }

    // Old addresses that led to the duplicate, and its own, now lead to the kept entry.
    await client.from("catalog_slug_history").update({ item_id: keep.id }).eq("item_id", dup.id).select("item_id");
    if (dup.maker_slug && dup.slug) {
        await client
            .from("catalog_slug_history")
            .upsert(
                { old_maker_slug: dup.maker_slug, old_slug: dup.slug, item_id: keep.id },
                { onConflict: "old_maker_slug,old_slug" },
            );
    }

    const { error: deleteError } = await client.from("catalog_items").delete().eq("id", dup.id);
    if (deleteError) return dbFailure("Delete failed", deleteError);

    const summary = `Merged "${dup.title}" into "${keep.title}": ${moved} link${moved === 1 ? "" : "s"} moved.`;
    const actionId = await recordAction(actor, {
        kind: "merge",
        itemId: dup.id,
        itemTitle: dup.title,
        relatedItemId: keep.id,
        suggestionId: opts.suggestionId ?? null,
        summary: `${summary} (Before update 243: this merge can't be undone.)`,
        note: opts.note ?? null,
        rows: [{ catalog_item_id: dup.id, before: dup, after: { merged_into: keep.id } }],
    });
    await recordChange(actor, {
        itemId: keep.id,
        changeType: "merge",
        summary: `🔁 Merged duplicate "${dup.title}" (${dup.maker ?? "unknown"}) into "${keep.title}": references repointed.`,
        suggestionId: opts.suggestionId ?? null,
        actionId,
        contributor: opts.contributor ?? null,
    });
    await finishWrite(actor);
    return { success: true, moved, summary, actionId };
}

/** Errors from registry_merge that mean the merge can never run as asked (as opposed to a deadlock or a timeout). */
const MERGE_DEFINITIVE = new Set(["same", "missing", "keep_is_child", "mixed", "mismatch", "not_found", "not_merge"]);

function mergeSummary(dup: CatalogRow, keep: CatalogRow, moved: number, rescaled: number): string {
    const base = `Merged "${dup.title}" into "${keep.title}": ${moved} link${moved === 1 ? "" : "s"} moved.`;
    if (!rescaled) return base;
    return `${base} ${rescaled} release${rescaled === 1 ? " now has" : "s now have"} the kept mold's scale (${keep.scale}).`;
}

/**
 * Run registry_merge for a recorded History entry. `from` is the state the
 * entry is in: the owner's `pending` entry is marked failed on ANY
 * refusal (it was never waiting for anyone); a moderator's entry waiting
 * for its second look is marked failed only when the merge can never run
 * (an entry gone, a wrong pair), and stays waiting after a deadlock or a
 * timeout, so someone can try again. "Already applied" never marks
 * anything: that merge happened, and its undo must survive.
 */
async function applyMerge(
    actor: RegistryActor,
    actionId: string,
    keep: CatalogRow,
    dup: CatalogRow,
    opts: {
        reason: string;
        from: "pending" | "awaiting_second_look";
        suggestionId?: string | null;
        contributor?: { userId: string; alias: string } | null;
    },
): Promise<WriteResult<{ moved: number; rescaled: number; summary: string }>> {
    const { data, error } = await db().rpc("registry_merge", {
        p_keep: keep.id,
        p_remove: dup.id,
        p_action_id: actionId,
        p_actor: actor.userId,
        p_reason: opts.reason,
    });
    if (error) {
        const raised = error.message ?? "";
        if (raised === "already_applied")
            return fail("invalid", "This merge has already been applied. Nothing more to do.");
        if (raised === "not_waiting") return fail("invalid", "This merge is no longer waiting for a second look.");
        if (opts.from === "pending" || MERGE_DEFINITIVE.has(raised)) await markFailed(actionId, opts.from);
        return rpcFailure("Merge failed", error);
    }
    const d = (data ?? {}) as { moved?: number; rescaled?: number };
    const moved = Number(d.moved ?? 0);
    const rescaled = Number(d.rescaled ?? 0);
    const summary = mergeSummary(dup, keep, moved, rescaled);
    await recordChange(actor, {
        itemId: keep.id,
        changeType: "merge",
        summary: `🔁 Merged duplicate "${dup.title}" (${dup.maker ?? "unknown"}) into "${keep.title}": references repointed.`,
        suggestionId: opts.suggestionId ?? null,
        actionId,
        contributor: opts.contributor ?? null,
    });
    return { success: true, moved, rescaled, summary };
}

/**
 * Change a suggestion's status from write.ts (a merge waiting for, or
 * finished with, its second look). Guarded on the status the caller
 * expects, so a decision made meanwhile is never overwritten; before 242
 * the claim columns are left out.
 */
async function moveSuggestion(
    suggestionId: string,
    fields: Record<string, unknown>,
    fromStatuses: string[],
): Promise<boolean> {
    const run = (payload: Record<string, unknown>) =>
        db().from("catalog_suggestions").update(payload).eq("id", suggestionId).in("status", fromStatuses).select("id");
    let { data, error } = await run(fields);
    if (error && isMissingSchema(error)) {
        const { claimed_by: _by, claimed_until: _until, ...legacy } = fields;
        void _by;
        void _until;
        ({ data, error } = await run(legacy));
    }
    if (error) {
        logger.error("RegistryWrite", "Suggestion status change failed (continuing)", error);
        return false;
    }
    return Array.isArray(data) && data.length > 0;
}

/** The merge waiting for a second look that came from this suggestion, if any. */
export async function waitingMergeFor(
    suggestionId: string,
): Promise<{ id: string; actorId: string | null; summary: string } | null> {
    if (!UUID_RE.test(suggestionId)) return null;
    const { data, error } = await db()
        .from("registry_actions")
        .select("id, actor_id, summary")
        .eq("suggestion_id", suggestionId)
        .eq("kind", "merge")
        .eq("status", "awaiting_second_look")
        .limit(1);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const a = data[0] as { id: string; actor_id: string | null; summary: string };
    return { id: a.id, actorId: a.actor_id, summary: a.summary };
}

/**
 * The suggestion was decided some other way (rejected, or approved by the
 * owner in Admin) while its merge waited: the waiting merge is closed, so
 * nobody confirms a merge for a report that was already settled.
 */
export async function closeWaitingMerge(actor: RegistryActor, suggestionId: string, note: string): Promise<void> {
    const waiting = await waitingMergeFor(suggestionId);
    if (!waiting) return;
    const { error } = await db()
        .from("registry_actions")
        .update({
            status: "declined",
            second_look_by: actor.userId,
            second_look_at: new Date().toISOString(),
            second_look_note: note.slice(0, 1000),
        })
        .eq("id", waiting.id)
        .eq("status", "awaiting_second_look");
    if (error) logger.error("RegistryWrite", "Closing a waiting merge failed (continuing)", error);
}

/**
 * Ask for a merge. The owner's applies at once (still undoable, answer 3);
 * a moderator's waits for a second look from someone else. Molds merge
 * into molds: the duplicate mold's releases move to the kept mold and
 * take its scale, and an undo puts their old scales back.
 */
export async function requestMerge(
    actor: RegistryActor,
    input: {
        keepId: string;
        removeId: string;
        note: string;
        suggestionId?: string | null;
        contributor?: { userId: string; alias: string } | null;
    },
): Promise<
    WriteResult<{
        actionId: string | null;
        status: "applied" | "awaiting_second_look";
        summary: string;
        /** The one-way merge ran (update 243 not pasted yet). */
        legacy: boolean;
    }>
> {
    if (!input.keepId || input.keepId === input.removeId) return fail("invalid", "Those are the same entry.");
    const [keep, dup] = await Promise.all([readRow(input.keepId), readRow(input.removeId)]);
    if (!keep) return fail("not_found", "The entry to keep is no longer in the Registry.");
    if (!dup) return fail("not_found", "The duplicate is no longer in the Registry.");
    if ((keep.item_type === "plastic_mold") !== (dup.item_type === "plastic_mold"))
        return fail("invalid", "A mold merges only into a mold, and a release only into a release.");
    if (keep.parent_id === dup.id)
        return fail("invalid", "The entry to keep is filed under the duplicate. Re-file it first.");

    const ready = await mergeUndoReady();
    if (!ready && actor.role !== "owner") return fail("not_ready", MERGE_REMOVE_NOT_READY);

    if (ready) {
        // One open merge per duplicate. The owner asking for the same merge
        // that already waits is its second look; anyone else is pointed at it.
        const { data: open } = await db()
            .from("registry_actions")
            .select("id, actor_id, related_item_id")
            .eq("kind", "merge")
            .eq("status", "awaiting_second_look")
            .eq("catalog_item_id", dup.id)
            .limit(1);
        const waiting = (Array.isArray(open) ? open[0] : null) as {
            id: string;
            actor_id: string | null;
            related_item_id: string | null;
        } | null;
        if (waiting) {
            if (actor.role === "owner" && waiting.related_item_id === keep.id && waiting.actor_id !== actor.userId) {
                const confirmed = await confirmMerge(actor, waiting.id);
                if (!confirmed.success) return confirmed;
                return {
                    success: true,
                    actionId: waiting.id,
                    status: "applied",
                    summary: confirmed.summary,
                    legacy: false,
                };
            }
            return fail(
                "invalid",
                `A merge of "${dup.title}" already waits for a second look. Confirm or decline that one first.`,
            );
        }
    }

    const limit = await checkRegistryLimit(actor, "merge");
    if (!limit.ok) return fail("limit", limit.error);
    const note = (input.note ?? "").trim().slice(0, 1000);

    if (!ready) {
        const legacy = await legacyMerge(actor, dup, keep, {
            suggestionId: input.suggestionId,
            contributor: input.contributor,
            note,
        });
        if (!legacy.success) return legacy;
        return { success: true, actionId: legacy.actionId, status: "applied", summary: legacy.summary, legacy: true };
    }

    if (actor.role === "owner") {
        // Pending until registry_merge turns it applied in its own
        // transaction: the History never says "applied" for a merge that
        // did not run.
        const actionId = await recordAction(actor, {
            kind: "merge",
            status: "pending",
            itemId: dup.id,
            itemTitle: dup.title,
            relatedItemId: keep.id,
            suggestionId: input.suggestionId ?? null,
            summary: `Merge "${dup.title}" into "${keep.title}"`,
            note: note || null,
        });
        if (!actionId) return fail("failed", GENERIC_REFUSAL);
        const merged = await applyMerge(actor, actionId, keep, dup, {
            reason: note,
            from: "pending",
            suggestionId: input.suggestionId,
            contributor: input.contributor,
        });
        if (!merged.success) return merged;
        await finishWrite(actor);
        return { success: true, actionId, status: "applied", summary: merged.summary, legacy: false };
    }

    const actionId = await recordAction(actor, {
        kind: "merge",
        status: "awaiting_second_look",
        itemId: dup.id,
        itemTitle: dup.title,
        relatedItemId: keep.id,
        suggestionId: input.suggestionId ?? null,
        summary: `Merge "${dup.title}" into "${keep.title}"`,
        note: note || null,
    });
    if (!actionId) return fail("failed", GENERIC_REFUSAL);
    if (input.suggestionId) {
        // The report waits with its merge; nobody holds a claim on it now.
        await moveSuggestion(input.suggestionId, { status: "under_review", claimed_by: null, claimed_until: null }, [
            "pending",
            "under_review",
            "approved",
        ]);
    }
    await alertOwner(
        "merge_requested",
        `@${actor.alias} asked for a merge: "${dup.title}" into "${keep.title}". It waits for a second look.`,
        "/catalog/desk?tab=second_looks",
    );
    await finishWrite(actor);
    return {
        success: true,
        actionId,
        status: "awaiting_second_look",
        summary: `Merge "${dup.title}" into "${keep.title}" waits for a second look.`,
        legacy: false,
    };
}

interface ActionRow {
    id: string;
    kind: ActionKind;
    status: ActionStatus;
    actor_id: string | null;
    actor_role: string;
    catalog_item_id: string | null;
    item_title: string | null;
    related_item_id: string | null;
    suggestion_id: string | null;
    summary: string;
    note: string | null;
    undo_until: string;
    created_at?: string;
    applied_at?: string | null;
}

async function readAction(id: string): Promise<ActionRow | null> {
    if (!UUID_RE.test(id)) return null;
    const { data } = await db().from("registry_actions").select("*").eq("id", id).maybeSingle();
    return (data as ActionRow | null) ?? null;
}

async function aliasOf(userId: string | null): Promise<string> {
    if (!userId) return "a moderator";
    const { data } = await db().from("users").select("alias_name").eq("id", userId).maybeSingle();
    return (data as { alias_name: string | null } | null)?.alias_name ?? "a moderator";
}

/** Words for an entry that is no longer waiting, read from its status. */
function notWaitingWords(status: ActionStatus): string {
    if (status === "applied" || status === "undone") return "This merge has already been applied.";
    if (status === "declined") return "This merge was declined, so there is nothing to confirm.";
    return "This merge is no longer waiting for a second look.";
}

/**
 * The second look's own rules, when the merge came from a member's
 * duplicate report: the same as deciding the report (nobody decides their
 * own; an artist doesn't decide about their own work). Returns the
 * report's author for the changelog credit.
 */
async function secondLookRules(
    actor: RegistryActor,
    action: ActionRow,
): Promise<{ ok: true; author: { userId: string; alias: string } | null } | { ok: false; error: string }> {
    if (!action.suggestion_id) return { ok: true, author: null };
    const { readSuggestion, reviewRefusal } = await import("@/lib/catalog/suggestionApply");
    const s = await readSuggestion(action.suggestion_id);
    if (!s) return { ok: true, author: null };
    const refusal = await reviewRefusal(s, actor);
    if (refusal) return { ok: false, error: refusal };
    return { ok: true, author: { userId: s.user_id, alias: await aliasOf(s.user_id) } };
}

/** The second look: apply a moderator's merge. Never by the moderator who asked. */
export async function confirmMerge(
    actor: RegistryActor,
    actionId: string,
): Promise<WriteResult<{ actionId: string; status: "applied"; summary: string }>> {
    if (!(await mergeUndoReady())) return fail("not_ready", MERGE_REMOVE_NOT_READY);
    const action = await readAction(actionId);
    if (!action || action.kind !== "merge") return fail("not_found", "That merge request is not in the history.");
    if (action.status !== "awaiting_second_look") return fail("invalid", notWaitingWords(action.status));
    if (action.actor_id === actor.userId)
        return fail("forbidden", "You asked for this merge, so someone else gives it the second look.");
    const rules = await secondLookRules(actor, action);
    if (!rules.ok) return fail("forbidden", rules.error);

    const limit = await checkRegistryLimit(actor, "merge");
    if (!limit.ok) return fail("limit", limit.error);

    const requester = { userId: action.actor_id ?? actor.userId, alias: await aliasOf(action.actor_id) };
    // A member's duplicate report keeps its credit: the changelog names them.
    const contributor = rules.author ?? requester;
    const gone = async (): Promise<WriteFailure> => {
        await markFailed(action.id, "awaiting_second_look");
        if (action.suggestion_id) {
            await moveSuggestion(
                action.suggestion_id,
                {
                    status: "pending",
                    claimed_by: null,
                    claimed_until: null,
                    admin_notes:
                        "The merge could not be made: one of the two entries is no longer in the Registry. Look at the report again.",
                },
                ["under_review"],
            );
        }
        return fail("not_found", "One of the two entries is no longer in the Registry, so there is nothing to merge.");
    };

    const [keep, dup] = await Promise.all([
        readRow(action.related_item_id ?? ""),
        readRow(action.catalog_item_id ?? ""),
    ]);
    if (!keep || !dup) return gone();

    const merged = await applyMerge(actor, action.id, keep, dup, {
        reason: action.note ?? "",
        from: "awaiting_second_look",
        suggestionId: action.suggestion_id,
        contributor,
    });
    if (!merged.success) {
        if (merged.code === "not_found") return gone();
        return merged;
    }

    if (action.suggestion_id) {
        const { finishMergedSuggestion } = await import("@/lib/catalog/suggestionApply");
        await finishMergedSuggestion(action.suggestion_id, { requester, confirmer: actor });
    }
    if (actor.role !== "owner") {
        await alertOwner(
            "merge_applied",
            `Merge applied: "${dup.title}" into "${keep.title}" (asked by @${requester.alias}, second look by @${actor.alias}).`,
            "/catalog/desk/history",
        );
    }
    await finishWrite(actor);
    return { success: true, actionId: action.id, status: "applied", summary: merged.summary };
}

/** The second look says no. Never by the moderator who asked. */
export async function declineMerge(
    actor: RegistryActor,
    actionId: string,
    note: string,
): Promise<WriteResult<{ actionId: string; status: "declined" }>> {
    const why = (note ?? "").trim();
    if (why.length < 3) return fail("invalid", "Say why in a few words; the moderator who asked reads it.");
    const action = await readAction(actionId);
    if (!action || action.kind !== "merge") return fail("not_found", "That merge request is not in the history.");
    if (action.status !== "awaiting_second_look") return fail("invalid", notWaitingWords(action.status));
    if (action.actor_id === actor.userId)
        return fail("forbidden", "You asked for this merge, so someone else gives it the second look.");
    const rules = await secondLookRules(actor, action);
    if (!rules.ok) return fail("forbidden", rules.error);

    // Guarded and checked: if a confirm got there first (registry_merge
    // holds the entry's lock and turns it applied), nothing is updated and
    // the decline stops here instead of also "succeeding".
    const { data, error } = await db()
        .from("registry_actions")
        .update({
            status: "declined",
            second_look_by: actor.userId,
            second_look_at: new Date().toISOString(),
            second_look_note: why.slice(0, 1000),
        })
        .eq("id", action.id)
        .eq("status", "awaiting_second_look")
        .is("applied_at", null)
        .select("id");
    if (error) return dbFailure("Decline failed", error);
    if (!Array.isArray(data) || data.length === 0) {
        const now = await readAction(action.id);
        return fail("invalid", notWaitingWords(now?.status ?? "applied"));
    }

    if (action.suggestion_id) {
        await moveSuggestion(
            action.suggestion_id,
            {
                status: "pending",
                claimed_by: null,
                claimed_until: null,
                admin_notes: `Second look declined the merge: ${why.slice(0, 500)}`,
            },
            ["under_review"],
        );
    }
    if (action.actor_id) {
        try {
            const { createNotification } = await import("@/lib/notifications/createNotification");
            await createNotification({
                userId: action.actor_id,
                type: "system",
                actorId: actor.userId,
                content: `@${actor.alias} did not confirm your merge ("${action.item_title ?? "an entry"}"): ${why.slice(0, 200)}`,
                linkUrl: "/catalog/desk/history",
            });
        } catch (err) {
            logger.error("RegistryWrite", "Decline notice failed (continuing)", err);
        }
    }
    return { success: true, actionId: action.id, status: "declined" };
}

// ══════════════════════════════════════════════════════════════
// Remove
// ══════════════════════════════════════════════════════════════

function countsFromDetail(details: string | null | undefined): Omit<LinkCounts, "total"> {
    try {
        const d = JSON.parse(details ?? "{}") as Record<string, number>;
        return { ...EMPTY_COUNTS, ...d };
    } catch {
        return { ...EMPTY_COUNTS };
    }
}

async function removeRow(
    actor: RegistryActor,
    row: CatalogRow,
    reason: string,
    actionId: string | null,
): Promise<WriteResult<{ removedId: string | null }>> {
    const { data, error } = await db().rpc("registry_remove", {
        p_item: row.id,
        p_action_id: actionId,
        p_actor: actor.userId,
        p_reason: reason,
    });
    if (error) {
        if (error.message !== "already_applied") await markFailed(actionId, "pending");
        if (error.message === "linked") {
            const counts = countsFromDetail(error.details);
            const total = Object.values(counts).reduce((s, n) => s + n, 0);
            return fail(
                "linked",
                `It can't be removed: ${linkWords(counts)} point at it. Merge it into the right entry instead.`,
                { counts: { ...counts, total } },
            );
        }
        return rpcFailure("Removal failed", error);
    }
    return { success: true, removedId: (data as { removed_id?: string } | null)?.removed_id ?? null };
}

/**
 * Remove a row nothing points at (owner ruling 2026-10-16, Q11). It is
 * kept in the archive and can be put back for 30 days. Anything linked
 * (horses, want lists, releases, set pieces ...) is refused: merge it.
 */
export async function removeItem(
    actor: RegistryActor,
    input: { id: string; reason: string },
): Promise<WriteResult<{ actionId: string | null; removedId: string | null }>> {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3 || reason.length > 1000)
        return fail("invalid", "Give a reason of 3 to 1,000 characters; it goes in the history.");
    if (!(await mergeUndoReady())) return fail("not_ready", MERGE_REMOVE_NOT_READY);

    const row = await readRow(input.id);
    if (!row) return fail("not_found", "That entry is no longer in the Registry.");

    // Set pieces first: the database can't see them, only the titles can.
    const counts = await linkCounts(row.id);
    if (counts.total > 0) {
        return fail(
            "linked",
            `It can't be removed: ${linkWords(counts)} point at it. Merge it into the right entry instead.`,
            { counts },
        );
    }

    const limit = await checkRegistryLimit(actor, "remove");
    if (!limit.ok) return fail("limit", limit.error);

    const actionId = await recordAction(actor, {
        kind: "remove",
        status: "pending",
        itemId: row.id,
        itemTitle: row.title,
        summary: `Removed "${row.title}" (${row.maker})`,
        note: reason,
    });
    const removed = await removeRow(actor, row, reason, actionId);
    if (!removed.success) return removed;

    await recordChange(actor, {
        itemId: null,
        changeType: "removal",
        summary: `🗑 Removed "${row.title}" (${row.maker}): ${reason}`,
        actionId,
    });
    if (actor.role !== "owner") {
        await alertOwner(
            "removal",
            `@${actor.alias} removed "${row.title}" (${row.maker}) from the Registry: ${reason.slice(0, 200)}`,
            "/catalog/desk/history",
        );
    }
    await finishWrite(actor);
    return { success: true, actionId, removedId: removed.removedId };
}

// ══════════════════════════════════════════════════════════════
// Undo
// ══════════════════════════════════════════════════════════════

/** A History row that only moved one release's scale (it followed its mold). */
function isScaleFollower(
    r: {
        catalog_item_id: string | null;
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
    },
    mainId: string | null,
): boolean {
    if (!r.catalog_item_id || r.catalog_item_id === mainId) return false;
    const a = Object.keys(r.after ?? {});
    const b = Object.keys(r.before ?? {});
    return a.length === 1 && a[0] === "scale" && b.length === 1 && b[0] === "scale";
}

/**
 * Put back the scale of the releases that followed a mold's scale edit,
 * a few hundred at a time and expect-guarded: a release whose scale has
 * changed again since is left alone and counted.
 */
async function undoScaleFollowers(
    rows: { catalog_item_id: string; before: Record<string, unknown>; after: Record<string, unknown> }[],
): Promise<{
    restored: { catalog_item_id: string; before: unknown; after: unknown; outcome: string }[];
    left: number;
    error?: DbError;
}> {
    const groups = new Map<string, { from: string | null; to: string | null; ids: string[] }>();
    for (const r of rows) {
        const from = (r.after.scale as string | null) ?? null;
        const to = (r.before.scale as string | null) ?? null;
        const key = JSON.stringify([from, to]);
        const g = groups.get(key) ?? { from, to, ids: [] };
        g.ids.push(r.catalog_item_id);
        groups.set(key, g);
    }
    const restored: { catalog_item_id: string; before: unknown; after: unknown; outcome: string }[] = [];
    for (const g of groups.values()) {
        for (let i = 0; i < g.ids.length; i += 200) {
            const chunk = g.ids.slice(i, i + 200);
            let q = db().from("catalog_items").update({ scale: g.to }).in("id", chunk);
            q = g.from === null ? q.is("scale", null) : q.eq("scale", g.from);
            const { data, error } = await q.select("id");
            if (error) return { restored, left: rows.length - restored.length, error };
            for (const r of (data ?? []) as { id: string }[])
                restored.push({
                    catalog_item_id: r.id,
                    before: { scale: g.from },
                    after: { scale: g.to },
                    outcome: "restored",
                });
        }
    }
    return { restored, left: rows.length - restored.length };
}

/** Restore what a field-level action changed, where the row still holds its `after`. */
async function undoFields(
    actor: RegistryActor,
    action: ActionRow,
    reason: string,
): Promise<WriteResult<{ restored: number; drifted: string[]; actionId: string | null }>> {
    const { data: rowsData, error } = await db()
        .from("registry_action_rows")
        .select("catalog_item_id, before, after")
        .eq("action_id", action.id);
    if (error) return dbFailure("Reading the history rows failed", error);
    const all = (rowsData ?? []) as {
        catalog_item_id: string | null;
        before: Record<string, unknown> | null;
        after: Record<string, unknown> | null;
    }[];
    const followers = all.filter((r) => isScaleFollower(r, action.catalog_item_id)) as {
        catalog_item_id: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
    }[];
    const rows = all.filter((r) => !isScaleFollower(r, action.catalog_item_id));

    let restoredCount = 0;
    const drifted: string[] = [];
    const undoRows: { catalog_item_id: string | null; before: unknown; after: unknown; outcome: string }[] = [];

    for (const r of rows) {
        const item = r.catalog_item_id ? await readRow(r.catalog_item_id) : null;
        const after = r.after ?? {};
        const before = r.before ?? {};
        if (!item) {
            drifted.push(...Object.keys(after).map((k) => `${labelOf(k)} (the entry is gone)`));
            continue;
        }
        const attrs = { ...(item.attributes ?? {}) };
        const columns: Record<string, unknown> = {};
        let attrsTouched = false;
        const wasNow: Record<string, unknown> = {};
        const putBack: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(after)) {
            const isColumn = CATALOG_REAL_COLUMNS.has(key);
            const current = isColumn ? (item as unknown as Record<string, unknown>)[key] : attrs[key];
            if (!same(current, value)) {
                drifted.push(labelOf(key));
                continue;
            }
            const old = before[key] ?? null;
            if (isColumn) {
                if (old === null && (key === "title" || key === "maker" || key === "item_type")) {
                    drifted.push(labelOf(key));
                    continue;
                }
                columns[key] = old;
            } else if (old === null) {
                delete attrs[key];
                attrsTouched = true;
            } else {
                attrs[key] = old;
                attrsTouched = true;
            }
            wasNow[key] = current ?? null;
            putBack[key] = old;
        }
        if (Object.keys(putBack).length === 0) continue;
        const payload: Record<string, unknown> = { ...columns };
        if (attrsTouched) payload.attributes = JSON.parse(JSON.stringify(attrs));
        const { data, error: updateError } = await db()
            .from("catalog_items")
            .update(payload)
            .eq("id", item.id)
            .eq("updated_at", item.updated_at)
            .select("id");
        if (updateError) return dbFailure("Undo failed", updateError);
        if (!Array.isArray(data) || data.length === 0) {
            drifted.push(...Object.keys(putBack).map(labelOf));
            continue;
        }
        restoredCount += Object.keys(putBack).length;
        undoRows.push({ catalog_item_id: item.id, before: wasNow, after: putBack, outcome: "restored" });
    }

    if (followers.length) {
        const back = await undoScaleFollowers(followers);
        if (back.error) logger.error("RegistryWrite", "Putting releases' scales back stopped", back.error);
        restoredCount += back.restored.length;
        undoRows.push(...back.restored);
        if (back.left > 0)
            drifted.push(
                `${back.left} release${back.left === 1 ? "" : "s"} whose scale changed again since (left as ${back.left === 1 ? "it is" : "they are"})`,
            );
    }

    if (restoredCount === 0) {
        return fail("conflict", "Nothing left to undo: every field has been changed again since.", { drifted });
    }

    const undoId = await recordAction(actor, {
        kind: "undo",
        itemId: action.catalog_item_id,
        itemTitle: action.item_title,
        suggestionId: action.suggestion_id,
        undoOf: action.id,
        summary: `Undid: ${action.summary}`.slice(0, 2000),
        note: reason,
        rows: undoRows,
    });
    await markUndone(actor, action.id);
    await recordChange(actor, {
        itemId: action.catalog_item_id,
        changeType: "revert",
        summary: `↩️ Undid a change to "${action.item_title ?? "an entry"}": ${reason}`,
        suggestionId: action.suggestion_id,
        actionId: undoId,
    });
    if (action.kind === "approve" && action.suggestion_id) {
        const { withdrawApproval } = await import("@/lib/catalog/suggestionApply");
        await withdrawApproval(action.suggestion_id, actor, reason, drifted);
    }
    return { success: true, restored: restoredCount, drifted, actionId: undoId };
}

/**
 * Changes other people made to a row since it was added: taking the
 * addition back out would throw their work away with it.
 */
async function laterEditsByOthers(action: ActionRow, itemId: string): Promise<string[]> {
    let q = db()
        .from("registry_actions")
        .select("id, actor_id")
        .eq("catalog_item_id", itemId)
        .eq("status", "applied")
        .in("kind", ["edit", "refile", "approve", "revert"])
        .neq("id", action.id);
    if (action.actor_id) q = q.or(`actor_id.is.null,actor_id.neq.${action.actor_id}`);
    const { data, error } = await q.limit(20);
    if (error || !Array.isArray(data)) return [];
    const who = [...new Set((data as { actor_id: string | null }[]).map((r) => r.actor_id))];
    return Promise.all(who.map((id) => aliasOf(id)));
}

/**
 * Undo a History entry within 30 days. Edits, approvals, re-files and
 * reverts put back only fields that still hold what the entry wrote
 * (others are reported as drifted); an addition is removed (refused if
 * anything links to it now, or if someone else has edited it since); a
 * merge is unmerged; a removal is restored; a rejection puts the
 * suggestion back in the queue. When the entry came from a member's
 * suggestion, the approval is withdrawn too (status, credit, notice).
 */
export async function undoAction(
    actor: RegistryActor,
    actionId: string,
    reason: string,
): Promise<WriteResult<{ restored: number; drifted: string[]; actionId: string | null }>> {
    const why = (reason ?? "").trim();
    if (why.length < 3) return fail("invalid", "Say why in a few words; it goes in the history.");
    const action = await readAction(actionId);
    if (!action) return fail("not_found", "That change is not in the history.");
    if (action.status === "undone") return fail("invalid", "That change has already been undone.");
    if (action.status !== "applied") return fail("invalid", "Only applied changes can be undone.");
    if (action.kind === "undo") return fail("invalid", "An undo can't be undone. Make the change again instead.");
    if (new Date(action.undo_until).getTime() < Date.now())
        return fail("invalid", "Changes can be undone for 30 days; this one is older.");

    const limit = await checkRegistryLimit(actor, "edit");
    if (!limit.ok) return fail("limit", limit.error);

    let result: WriteResult<{ restored: number; drifted: string[]; actionId: string | null }>;

    if (action.kind === "edit" || action.kind === "approve" || action.kind === "refile" || action.kind === "revert") {
        result = await undoFields(actor, action, why);
    } else if (action.kind === "reject") {
        if (!action.suggestion_id) return fail("not_found", "That suggestion is no longer on the site.");
        const { reopenSuggestion } = await import("@/lib/catalog/suggestionApply");
        const reopened = await reopenSuggestion(action.suggestion_id, actor, why);
        if (!reopened) return fail("conflict", "That suggestion has been decided again since, so it stays as it is.");
        const undoId = await recordAction(actor, {
            kind: "undo",
            itemId: action.catalog_item_id,
            itemTitle: action.item_title,
            suggestionId: action.suggestion_id,
            undoOf: action.id,
            summary: `Undid: ${action.summary}`.slice(0, 2000),
            note: why,
        });
        await markUndone(actor, action.id);
        result = { success: true, restored: 1, drifted: [], actionId: undoId };
    } else {
        if (!(await mergeUndoReady())) return fail("not_ready", MERGE_REMOVE_NOT_READY);
        if (action.kind === "add") {
            const row = await readRow(action.catalog_item_id ?? "");
            if (!row) return fail("not_found", "That entry is no longer in the Registry.");
            const others = await laterEditsByOthers(action, row.id);
            if (others.length) {
                const names = others.map((a) => `@${a}`).join(", ");
                return fail(
                    "conflict",
                    `It can't be taken back out: ${names} ${others.length === 1 ? "has" : "have"} changed it since it was added. Undo ${others.length === 1 ? "that change" : "those changes"} first, or merge it into the right entry.`,
                );
            }
            const counts = await linkCounts(row.id);
            if (counts.total > 0) {
                return fail(
                    "linked",
                    `It can't be taken back out: ${linkWords(counts)} point at it now. Merge it instead.`,
                    { counts },
                );
            }
            const undoId = await recordAction(actor, {
                kind: "undo",
                status: "pending",
                itemId: row.id,
                itemTitle: row.title,
                suggestionId: action.suggestion_id,
                undoOf: action.id,
                summary: `Undid: ${action.summary}`.slice(0, 2000),
                note: why,
            });
            const removed = await removeRow(actor, row, why, undoId);
            if (!removed.success) return removed;
            await markUndone(actor, action.id);
            await recordChange(actor, {
                itemId: null,
                changeType: "removal",
                summary: `↩️ Took back the addition of "${row.title}": ${why}`,
                actionId: undoId,
            });
            if (action.suggestion_id) {
                const { withdrawApproval } = await import("@/lib/catalog/suggestionApply");
                await withdrawApproval(action.suggestion_id, actor, why);
            }
            result = { success: true, restored: 1, drifted: [], actionId: undoId };
        } else if (action.kind === "merge") {
            const { data, error } = await db().rpc("registry_unmerge", {
                p_action_id: action.id,
                p_actor: actor.userId,
            });
            if (error) return rpcFailure("Unmerge failed", error);
            const d = (data ?? {}) as {
                restored?: number;
                left?: number;
                parent_lost?: boolean;
                same_address?: boolean;
            };
            const drifted: string[] = [];
            if (d.left) drifted.push(`${d.left} link${d.left === 1 ? "" : "s"} changed since and left where they are`);
            if (d.parent_lost) drifted.push("its mold is gone, so it came back unfiled");
            if (d.same_address === false) drifted.push("its old page address is taken, so it has a new one");
            const undoId = await recordAction(actor, {
                kind: "undo",
                itemId: action.catalog_item_id,
                itemTitle: action.item_title,
                relatedItemId: action.related_item_id,
                suggestionId: action.suggestion_id,
                undoOf: action.id,
                summary: `Undid: ${action.summary}`.slice(0, 2000),
                note: why,
            });
            await recordChange(actor, {
                itemId: action.catalog_item_id,
                changeType: "restore",
                summary: `↩️ Unmerged "${action.item_title ?? "an entry"}": ${why}`,
                actionId: undoId,
            });
            if (action.suggestion_id) {
                const { withdrawApproval } = await import("@/lib/catalog/suggestionApply");
                await withdrawApproval(action.suggestion_id, actor, why, drifted);
            }
            result = { success: true, restored: Number(d.restored ?? 0), drifted, actionId: undoId };
        } else if (action.kind === "remove") {
            const { data: archived } = await db()
                .from("catalog_removed_items")
                .select("id")
                .eq("action_id", action.id)
                .is("restored_at", null)
                .maybeSingle();
            const archiveId = (archived as { id: string } | null)?.id;
            if (!archiveId) return fail("not_found", "The removed entry is not in the archive.");
            const { data, error } = await db().rpc("registry_restore", {
                p_removed_id: archiveId,
                p_actor: actor.userId,
            });
            if (error) return rpcFailure("Restore failed", error);
            const d = (data ?? {}) as { parent_lost?: boolean; same_address?: boolean };
            const drifted: string[] = [];
            if (d.parent_lost) drifted.push("its mold is gone, so it came back unfiled");
            if (d.same_address === false) drifted.push("its old page address is taken, so it has a new one");
            const undoId = await recordAction(actor, {
                kind: "undo",
                itemId: action.catalog_item_id,
                itemTitle: action.item_title,
                undoOf: action.id,
                summary: `Undid: ${action.summary}`.slice(0, 2000),
                note: why,
            });
            await recordChange(actor, {
                itemId: action.catalog_item_id,
                changeType: "restore",
                summary: `↩️ Put back "${action.item_title ?? "an entry"}": ${why}`,
                actionId: undoId,
            });
            result = { success: true, restored: 1, drifted, actionId: undoId };
        } else {
            return fail("invalid", "That kind of change can't be undone here.");
        }
    }

    if (!result.success) return result;
    if (actor.role === "moderator" && action.actor_role === "moderator" && action.actor_id !== actor.userId) {
        await alertOwner(
            "undo_other",
            `@${actor.alias} undid another moderator's change: ${action.summary.slice(0, 160)}. Why: ${why.slice(0, 200)}`,
            "/catalog/desk/history",
        );
    }
    await finishWrite(actor);
    return result;
}

// ══════════════════════════════════════════════════════════════
// Claims on suggestions and rejections (the Desk's Queue)
// ══════════════════════════════════════════════════════════════

/** How long a moderator holds a suggestion they opened. */
export const CLAIM_MINUTES = 30;

/**
 * Take a suggestion to review: ONE conditional update moves it from
 * pending to under_review with this moderator's name and a 30-minute
 * clock, only while it is pending, or under review on a claim that has
 * run out or is already theirs (renewing it). While it is under review
 * the member can't edit it (their policy is "own AND pending"), so the
 * moderator decides exactly what they read.
 *
 * A suggestion whose merge waits for a second look is not claimed here:
 * it is decided by confirming or declining that merge.
 *
 * Before 242 there are no claim columns: success with claimedUntil "".
 */
export async function claimSuggestion(
    actor: RegistryActor,
    id: string,
): Promise<WriteResult<{ claimedUntil: string }>> {
    if (!UUID_RE.test(id)) return fail("not_found", "That suggestion is no longer on the site.");
    // The review rules first: a moderator who may not decide it (their own
    // suggestion, their own work) does not hold it either.
    const { readSuggestion, reviewRefusal } = await import("@/lib/catalog/suggestionApply");
    const current = await readSuggestion(id);
    if (!current) return fail("not_found", "That suggestion is no longer on the site.");
    const refusal = await reviewRefusal(current, actor);
    if (refusal) return fail("forbidden", refusal);

    const now = new Date();
    const until = new Date(now.getTime() + CLAIM_MINUTES * 60_000).toISOString();
    const take = { status: "under_review", claimed_by: actor.userId, claimed_until: until };

    const { data, error } = await db()
        .from("catalog_suggestions")
        .update(take)
        .eq("id", id)
        .or(
            `status.eq.pending,and(status.eq.under_review,claimed_until.lt.${now.toISOString()}),and(status.eq.under_review,claimed_by.eq.${actor.userId})`,
        )
        .select("id");
    if (error) {
        if (isMissingSchema(error)) return { success: true, claimedUntil: "" };
        return dbFailure("Claim failed", error);
    }
    if (Array.isArray(data) && data.length > 0) return { success: true, claimedUntil: until };

    // Nothing taken: say why, in words.
    const { data: row } = await db()
        .from("catalog_suggestions")
        .select("id, status, claimed_by, claimed_until")
        .eq("id", id)
        .maybeSingle();
    const s = row as { status: string; claimed_by: string | null; claimed_until: string | null } | null;
    if (!s) return fail("not_found", "That suggestion is no longer on the site.");
    if (s.status !== "pending" && s.status !== "under_review")
        return fail("invalid", "This suggestion has already been decided.");
    if (s.claimed_by && s.claimed_until) {
        const minutes = Math.max(1, Math.ceil((Date.parse(s.claimed_until) - now.getTime()) / 60_000));
        return fail(
            "conflict",
            `@${await aliasOf(s.claimed_by)} is looking at this one for another ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        );
    }
    if (await waitingMergeFor(id))
        return fail(
            "invalid",
            "This report's merge waits for a second look: confirm or decline it under Second looks.",
        );

    // Under review with no claim at all (set before claims existed): take it,
    // still in one conditional update, so two moderators can't both win.
    const { data: legacy, error: legacyError } = await db()
        .from("catalog_suggestions")
        .update(take)
        .eq("id", id)
        .eq("status", "under_review")
        .is("claimed_until", null)
        .select("id");
    if (legacyError) return dbFailure("Claim failed", legacyError);
    if (Array.isArray(legacy) && legacy.length > 0) return { success: true, claimedUntil: until };
    return fail("conflict", "Someone else took this one a moment ago.");
}

/**
 * Let go of a claim: the suggestion goes back to pending, so the member
 * can edit it again and another moderator can take it. Only your own
 * claim (the owner may let go of anyone's). A suggestion whose merge is
 * waiting for a second look keeps its under_review status. Never touches
 * a suggestion that has been decided.
 */
export async function releaseSuggestionClaim(actor: RegistryActor, id: string): Promise<WriteResult> {
    if (!UUID_RE.test(id)) return fail("not_found", "That suggestion is no longer on the site.");
    const waiting = await waitingMergeFor(id);
    const fields: Record<string, unknown> = waiting
        ? { claimed_by: null, claimed_until: null }
        : { status: "pending", claimed_by: null, claimed_until: null };
    let q = db().from("catalog_suggestions").update(fields).eq("id", id).eq("status", "under_review");
    if (actor.role !== "owner") q = q.eq("claimed_by", actor.userId);
    const { error } = await q.select("id");
    if (error) {
        if (isMissingSchema(error)) return { success: true };
        return dbFailure("Letting go of the claim failed", error);
    }
    return { success: true };
}

/**
 * A rejection on the Desk, in the History (kind "reject"): it feeds the
 * speed alarm and stamps the seat, and can be undone (the suggestion goes
 * back to the queue). decideSuggestion checks the daily limit of
 * rejections (checkRegistryLimit "reject") before it decides anything,
 * then calls this once the rejection is made.
 */
export async function recordRejection(
    actor: RegistryActor,
    input: {
        suggestionId: string;
        itemId: string | null;
        itemTitle?: string | null;
        summary: string;
        note: string | null;
    },
): Promise<WriteResult<{ actionId: string | null }>> {
    const actionId = await recordAction(actor, {
        kind: "reject",
        itemId: input.itemId,
        itemTitle: input.itemTitle ?? null,
        suggestionId: input.suggestionId,
        summary: input.summary,
        note: input.note,
    });
    if (actor.role === "moderator") {
        const { error } = await db()
            .from("registry_moderators")
            .update({ last_action_at: new Date().toISOString() })
            .eq("user_id", actor.userId);
        if (error && !isMissingSchema(error)) logger.error("RegistryWrite", "Seat stamp failed (continuing)", error);
    }
    await noteRegistryAction(actor);
    return { success: true, actionId };
}
