/**
 * Form engine — THE field registry.
 *
 * This is the single sentence that the browser, the server actions, and the
 * CSV importer all read. Before this file existed, "a model needs a name, a
 * finish type, and a condition grade unless it's a work in progress" was
 * written out four times (three times inside `add-horse/page.tsx` alone,
 * once in the edit form) and three separate lists disagreed about what a
 * valid condition grade was.
 *
 * ── Reconciling the config against the forms ──────────────────────────
 * `assetFields.ts` and the two big forms had drifted. The rule used here:
 *
 *   • A field the forms RENDER today stays rendered, in every category
 *     where they render it. Removing a control users can currently fill in
 *     would silently drop data, and no owner asked for that.
 *     (`finish_details` and `public_notes` render unconditionally, so the
 *     spec marks them visible everywhere — the config said model-only.)
 *
 *   • `condition_grade` follows OWNER DECISION 6: tack, props, dioramas and
 *     other models all get one. The config always claimed this and both
 *     forms ignored it. This is the one deliberate, visible behaviour
 *     change in the engine. It needs no migration — `condition_grade` is a
 *     plain nullable TEXT column with no CHECK constraint (001, 053).
 *
 *   • Every other config-vs-form disagreement resolves toward TODAY'S FORM
 *     and is reported to the owner rather than silently changed. Namely:
 *     the config marks `finish_type` and `life_stage` visible for
 *     `other_model`; both forms gate them on a hardcoded `isModel`. The
 *     spec keeps them model-only pending an owner ruling.
 *
 * ── DOM ids are a contract ────────────────────────────────────────────
 * `e2e/inventory.spec.ts` drives the entire create wizard by id. Every id
 * the legacy forms emitted is recorded in `domIds` and asserted in
 * `__tests__/registry.test.ts`. Never rename one.
 */

import type { AssetCategory } from "@/lib/types/database";
import { CONDITION_GRADES, conditionOptionLabel } from "@/lib/conditionGrades";
import { GENDER_GROUPS } from "@/lib/config/genders";
import {
    DISCIPLINES,
    MATERIALS,
    PROP_CATEGORIES,
    SCENE_THEMES,
    SPECIES_TYPES,
    TACK_TYPES,
    TERRAIN_SETTINGS,
    WORKING_PARTS,
} from "./vocab";
import type { FieldContext, FieldOption, FieldSpec, FormMode } from "./types";

// ── Category sets ─────────────────────────────────────────────────────

export const ALL_CATEGORIES: readonly AssetCategory[] = [
    "model",
    "tack",
    "prop",
    "diorama",
    "other_model",
] as const;

const MODEL_ONLY: readonly AssetCategory[] = ["model"] as const;
const MODEL_LIKE: readonly AssetCategory[] = ["model", "other_model"] as const;
/** Everything with a human maker credit — `other_model` is factory output. */
const MAKER_CATEGORIES: readonly AssetCategory[] = ["model", "tack", "prop", "diorama"] as const;

// ── Option lists (pointed at the shared modules, never re-declared) ────

/** The canonical finish enum (migration 001). Was re-declared in three files. */
export const FINISH_TYPE_OPTIONS: readonly FieldOption[] = [
    { value: "OF", label: "OF (Original Finish)" },
    { value: "Custom", label: "Custom (Repaint / Body Mod)" },
    { value: "Artist Resin", label: "Artist Resin" },
] as const;

/**
 * All ten grades, with their glosses. The CSV importer knew only nine — it
 * was missing "Play Grade", so a spreadsheet row saying exactly what the
 * dropdown offered was rejected. Reading the list from here deletes that
 * bug by construction.
 */
export const CONDITION_GRADE_OPTIONS: readonly FieldOption[] = CONDITION_GRADES.map((g) => ({
    value: g.value,
    label: conditionOptionLabel(g),
    hint: g.gloss,
}));

export const LIFE_STAGE_OPTIONS: readonly FieldOption[] = [
    { value: "blank", label: "🎨 Blank / Unpainted" },
    { value: "stripped", label: "🛁 Stripped / Body" },
    { value: "in_progress", label: "🔧 Work in Progress" },
    { value: "completed", label: "✅ Completed" },
    { value: "for_sale", label: "💲 For Sale" },
] as const;

