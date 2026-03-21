"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { saveExpertPlacings, overrideFinalPlacings } from"@/app/actions/shows";

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

 const borderColor = overrideMode ?"rgba(239, 68, 68, 0.3)" :"rgba(245, 158, 11, 0.3)";
 const bgColor = overrideMode ?"rgba(239, 68, 68, 0.05)" :"rgba(245, 158, 11, 0.05)";

 return (
 <div
 className="bg-card border-edge animate-fade-in-up rounded-lg border shadow-md transition-all"
 style={{
 marginBottom:"var(--space-lg)",
 border: `1px solid ${borderColor}`,
 background: bgColor,
 }}
 >
 <h3 className="mb-4 gap-2" style={{ display:"flex", alignItems:"center" }}>
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
 className="form-input"
 value={selectedClassId}
 onChange={(e) => setSelectedClassId(e.target.value)}
 style={{ maxWidth: 400 }}
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
 <div
 style={{
 marginTop:"var(--space-xs)",
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 color:"var(--color-text-muted)",
 }}
 >
 Currently judging: <strong>{currentClass.divisionName}</strong> ›{""}
 <strong>{currentClass.name}</strong>
 </div>
 )}
 </div>
 )}

 <div className="gap-2" style={{ display:"flex", flexDirection:"column" }}>
 {filteredEntries.length === 0 ? (
 <div className="text-muted p-4" style={{ textAlign:"center" }}>
 No entries {selectedClassId !=="all" ?"in this class" :"to judge"}.
 </div>
 ) : (
 filteredEntries.map((entry) => (
 <div key={entry.id}>
 <div
 style={{
 display:"flex",
 alignItems:"center",
 gap:"var(--space-md)",
 padding:"var(--space-sm) var(--space-md)",
 background:"rgba(var(--color-surface-rgb, 30, 30, 30), 0.5)",
 borderRadius: expandedNotes.has(entry.id)
 ?"var(--radius-sm) var(--radius-sm) 0 0"
 :"var(--radius-sm)",
 }}
 >
 {entry.thumbnailUrl && (
 <div className="h-[40] w-[40] shrink-0 rounded-sm" style={{ overflow:"hidden" }}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={entry.thumbnailUrl}
 alt={entry.horseName}
 className="h-full w-full"
 style={{ objectFit:"cover" }}
 />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <div className="text-sm font-semibold">🐴 {entry.horseName}</div>
 <div className="text-muted text-[calc(0.75rem*var(--font-scale))]">
 by @{entry.ownerAlias}
 </div>
 </div>
 <button
 type="button"
 onClick={() => toggleNotes(entry.id)}
 title="Judge notes"
 style={{
 background:"none",
 border:"none",
 cursor:"pointer",
 color: notes[entry.id]
 ?"var(--color-accent-primary)"
 :"var(--color-text-muted)",
 fontSize:"1rem",
 padding:"4px",
 flexShrink: 0,
 }}
 >
 📝
 </button>
 <select
 className="form-input"
 value={placings[entry.id] ||""}
 onChange={(e) => setPlacings((prev) => ({ ...prev, [entry.id]: e.target.value }))}
 style={{ width: 140, flexShrink: 0 }}
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
 <div
 style={{
 padding:"var(--space-sm) var(--space-md)",
 background:"rgba(var(--color-surface-rgb, 30, 30, 30), 0.3)",
 borderRadius:"0 0 var(--radius-sm) var(--radius-sm)",
 borderTop:"1px solid rgba(255,255,255,0.05)",
 }}
 >
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 value={notes[entry.id] ||""}
 onChange={(e) => setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
 placeholder="Private judge notes (critique, reasoning)…"
 rows={2}
 style={{ fontSize:"calc(0.8rem * var(--font-scale))", resize:"vertical" }}
 />
 </div>
 )}
 </div>
 ))
 )}
 </div>

 {error && <div className="comment-error mt-2">{error}</div>}
 {success && (
 <div
 style={{
 marginTop:"var(--space-sm)",
 padding:"var(--space-xs) var(--space-sm)",
 background:"rgba(34, 197, 94, 0.15)",
 color:"#22c55e",
 borderRadius:"var(--radius-sm)",
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 }}
 >
 ✅ Placings saved!{""}
 {overrideMode
 ?"Show records updated with audit trail."
 :"Show records auto-generated for placed entries."}
 </div>
 )}

 <div className="mt-4 gap-2" style={{ display:"flex" }}>
 <button
 className={`btn ${overrideMode ?"btn-ghost" :"btn-primary"}`}
 onClick={handleSave}
 disabled={saving}
 style={overrideMode ? { borderColor:"rgba(239, 68, 68, 0.4)", color:"#ef4444" } : undefined}
 >
 {saving ?"Saving…" : overrideMode ?"⚠️ Override Placings" :"💾 Save Placings"}
 </button>
 </div>
 </div>
 );
}
