"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ChipToggle from "@/components/forms/ChipToggle";
import { TACK_TYPES, DISCIPLINES, MATERIALS, WORKING_PARTS } from "@/lib/config/assetFields";

interface TackFormFieldsProps {
  tackType: string;
  setTackType: (v: string) => void;
  discipline: string;
  setDiscipline: (v: string) => void;
  materials: string[];
  setMaterials: (v: string[]) => void;
  fitsMolds: string;
  setFitsMolds: (v: string) => void;
  workingParts: string[];
  setWorkingParts: (v: string[]) => void;
}

export default function TackFormFields({
  tackType, setTackType,
  discipline, setDiscipline,
  materials, setMaterials,
  fitsMolds, setFitsMolds,
  workingParts, setWorkingParts,
}: TackFormFieldsProps) {
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-[#E0D5C1] bg-[#FEFCF8] p-4">
      <h4 className="text-sm font-semibold text-stone-900">🏇 Tack Details</h4>

      <div>
        <label htmlFor="tack-type" className="mb-1 block text-sm font-semibold text-stone-900">
          Tack Type
        </label>
        <select
          id="tack-type"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={tackType}
          onChange={(e) => setTackType(e.target.value)}
        >
          <option value="">Select type…</option>
          {TACK_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tack-discipline" className="mb-1 block text-sm font-semibold text-stone-900">
          Discipline
        </label>
        <select
          id="tack-discipline"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="">Select discipline…</option>
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <ChipToggle
        label="Materials"
        options={MATERIALS}
        selected={materials}
        onChange={setMaterials}
        id="tack-materials"
      />

      <div>
        <label htmlFor="tack-fits-molds" className="mb-1 block text-sm font-semibold text-stone-900">
          Fits Molds
        </label>
        <Input
          id="tack-fits-molds"
          type="text"
          placeholder="e.g. Ideal Stock Horse, PS Arabian, Traditional"
          value={fitsMolds}
          onChange={(e) => setFitsMolds(e.target.value)}
          maxLength={200}
        />
        <span className="mt-1 block text-xs text-stone-500">
          Which molds does this tack fit? Comma-separated.
        </span>
      </div>

      <ChipToggle
        label="Working Parts"
        options={WORKING_PARTS}
        selected={workingParts}
        onChange={setWorkingParts}
        id="tack-working-parts"
      />
    </div>
  );
}
