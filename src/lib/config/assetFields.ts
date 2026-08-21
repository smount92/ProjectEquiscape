/**
 * Shared field configuration for asset categories.
 *
 * ── This file is now a VIEW, not a source ─────────────────────────────
 * The real field spec lives in `src/lib/forms/registry.ts`. Everything
 * below that describes a field — which categories show it, what it's
 * called, whether it's required — is DERIVED from that registry, so the
 * config and the forms can no longer disagree the way they had (the config
 * promised tack a condition grade for a year while both forms hard-coded
 * the control to models only).
 *
 * The public API is unchanged, so the three legacy forms and the display
 * pages keep working byte-for-byte while the engine soaks behind
 * NEXT_PUBLIC_FORM_ENGINE.
 *
 * Gallery slots, steps, and the page-title helpers are still authored here
 * — they describe layout, not fields.
 */

import type { AssetCategory } from "@/lib/types/database";
import { HORSE_FIELDS, resolveLabel } from "@/lib/forms/registry";
import { cleanAttributeBag } from "@/lib/forms/attributes";
import type { FieldSpec } from "@/lib/forms/types";

// ── Dropdown value arrays ──
// Authored in @/lib/forms/vocab (so the registry can read them without a
// circular import) and re-exported here — every existing import still works.

export {
    TACK_TYPES,
    DISCIPLINES,
    MATERIALS,
    PROP_CATEGORIES,
    TERRAIN_SETTINGS,
    SCENE_THEMES,
    SPECIES_TYPES,
    WORKING_PARTS,
} from "@/lib/forms/vocab";

// ── Types ──

export interface GallerySlot {
  angle: string;
  label: string;
  primary?: boolean;
}

export interface StepDef {
  label: string;
  icon: string;
}

export interface FieldDef {
  visible: boolean;
  label: string;
  required: boolean;
}

export interface AssetConfig {
  label: string;
  icon: string;
  steps: StepDef[];
  gallerySlots: GallerySlot[];
  fields: Record<string, FieldDef>;
  showReferenceStep: boolean;
  showHoofprint: boolean;
  showShowBio: boolean;
}

// ── Gallery slots per category ──

const MODEL_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Near-Side (Recommended)", primary: true },
  { angle: "Right_Side", label: "Off-Side" },
  { angle: "Front_Chest", label: "Front / Chest" },
  { angle: "Back_Hind", label: "Hindquarters / Tail" },
  { angle: "Belly_Makers_Mark", label: "Belly / Maker's Mark" },
];

const TACK_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Recommended)", primary: true },
  { angle: "Detail_Face_Eyes", label: "Detail / Hardware" },
  { angle: "Belly_Makers_Mark", label: "Maker's Mark" },
  { angle: "Right_Side", label: "On-Model Fit" },
];

const PROP_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Recommended)", primary: true },
  { angle: "Right_Side", label: "Scale Reference" },
  { angle: "Detail_Face_Eyes", label: "Detail" },
  { angle: "Back_Hind", label: "In-Use / Scene" },
];

const DIORAMA_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Overview (Recommended)", primary: true },
  { angle: "Detail_Face_Eyes", label: "Close-Up 1" },
  { angle: "Right_Side", label: "Close-Up 2" },
  { angle: "Belly_Makers_Mark", label: "Documentation Card" },
];

const OTHER_MODEL_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Recommended)", primary: true },
  { angle: "Right_Side", label: "Side View" },
  { angle: "Detail_Face_Eyes", label: "Detail" },
  { angle: "Belly_Makers_Mark", label: "Maker's Mark" },
];

// ── Steps per category ──

const FULL_STEPS: StepDef[] = [
  { label: "Gallery", icon: "📸" },
  { label: "Reference", icon: "🔗" },
  { label: "Identity", icon: "🏷️" },
  { label: "Vault", icon: "🔒" },
];

const SHORT_STEPS: StepDef[] = [
  { label: "Gallery", icon: "📸" },
  { label: "Details", icon: "🏷️" },
  { label: "Vault", icon: "🔒" },
];

// ── Field definitions per category — DERIVED from the registry ──

/**
 * The ten keys this config has always described, mapped to the registry
 * field that now backs each one. Two keys have no 1:1 spec:
 *
 *   • `edition_info` — one config key covering the registry's
 *     `edition_number` + `edition_size` pair.
 *   • `show_bio` — a whole GROUP of registry fields (assigned breed,
 *     gender, age, regional id), not a field.
 *
 * Both resolve through their representative spec, named here.
 */
const LEGACY_FIELD_SOURCES: { key: string; from: string; label: string }[] = [
  { key: "custom_name", from: "custom_name", label: "Custom Name" },
  { key: "sculptor", from: "sculptor", label: "Sculptor / Artist" },
  { key: "finishing_artist", from: "finishing_artist", label: "Finishing Artist" },
  { key: "edition_info", from: "edition_number", label: "Edition Info" },
  { key: "finish_type", from: "finish_type", label: "Finish Type" },
  { key: "finish_details", from: "finish_details", label: "Finish Details" },
  { key: "condition_grade", from: "condition_grade", label: "Condition Grade" },
  { key: "life_stage", from: "life_stage", label: "Life Stage" },
  { key: "show_bio", from: "assigned_breed", label: "Show Bio" },
  { key: "public_notes", from: "public_notes", label: "Public Notes" },
];

