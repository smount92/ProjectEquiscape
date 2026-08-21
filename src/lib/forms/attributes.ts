/**
 * Form engine — the `attributes` JSONB bag.
 *
 * The add form built this bag by hand and the edit form took it apart by
 * hand, in a different file, as exact inverses maintained by nobody. Both
 * directions now come off the registry, so a new category attribute is one
 * `FieldSpec` and neither direction can drift.
 */

import type { AssetCategory } from "@/lib/types/database";
import { getAttributeFields, getAttributeKeys } from "./registry";
import type { FormValues } from "./types";

/**
 * Build the JSONB bag from form values. Empty values are omitted entirely
 * rather than stored as `""` — the passport renders on presence.
 */
export function packAttributes(
    category: AssetCategory,
    values: FormValues,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const spec of getAttributeFields(category)) {
        const key = spec.attributeKey as string;
        const raw = values[spec.name];
        if (raw === null || raw === undefined || raw === "") continue;

        if (spec.type === "chips") {
            const items = Array.isArray(raw)
                ? raw.filter((v): v is string => typeof v === "string" && v.trim() !== "")
                : typeof raw === "string"
                  ? [raw.trim()]
                  : [];
            if (items.length > 0) out[key] = items;
            continue;
        }

        if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed) out[key] = trimmed;
        }
    }
    return out;
}

/**
 * Take the bag apart into form values — the exact inverse of
 * `packAttributes`. Missing keys become the control's empty value so the
 * edit form can render without null checks.
 */
export function unpackAttributes(
    category: AssetCategory,
    attributes: Record<string, unknown> | null | undefined,
): FormValues {
    const bag = attributes ?? {};
    const out: FormValues = {};
    for (const spec of getAttributeFields(category)) {
        const key = spec.attributeKey as string;
        const raw = bag[key];
        if (spec.type === "chips") {
            out[spec.name] = Array.isArray(raw)
                ? raw.filter((v): v is string => typeof v === "string")
                : typeof raw === "string" && raw
                  ? [raw]
                  : [];
        } else {
            out[spec.name] = typeof raw === "string" ? raw : "";
        }
    }
    return out;
}

/**
 * Clean an untrusted `attributes` object before a database write: strip
 * keys the category doesn't own, drop empties, coerce the chip fields to
 * string arrays.
 *
 * This is the behaviour `assetFields.validateAttributes` always described
 * in its docstring ("called before every DB write") and never actually had
 * — its only two call sites were in the browser, and `attributes` sits on
 * the server action's column allow-list, so a direct call could write
 * arbitrary JSONB.
 */
export function cleanAttributeBag(
    category: AssetCategory,
    attrs: Record<string, unknown>,
): { valid: boolean; cleaned: Record<string, unknown> } {
    const allowed = getAttributeKeys(category);
    if (allowed.size === 0) return { valid: true, cleaned: {} };

    const cleaned: Record<string, unknown> = {};
    const chipKeys = new Set(
        getAttributeFields(category)
            .filter((f) => f.type === "chips")
            .map((f) => f.attributeKey as string),
    );

    for (const [key, value] of Object.entries(attrs)) {
        if (!allowed.has(key)) continue;
        if (value === null || value === undefined || value === "") continue;

        if (chipKeys.has(key)) {
            if (Array.isArray(value)) {
                cleaned[key] = value.filter((v): v is string => typeof v === "string");
            } else if (typeof value === "string") {
                cleaned[key] = [value];
            }
            continue;
        }

        if (typeof value === "string") cleaned[key] = value.trim();
    }

    return { valid: true, cleaned };
}
