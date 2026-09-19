"use client";

import { useState } from"react";
import { addShowRecord, updateShowRecord } from"@/app/actions/provenance";
import {
 QUALIFIER_PROGRAMS,
 MAX_CARD_ID,
 MIN_CARD_YEAR,
 isQualifierProgram,
 programInfo,
 type QualifierProgram,
} from "@/lib/records/qualifiers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const RIBBON_COLORS = [
 { value:"", label:"Select ribbon/award…" },
 { value:"Blue", label:"🔵 Blue" },
 { value:"Red", label:"🔴 Red" },
 { value:"Yellow", label:"🟡 Yellow" },
 { value:"White", label:"⚪ White" },
 { value:"Pink", label:"🩷 Pink" },
 { value:"Green", label:"🟢 Green" },
 { value:"Purple", label:"🟣 Purple" },
 { value:"Brown", label:"🟤 Brown (8th)" },
 { value:"Gray", label:"🔘 Gray (9th)" },
 { value:"Light Blue", label:"🧊 Light Blue (10th)" },
 { value:"Grand Champion", label:"🏆 Grand Champion" },
 { value:"Reserve Grand Champion", label:"🥈 Reserve Grand Champion" },
 { value:"Champion", label:"🏆 Champion" },
 { value:"Reserve Champion", label:"🥈 Reserve Champion" },
 { value:"Honorable Mention", label:"🎖️ Honorable Mention (HM)" },
 { value:"Top 3", label:"🏅 Top 3" },
 { value:"Top 5", label:"🏅 Top 5" },
 { value:"Top 10", label:"🏅 Top 10" },
 { value:"Participant", label:"🎀 Participant" },
 { value:"Other", label:"Other" },
];

interface ShowRecordFormProps {
 horseId: string;
 existingRecord?: {
 id: string;
 showName: string;
 showDate: string | null;
 division: string | null;
 className: string | null;
 placing: string | null;
 ribbonColor: string | null;
 judgeName: string | null;
 isNan: boolean;
 notes: string | null;
 // Beta feedback fields
 showLocation: string | null;
 sectionName: string | null;
 awardCategory: string | null;
 competitionLevel: string | null;
 showDateText: string | null;
 // Qualification card (210)
 qualifierProgram?: string | null;
 qualifierCard?: string | null;
 qualifierYear?: number | null;
 qualifierCardId?: string | null;
 };
 onSave: () => void;
 onCancel: () => void;
}

