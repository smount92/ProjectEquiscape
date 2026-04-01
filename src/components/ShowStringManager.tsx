"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import {
 createShowString,
 addShowStringEntry,
 removeShowStringEntry,
 getShowStringEntries,
 deleteShowString,
 duplicateShowString,
 detectConflicts,
 type ShowString,
 type ShowStringEntry,
} from"@/app/actions/competition";
import { batchRecordResults } from"@/app/actions/shows";
import { Input } from "@/components/ui/input";

interface Props {
 showStrings: ShowString[];
 horses: { id: string; name: string }[];
}

export default function ShowStringManager({ showStrings, horses }: Props) {
 const router = useRouter();
 const [creating, setCreating] = useState(false);
 const [newName, setNewName] = useState("");
 const [newDate, setNewDate] = useState("");
 const [activeStringId, setActiveStringId] = useState<string | null>(null);
 const [entries, setEntries] = useState<ShowStringEntry[]>([]);
 const [loadingEntries, setLoadingEntries] = useState(false);
 const [conflicts, setConflicts] = useState<{ entryA: string; entryB: string; reason: string }[]>([]);

 // Add entry form state
 const [entryHorseId, setEntryHorseId] = useState("");
 const [entryClassName, setEntryClassName] = useState("");
 const [entryDivision, setEntryDivision] = useState("");
 const [entryTimeSlot, setEntryTimeSlot] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 // Batch results state
 const [showResults, setShowResults] = useState(false);
 const [results, setResults] = useState<Record<string, { placing: string; ribbon: string }>>({});
 const [savingResults, setSavingResults] = useState(false);
 const [resultsSaved, setResultsSaved] = useState(false);

 async function handleCreate() {
 if (!newName.trim()) return;
 setSaving(true);
 const result = await createShowString({ name: newName, showDate: newDate || undefined });
 if (result.success) {
 setNewName("");
 setNewDate("");
 setCreating(false);
 router.refresh();
 } else {
 setError(result.error ||"Failed to create");
 }
 setSaving(false);
 }

 async function handleSelectString(id: string) {
 if (activeStringId === id) {
 setActiveStringId(null);
 setEntries([]);
 setConflicts([]);
 return;
 }
 setActiveStringId(id);
 setLoadingEntries(true);
 const data = await getShowStringEntries(id);
 setEntries(data);
 const { conflicts: c } = await detectConflicts(id);
 setConflicts(c);
 setLoadingEntries(false);
 }

 async function handleAddEntry() {
 if (!activeStringId || !entryHorseId || !entryClassName.trim()) return;
 setSaving(true);
 const result = await addShowStringEntry({
 showStringId: activeStringId,
 horseId: entryHorseId,
 className: entryClassName.trim(),
 division: entryDivision.trim() || undefined,
 timeSlot: entryTimeSlot.trim() || undefined,
 });
 if (result.success) {
 setEntryHorseId("");
 setEntryClassName("");
 setEntryDivision("");
 setEntryTimeSlot("");
 // Refresh entries
 const data = await getShowStringEntries(activeStringId);
 setEntries(data);
 const { conflicts: c } = await detectConflicts(activeStringId);
 setConflicts(c);
 router.refresh();
 } else {
 setError(result.error ||"Failed to add entry");
 }
 setSaving(false);
 }

 async function handleRemoveEntry(entryId: string) {
 if (!activeStringId) return;
 await removeShowStringEntry(entryId);
 const data = await getShowStringEntries(activeStringId);
 setEntries(data);
 const { conflicts: c } = await detectConflicts(activeStringId);
 setConflicts(c);
 router.refresh();
 }

 async function handleDeleteString(id: string) {
 if (!confirm("Delete this show string and all its entries?")) return;
 await deleteShowString(id);
 if (activeStringId === id) {
 setActiveStringId(null);
 setEntries([]);
 setConflicts([]);
 }
 router.refresh();
 }

 return (
 <div>
 <p className="text-sm text-stone-500 mb-4">
    Pack your string of horses for real-world shows. Detect ring time conflicts
    and convert results to ribbons when you get home.
  </p>
 {error && (
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {error}
 </p>
 )}

 {/* Create New */}
 {!creating ? (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => setCreating(true)}
 >
 + New Show String
 </button>
 ) : (
 <div className="bg-white border-stone-200 mb-6 rounded-lg border p-6 shadow-md transition-all">
 <h3 className="mb-4">Create Show String</h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Show Name *</label>
 <Input
 
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="e.g. Spring Fling 2026"
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Show Date</label>
 <Input
 
 type="date"
 value={newDate}
 onChange={(e) => setNewDate(e.target.value)}
 title="Show date"
 />
 </div>
 </div>
 <div className="mt-4 flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleCreate}
 disabled={saving}
 >
 {saving ?"Creating..." :"Create"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setCreating(false)}
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Show Strings List */}
 {showStrings.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
 <p>No show strings yet. Create one to start planning!</p>
 </div>
 ) : (
 <div className="grid gap-2">
 {showStrings.map((ss) => (
 <div key={ss.id} className={`show-string-item ${activeStringId === ss.id ?"active" :""}`}>
 <div
 className="flex cursor-pointer items-center justify-between gap-2 px-6 py-4"
 onClick={() => handleSelectString(ss.id)}
 >
 <div>
 <strong>{ss.name}</strong>
 {ss.showDate && (
 <span className="text-stone-500 ml-2 text-sm">
 📅{""}
 {new Date(ss.showDate +"T12:00:00").toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 })}
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <span className="flex cursor-pointer items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-500 transition-all">
 {ss.entryCount}
 </span>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={async (e) => {
 e.stopPropagation();
 setSaving(true);
 await duplicateShowString(ss.id);
 setSaving(false);
 router.refresh();
 }}
 title="Duplicate"
 disabled={saving}
 >
 📋
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteString(ss.id);
 }}
 title="Delete"
 >
 🗑️
 </button>
 </div>
 </div>

 {/* Expanded: entries + add form */}
 {activeStringId === ss.id && (
 <div className="px-4 pb-4 border-stone-200 border-t">
 {loadingEntries ? (
 <p className="text-stone-500">Loading entries...</p>
 ) : (
 <>
 {/* Ring Conflict Visual Timeline */}
 {conflicts.length > 0 && (
 <div className="mb-4">
 <div
 className="mb-1 flex items-center gap-2"
 >
 <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-[#ef4444]">
 ⚠️ {conflicts.length} Conflict
 {conflicts.length !== 1 ?"s" :""}
 </span>
 </div>
 {/* Timeline visualization */}
 <div className="bg-surface-secondary flex h-8 items-stretch gap-0.5 overflow-hidden rounded-md">
 {entries.map((entry) => {
 const isConflict = conflicts.some(
 (c) => c.entryA === entry.id || c.entryB === entry.id,
 );
 return (
 <div
 key={entry.id}
 className={`relative flex flex-1 items-center justify-center text-xs font-semibold text-white transition-opacity ${isConflict ?"animate-pulse bg-[#ef4444]" :"bg-forest"}`}
 title={`${entry.horseName} — ${entry.className}${entry.timeSlot ? ` @ ${entry.timeSlot}` :""}`}
 >
 {entry.className.slice(0, 3)}
 </div>
 );
 })}
 </div>
 <div className="mt-1">
 {conflicts.map((c, i) => (
 <div
 key={i}
 className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-xs font-semibold text-[#f59e0b]"
 >
 ⚠️ {c.reason}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Entries Table */}
 {entries.length > 0 ? (
 <div className="my-3 grid gap-1">
 {entries.map((entry) => (
 <div
 key={entry.id}
 className="flex items-center gap-2 rounded-md bg-stone-50 px-4 py-2 text-sm"
 >
 <span className="min-w-[140px] font-bold">
 🐴 {entry.horseName}
 </span>
 <span className="flex-1">{entry.className}</span>
 {entry.division && (
 <span className="rounded-full bg-purple-100/50 px-[8px] py-[2px] text-xs text-[#a78bfa]">
 {entry.division}
 </span>
 )}
 {entry.timeSlot && (
 <span className="text-stone-500 text-xs">
 🕐 {entry.timeSlot}
 </span>
 )}
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => handleRemoveEntry(entry.id)}
 title="Remove"
 >
 ✕
 </button>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-stone-500 text-sm">
 No entries yet. Add horses below.
 </p>
 )}

 {/* Add Entry Form */}
 <div className="border-stone-200 mt-6 border-t pt-6">
 <h4>Add Entry</h4>
 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Horse *
 </label>
 <select
 className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={entryHorseId}
 onChange={(e) => setEntryHorseId(e.target.value)}
 title="Select horse"
 >
 <option value="">Select horse...</option>
 {horses.map((h) => (
 <option key={h.id} value={h.id}>
 {h.name}
 </option>
 ))}
 </select>
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Class *
 </label>
 <Input
 
 value={entryClassName}
 onChange={(e) => setEntryClassName(e.target.value)}
 placeholder="e.g. Arabian Stallion"
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Division
 </label>
 <Input
 
 value={entryDivision}
 onChange={(e) => setEntryDivision(e.target.value)}
 placeholder="e.g. Breed"
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Time Slot
 </label>
 <Input
 
 value={entryTimeSlot}
 onChange={(e) => setEntryTimeSlot(e.target.value)}
 placeholder="e.g. 10:00 AM"
 />
 </div>
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleAddEntry}
 disabled={saving || !entryHorseId || !entryClassName.trim()}
 >
 {saving ?"Adding..." :"+ Add Entry"}
 </button>
 </div>

 {/* ── Batch Results Section ── */}
 {entries.length > 0 && (
 <div
 className="mt-6 border-t border-stone-200 pt-4"
 >
 {!showResults ? (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => {
 setShowResults(true);
 setResultsSaved(false);
 // Initialize results map
 const init: Record<
 string,
 { placing: string; ribbon: string }
 > = {};
 entries.forEach((e) => {
 init[e.id] = { placing:"", ribbon:"" };
 });
 setResults(init);
 }}
 >
 🏆 Enter Results
 </button>
 ) : (
 <div>
 <h4 className="mb-2">🏆 Batch Results</h4>
 <p className="text-stone-500 mb-2 text-sm">
 Tab through to enter placing and ribbon for each entry.
 Results will be saved as show records.
 </p>
 <table className="sticky top-0 bg-[var(--color-surface-secondary)] font-semibold">
 <thead>
 <tr>
 <th>Horse</th>
 <th>Class</th>
 <th className="w-[100]">Placing</th>
 <th className="w-[120]">Ribbon</th>
 </tr>
 </thead>
 <tbody>
 {entries.map((entry) => (
 <tr key={entry.id}>
 <td>{entry.horseName}</td>
 <td>
 {entry.className}
 {entry.division
 ? ` (${entry.division})`
 :""}
 </td>
 <td>
 <input
 type="text"
 placeholder="1st"
 value={
 results[entry.id]?.placing ||""
 }
 onChange={(e) =>
 setResults((prev) => ({
 ...prev,
 [entry.id]: {
 ...prev[entry.id],
 placing: e.target.value,
 },
 }))
 }
 />
 </td>
 <td>
 <select
 value={
 results[entry.id]?.ribbon ||""
 }
 onChange={(e) =>
 setResults((prev) => ({
 ...prev,
 [entry.id]: {
 ...prev[entry.id],
 ribbon: e.target.value,
 },
 }))
 }
 title="Ribbon"
 >
 <option value="">—</option>
 <option value="Blue">
 🥇 Blue
 </option>
 <option value="Red">🥈 Red</option>
 <option value="Yellow">
 🥉 Yellow
 </option>
 <option value="White">
 ⬜ White
 </option>
 <option value="Pink">
 🩷 Pink
 </option>
 <option value="Green">
 💚 Green
 </option>
 <option value="Champion">
 🏆 Champion
 </option>
 <option value="Reserve">
 🎖️ Reserve
 </option>
 <option value="Top Ten">
 🔟 Top Ten
 </option>
 </select>
 </td>
 </tr>
 ))}
 </tbody>
 </table>

 {/* NAN Rollup Summary */}
 {(() => {
 const filled = Object.values(results).filter(
 (r) => r.placing || r.ribbon,
 );
 const champs = Object.values(results).filter(
 (r) => r.ribbon ==="Champion",
 ).length;
 const reserves = Object.values(results).filter(
 (r) => r.ribbon ==="Reserve",
 ).length;
 const topTens = Object.values(results).filter(
 (r) => r.ribbon ==="Top Ten",
 ).length;
 const points =
 champs * 4 +
 reserves * 3 +
 topTens * 2 +
 (filled.length - champs - reserves - topTens);
 if (filled.length === 0) return null;
 return (
 <div className="bg-surface-secondary mt-4 flex flex-wrap gap-6 rounded-lg p-4">
 <div className="flex flex-col gap-0.5">
 <span className="text-forest text-xl font-bold">
 {filled.length}
 </span>
 <span className="text-stone-500 text-xs">
 Results
 </span>
 </div>
 <div className="flex flex-col gap-0.5">
 <span className="text-forest text-xl font-bold">
 {champs}🏆 {reserves}🎖️ {topTens}🔟
 </span>
 <span className="text-stone-500 text-xs">
 Major Ribbons
 </span>
 </div>
 <div className="flex flex-col gap-0.5">
 <span className="text-forest text-xl font-bold">
 ~{points}
 </span>
 <span className="text-stone-500 text-xs">
 Est. NAN Points
 </span>
 </div>
 </div>
 );
 })()}

 <div className="mt-4 flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 disabled={savingResults}
 onClick={async () => {
 setSavingResults(true);
 const activeStr = showStrings.find(
 (s) => s.id === activeStringId,
 );
 const records = entries
 .filter(
 (e) =>
 results[e.id]?.placing ||
 results[e.id]?.ribbon,
 )
 .map((e) => ({
 horseId: e.horseId,
 showName:
 activeStr?.name ||"Unknown Show",
 showDate: activeStr?.showDate || null,
 division: e.division || null,
 className: e.className,
 placing: results[e.id]?.placing || null,
 ribbonColor:
 results[e.id]?.ribbon || null,
 }));
 if (records.length > 0) {
 await batchRecordResults(records);
 }
 setSavingResults(false);
 setResultsSaved(true);
 router.refresh();
 }}
 >
 {savingResults
 ?"Saving..."
 : `💾 Save ${Object.values(results).filter((r) => r.placing || r.ribbon).length} Results`}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setShowResults(false)}
 >
 Cancel
 </button>
 {resultsSaved && (
 <span className="text-forest font-semibold">
 ✅ Saved!
 </span>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </>
 )}
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
