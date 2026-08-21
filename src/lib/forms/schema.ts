/**
 * Form engine — the derived zod schema.
 *
 * One schema, three consumers that previously had zero, one, and a third
 * private rule set between them:
 *
 *   • the browser, for live validation;
 *   • `createHorseRecord` / `updateHorseAction`, which validated NOTHING
 *     beyond a column allow-list — a raw action call could write anything
 *     the whitelist named, including a nonsense condition grade or a
 *     500-character name;
 *   • the CSV importer, which kept its own finish and condition lists.
 *
 * Error messages are written for a collector, not a validator. Nothing here
 * ever surfaces a raw zod issue path.
 */

import { z } from "zod";
import type { AssetCategory } from "@/lib/types/database";
import { HORSE_FIELDS, getFieldSpec, optionValues, resolveLabel } from "./registry";
import { isFieldRequired, isFieldVisible } from "./rules";
import type { FieldContext, FieldProblem, FieldSpec, FormMode, FormValues } from "./types";

// ── Normalisation ─────────────────────────────────────────────────────

/**
 * Coerce one raw control value into the shape the schema expects.
 * Blank strings become `undefined` so "untouched" and "cleared" are the
 * same thing — which is what every one of these fields means.
 */
export function normalizeValue(spec: FieldSpec, raw: unknown): unknown {
    if (raw === null || raw === undefined) return undefined;

    if (spec.type === "checkbox") return raw === true || raw === "true";

    if (spec.type === "chips") {
        if (Array.isArray(raw)) {
            const items = raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
            return items.length > 0 ? items : undefined;
        }
        if (typeof raw === "string" && raw.trim() !== "") return [raw.trim()];
        return undefined;
    }

    if (spec.type === "number" || spec.type === "money") {
        if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
        if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed === "") return undefined;
            const parsed = Number(trimmed);
            // A non-numeric string is passed through unchanged so the schema
            // can report "must be a number" instead of silently dropping it.
            return Number.isNaN(parsed) ? raw : parsed;
        }
        return raw;
    }

    if (typeof raw === "string") {
        const trimmed = raw.trim();
        return trimmed === "" ? undefined : trimmed;
    }

    return raw;
}

/** Normalise a whole value bag, keyed by `FieldSpec.name`. */
export function normalizeValues(context: FieldContext, values: FormValues): FormValues {
    const out: FormValues = {};
    for (const [key, raw] of Object.entries(values)) {
        const spec = getFieldSpec(key);
        if (!spec) continue; // unknown keys are dropped, never forwarded
        if (!isFieldVisible(spec, context)) continue; // not askable in this shape
        const normalized = normalizeValue(spec, raw);
        if (normalized !== undefined) out[key] = normalized;
    }
    return out;
}

// ── Per-field schema ──────────────────────────────────────────────────

