/**
 * The fields a member may correct on a catalog entry.
 *
 * WHY THIS MODULE EXISTS. The correction form used to build its field list
 * from `Object.entries(attributes).filter(v != null)` — so it offered only
 * the fields that were ALREADY FILLED. Look at a row with no year, no
 * colour and no run type and the form gave you Title, Maker, Scale and
 * nothing else. There was no way to add a missing value at all.
 *
 * That one filter shaped the whole contribution pattern: of 51 suggestions
 * ever received, 45 were whole new entries and only 6 were corrections —
 * because the addition form offered 17 fields and the correction form
 * offered 3. It is also why `breed` and `gender` sit on 0 of 10,945 rows
 * despite both being built, validated and shipped: they were only ever
 * reachable by creating a new entry.
 *
 * The catalog's defect is EMPTINESS, not wrongness — no colour on 4,988
 * rows, no year on 3,589 — and emptiness was the one thing members could
 * not fix.
 *
 * Pure data plus one pure function, so both forms read the same list and
 * the vocabularies cannot drift apart.
 */

import {
    CANONICAL_SCALES,
    CATALOG_CATEGORIES,
    CATALOG_GENDERS,
    RUN_TYPES,
} from "@/lib/catalog/taxonomy";

export type FieldKind = "text" | "textarea" | "select" | "number";

export interface EditableField {
    key: string;
    label: string;
    kind: FieldKind;
    /** Present for `select`. The empty option is added by the renderer. */
    options?: readonly string[];
    /** Shown under the input. Keep it about the VALUE, not the mechanics. */
    help?: string;
    placeholder?: string;
}

/**
 * Material's vocabulary lives in the new-entry form's markup and nowhere
 * else. Repeated here so the correction form offers the same six rather
 * than inventing a seventh, and so there is one obvious place to move it
 * to taxonomy.ts when someone does that properly.
 */
export const MATERIAL_OPTIONS = [
    "Plastic", "Resin", "Pewter", "China", "Metal", "Other",
] as const;

/**
 * The curated set, in the order a person would fill them in: what it is,
 * then when, then how many, then the details.
 *
 * Ordering is deliberate. A member who opens this and sees `cast_medium`
 * above `color_description` concludes the form is for someone else.
 */
export const CATALOG_EDITABLE_FIELDS: readonly EditableField[] = [
    { key: "title", label: "Name", kind: "text",
      help: "The model's name as the maker released it." },
    { key: "maker", label: "Maker", kind: "text",
      help: "Breyer, Peter Stone, North Light, or the artist's name." },
    { key: "item_type", label: "Type", kind: "select",
      options: CATALOG_CATEGORIES.map((c) => c.value) },
    { key: "scale", label: "Scale", kind: "select", options: CANONICAL_SCALES },
    { key: "model_number", label: "Model number", kind: "text",
      placeholder: "e.g. 712053",
      help: "The maker's own number. The single most useful field for identifying a model." },
    { key: "color_description", label: "Colour and markings", kind: "textarea",
      placeholder: "Bay pinto, blaze, four stockings",
      help: "Base colour first, then markings. Plain hobby terms." },
    { key: "release_year_start", label: "First released", kind: "number", placeholder: "1998" },
    { key: "release_year_end", label: "Last released", kind: "number", placeholder: "2004",
      help: "Leave blank if it was a single year." },
    { key: "run_type", label: "Run type", kind: "select", options: RUN_TYPES },
    { key: "run_count", label: "Pieces made", kind: "number", placeholder: "1500" },
    { key: "retail_price", label: "Original retail price", kind: "text", placeholder: "59.99",
      help: "What it cost new, in US dollars. Not what it sells for now." },
    { key: "material", label: "Material", kind: "select", options: MATERIAL_OPTIONS },
    { key: "mold_name", label: "Mold", kind: "text",
      help: "The sculpture this paint job was applied to." },
    { key: "sculptor", label: "Sculptor", kind: "text",
      help: "Who sculpted the mold." },
    { key: "breed", label: "Breed", kind: "text",
      help: "Free text on purpose — there is no closed breed list good enough to lock you into." },
    { key: "gender", label: "Gender", kind: "select", options: CATALOG_GENDERS },
];

/**
 * Pipeline plumbing rather than catalog fact. The reference page hides
 * these, so offering them invites corrections nobody can ever see.
 */
export const HIDDEN_ATTRIBUTES: ReadonlySet<string> = new Set([
    "source", "source_id", "source_note",
]);

export interface FieldEdit {
    key: string;
    label: string;
    kind: FieldKind;
    options?: readonly string[];
    help?: string;
    placeholder?: string;
    original: string;
    current: string;
    /** True when the entry has no value yet — the form says "add" not "fix". */
    isEmpty: boolean;
}

export interface EditableSource {
    title: string;
    maker: string | null;
    scale: string | null;
    item_type?: string | null;
    attributes?: Record<string, unknown> | null;
}

const REAL_COLUMN_KEYS = new Set(["title", "maker", "scale", "item_type"]);

function valueFor(item: EditableSource, key: string): string {
    if (key === "title") return item.title ?? "";
    if (key === "maker") return item.maker ?? "";
    if (key === "scale") return item.scale ?? "";
    if (key === "item_type") return item.item_type ?? "";
    const v = (item.attributes ?? {})[key];
    return v == null ? "" : String(v);
}

/**
 * Every field a member may edit on this entry: the whole curated set
 * whether filled or not, PLUS any other attribute the row already
 * carries, so nothing that exists silently becomes uneditable.
 */
export function buildEditableFields(item: EditableSource): FieldEdit[] {
    const curated = CATALOG_EDITABLE_FIELDS.map((f) => {
        const value = valueFor(item, f.key);
        return { ...f, original: value, current: value, isEmpty: value === "" };
    });

    const known = new Set(CATALOG_EDITABLE_FIELDS.map((f) => f.key));
    const extras: FieldEdit[] = Object.entries(item.attributes ?? {})
        .filter(([k, v]) => !known.has(k) && !HIDDEN_ATTRIBUTES.has(k) && v != null && v !== "")
        .map(([k, v]) => ({
            key: k,
            label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            kind: "text" as const,
            original: String(v),
            current: String(v),
            isEmpty: false,
        }));

    return [...curated, ...extras];
}

/**
 * What actually gets submitted. A field the member left blank and that was
 * already blank is NOT a change — without this, opening the form and
 * closing it would propose emptying every unfilled field on the row.
 */
export function changedFields(fields: FieldEdit[]): FieldEdit[] {
    return fields.filter((f) => f.current.trim() !== f.original.trim());
}

/** Which curated fields this entry is still missing — drives the nudge. */
export function missingFieldLabels(item: EditableSource): string[] {
    return CATALOG_EDITABLE_FIELDS
        .filter((f) => !REAL_COLUMN_KEYS.has(f.key) && valueFor(item, f.key) === "")
        .map((f) => f.label);
}
