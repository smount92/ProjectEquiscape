"use client";

import type { AssetCategory } from "@/lib/types/database";
import { getCategoryLabel } from "@/lib/config/assetFields";

interface AssetDetailRendererProps {
  category: AssetCategory;
  attributes: Record<string, unknown>;
}

/**
 * Read-only display component for category-specific JSONB attributes.
 * Used on stable/[id] (owner view) and community/[id] (public view).
 */
export default function AssetDetailRenderer({ category, attributes }: AssetDetailRendererProps) {
  if (!attributes || Object.keys(attributes).length === 0) return null;

  const renderField = (label: string, value: unknown) => {
    if (!value) return null;
    const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
    if (!displayValue) return null;
    return (
      <div key={label} className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
        <span className="text-sm text-stone-800">{displayValue}</span>
      </div>
    );
  };

  const getFieldsForCategory = () => {
    switch (category) {
      case "tack":
        return [
          renderField("Tack Type", attributes.tack_type),
          renderField("Discipline", attributes.discipline),
          renderField("Materials", attributes.materials),
          renderField("Fits Molds", attributes.fits_molds),
          renderField("Working Parts", attributes.working_parts),
        ];
      case "prop":
        return [
          renderField("Category", attributes.prop_category),
          renderField("Dimensions", attributes.dimensions),
          renderField("Terrain / Setting", attributes.terrain_setting),
          renderField("Materials", attributes.materials),
        ];
      case "diorama":
        return [
          renderField("Scene Theme", attributes.scene_theme),
          renderField("Discipline", attributes.discipline),
          renderField("Components", attributes.components),
          renderField("Base Dimensions", attributes.base_dimensions),
          renderField("Documentation Notes", attributes.documentation_notes),
        ];
      case "other_model":
        return [
          renderField("Species", attributes.species),
          renderField("Breed / Type", attributes.breed),
          renderField("Manufacturer", attributes.manufacturer),
          renderField("Model Number", attributes.model_number),
        ];
      default:
        return [];
    }
  };

  const fields = getFieldsForCategory().filter(Boolean);
  if (fields.length === 0) return null;

  const catLabel = getCategoryLabel(category);

  return (
    <div className="rounded-lg border border-[#E0D5C1] bg-[#FEFCF8] p-4">
      <h4 className="mb-3 text-sm font-semibold text-stone-700">{catLabel} Details</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields}
      </div>
    </div>
  );
}