export const TRADE_STATUS_OPTIONS: readonly FieldOption[] = [
    { value: "Not for Sale", label: "Not for Sale" },
    { value: "For Sale", label: "For Sale" },
    { value: "Open to Offers", label: "Open to Offers" },
    { value: "Stolen/Missing", label: "🚨 Stolen/Missing" },
] as const;

export const VISIBILITY_OPTIONS: readonly FieldOption[] = [
    { value: "public", label: "Public", hint: "Visible in the Show Ring" },
    { value: "unlisted", label: "Unlisted", hint: "Anyone with the link can see it" },
    { value: "private", label: "Private", hint: "Only you can see it" },
] as const;

const GENDER_OPTIONS: readonly FieldOption[] = GENDER_GROUPS.flatMap((grp) =>
    grp.options.map((value) => ({ value, label: value, group: grp.label })),
);

const toOptions = (values: readonly string[]): readonly FieldOption[] =>
    values.map((value) => ({ value, label: value }));

// ── Predicates: the ONE required rule ─────────────────────────────────

/** Every item, in every category and mode, needs a name. */
const nameRequired = (ctx: FieldContext): boolean => {
    // Quick add accepts a catalog reference INSTEAD of a typed name — the
    // action derives the name from the catalog item.
    if (ctx.mode === "create-quick") return !ctx.values.catalog_id;
    return true;
};

/** Finish type is required for model horses and nothing else. */
const finishRequired = (ctx: FieldContext): boolean => ctx.category === "model";

/**
 * Condition grade is required for model horses that are not a work in
 * progress. Every other category may record one (owner decision 6) but is
 * never forced to.
 */
const conditionRequired = (ctx: FieldContext): boolean =>
    ctx.category === "model" && ctx.values.life_stage !== "in_progress";

const isWorkInProgress = (ctx: FieldContext): boolean => ctx.values.life_stage === "in_progress";

const isForSale = (ctx: FieldContext): boolean =>
    ctx.values.trade_status === "For Sale" || ctx.values.trade_status === "Open to Offers";

const isTrade = (ctx: FieldContext): boolean => ctx.values.is_trade === true;

// ── The registry ──────────────────────────────────────────────────────

const FULL_ONLY: readonly FormMode[] = ["create-full", "edit"] as const;

