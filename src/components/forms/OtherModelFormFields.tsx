"use client";

import { Input } from "@/components/ui/input";
import { SPECIES_TYPES } from "@/lib/config/assetFields";

interface OtherModelFormFieldsProps {
  species: string;
  setSpecies: (v: string) => void;
  breed: string;
  setBreed: (v: string) => void;
  manufacturer: string;
  setManufacturer: (v: string) => void;
  modelNumber: string;
  setModelNumber: (v: string) => void;
}

export default function OtherModelFormFields({
  species, setSpecies,
  breed, setBreed,
  manufacturer, setManufacturer,
  modelNumber, setModelNumber,
}: OtherModelFormFieldsProps) {
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-[#E0D5C1] bg-[#FEFCF8] p-4">
      <h4 className="text-sm font-semibold text-stone-900">🐄 Other Model Details</h4>

      <div>
        <label htmlFor="other-species" className="mb-1 block text-sm font-semibold text-stone-900">
          Species
        </label>
        <select
          id="other-species"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
        >
          <option value="">Select species…</option>
          {SPECIES_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="other-breed" className="mb-1 block text-sm font-semibold text-stone-900">
          Breed / Type
        </label>
        <Input
          id="other-breed"
          type="text"
          placeholder="e.g. Hereford, Border Collie, Brahma Bull"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="other-manufacturer" className="mb-1 block text-sm font-semibold text-stone-900">
          Manufacturer
        </label>
        <Input
          id="other-manufacturer"
          type="text"
          placeholder="e.g. Breyer, Schleich, CollectA"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="other-model-number" className="mb-1 block text-sm font-semibold text-stone-900">
          Model / Item Number
        </label>
        <Input
          id="other-model-number"
          type="text"
          placeholder="e.g. #1760, SKU 13872"
          value={modelNumber}
          onChange={(e) => setModelNumber(e.target.value)}
          maxLength={50}
        />
      </div>
    </div>
  );
}
