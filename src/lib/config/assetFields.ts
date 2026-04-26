/**
 * Shared field configuration for asset categories.
 * Single source of truth consumed by add-horse, edit, and display pages.
 * Prevents drift between add/edit forms.
 */

import type { AssetCategory } from "@/lib/types/database";

// ── Dropdown value arrays ──

export const TACK_TYPES = ["Saddle", "Bridle", "Halter", "Blanket/Sheet", "Boots/Wraps", "Breast Collar", "Girth/Cinch", "Harness Set", "Bit", "Reins", "Pad/Numnah", "Martingale", "Complete Set", "Other"] as const;

export const DISCIPLINES = ["Western", "English", "Dressage", "Jumping/Hunter", "Driving/Harness", "Racing", "Endurance", "Arabian/Native", "Costume", "Multi-Discipline", "Other"] as const;

export const MATERIALS = ["Real Leather", "Faux Leather", "Vinyl", "Metal Hardware", "Fabric", "Nylon", "Wire", "Mixed Media"] as const;

export const PROP_CATEGORIES = ["Fence/Gate", "Jump/Standard", "Arena Obstacle", "Trail Obstacle", "Barrel/Pole", "Building/Barn", "Vegetation/Trees", "Ground Cover/Base", "Water Feature", "Feed/Hay", "Vehicle/Trailer", "Sign/Banner", "Scenery/Backdrop", "Other"] as const;

export const TERRAIN_SETTINGS = ["Arena/Ring", "Pasture/Field", "Trail/Cross-Country", "Barn/Stable", "Ranch/Farm", "Show Grounds", "Other"] as const;

export const SCENE_THEMES = ["Performance Show", "Ranch/Farm", "Trail Ride", "Racing", "Parade/Costume", "Fantasy/Creative", "Historical", "Breeding Farm", "Veterinary/Farrier", "Other"] as const;

export const SPECIES_TYPES = ["Cattle", "Dog", "Cat", "Wildlife", "Rider/Doll", "Bird", "Fantasy Creature", "Other"] as const;

export const WORKING_PARTS = ["Working Buckles", "Removable Bit", "Adjustable Girth", "Working Stirrups"] as const;

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

// ── Known attribute keys per category ──

const TACK_KEYS = new Set(["tack_type", "discipline", "materials", "fits_molds", "working_parts"]);
const PROP_KEYS = new Set(["prop_category", "dimensions", "terrain_setting", "materials"]);
const DIORAMA_KEYS = new Set(["scene_theme", "discipline", "components", "base_dimensions", "documentation_notes"]);
const OTHER_MODEL_KEYS = new Set(["species", "breed", "manufacturer", "model_number"]);

const CATEGORY_KEYS: Record<AssetCategory, Set<string>> = {
  model: new Set(),
  tack: TACK_KEYS,
  prop: PROP_KEYS,
  diorama: DIORAMA_KEYS,
  other_model: OTHER_MODEL_KEYS,
};

// ── Gallery slots per category ──

const MODEL_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Near-Side (Required)", primary: true },
  { angle: "Right_Side", label: "Off-Side" },
  { angle: "Front_Chest", label: "Front / Chest" },
  { angle: "Back_Hind", label: "Hindquarters / Tail" },
  { angle: "Belly_Makers_Mark", label: "Belly / Maker's Mark" },
];

const TACK_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Required)", primary: true },
  { angle: "Detail_Face_Eyes", label: "Detail / Hardware" },
  { angle: "Belly_Makers_Mark", label: "Maker's Mark" },
  { angle: "Right_Side", label: "On-Model Fit" },
];

const PROP_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Required)", primary: true },
  { angle: "Right_Side", label: "Scale Reference" },
  { angle: "Detail_Face_Eyes", label: "Detail" },
  { angle: "Back_Hind", label: "In-Use / Scene" },
];

const DIORAMA_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Overview (Required)", primary: true },
  { angle: "Detail_Face_Eyes", label: "Close-Up 1" },
  { angle: "Right_Side", label: "Close-Up 2" },
  { angle: "Belly_Makers_Mark", label: "Documentation Card" },
];

const OTHER_MODEL_GALLERY: GallerySlot[] = [
  { angle: "Primary_Thumbnail", label: "Main View (Required)", primary: true },
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

// ── Field definitions per category ──

function makeFields(category: AssetCategory): Record<string, FieldDef> {
  switch (category) {
    case "model":
      return {
        custom_name: { visible: true, label: "Custom Name", required: true },
        sculptor: { visible: true, label: "Sculptor / Artist", required: false },
        finishing_artist: { visible: true, label: "Finishing Artist", required: false },
        edition_info: { visible: true, label: "Edition Info", required: false },
        finish_type: { visible: true, label: "Finish Type", required: true },
        finish_details: { visible: true, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition Grade", required: true },
        life_stage: { visible: true, label: "Life Stage", required: false },
        show_bio: { visible: true, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
      };
    case "tack":
      return {
        custom_name: { visible: true, label: "Item Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
      };
    case "prop":
      return {
        custom_name: { visible: true, label: "Item Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
      };
    case "diorama":
      return {
        custom_name: { visible: true, label: "Scene Name", required: true },
        sculptor: { visible: true, label: "Maker / Artist", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: false, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: false, label: "Condition", required: false },
        life_stage: { visible: false, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
      };
    case "other_model":
      return {
        custom_name: { visible: true, label: "Custom Name", required: true },
        sculptor: { visible: false, label: "Sculptor", required: false },
        finishing_artist: { visible: false, label: "Finishing Artist", required: false },
        edition_info: { visible: false, label: "Edition Info", required: false },
        finish_type: { visible: true, label: "Finish Type", required: false },
        finish_details: { visible: false, label: "Finish Details", required: false },
        condition_grade: { visible: true, label: "Condition Grade", required: false },
        life_stage: { visible: true, label: "Life Stage", required: false },
        show_bio: { visible: false, label: "Show Bio", required: false },
        public_notes: { visible: true, label: "Public Notes", required: false },
      };
  }
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
 * Called in createHorseRecord and updateHorseAction before DB write.
 */
export function validateAttributes(
  category: AssetCategory,
  attrs: Record<string, unknown>
): { valid: boolean; cleaned: Record<string, unknown> } {
  const allowedKeys = CATEGORY_KEYS[category];
  if (!allowedKeys || allowedKeys.size === 0) {
    return { valid: true, cleaned: {} };
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (!allowedKeys.has(key)) continue; // strip unknown keys
    if (value === null || value === undefined || value === "") continue; // strip empty

    // Coerce array fields
    if (key === "materials" || key === "working_parts") {
      if (Array.isArray(value)) {
        cleaned[key] = value.filter((v): v is string => typeof v === "string");
      } else if (typeof value === "string") {
        cleaned[key] = [value]; // coerce bare string to array
      }
      continue;
    }

    // All other fields stored as-is (string)
    if (typeof value === "string") {
      cleaned[key] = value.trim();
    }
  }

  return { valid: true, cleaned };
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
