"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { saveExpertPlacings, overrideFinalPlacings } from"@/app/actions/shows";
import { Textarea } from "@/components/ui/textarea";

interface EntryForJudging {
 id: string;
 horseName: string;
 ownerAlias: string;
 thumbnailUrl: string | null;
 placing: string | null;
 classId: string | null;
}

interface ClassInfo {
 id: string;
 name: string;
 divisionName: string;
}

const PLACING_OPTIONS = [
 { value:"", label:"—" },
 { value:"1st", label:"🥇 1st" },
 { value:"2nd", label:"🥈 2nd" },
 { value:"3rd", label:"🥉 3rd" },
 { value:"4th", label:"4th" },
 { value:"5th", label:"5th" },
 { value:"6th", label:"6th" },
 { value:"HM", label:"🎗️ HM" },
 { value:"Champion", label:"🏆 Champ" },
 { value:"Reserve Champion", label:"🥈 Reserve" },
 { value:"Grand Champion", label:"🏆 Grand" },
 { value:"Reserve Grand Champion", label:"🥈 Reserve Grand" },
 { value:"Top 3", label:"🏅 Top 3" },
 { value:"Top 5", label:"🏅 Top 5" },
 { value:"Top 10", label:"🏅 Top 10" },
];

export default function ExpertJudgingPanel({
 showId,
 entries,
 classes,
 overrideMode = false,
}: {
 showId: string;
 entries: EntryForJudging[];
 classes?: ClassInfo[];
 /** When true, uses overrideFinalPlacings() instead of saveExpertPlacings() */
 overrideMode?: boolean;
}) {
 const router = useRouter();
 const [placings, setPlacings] = useState<Record<string, string>>(() => {
 const init: Record<string, string> = {};
 entries.forEach((e) => {
 init[e.id] = e.placing ||"";
 });
 return init;
 });
 const [notes, setNotes] = useState<Record<string, string>>({});
 const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [success, setSuccess] = useState(false);
 const [selectedClassId, setSelectedClassId] = useState<string>("all");

 // Filter entries by selected class
 const filteredEntries = selectedClassId ==="all" ? entries : entries.filter((e) => e.classId === selectedClassId);

 // Find current class info
 const currentClass = classes?.find((c) => c.id === selectedClassId);

 const toggleNotes = (entryId: string) => {
 setExpandedNotes((prev) => {
 const next = new Set(prev);
 if (next.has(entryId)) next.delete(entryId);
 else next.add(entryId);
 return next;
 });
 };

 const handleSave = async () => {
 setSaving(true);
 setError("");
 setSuccess(false);

 const toSave = Object.entries(placings)
 .filter(([, v]) => v !=="")
 .map(([entryId, placing]) => ({
 entryId,
 placing,
 notes: notes[entryId]?.trim() || undefined,
 }));

 if (toSave.length === 0) {
 setError("Please assign at least one placing.");
 setSaving(false);
 return;
 }

 let result: { success: boolean; error?: string };
 if (overrideMode) {
 result = await overrideFinalPlacings(showId, toSave);
 } else {
 result = await saveExpertPlacings(showId, toSave);
 }

 if (result.success) {
 setSuccess(true);
 router.refresh();
 } else {
 setError(result.error ||"Failed to save placings.");
 }
 setSaving(false);
 };

 // Group classes by division for the selector
 const divisionGroups: Map<string, ClassInfo[]> = new Map();
 if (classes && classes.length > 0) {
 for (const c of classes) {
 const group = divisionGroups.get(c.divisionName) || [];
 group.push(c);
 divisionGroups.set(c.divisionName, group);
 }
 }

  const isOverride = overrideMode;

  return (
  <div
  className={`animate-fade-in-up mb-6 rounded-xl border bg-white p-6 shadow-sm ${
  isOverride ? "border-red-200" : "border-stone-200"
  }`}
  >
 <h3 className="mb-4 flex items-center gap-2">
 {overrideMode ?"⚠️" :"🏅"}{""}
 <span className="text-forest">{overrideMode ?"Override Final Placings" :"Expert Judging Panel"}</span>
 </h3>
 <p className="text-muted mb-4 text-sm">
 {overrideMode
 ?"Adjust placings after the show has been judged or closed. Changes update show records with an audit trail."
 :"Assign placings to each entry below. Only placed entries will appear in results and auto-generate show records."}
 </p>

 {/* Class Filter */}
 {classes && classes.length > 0 && (
 <div className="mb-4">
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 max-w-[400px]"
 value={selectedClassId}
 onChange={(e) => setSelectedClassId(e.target.value)}
 title="Filter by class"
 >
 <option value="all">All Entries ({entries.length})</option>
 {Array.from(divisionGroups.entries()).map(([divName, items]) => (
 <optgroup key={divName} label={divName}>
 {items.map((c) => {
 const count = entries.filter((e) => e.classId === c.id).length;
 return (
 <option key={c.id} value={c.id}>
 {c.name} ({count})
 </option>
 );
 })}
 </optgroup>
 ))}
 </select>
  {currentClass && (
  <div className="mt-1 text-sm text-muted">
  Currently judging: <strong>{currentClass.divisionName}</strong> ›{""}
  <strong>{currentClass.name}</strong>
  </div>
  )}
 </div>
 )}

 <div className="flex flex-col gap-2">
 {filteredEntries.length === 0 ? (
 <div className="text-muted p-4 text-center">
 No entries {selectedClassId !=="all" ?"in this class" :"to judge"}.
 </div>
 ) : (
 filteredEntries.map((entry) => (
 <div key={entry.id}>
  <div
  className={`flex items-center gap-4 px-4 py-2 bg-stone-50 ${
  expandedNotes.has(entry.id) ? "rounded-t-md" : "rounded-md"
  }`}
  >
 {entry.thumbnailUrl && (
 <div className="h-[40] w-[40] shrink-0 overflow-hidden rounded-sm">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={entry.thumbnailUrl}
 alt={entry.horseName}
 className="h-full w-full object-cover"
 />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <div className="text-sm font-semibold">🐴 {entry.horseName}</div>
 <div className="text-muted text-xs">
 by @{entry.ownerAlias}
 </div>
 </div>
  <button
  type="button"
  onClick={() => toggleNotes(entry.id)}
  title="Judge notes"
  className={`shrink-0 cursor-pointer border-none bg-transparent p-1 text-base ${
  notes[entry.id] ? "text-forest" : "text-muted"
  }`}
  >
 📝
 </button>
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[140px] shrink-0"
 value={placings[entry.id] ||""}
 onChange={(e) => setPlacings((prev) => ({ ...prev, [entry.id]: e.target.value }))}
 title={`Placing for ${entry.horseName}`}
 >
 {PLACING_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>
 {opt.label}
 </option>
 ))}
 </select>
 </div>
 {/* Collapsible Judge Notes */}
 {expandedNotes.has(entry.id) && (
  <div className="rounded-b-md border-t border-stone-100 bg-stone-50/50 px-4 py-2">
 <Textarea
 className="text-sm resize-y"
 value={notes[entry.id] ||""}
 onChange={(e) => setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
 placeholder="Private judge notes (critique, reasoning)…"
 rows={2}
 />
 </div>
 )}
 </div>
 ))
 )}
 </div>

 {error && <div className="mt-2 text-sm text-danger mt-2">{error}</div>}
  {success && (
  <div className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
  ✅ Placings saved!{""}
  {overrideMode
  ?"Show records updated with audit trail."
  :"Show records auto-generated for placed entries."}
  </div>
  )}

 <div className="mt-4 flex gap-2">
 <button
  className={`btn ${overrideMode ? "btn-ghost border-red-300 text-red-500" : "btn-primary"}`}
 onClick={handleSave}
 disabled={saving}
 >
 {saving ?"Saving…" : overrideMode ?"⚠️ Override Placings" :"💾 Save Placings"}
 </button>
 </div>
 </div>
 );
}
