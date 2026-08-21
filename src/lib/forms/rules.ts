/**
 * Form engine — rule evaluation.
 *
 * Pure functions over the registry. Everything that used to be a hardcoded
 * `isModel &&` in a JSX branch, or one of the four copies of the
 * required-field rule, resolves here instead.
 */

import type { AssetCategory } from "@/lib/types/database";
import { HORSE_FIELDS, resolveLabel } from "./registry";
import type { FieldContext, FieldGroup, FieldSpec, FormMode, FormValues } from "./types";

/** Convenience constructor so callers don't rebuild the context by hand. */
export function ctx(
    category: AssetCategory,
    mode: FormMode,
    values: FormValues = {},
): FieldContext {
    return { category, mode, values };
}

/** Does this field appear in this mode at all? Absent `modes` means all. */
export function isFieldInMode(spec: FieldSpec, mode: FormMode): boolean {
    return !spec.modes || spec.modes.includes(mode);
}

/**
 * Is the field rendered right now? Three gates, in order: the category owns
 * it, the mode offers it, and any `visibleWhen` predicate passes.
 */
export function isFieldVisible(spec: FieldSpec, context: FieldContext): boolean {
    if (!spec.categories.includes(context.category)) return false;
    if (!isFieldInMode(spec, context.mode)) return false;
    if (spec.visibleWhen && !spec.visibleWhen(context)) return false;
    return true;
}

/**
 * THE required rule — the single replacement for all four hand-written
 * copies. A field can only be required if it is visible.
 */
export function isFieldRequired(spec: FieldSpec, context: FieldContext): boolean {
    if (!isFieldVisible(spec, context)) return false;
    if (!spec.requiredWhen) return false;
    return spec.requiredWhen(context);
}

/** Rendered, but not editable (condition grade on a work in progress). */
export function isFieldDisabled(spec: FieldSpec, context: FieldContext): boolean {
    if (!spec.disabledWhen) return false;
    return spec.disabledWhen(context);
}

/** Every visible field, in registry order. */
export function getVisibleFields(context: FieldContext): FieldSpec[] {
    return HORSE_FIELDS.filter((f) => isFieldVisible(f, context));
}

/** Every visible field in one group, in registry order. */
export function getGroupFields(context: FieldContext, group: FieldGroup): FieldSpec[] {
    return getVisibleFields(context).filter((f) => f.group === group);
}

/** The groups a category actually uses, in canonical order. */
export function getActiveGroups(context: FieldContext): FieldGroup[] {
    const order: FieldGroup[] = [
        "identity",
        "attributes",
        "showbio",
        "market",
        "visibility",
        "vault",
    ];
    const present = new Set(getVisibleFields(context).map((f) => f.group));
    return order.filter((g) => present.has(g));
}

/** Every field that must be filled in before this form can be submitted. */
export function getRequiredFields(context: FieldContext): FieldSpec[] {
    return HORSE_FIELDS.filter((f) => isFieldRequired(f, context));
}

/** True when a value counts as "the user filled this in". */
export function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return true;
}

/**
 * The required fields that are still empty, in registry order, labelled the
 * way the user saw them. An empty array means the form can advance.
 *
 * This is what the step rail, the Next button, and the submit guard all
 * ask — one answer, one place.
 */
export function getMissingRequiredFields(
    context: FieldContext,
): { name: string; label: string }[] {
    return getRequiredFields(context)
        .filter((spec) => !hasValue(context.values[spec.name]))
        .map((spec) => ({ name: spec.name, label: resolveLabel(spec, context.category) }));
}

/** Convenience: can this form be submitted as it stands? */
export function canSubmit(context: FieldContext): boolean {
    return getMissingRequiredFields(context).length === 0;
}

/**
 * The DOM id for a field in a given mode. Returns undefined when the legacy
 * forms never gave it one — the renderer then falls back to a derived id,
 * but it must never invent one for a field that HAS a recorded id.
 */
export function getDomId(spec: FieldSpec, mode: FormMode): string | undefined {
    return spec.domIds?.[mode];
}