export default function ShowRecordForm({ horseId, existingRecord, onSave, onCancel }: ShowRecordFormProps) {
 const isEdit = !!existingRecord;

 const [showName, setShowName] = useState(existingRecord?.showName ??"");
 const [showDate, setShowDate] = useState(existingRecord?.showDate ??"");
 const [division, setDivision] = useState(existingRecord?.division ??"");
 const [className, setClassName] = useState(existingRecord?.className ??"");
 const [placing, setPlacing] = useState(existingRecord?.placing ??"");
 const [ribbonColor, setRibbonColor] = useState(existingRecord?.ribbonColor ??"");
 const [judgeName, setJudgeName] = useState(existingRecord?.judgeName ??"");
 const [isNan, setIsNan] = useState(existingRecord?.isNan ?? false);
 const [notes, setNotes] = useState(existingRecord?.notes ??"");
 const [status, setStatus] = useState<"idle" |"saving" |"error" |"saved">("idle");
 const [errorMsg, setErrorMsg] = useState("");
 /** Saved, but with something the member should know (pre-210 card). */
 const [savedNote, setSavedNote] = useState<string | null>(null);

 // Qualification card (210): NAN or OMEQ — colour, year, printed ID.
 const [qProgram, setQProgram] = useState<QualifierProgram |"">(
 isQualifierProgram(existingRecord?.qualifierProgram) ? existingRecord!.qualifierProgram as QualifierProgram :"",
 );
 const [qCard, setQCard] = useState(existingRecord?.qualifierCard ??"");
 const [qYear, setQYear] = useState(existingRecord?.qualifierYear ? String(existingRecord.qualifierYear) :"");
 const [qCardId, setQCardId] = useState(existingRecord?.qualifierCardId ??"");

 // NEW: Beta feedback state
 const [showLocation, setShowLocation] = useState(existingRecord?.showLocation ??"");
 const [sectionName, setSectionName] = useState(existingRecord?.sectionName ??"");
 const [awardCategory, setAwardCategory] = useState(existingRecord?.awardCategory ??"");
 const [competitionLevel, setCompetitionLevel] = useState(existingRecord?.competitionLevel ??"");
 const [showDateText, setShowDateText] = useState(existingRecord?.showDateText ??"");
 const [showAdvanced, setShowAdvanced] = useState(
 !!(
 existingRecord?.showLocation ||
 existingRecord?.sectionName ||
 existingRecord?.awardCategory ||
 existingRecord?.competitionLevel
 ),
 );

 /** Picking a program keeps a colour only if it belongs to that
  *  program, and seeds the year from the show date. */
 const pickProgram = (value: string) => {
 if (!isQualifierProgram(value)) {
 setQProgram("");
 return;
 }
 setQProgram(value);
 if (!programInfo(value).cards.some((c) => c.value === qCard)) setQCard("");
 if (!qYear) setQYear(showDate ? showDate.slice(0, 4) : String(new Date().getFullYear()));
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!showName.trim() || status ==="saving") return;
 if (qProgram && !qCard) {
 setErrorMsg(`Pick the ${programInfo(qProgram).short} card colour.`);
 setStatus("error");
 return;
 }

 setStatus("saving");
 setErrorMsg("");

 const formData = {
 showName,
 showDate: showDate || null,
 division: division.trim() || null,
 className: className.trim() || null,
 placing: placing.trim() || null,
 ribbonColor: ribbonColor || null,
 judgeName: judgeName.trim() || null,
 isNan,
 notes: notes.trim() || null,
 showLocation: showLocation.trim() || null,
 sectionName: sectionName.trim() || null,
 awardCategory: awardCategory.trim() || null,
 competitionLevel: competitionLevel.trim() || null,
 showDateText: showDateText.trim() || null,
 // The card: always sent, so "No card" clears one on edit.
 qualifierProgram: qProgram || null,
 qualifierCard: qProgram ? qCard || null : null,
 qualifierYear: qProgram ? qYear || null : null,
 qualifierCardId: qProgram ? qCardId.trim() || null : null,
 };

 const result = isEdit
 ? await updateShowRecord(existingRecord!.id, formData)
 : await addShowRecord({ horseId, ...formData });

 if (result.success) {
 if (result.warning) {
 // The record is in; the member should still read this.
 setSavedNote(result.warning);
 setStatus("saved");
 } else {
 onSave();
 }
 } else {
 setErrorMsg(result.error ||"Failed to save.");
 setStatus("error");
 }
 };

 return (
 <div className="rounded-lg border border-input bg-card p-6 shadow-md transition-all">
 <div className="mb-4 text-base font-semibold">
 {isEdit ?"✏️ Edit Show Record" :"🏅 Add Show Record"}
 </div>
 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Show Name <span className="text-destructive">*</span>
 </label>
 <Input
 
 type="text"
 value={showName}
 onChange={(e) => setShowName(e.target.value)}
 placeholder="e.g. NAMHSA Nationals 2025"
 maxLength={200}
 required
 id="show-record-name"
 />
 </div>

 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label htmlFor="show-record-date" className="text-foreground mb-1 block text-sm font-semibold">Show Date</label>
 <Input
 
 type="date"
 value={showDate}
 onChange={(e) => setShowDate(e.target.value)}
 id="show-record-date"
 title="Show date"
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Division / Section</label>
 <Input
 
 type="text"
 value={division}
 onChange={(e) => setDivision(e.target.value)}
 placeholder="e.g. OF Breyer Traditional"
 id="show-record-division"
 />
 </div>
 </div>

 {/* Class Name — between Division and Placing */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Class Name</label>
 <Input
 
 type="text"
 value={className}
 onChange={(e) => setClassName(e.target.value)}
 placeholder="e.g. OF Stock Horse Mare, CM Decorator"
 id="show-record-class-name"
 />
 <small className="text-muted-foreground text-[var(--font-size-xs)]">
 Individual class name (not division or section callbacks).
 </small>
 </div>

 {/* Fuzzy Date fallback */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Approximate Date</label>
 <Input
 
 type="text"
 value={showDateText}
 onChange={(e) => setShowDateText(e.target.value)}
 placeholder="e.g. Spring 2023, BreyerFest 2015"
 id="show-record-date-text"
 />
 <small className="text-muted-foreground text-[var(--font-size-xs)]">
 Use this when you don&apos;t know the exact date.
 </small>
 </div>

 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Placing</label>
 <Input
 
 type="text"
 value={placing}
 onChange={(e) => setPlacing(e.target.value)}
 placeholder="e.g. 1st, NAN Top Ten"
 id="show-record-placing"
 />
 </div>
 <div className="mb-6">
 <label htmlFor="show-record-ribbon" className="text-foreground mb-1 block text-sm font-semibold">Ribbon Color</label>
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={ribbonColor}
 onChange={(e) => setRibbonColor(e.target.value)}
 id="show-record-ribbon"
 >
 {RIBBON_COLORS.map((r) => (
 <option key={r.value} value={r.value}>
 {r.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Judge</label>
 <Input
 
 type="text"
 value={judgeName}
 onChange={(e) => setJudgeName(e.target.value)}
 placeholder="Judge name (optional)"
 id="show-record-judge"
 />
 </div>

 <div className="mb-6 flex items-center gap-2">
 <input
 type="checkbox"
 checked={isNan}
 onChange={(e) => setIsNan(e.target.checked)}
 id="show-record-nan"
 className="h-[18px] w-[18px] accent-amber-500"
 />
 <label htmlFor="show-record-nan" className="text-foreground mb-0 mb-1 block text-sm font-semibold">
 ⭐ Placed at NAN itself (the championship)
 </label>
 </div>

 {/* Qualification card (210): NAN or OMEQ. We track it; the program issued it. */}
 <div className="mb-6 rounded-md border border-input p-4" data-testid="qualifier-block">
 <label htmlFor="show-record-qualifier" className="text-foreground mb-1 block text-sm font-semibold">
 🎫 Qualification card earned
 </label>
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={qProgram}
 onChange={(e) => pickProgram(e.target.value)}
 id="show-record-qualifier"
 >
 <option value="">No card</option>
 {QUALIFIER_PROGRAMS.map((p) => (
 <option key={p.value} value={p.value}>
 {p.label}
 </option>
 ))}
 </select>
 {qProgram && (
 <>
 <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Card colour">
 {programInfo(qProgram).cards.map((c) => (
 <button
 key={c.value}
 type="button"
 role="radio"
 aria-checked={qCard === c.value}
 onClick={() => setQCard(c.value)}
 className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs ${
 qCard === c.value
 ?"border-forest bg-forest/10 font-semibold text-forest"
 :"border-input text-muted-foreground"
 }`}
 >
 {c.glyph} {c.label}
 </button>
 ))}
 </div>
 <div className="mt-3 grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div>
 <label htmlFor="show-record-qualifier-year" className="text-foreground mb-1 block text-sm font-semibold">
 Card year
 </label>
 <Input
 type="number"
 min={MIN_CARD_YEAR}
 max={new Date().getFullYear() + 1}
 value={qYear}
 onChange={(e) => setQYear(e.target.value)}
 id="show-record-qualifier-year"
 />
 </div>
 <div>
 <label htmlFor="show-record-qualifier-card-id" className="text-foreground mb-1 block text-sm font-semibold">
 Card ID{" "}
 <span className="font-normal text-muted-foreground">
 (optional{qProgram ==="omeq" ?" — printed on the card" :""})
 </span>
 </label>
 <Input
 type="text"
 value={qCardId}
 onChange={(e) => setQCardId(e.target.value)}
 maxLength={MAX_CARD_ID}
 id="show-record-qualifier-card-id"
 placeholder={qProgram ==="omeq" ?"The ID on your OMEQ card" :"If your card has one"}
 />
 </div>
 </div>
 <small className="text-muted-foreground text-[var(--font-size-xs)]">
 {programInfo(qProgram).validity} Official cards are issued by {programInfo(qProgram).issuer}; this is
 your own record of it.
 </small>
 </>
 )}
 </div>

 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Notes</label>
 <textarea
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Additional notes (optional)"
 maxLength={500}
 rows={2}
 id="show-record-notes"
 />
 </div>

 {/* Advanced Details Toggle */}
 <div className="mb-6">
 <Button
 type="button" variant="outline" size="wide" className="w-full"
 onClick={() => setShowAdvanced(!showAdvanced)}
 id="show-record-advanced-toggle"
 >
 {showAdvanced ?"▾ Hide" :"▸ Show"} Advanced Details
 </Button>
 </div>

 {showAdvanced && (
 <>
 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Location</label>
 <Input
 
 type="text"
 value={showLocation}
 onChange={(e) => setShowLocation(e.target.value)}
 placeholder="e.g. Dallas TX, Ontario Canada"
 id="show-record-location"
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Section</label>
 <Input
 
 type="text"
 value={sectionName}
 onChange={(e) => setSectionName(e.target.value)}
 placeholder="e.g. Halter, Performance"
 id="show-record-section"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label htmlFor="show-record-award-category" className="text-foreground mb-1 block text-sm font-semibold">Award Category</label>
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={awardCategory}
 onChange={(e) => setAwardCategory(e.target.value)}
 id="show-record-award-category"
 >
 <option value="">Select category…</option>
 <option value="Breed">Breed</option>
 <option value="Collectibility">Collectibility</option>
 <option value="Workmanship">Workmanship</option>
 <option value="Color">Color</option>
 <option value="Gender">Gender</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div className="mb-6">
 <label htmlFor="show-record-competition-level" className="text-foreground mb-1 block text-sm font-semibold">Competition Level</label>
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={competitionLevel}
 onChange={(e) => setCompetitionLevel(e.target.value)}
 id="show-record-competition-level"
 >
 <option value="">Select level…</option>
 <option value="Open">Open</option>
 <option value="Novice">Novice</option>
 <option value="Intermediate">Intermediate</option>
 <option value="Youth">Youth</option>
 </select>
 </div>
 </div>
 </>
 )}

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-red-700 mb-4">{errorMsg}</div>}
 {status ==="saved" && savedNote && (
 <div role="status" className="mt-2 mb-4 rounded-md border border-input bg-muted px-3 py-2 text-sm">
 {savedNote}
 </div>
 )}

 <div className="mt-6 flex justify-end gap-2">
 {status ==="saved" ? (
 <Button type="button" onClick={onSave}>
 Done
 </Button>
 ) : (
 <>
 <Button
 type="button" variant="outline" size="wide"
 onClick={onCancel}
 >
 Cancel
 </Button>
 <Button
 type="submit"
 disabled={!showName.trim() || status ==="saving"}
 >
 {status ==="saving" ?"Saving…" : isEdit ?"Update" :"Add Record"}
 </Button>
 </>
 )}
 </div>
 </form>
 </div>
 );
}
