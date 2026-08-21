/**
 * Form engine — the field-spec vocabulary.
 *
 * One `FieldSpec` describes a single thing a collector can write down about
 * an item: what kind of control it is, which asset categories it belongs to,
 * when it is required, what the browser calls it, what the server action
 * calls it, and which DOM id it has carried since the hand-written forms.
 *
 * Nothing in here knows about React. The registry (`registry.ts`), the rule
 * evaluator (`rules.ts`), the zod derivation (`schema.ts`), and the JSONB
 * packer (`attributes.ts`) are all pure functions over these types, so the
 * browser, the server actions, and the CSV importer can share one answer to
 * "what is a valid horse?".
 */

import type { AssetCategory } from "@/lib/types/database";

/** The control a field renders as. */
export type FieldType =
    | "text"
    | "textarea"
    | "select"
    | "number"
    | "money"
    | "date"
    | "chips"
    | "checkbox"
    | "segmented";

/**
 * The four consumers of the engine. `import` is validation-only — the CSV
 * importer has no rendered controls, it just needs the same option lists,
 * the same required rule, and the same normalizers.
 */
export type FormMode = "create-full" | "create-quick" | "edit" | "import";

export const FORM_MODES: readonly FormMode[] = [
    "create-full",
    "create-quick",
    "edit",
    "import",
] as const;

/**
 * Which ledger page a field belongs on. The renderer groups by this; the
 * step rail is built from the groups a category actually uses.
 */
export type FieldGroup =
    | "identity"
    | "showbio"
    | "attributes"
    | "market"
    | "visibility"
    | "vault";

/** Free-form field values, keyed by `FieldSpec.name`. */
export type FormValues = Record<string, unknown>;

/** Everything a `visibleWhen` / `requiredWhen` / `disabledWhen` predicate sees. */
export interface FieldContext {
    category: AssetCategory;
    mode: FormMode;
    values: FormValues;
}

export interface FieldOption {
    value: string;
    label: string;
    /** optgroup label (gender groups) */
    group?: string;
    /** one-line gloss rendered beside the control (condition grades) */
    hint?: string;
}

export interface FieldSpec {
    /**
     * Canonical key. For columns this is the `user_horses` /
     * `financial_vault` column name; for JSONB fields it is the
     * `attributes` key. Unique across the registry.
     */
    name: string;
    type: FieldType;
    group: FieldGroup;
    /**
     * Default label. Per-category overrides in `labels` win.
     * Emoji live in `icon`, never here — this string is also what error
     * messages say, and "🐾 Life Stage is required." reads badly.
     */
    label: string;
    labels?: Partial<Record<AssetCategory, string>>;
    /** Decorative glyph rendered before the label. Never part of a message. */
    icon?: string;
    /** Asset categories in which this field exists at all. */
    categories: readonly AssetCategory[];
    /** Modes that offer this field. Defaults to all four. */
    modes?: readonly FormMode[];
    /** Further narrowing by current values (listing price only when For Sale). */
    visibleWhen?: (ctx: FieldContext) => boolean;
    /**
     * THE required rule. Absent means never required. This replaces all four
     * hand-written copies of "a model needs a name, a finish type, and a
     * condition grade unless it's a work in progress".
     */
    requiredWhen?: (ctx: FieldContext) => boolean;
    /** Rendered but not editable (condition grade on a work in progress). */
    disabledWhen?: (ctx: FieldContext) => boolean;
    options?: readonly FieldOption[];
    maxLength?: number;
    min?: number;
    max?: number;
    /** Help text under the control. */
    help?: string;
    placeholder?: string;
    /** Glossary anchor (`/learn/glossary#<id>`). */
    glossaryAnchor?: string;
    /**
     * Present => this field lives in the `attributes` JSONB bag rather than
     * in a column. The value is the bag key (equal to `name` today, kept
     * separate so the two can diverge without a migration).
     */
    attributeKey?: string;
    /** Which table the column belongs to. Omitted for attribute fields. */
    table?: "user_horses" | "financial_vault";
    /**
     * The camelCase key this field carries in the `createHorseRecord`
     * server-action payload. Absent when the action does not accept it.
     */
    inputKey?: string;
    /**
     * DOM ids as the hand-written forms emitted them, per mode. These are a
     * contract: `e2e/inventory.spec.ts` drives the whole wizard by id, so
     * renaming one is a silent break. Never change an existing entry.
     */
    domIds?: Partial<Record<FormMode, string>>;
    /** CSV header synonyms, lowercased. Moved in from the importer. */
    importAliases?: readonly string[];
}

/** A field that failed validation, in the engine's own vocabulary. */
export interface FieldProblem {
    /** `FieldSpec.name` */
    field: string;
    /** The label the user actually saw. */
    label: string;
    /** Plain-English, never a zod dump. */
    message: string;
    /**
     * `missing` — a required field was left empty.
     * `invalid` — a value was supplied that the field can never hold
     *   (outside the enum, over the length cap, negative, not a number).
     *
     * The distinction matters at the server boundary: an `invalid` value
     * cannot come from any legitimate caller, because no rendered control
     * can produce it, so the actions reject it outright. `missing` is
     * softer — a create path that predates the engine may simply not send
     * a field — so it rides in log-only mode during the flag soak, exactly
     * as COMMERCE_AND_COMMS_PLAN §4.3 step 6 asks.
     */
    kind: "missing" | "invalid";
}