export const HORSE_FIELDS: readonly FieldSpec[] = [
    // ── Identity ──────────────────────────────────────────────────────
    {
        name: "custom_name",
        type: "text",
        group: "identity",
        label: "Custom Name",
        labels: { tack: "Item Name", prop: "Item Name", diorama: "Scene Name" },
        categories: ALL_CATEGORIES,
        requiredWhen: nameRequired,
        maxLength: 100,
        table: "user_horses",
        inputKey: "customName",
        placeholder: "e.g. Midnight Star, Patches, Stormy…",
        help: "What do you call this model? This can be a show name, pet name, or whatever you like.",
        domIds: { "create-full": "custom-name", edit: "edit-name" },
        importAliases: ["name", "custom name", "horse name", "title", "model name"],
    },
    {
        name: "sculptor",
        type: "text",
        group: "identity",
        label: "Sculptor / Artist",
        labels: {
            tack: "Maker / Artist",
            prop: "Maker / Artist",
            diorama: "Maker / Artist",
            // Never shown (factory output has no sculptor credit), but kept
            // exact so the legacy-parity test has nothing to forgive.
            other_model: "Sculptor",
        },
        categories: MAKER_CATEGORIES,
        maxLength: 100,
        table: "user_horses",
        inputKey: "sculptor",
        placeholder: "e.g. Sarah Rose, Brigitte Eberl, Kathleen Moody…",
        modes: FULL_ONLY,
        domIds: { "create-full": "sculptor", edit: "edit-sculptor" },
        importAliases: ["sculptor", "artist", "maker"],
    },
    {
        name: "finishing_artist",
        type: "text",
        group: "identity",
        label: "Finishing Artist",
        icon: "🎨",
        categories: MODEL_ONLY,
        maxLength: 100,
        table: "user_horses",
        inputKey: "finishingArtist",
        placeholder: "Who painted or customized this model?",
        modes: FULL_ONLY,
        domIds: { "create-full": "finishing-artist", edit: "edit-finishing-artist" },
        importAliases: ["finishing artist", "painter"],
    },
    {
        name: "edition_number",
        type: "number",
        group: "identity",
        label: "Edition Number",
        categories: MODEL_ONLY,
        min: 1,
        table: "user_horses",
        inputKey: "editionNumber",
        modes: FULL_ONLY,
        placeholder: "#",
    },
    {
        name: "edition_size",
        type: "number",
        group: "identity",
        label: "Edition Size",
        categories: MODEL_ONLY,
        min: 1,
        table: "user_horses",
        inputKey: "editionSize",
        modes: FULL_ONLY,
        placeholder: "Total",
        help: 'e.g. "3 of 50" for limited edition runs.',
    },
    {
        name: "finish_type",
        type: "select",
        group: "identity",
        label: "Finish Type",
        categories: MODEL_ONLY,
        requiredWhen: finishRequired,
        options: FINISH_TYPE_OPTIONS,
        table: "user_horses",
        inputKey: "finishType",
        domIds: { "create-full": "finish-type", edit: "edit-finish", "create-quick": "quick-finish" },
        importAliases: ["finish", "finish type", "finish_type"],
    },
    {
        name: "finish_details",
        type: "text",
        group: "identity",
        // Rendered unconditionally by both forms today — see the header note.
        label: "Finish Details",
        categories: ALL_CATEGORIES,
        maxLength: 100,
        table: "user_horses",
        inputKey: "finishDetails",
        placeholder: "e.g. Glossy, Matte, Satin, Chalky",
        modes: FULL_ONLY,
        domIds: { "create-full": "finish-details", edit: "edit-finish-details" },
    },
    {
        name: "condition_grade",
        type: "select",
        group: "identity",
        label: "Condition Grade",
        labels: { tack: "Condition", prop: "Condition", diorama: "Condition" },
        // OWNER DECISION 6 — every category may be graded.
        categories: ALL_CATEGORIES,
        requiredWhen: conditionRequired,
        disabledWhen: isWorkInProgress,
        options: CONDITION_GRADE_OPTIONS,
        table: "user_horses",
        inputKey: "conditionGrade",
        glossaryAnchor: "condition-grades",
        domIds: {
            "create-full": "condition-grade",
            edit: "edit-condition",
            "create-quick": "quick-condition",
        },
        importAliases: ["condition", "condition grade", "grade", "condition_grade"],
    },
    {
        name: "life_stage",
        type: "select",
        group: "identity",
        label: "Life Stage",
        icon: "🐾",
        categories: MODEL_ONLY,
        options: LIFE_STAGE_OPTIONS,
        table: "user_horses",
        inputKey: "lifeStage",
        help: "This sets the life stage on your Hoofprint timeline.",
        modes: FULL_ONLY,
        domIds: { "create-full": "life-stage", edit: "edit-life-stage" },
    },
    {
        name: "public_notes",
        type: "textarea",
        group: "identity",
        label: "Public Notes",
        categories: ALL_CATEGORIES,
        maxLength: 500,
        table: "user_horses",
        inputKey: "publicNotes",
        placeholder:
            "Visible on your passport — e.g. comes with original box, factory rubs on near leg",
        help: "These notes will be visible to anyone viewing this horse's passport.",
        modes: FULL_ONLY,
        domIds: { "create-full": "public-notes", edit: "edit-public-notes" },
        importAliases: ["notes", "public notes", "description", "comments"],
    },

    // ── Show bio (model only) ─────────────────────────────────────────
    {
        name: "assigned_breed",
        type: "text",
        group: "showbio",
        label: "Assigned Breed",
        categories: MODEL_ONLY,
        maxLength: 100,
        table: "user_horses",
        inputKey: "assignedBreed",
        placeholder: "e.g. Andalusian, Arabian, Quarter Horse",
        modes: FULL_ONLY,
        domIds: { "create-full": "assigned-breed", edit: "edit-assigned-breed" },
        importAliases: ["breed", "assigned breed"],
    },
    {
        name: "assigned_gender",
        type: "select",
        group: "showbio",
        label: "Assigned Gender",
        categories: MODEL_ONLY,
        options: GENDER_OPTIONS,
        table: "user_horses",
        inputKey: "assignedGender",
        modes: FULL_ONLY,
        domIds: { "create-full": "assigned-gender", edit: "edit-assigned-gender" },
        importAliases: ["gender", "sex", "assigned gender"],
    },
    {
        name: "assigned_age",
        type: "text",
        group: "showbio",
        label: "Assigned Age",
        categories: MODEL_ONLY,
        maxLength: 50,
        table: "user_horses",
        inputKey: "assignedAge",
        placeholder: "e.g. Foal, Yearling, Adult, 5 years",
        modes: FULL_ONLY,
        domIds: { "create-full": "assigned-age", edit: "edit-assigned-age" },
    },
    {
        name: "regional_id",
        type: "text",
        group: "showbio",
        label: "Regional Show ID",
        categories: MODEL_ONLY,
        maxLength: 50,
        table: "user_horses",
        inputKey: "regionalId",
        placeholder: "e.g. RX number, Texas System ID",
        modes: FULL_ONLY,
        domIds: { "create-full": "regional-id", edit: "edit-regional-id" },
    },

    // ── Category attributes (the JSONB bag) ───────────────────────────
    {
        name: "tack_type",
        type: "select",
        group: "attributes",
        label: "Tack Type",
        categories: ["tack"],
        options: toOptions(TACK_TYPES),
        attributeKey: "tack_type",
        modes: FULL_ONLY,
    },
    {
        name: "discipline",
        type: "select",
        group: "attributes",
        label: "Discipline",
        categories: ["tack", "diorama"],
        options: toOptions(DISCIPLINES),
        attributeKey: "discipline",
        modes: FULL_ONLY,
    },
    {
        name: "materials",
        type: "chips",
        group: "attributes",
        label: "Materials",
        categories: ["tack", "prop"],
        options: toOptions(MATERIALS),
        attributeKey: "materials",
        modes: FULL_ONLY,
    },
    {
        name: "fits_molds",
        type: "text",
        group: "attributes",
        label: "Fits Molds",
        categories: ["tack"],
        maxLength: 200,
        attributeKey: "fits_molds",
        placeholder: "e.g. Traditional Breyer, Stone ISH",
        modes: FULL_ONLY,
    },
    {
        name: "working_parts",
        type: "chips",
        group: "attributes",
        label: "Working Parts",
        categories: ["tack"],
        options: toOptions(WORKING_PARTS),
        attributeKey: "working_parts",
        modes: FULL_ONLY,
    },
    {
        name: "prop_category",
        type: "select",
        group: "attributes",
        label: "Prop Category",
        categories: ["prop"],
        options: toOptions(PROP_CATEGORIES),
        attributeKey: "prop_category",
        modes: FULL_ONLY,
    },
    {
        name: "dimensions",
        type: "text",
        group: "attributes",
        label: "Dimensions",
        categories: ["prop"],
        maxLength: 100,
        attributeKey: "dimensions",
        placeholder: 'e.g. 6" x 4" x 3"',
        modes: FULL_ONLY,
    },
    {
        name: "terrain_setting",
        type: "select",
        group: "attributes",
        label: "Terrain / Setting",
        categories: ["prop"],
        options: toOptions(TERRAIN_SETTINGS),
        attributeKey: "terrain_setting",
        modes: FULL_ONLY,
    },
    {
        name: "scene_theme",
        type: "select",
        group: "attributes",
        label: "Scene Theme",
        categories: ["diorama"],
        options: toOptions(SCENE_THEMES),
        attributeKey: "scene_theme",
        modes: FULL_ONLY,
    },
    {
        name: "components",
        type: "textarea",
        group: "attributes",
        label: "Components",
        categories: ["diorama"],
        maxLength: 500,
        attributeKey: "components",
        placeholder: "What's in the scene — models, tack, props, figures…",
        modes: FULL_ONLY,
    },
    {
        name: "base_dimensions",
        type: "text",
        group: "attributes",
        label: "Base Dimensions",
        categories: ["diorama"],
        maxLength: 100,
        attributeKey: "base_dimensions",
        modes: FULL_ONLY,
    },
    {
        name: "documentation_notes",
        type: "textarea",
        group: "attributes",
        label: "Documentation Notes",
        categories: ["diorama"],
        maxLength: 500,
        attributeKey: "documentation_notes",
        help: "Reference photos, historical sources, or the story behind the scene.",
        modes: FULL_ONLY,
    },
    {
        name: "species",
        type: "select",
        group: "attributes",
        label: "Species",
        categories: ["other_model"],
        options: toOptions(SPECIES_TYPES),
        attributeKey: "species",
        modes: FULL_ONLY,
    },
    {
        name: "breed",
        type: "text",
        group: "attributes",
        label: "Breed",
        categories: ["other_model"],
        maxLength: 100,
        attributeKey: "breed",
        modes: FULL_ONLY,
    },
    {
        name: "manufacturer",
        type: "text",
        group: "attributes",
        label: "Manufacturer",
        categories: ["other_model"],
        maxLength: 100,
        attributeKey: "manufacturer",
        modes: FULL_ONLY,
        importAliases: ["manufacturer", "brand", "company"],
    },
    {
        name: "model_number",
        type: "text",
        group: "attributes",
        label: "Model Number",
        categories: ["other_model"],
        maxLength: 50,
        attributeKey: "model_number",
        modes: FULL_ONLY,
    },

    // ── Marketplace ───────────────────────────────────────────────────
    {
        name: "trade_status",
        type: "select",
        group: "market",
        label: "Marketplace Status",
        categories: ALL_CATEGORIES,
        options: TRADE_STATUS_OPTIONS,
        table: "user_horses",
        inputKey: "tradeStatus",
        modes: FULL_ONLY,
        domIds: { "create-full": "trade-status", edit: "edit-trade-status" },
    },
    {
        name: "listing_price",
        type: "money",
        group: "market",
        label: "Listing Price",
        icon: "💲",
        categories: ALL_CATEGORIES,
        visibleWhen: isForSale,
        min: 0,
        table: "user_horses",
        inputKey: "listingPrice",
        placeholder: "0.00",
        help: 'Optional — leave blank for "Contact for price"',
        modes: FULL_ONLY,
        domIds: { "create-full": "listing-price", edit: "edit-listing-price" },
    },
    {
        name: "marketplace_notes",
        type: "textarea",
        group: "market",
        label: "Seller Notes",
        icon: "📝",
        categories: ALL_CATEGORIES,
        visibleWhen: isForSale,
        maxLength: 500,
        table: "user_horses",
        inputKey: "marketplaceNotes",
        placeholder: "e.g. Will ship anywhere, Trades welcome, Smoke-free home…",
        modes: FULL_ONLY,
        domIds: { "create-full": "marketplace-notes", edit: "edit-marketplace-notes" },
    },

    // ── Visibility ────────────────────────────────────────────────────
    {
        name: "visibility",
        type: "segmented",
        group: "visibility",
        label: "Visibility",
        icon: "👁️",
        categories: ALL_CATEGORIES,
        options: VISIBILITY_OPTIONS,
        table: "user_horses",
        inputKey: "visibility",
        modes: ["create-full", "create-quick", "edit"],
    },

    // ── Financial vault ───────────────────────────────────────────────
    {
        name: "is_trade",
        type: "checkbox",
        group: "vault",
        label: "Acquired via trade (no cash exchanged)",
        categories: ALL_CATEGORIES,
        table: "financial_vault",
        inputKey: "isTrade",
        modes: FULL_ONLY,
        domIds: { "create-full": "is-trade", edit: "is-trade" },
    },
    {
        name: "purchase_price",
        type: "money",
        group: "vault",
        label: "Purchase Price",
        categories: ALL_CATEGORIES,
        disabledWhen: isTrade,
        min: 0,
        table: "financial_vault",
        inputKey: "purchasePrice",
        placeholder: "0.00",
        modes: FULL_ONLY,
        domIds: { "create-full": "purchase-price", edit: "edit-price" },
        importAliases: ["purchase price", "price paid", "cost", "paid"],
    },
    {
        name: "purchase_date",
        type: "date",
        group: "vault",
        label: "Purchase Date",
        categories: ALL_CATEGORIES,
        table: "financial_vault",
        inputKey: "purchaseDate",
        modes: FULL_ONLY,
        domIds: { "create-full": "purchase-date", edit: "edit-date" },
    },
    {
        name: "purchase_date_text",
        type: "text",
        group: "vault",
        label: "Approximate Purchase Date",
        categories: ALL_CATEGORIES,
        maxLength: 100,
        table: "financial_vault",
        inputKey: "purchaseDateText",
        placeholder: "e.g. BreyerFest 2017, Summer 2015, Christmas 2020",
        help: "Use this when you don't remember the exact date.",
        modes: FULL_ONLY,
        domIds: { "create-full": "purchase-date-text", edit: "edit-purchase-date-text" },
    },
    {
        name: "estimated_current_value",
        type: "money",
        group: "vault",
        label: "Estimated Current Value",
        categories: ALL_CATEGORIES,
        disabledWhen: isTrade,
        min: 0,
        table: "financial_vault",
        inputKey: "estimatedValue",
        placeholder: "0.00",
        modes: FULL_ONLY,
        domIds: { "create-full": "estimated-value", edit: "edit-value" },
        importAliases: ["estimated value", "value", "current value", "worth"],
    },
    {
        name: "insurance_notes",
        type: "text",
        group: "vault",
        label: "Insurance Notes",
        categories: ALL_CATEGORIES,
        maxLength: 500,
        table: "financial_vault",
        inputKey: "insuranceNotes",
        placeholder: "Policy number, coverage details, etc.",
        modes: FULL_ONLY,
        domIds: { "create-full": "insurance-notes", edit: "edit-insurance" },
    },
] as const;