function baseSchema(spec: FieldSpec, label: string): z.ZodType {
    switch (spec.type) {
        case "checkbox":
            return z.boolean({ error: `${label} must be yes or no.` });

        case "number":
        case "money": {
            let s = z
                .number({ error: `${label} must be a number.` })
                .finite(`${label} must be a number.`);
            if (spec.min !== undefined) s = s.min(spec.min, `${label} cannot be negative.`);
            if (spec.max !== undefined) s = s.max(spec.max, `${label} is too large.`);
            return s;
        }

        case "date":
            return z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date (YYYY-MM-DD).`);

        case "select":
        case "segmented": {
            const legal = optionValues(spec);
            if (legal.length === 0) return z.string();
            return z.string().refine((v) => legal.includes(v), {
                error: `${label} must be one of: ${legal.join(", ")}.`,
            });
        }

        case "chips": {
            const legal = optionValues(spec);
            const item =
                legal.length > 0
                    ? z.string().refine((v) => legal.includes(v), {
                          error: `${label} must be one of: ${legal.join(", ")}.`,
                      })
                    : z.string();
            return z.array(item);
        }

        default: {
            let s = z.string({ error: `${label} must be text.` });
            if (spec.maxLength !== undefined) {
                s = s.max(
                    spec.maxLength,
                    `${label} is too long (max ${spec.maxLength} characters).`,
                );
            }
            return s;
        }
    }
}

/** The schema for one field in one context, required-ness included. */
export function buildFieldSchema(spec: FieldSpec, context: FieldContext): z.ZodType {
    const label = resolveLabel(spec, context.category);
    const base = baseSchema(spec, label);
    if (isFieldRequired(spec, context)) {
        // A required field must be present AND non-empty. Normalisation has
        // already turned "" into undefined, so presence is enough.
        return base.refine(() => true, { error: `${label} is required.` });
    }
    return base.optional();
}

/**
 * The whole form's schema for one category + mode, keyed by
 * `FieldSpec.name`. Unknown keys are stripped, not rejected — the engine's
 * job is to make the payload safe, not to lecture the caller.
 */
export function buildFormSchema(context: FieldContext): z.ZodObject<z.ZodRawShape> {
    const shape: Record<string, z.ZodType> = {};
    for (const spec of HORSE_FIELDS) {
        if (!isFieldVisible(spec, context)) continue;
        shape[spec.name] = buildFieldSchema(spec, context);
    }
    return z.object(shape as z.ZodRawShape);
}

// ── Validation with human error messages ──────────────────────────────

export type ValidationResult =
    | { ok: true; data: FormValues }
    | { ok: false; problems: FieldProblem[] };

function problemsFromZod(error: z.ZodError, category: AssetCategory): FieldProblem[] {
    return error.issues.map((issue) => {
        const name = String(issue.path[0] ?? "");
        const spec = getFieldSpec(name);
        const label = spec ? resolveLabel(spec, category) : name;
        return { field: name, label, message: issue.message };
    });
}

/**
 * Validate a value bag against the registry.
 *
 * Missing required fields are reported first, in registry order, so the
 * message a user sees matches the order of the controls on the page.
 */
export function validateForm(context: FieldContext, values: FormValues): ValidationResult {
    const normalized = normalizeValues(context, values);
    const problems: FieldProblem[] = [];

    // Required-ness is checked here rather than left to zod so the message
    // is "Custom Name is required." and not a union of type complaints.
    for (const spec of HORSE_FIELDS) {
        if (!isFieldRequired(spec, context)) continue;
        if (normalized[spec.name] === undefined) {
            const label = resolveLabel(spec, context.category);
            problems.push({ field: spec.name, label, message: `${label} is required.` });
        }
    }

    const parsed = buildFormSchema(context).safeParse(normalized);
    if (!parsed.success) {
        for (const p of problemsFromZod(parsed.error, context.category)) {
            // Don't say "required" twice for the same field.
            if (problems.some((existing) => existing.field === p.field)) continue;
            problems.push(p);
        }
    }

    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, data: parsed.success ? (parsed.data as FormValues) : normalized };
}

/** The first problem, phrased for a single-line error banner. */
export function firstProblemMessage(problems: FieldProblem[]): string {
    if (problems.length === 0) return "";
    if (problems.length === 1) return problems[0].message;
    return `${problems[0].message} (${problems.length - 1} more ${
        problems.length === 2 ? "problem" : "problems"
    } to fix)`;
}

// ── Server-action projections ─────────────────────────────────────────

/**
 * Translate a `createHorseRecord`-shaped payload (camelCase `inputKey`s)
 * into the registry's own key space so it can be validated like any form.
 * Keys the registry doesn't know are dropped.
 */
export function fromActionInput(payload: Record<string, unknown>): FormValues {
    const values: FormValues = {};
    for (const spec of HORSE_FIELDS) {
        if (!spec.inputKey) continue;
        if (!(spec.inputKey in payload)) continue;
        values[spec.name] = payload[spec.inputKey];
    }
    return values;
}

/** The inverse of `fromActionInput`. */
export function toActionInput(values: FormValues): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const spec of HORSE_FIELDS) {
        if (!spec.inputKey) continue;
        if (values[spec.name] === undefined) continue;
        payload[spec.inputKey] = values[spec.name];
    }
    return payload;
}

/**
 * Validate the payload `createHorseRecord` actually receives.
 *
 * The action previously trusted its caller completely: a hand-rolled fetch
 * could set `condition_grade` to anything, exceed every length cap, and
 * write an arbitrary `attributes` blob. This is the boundary that closes.
 */
export function validateCreateInput(
    payload: Record<string, unknown>,
    mode: FormMode = "create-full",
): ValidationResult {
    const category = (payload.assetCategory as AssetCategory) ?? "model";
    const context: FieldContext = { category, mode, values: {} };
    const values = fromActionInput(payload);
    // Predicates read from `values`, so seed the context with them.
    context.values = normalizeValues({ ...context, values }, values);
    return validateForm(context, values);
}

/**
 * Validate an `updateHorseAction` payload. Column-keyed, split across two
 * tables, and partial by nature — an edit only sends what changed, so
 * required-ness is checked only for fields the payload actually carries.
 */
export function validateUpdateInput(
    category: AssetCategory,
    horseUpdate: Record<string, unknown> | null,
    vaultData: Record<string, unknown> | null,
): ValidationResult {
    const merged: FormValues = { ...(horseUpdate ?? {}), ...(vaultData ?? {}) };
    const context: FieldContext = { category, mode: "edit", values: merged };
    const normalized = normalizeValues(context, merged);
    context.values = normalized;

    const problems: FieldProblem[] = [];

    // A partial update may legitimately omit a required field; but if it
    // SENDS one, it may not send it empty.
    for (const spec of HORSE_FIELDS) {
        if (!isFieldRequired(spec, context)) continue;
        if (!(spec.name in merged)) continue;
        if (normalized[spec.name] === undefined) {
            const label = resolveLabel(spec, category);
            problems.push({ field: spec.name, label, message: `${label} is required.` });
        }
    }

    const parsed = buildFormSchema(context).partial().safeParse(normalized);
    if (!parsed.success) {
        for (const p of problemsFromZod(parsed.error, category)) {
            if (problems.some((existing) => existing.field === p.field)) continue;
            problems.push(p);
        }
    }

    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, data: normalized };
}
