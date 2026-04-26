"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SCENE_THEMES, DISCIPLINES } from "@/lib/config/assetFields";

interface DioramaFormFieldsProps {
  sceneTheme: string;
  setSceneTheme: (v: string) => void;
  discipline: string;
  setDiscipline: (v: string) => void;
  components: string;
  setComponents: (v: string) => void;
  baseDimensions: string;
  setBaseDimensions: (v: string) => void;
  documentationNotes: string;
  setDocumentationNotes: (v: string) => void;
}

export default function DioramaFormFields({
  sceneTheme, setSceneTheme,
  discipline, setDiscipline,
  components, setComponents,
  baseDimensions, setBaseDimensions,
  documentationNotes, setDocumentationNotes,
}: DioramaFormFieldsProps) {
  return (
    <div className="mt-4 space-y-4 rounded-lg border border-[#E0D5C1] bg-[#FEFCF8] p-4">
      <h4 className="text-sm font-semibold text-stone-900">🎭 Diorama Details</h4>

      <div>
        <label htmlFor="diorama-theme" className="mb-1 block text-sm font-semibold text-stone-900">
          Scene Theme
        </label>
        <select
          id="diorama-theme"
          className="flex h-9 w-full rounded-md border border-[#E0D5C1] bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          value={sceneTheme}
          onChange={(e) => setSceneTheme(e.target.value)}
        >
          <option value="">Select theme…</option>
          {SCENE_THEMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="diorama-discipline" className="mb-1 block text-sm font-semibold text-stone-900">
          Discipline
        </label>
        <select
          id="diorama-discipline"
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

      <div>
        <label htmlFor="diorama-components" className="mb-1 block text-sm font-semibold text-stone-900">
          Components
        </label>
        <Textarea
          id="diorama-components"
          value={components}
          onChange={(e) => setComponents(e.target.value)}
          placeholder="List the major components (e.g. barn, 3 fences, 2 trees, water trough)"
          maxLength={500}
          rows={2}
        />
      </div>

      <div>
        <label htmlFor="diorama-base-dims" className="mb-1 block text-sm font-semibold text-stone-900">
          Base Dimensions
        </label>
        <Input
          id="diorama-base-dims"
          type="text"
          placeholder='e.g. 24" × 18" or 1:9 scale table'
          value={baseDimensions}
          onChange={(e) => setBaseDimensions(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor="diorama-documentation" className="mb-1 block text-sm font-semibold text-stone-900">
          Documentation Notes
        </label>
        <Textarea
          id="diorama-documentation"
          value={documentationNotes}
          onChange={(e) => setDocumentationNotes(e.target.value)}
          placeholder="Notes about construction, materials, scale accuracy, and setup guidance for judges"
          maxLength={1000}
          rows={3}
        />
        <span className="mt-1 block text-xs text-stone-500">
          For shows: describe scale accuracy, materials, and how the scene should be presented.
        </span>
      </div>
    </div>
  );
}