// ── Lookups ───────────────────────────────────────────────────────────

const BY_NAME = new Map<string, FieldSpec>(HORSE_FIELDS.map((f) => [f.name, f]));

/** The spec for a field name, or undefined when the name is unknown. */
export function getFieldSpec(name: string): FieldSpec | undefined {
    return BY_NAME.get(name);
}

/** Every attribute-bag field for a category, in registry order. */
export function getAttributeFields(category: AssetCategory): readonly FieldSpec[] {
    return HORSE_FIELDS.filter((f) => f.attributeKey && f.categories.includes(category));
}

/** Every column field (user_horses or financial_vault) for a category. */
export function getColumnFields(category: AssetCategory): readonly FieldSpec[] {
    return HORSE_FIELDS.filter((f) => f.table && f.categories.includes(category));
}

/** The allowed `attributes` JSONB keys for a category. */
export function getAttributeKeys(category: AssetCategory): Set<string> {
    return new Set(getAttributeFields(category).map((f) => f.attributeKey as string));
}

/** The label a given category actually shows for a field. */
export function resolveLabel(spec: FieldSpec, category: AssetCategory): string {
    return spec.labels?.[category] ?? spec.label;
}

/** Legal values for a select/segmented/chips field, as bare strings. */
export function optionValues(spec: FieldSpec): string[] {
    return (spec.options ?? []).map((o) => o.value);
}

/** The canonical condition-grade values — the list all four consumers share. */
export function conditionGradeValues(): string[] {
    return CONDITION_GRADE_OPTIONS.map((o) => o.value);
}

/** The canonical finish-type values. */
export function finishTypeValues(): string[] {
    return FINISH_TYPE_OPTIONS.map((o) => o.value);
}

/**
 * CSV header synonym → field name, lowercased. Moved in from the importer
 * so a new field declares its own spreadsheet spellings alongside
 * everything else about it.
 */
export function importAliasMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const spec of HORSE_FIELDS) {
        // The field's own name and label are always accepted.
        map.set(spec.name.toLowerCase(), spec.name);
        map.set(spec.label.toLowerCase(), spec.name);
        for (const alias of spec.importAliases ?? []) {
            map.set(alias.toLowerCase(), spec.name);
        }
    }
    return map;
}

/** The field a spreadsheet column header refers to, if any. */
export function matchImportHeader(header: string): string | undefined {
    return importAliasMap().get(header.trim().toLowerCase());
}
