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
 updateShowString,
 updateShowStringEntry,
 detectConflicts,
 type ShowString,
 type ShowStringEntry,
} from"@/app/actions/competition";
import { batchRecordResults } from"@/app/actions/shows";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [results, setResults] = useState<Record<string, { placing: string; ribbon: string; awardCategory?: string; level?: string; notes?: string; isNan?: boolean }>>({});
  const [savingResults, setSavingResults] = useState(false);
  const [resultsSaved, setResultsSaved] = useState(false);

  // Advanced fields state
  const [showLocation, setShowLocation] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [showDateText, setShowDateText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

 // Edit show string state
 const [editingStringId, setEditingStringId] = useState<string | null>(null);
 const [editStringName, setEditStringName] = useState("");
 const [editStringDate, setEditStringDate] = useState("");

 // Edit entry state
 const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
 const [editEntryHorseId, setEditEntryHorseId] = useState("");
 const [editEntryClassName, setEditEntryClassName] = useState("");
 const [editEntryDivision, setEditEntryDivision] = useState("");
 const [editEntryTimeSlot, setEditEntryTimeSlot] = useState("");

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

 function handleEditString(ss: ShowString) {
    setEditingStringId(ss.id);
    setEditStringName(ss.name);
    setEditStringDate(ss.showDate || "");
  }

  async function handleSaveString() {
    if (!editingStringId || !editStringName.trim()) return;
    setSaving(true);
    const result = await updateShowString(editingStringId, {
      name: editStringName,
      showDate: editStringDate || null,
    });
    if (result.success) {
      setEditingStringId(null);
      router.refresh();
    } else {
      setError(result.error || "Failed to update");
    }
    setSaving(false);
  }

  function handleEditEntry(entry: ShowStringEntry) {
    setEditingEntryId(entry.id);
    setEditEntryHorseId(entry.horseId);
    setEditEntryClassName(entry.className);
    setEditEntryDivision(entry.division || "");
    setEditEntryTimeSlot(entry.timeSlot || "");
  }

  async function handleSaveEntry() {
    if (!editingEntryId || !editEntryClassName.trim() || !editEntryHorseId) return;
    setSaving(true);
    const result = await updateShowStringEntry(editingEntryId, {
      horseId: editEntryHorseId,
      className: editEntryClassName,
      division: editEntryDivision || null,
      timeSlot: editEntryTimeSlot || null,
    });
    if (result.success) {
      setEditingEntryId(null);
      if (activeStringId) {
        const data = await getShowStringEntries(activeStringId);
        setEntries(data);
        const { conflicts: c } = await detectConflicts(activeStringId);
        setConflicts(c);
      }
      router.refresh();
    } else {
      setError(result.error || "Failed to update entry");
    }
    setSaving(false);
  }

 return (
 <div>
 <p className="text-sm text-muted-foreground mb-4">
    Pack your string of horses for real-world shows. Detect ring time conflicts
    and convert results to ribbons when you get home.
  </p>
 {error && (
 <p className="text-destructive mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm">
 {error}
 </p>
 )}

 {/* Create New */}
 {!creating ? (
 <Button
 onClick={() => setCreating(true)}
 >
 + New Show String
 </Button>
 ) : (
 <div className="bg-card border-input mb-6 rounded-lg border p-6 shadow-md transition-all">
 <h3 className="mb-4">Create Show String</h3>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Show Name *</label>
 <Input
 
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="e.g. Spring Fling 2026"
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Show Date</label>
 <Input
 
 type="date"
 value={newDate}
 onChange={(e) => setNewDate(e.target.value)}
 title="Show date"
 />
 </div>
 </div>
 <div className="mt-4 flex gap-2">
 <Button
 onClick={handleCreate}
 disabled={saving}
 >
 {saving ?"Creating..." :"Create"}
 </Button>
 <Button variant="outline" size="wide"
 onClick={() => setCreating(false)}
 >
 Cancel
 </Button>
 </div>
 </div>
 )}

 {/* Show Strings List */}
 {showStrings.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-lg border border-input bg-card p-8 text-center shadow-sm">
 <p>No show strings yet. Create one to start planning!</p>
 </div>
 ) : (
 <div className="grid gap-2">
 {showStrings.map((ss) => (
  <div key={ss.id} className={`show-string-item ${activeStringId === ss.id ?"active" :""}`}>
  {editingStringId === ss.id ? (
  <div className="flex flex-col gap-3 px-6 py-4" onClick={(e) => e.stopPropagation()}>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <Input
  value={editStringName}
  onChange={(e) => setEditStringName(e.target.value)}
  placeholder="Show name"
  autoFocus
  />
  <Input
  type="date"
  value={editStringDate}
  onChange={(e) => setEditStringDate(e.target.value)}
  title="Show date"
  />
  </div>
  <div className="flex gap-2">
  <Button
  onClick={handleSaveString}
  disabled={saving || !editStringName.trim()}
  >
  {saving ? "Saving..." : "Save"}
  </Button>
  <Button variant="outline"
  onClick={() => setEditingStringId(null)}
  >
  Cancel
  </Button>
  </div>
  </div>
  ) : (
  <div
  className="flex cursor-pointer items-center justify-between gap-2 px-6 py-4"
  onClick={() => handleSelectString(ss.id)}
  >
  <div>
  <strong>{ss.name}</strong>
  {ss.showDate && (
  <span className="text-muted-foreground ml-2 text-sm">
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
  <span className="flex cursor-pointer items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-xs text-muted-foreground transition-all">
  {ss.entryCount}
  </span>
  <Button variant="outline" className="px-4 py-2"
  onClick={(e) => {
  e.stopPropagation();
  handleEditString(ss);
  }}
  title="Edit"
  >
  ✏️
  </Button>
  <Button variant="outline" className="px-4 py-2"
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
  </Button>
  <Button variant="outline" className="px-4 py-2"
  onClick={(e) => {
  e.stopPropagation();
  handleDeleteString(ss.id);
  }}
  title="Delete"
  >
  🗑️
  </Button>
  </div>
  </div>
  )}

 {/* Expanded: entries + add form */}
 {activeStringId === ss.id && (
 <div className="px-4 pb-4 border-input border-t">
 {loadingEntries ? (
 <p className="text-muted-foreground">Loading entries...</p>
 ) : (
 <>
 {/* Ring Conflict Visual Timeline */}
 {conflicts.length > 0 && (
 <div className="mb-4">
 <div
 className="mb-1 flex items-center gap-2"
 >
 <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
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
 className={`relative flex flex-1 items-center justify-center text-xs font-semibold text-white transition-opacity ${isConflict ?"animate-pulse bg-destructive" :"bg-forest"}`}
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
 className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-xs font-semibold text-warning"
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
  <div key={entry.id}>
  {editingEntryId === entry.id ? (
  <div className="rounded-md border border-forest/30 bg-muted p-4">
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
  <div>
  <label className="text-foreground mb-1 block text-xs font-semibold">Horse</label>
  <select
  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
  value={editEntryHorseId}
  onChange={(e) => setEditEntryHorseId(e.target.value)}
  title="Select horse"
  >
  {horses.map((h) => (
  <option key={h.id} value={h.id}>{h.name}</option>
  ))}
  </select>
  </div>
  <div>
  <label className="text-foreground mb-1 block text-xs font-semibold">Class *</label>
  <Input value={editEntryClassName} onChange={(e) => setEditEntryClassName(e.target.value)} placeholder="e.g. Arabian Stallion" />
  </div>
  <div>
  <label className="text-foreground mb-1 block text-xs font-semibold">Division</label>
  <Input value={editEntryDivision} onChange={(e) => setEditEntryDivision(e.target.value)} placeholder="e.g. Breed" />
  </div>
  <div>
  <label className="text-foreground mb-1 block text-xs font-semibold">Time Slot</label>
  <Input value={editEntryTimeSlot} onChange={(e) => setEditEntryTimeSlot(e.target.value)} placeholder="e.g. 10:00 AM" />
  </div>
  </div>
  <div className="mt-3 flex gap-2">
  <Button
  onClick={handleSaveEntry}
  disabled={saving || !editEntryClassName.trim()}
  >
  {saving ? "Saving..." : "Save"}
  </Button>
  <Button variant="outline"
  onClick={() => setEditingEntryId(null)}
  >
  Cancel
  </Button>
  </div>
  </div>
  ) : (
  <div className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm">
  <span className="min-w-[140px] font-bold">
  🐴 {entry.horseName}
  </span>
  <span className="flex-1">{entry.className}</span>
  {entry.division && (
  <span className="rounded-full bg-studio/10 px-[8px] py-[2px] text-xs text-studio">
  {entry.division}
  </span>
  )}
  {entry.timeSlot && (
  <span className="text-muted-foreground text-xs">
  🕐 {entry.timeSlot}
  </span>
  )}
  <Button variant="outline" className="px-3 py-2"
  onClick={() => handleEditEntry(entry)}
  title="Edit"
  >
  ✏️
  </Button>
  <Button variant="outline" className="px-3 py-2"
  onClick={() => handleRemoveEntry(entry.id)}
  title="Remove"
  >
  ✕
  </Button>
  </div>
  )}
  </div>
  ))}
  </div>
 ) : (
 <p className="text-muted-foreground text-sm">
 No entries yet. Add horses below.
 </p>
 )}

 {/* Add Entry Form */}
 <div className="border-input mt-6 border-t pt-6">
 <h4>Add Entry</h4>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Horse *
 </label>
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Class *
 </label>
 <Input
 
 value={entryClassName}
 onChange={(e) => setEntryClassName(e.target.value)}
 placeholder="e.g. Arabian Stallion"
 />
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Division
 </label>
 <Input
 
 value={entryDivision}
 onChange={(e) => setEntryDivision(e.target.value)}
 placeholder="e.g. Breed"
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Time Slot
 </label>
 <Input
 
 value={entryTimeSlot}
 onChange={(e) => setEntryTimeSlot(e.target.value)}
 placeholder="e.g. 10:00 AM"
 />
 </div>
 </div>
 <Button
 onClick={handleAddEntry}
 disabled={saving || !entryHorseId || !entryClassName.trim()}
 >
 {saving ?"Adding..." :"+ Add Entry"}
 </Button>
 </div>

 {/* ── Batch Results Section ── */}
 {entries.length > 0 && (
 <div
 className="mt-6 border-t border-input pt-4"
 >
 {!showResults ? (
 <Button variant="outline" size="wide"
 onClick={() => {
 setShowResults(true);
 setResultsSaved(false);
 // Initialize results map
 const init: Record<
 string,
 { placing: string; ribbon: string; awardCategory: string; level: string; notes: string; isNan: boolean }
 > = {};
 entries.forEach((e) => {
 init[e.id] = { placing: "", ribbon: "", awardCategory: "", level: "", notes: "", isNan: false };
 });
 setResults(init);
 }}
 >
 🏆 Enter Results
 </Button>
 ) : (
 <div>
 <h4 className="mb-2">🏆 Batch Results</h4>
 <p className="text-muted-foreground mb-2 text-sm">
 Tab through to enter placing and ribbon for each entry.
 Results will be saved as show records.
 </p>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
    <div>
      <label className="text-foreground mb-1 block text-xs font-semibold">Show Location</label>
      <Input value={showLocation} onChange={(e) => setShowLocation(e.target.value)} placeholder="e.g. Lexington, KY" />
    </div>
    <div>
      <label className="text-foreground mb-1 block text-xs font-semibold">Judge Name</label>
      <Input value={judgeName} onChange={(e) => setJudgeName(e.target.value)} placeholder="e.g. Jane Doe" />
    </div>
    <div>
      <label className="text-foreground mb-1 block text-xs font-semibold">Approximate Date</label>
      <Input value={showDateText} onChange={(e) => setShowDateText(e.target.value)} placeholder="e.g. Summer 2026" />
    </div>
  </div>

  <div className="flex items-center gap-2 mb-4">
    <input
      id="show-advanced-toggle"
      type="checkbox"
      className="h-4 w-4 rounded border-input text-forest focus:ring-forest accent-forest"
      checked={showAdvanced}
      onChange={(e) => setShowAdvanced(e.target.checked)}
    />
    <label htmlFor="show-advanced-toggle" className="text-sm font-semibold text-foreground cursor-pointer select-none">
      Show Advanced Fields for entries
    </label>
  </div>

 <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
 <table className="sticky top-0 min-w-[560px] bg-[var(--secondary)] font-semibold">
 <thead>
 <tr>
 <th>Horse</th>
 <th>Class</th>
 <th className="w-[100]">Placing</th>
 <th className="w-[120]">Ribbon</th>
 {showAdvanced && (
    <>
      <th className="w-[120]">Award Category</th>
      <th className="w-[100]">Level</th>
      <th className="w-[150]">Notes</th>
      <th className="w-[60] text-center">NAN</th>
    </>
  )}
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
 {showAdvanced && (
    <>
      <td>
        <input
          type="text"
          placeholder="e.g. Champ"
          value={results[entry.id]?.awardCategory || ""}
          onChange={(e) =>
            setResults((prev) => ({
              ...prev,
              [entry.id]: {
                ...prev[entry.id],
                awardCategory: e.target.value,
              },
            }))
          }
        />
      </td>
      <td>
        <input
          type="text"
          placeholder="e.g. Open"
          value={results[entry.id]?.level || ""}
          onChange={(e) =>
            setResults((prev) => ({
              ...prev,
              [entry.id]: {
                ...prev[entry.id],
                level: e.target.value,
              },
            }))
          }
        />
      </td>
      <td>
        <input
          type="text"
          placeholder="e.g. Large class"
          value={results[entry.id]?.notes || ""}
          onChange={(e) =>
            setResults((prev) => ({
              ...prev,
              [entry.id]: {
                ...prev[entry.id],
                notes: e.target.value,
              },
            }))
          }
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={!!results[entry.id]?.isNan}
          onChange={(e) =>
            setResults((prev) => ({
              ...prev,
              [entry.id]: {
                ...prev[entry.id],
                isNan: e.target.checked,
              },
            }))
          }
          className="h-4 w-4 rounded border-input text-forest focus:ring-forest accent-forest"
        />
      </td>
    </>
  )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>

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
 <span className="text-muted-foreground text-xs">
 Results
 </span>
 </div>
 <div className="flex flex-col gap-0.5">
 <span className="text-forest text-xl font-bold">
 {champs}🏆 {reserves}🎖️ {topTens}🔟
 </span>
 <span className="text-muted-foreground text-xs">
 Major Ribbons
 </span>
 </div>
 <div className="flex flex-col gap-0.5">
 <span className="text-forest text-xl font-bold">
 ~{points}
 </span>
 <span className="text-muted-foreground text-xs">
 Est. NAN Points
 </span>
 </div>
 </div>
 );
 })()}

 <div className="mt-4 flex gap-2">
 <Button
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
      results[e.id]?.ribbon ||
      results[e.id]?.awardCategory ||
      results[e.id]?.level ||
      results[e.id]?.notes ||
      results[e.id]?.isNan
  )
  .map((e) => ({
    horseId: e.horseId,
    showName: activeStr?.name || "Unknown Show",
    showDate: activeStr?.showDate || null,
    division: e.division || null,
    className: e.className,
    placing: results[e.id]?.placing || null,
    ribbonColor: results[e.id]?.ribbon || null,
    showLocation: showLocation || null,
    judgeName: judgeName || null,
    showDateText: showDateText || null,
    awardCategory: results[e.id]?.awardCategory || null,
    competitionLevel: results[e.id]?.level || null,
    notes: results[e.id]?.notes || null,
    isNan: !!results[e.id]?.isNan,
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
 : `💾 Save ${Object.values(results).filter((r) => r.placing || r.ribbon || r.awardCategory || r.level || r.notes || r.isNan).length} Results`}
 </Button>
 <Button variant="outline" size="wide"
 onClick={() => setShowResults(false)}
 >
 Cancel
 </Button>
 {resultsSaved && (
  <span className="text-forest font-semibold">
    ✅ Results saved. Re-saving will skip already-recorded entries.
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