const SPEC_BY_NAME = new Map<string, FieldSpec>(HORSE_FIELDS.map((f) => [f.name, f]));

function makeFields(category: AssetCategory): Record<string, FieldDef> {
  const fields: Record<string, FieldDef> = {};

  for (const entry of LEGACY_FIELD_SOURCES) {
    const spec = SPEC_BY_NAME.get(entry.from);
    if (!spec) continue;

    const visible = spec.categories.includes(category);
    // `required` is evaluated in a neutral context — no life stage chosen,
    // so a model's condition grade reads as required, exactly as the old
    // literal said. The engine re-evaluates it per keystroke; this static
    // snapshot is only here to keep the legacy shape honest.
    const required = visible
      ? Boolean(spec.requiredWhen?.({ category, mode: "create-full", values: {} }))
      : false;

    fields[entry.key] = {
      visible,
      // The config's own key labels win where they differ from the field's
      // (an `edition_info` control is labelled "Edition Info", not
      // "Edition Number"); otherwise the registry's per-category label.
      label: entry.key === entry.from ? resolveLabel(spec, category) : entry.label,
      required,
    };
  }

  return fields;
}

// ── Config map ──

const CONFIGS: Record<AssetCategory, AssetConfig> = {
  model: {
    label: "Model Horse",
    icon: "🐎",
    steps: FULL_STEPS,
    gallerySlots: MODEL_GALLERY,
    fields: makeFields("model"),
    showReferenceStep: true,
    showHoofprint: true,
    showShowBio: true,
  },
  tack: {
    label: "Tack & Gear",
    icon: "🏇",
    steps: SHORT_STEPS,
    gallerySlots: TACK_GALLERY,
    fields: makeFields("tack"),
    showReferenceStep: false,
    showHoofprint: false,
    showShowBio: false,
  },
  prop: {
    label: "Prop",
    icon: "🌲",
    steps: SHORT_STEPS,
    gallerySlots: PROP_GALLERY,
    fields: makeFields("prop"),
    showReferenceStep: false,
    showHoofprint: false,
    showShowBio: false,
  },
  diorama: {
    label: "Diorama",
    icon: "🎭",
    steps: SHORT_STEPS,
    gallerySlots: DIORAMA_GALLERY,
    fields: makeFields("diorama"),
    showReferenceStep: false,
    showHoofprint: false,
    showShowBio: false,
  },
  other_model: {
    label: "Other Model",
    icon: "🐄",
    steps: FULL_STEPS,
    gallerySlots: OTHER_MODEL_GALLERY,
    fields: makeFields("other_model"),
    showReferenceStep: true,
    showHoofprint: true,
    showShowBio: false,
  },
};

// ── Public API ──

export function getAssetConfig(category: AssetCategory): AssetConfig {
  return CONFIGS[category] ?? CONFIGS.model;
}

export function getGallerySlots(category: AssetCategory): GallerySlot[] {
  return (CONFIGS[category] ?? CONFIGS.model).gallerySlots;
}

export function getSteps(category: AssetCategory): StepDef[] {
  return (CONFIGS[category] ?? CONFIGS.model).steps;
}

export function isFieldVisible(category: AssetCategory, fieldName: string): boolean {
  const fields = (CONFIGS[category] ?? CONFIGS.model).fields;
  return fields[fieldName]?.visible ?? false;
}

export function getFieldLabel(category: AssetCategory, fieldName: string): string {
  const fields = (CONFIGS[category] ?? CONFIGS.model).fields;
  return fields[fieldName]?.label ?? fieldName;
}

/**
 * Validate and clean attributes JSONB for a given category.
 * Strips unknown keys, coerces types (e.g. materials must be string[]).
 *
 * Now a thin alias for `@/lib/forms/attributes.cleanAttributeBag`, which
 * derives the allowed keys from the registry. The old docstring claimed
 * this ran "before every DB write" — it didn't; both call sites were in the
 * browser. As of the form engine, the server actions call it too.
 */
export function validateAttributes(
  category: AssetCategory,
  attrs: Record<string, unknown>
): { valid: boolean; cleaned: Record<string, unknown> } {
  return cleanAttributeBag(category, attrs);
}

/**
 * Get the category-aware label for the asset (e.g. "Model Passport" vs "Item Details")
 */
export function getCategoryPageTitle(category: AssetCategory): string {
  switch (category) {
    case "model": return "Model Passport";
    case "tack": return "Tack Details";
    case "prop": return "Prop Details";
    case "diorama": return "Diorama Details";
    case "other_model": return "Model Details";
    default: return "Item Details";
  }
}

/**
 * Get the human-readable label for the category
 */
export function getCategoryLabel(category: AssetCategory): string {
  return (CONFIGS[category] ?? CONFIGS.model).label;
}
