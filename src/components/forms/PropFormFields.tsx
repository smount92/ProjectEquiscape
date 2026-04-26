"use client";

import { Input } from "@/components/ui/input";
import ChipToggle from "@/components/forms/ChipToggle";
import { PROP_CATEGORIES, TERRAIN_SETTINGS, MATERIALS } from "@/lib/config/assetFields";

interface PropFormFieldsProps {
  propCategory: string;
  setPropCategory: (v: string) => void;
  dimensions: string;
  setDimensions: (v: string) => void;
  terrainSetting: string;
  setTerrainSetting: (v: string) => void;
  materials: string[];
  setMaterials: (v: string[]) => void;
}

export default function PropFormFields({
  propCategory, setPropCategory,
  dimensions, setDimensions,
  terrainSetting, setTerrainSetting,
  materials, setMaterials,
}: PropFormFieldsProps) {
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-[#E0D5C1] bg-[#FEFCF8] p-4">
      <h4 className="text-sm font-semibold text-stone-900">🌲 Prop Details</h4>

      <div>
        <label htmlFor="prop-category" className="mb-1 block text-sm font-semibold text-stone-900">
          Prop Category
        </label>
        <select
          id="prop-category"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={propCategory}
          onChange={(e) => setPropCategory(e.target.value)}
        >
          <option value="">Select category…</option>
          {PROP_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="prop-dimensions" className="mb-1 block text-sm font-semibold text-stone-900">
          Dimensions
        </label>
        <Input
          id="prop-dimensions"
          type="text"
          placeholder='e.g. 6" × 4" × 3" or 1:9 scale'
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="prop-terrain" className="mb-1 block text-sm font-semibold text-stone-900">
          Terrain / Setting
        </label>
        <select
          id="prop-terrain"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={terrainSetting}
          onChange={(e) => setTerrainSetting(e.target.value)}
        >
          <option value="">Select terrain…</option>
          {TERRAIN_SETTINGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <ChipToggle
        label="Materials"
        options={MATERIALS}
        selected={materials}
        onChange={setMaterials}
        id="prop-materials"
      />
    </div>
  );
}
