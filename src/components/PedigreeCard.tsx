"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { savePedigree } from"@/app/actions/provenance";
import { searchPublicHorses } from"@/app/actions/horse";

interface PedigreeData {
 id: string;
 sireName: string | null;
 damName: string | null;
 sireId: string | null;
 damId: string | null;
 sculptor: string | null;
 castNumber: string | null;
 editionSize: string | null;
 lineageNotes: string | null;
}

interface PedigreeCardProps {
 horseId: string;
 pedigree: PedigreeData | null;
 isOwner: boolean;
}

interface HorseSearchResult {
 id: string;
 custom_name: string;
 finish_type: string;
}

export default function PedigreeCard({ horseId, pedigree, isOwner }: PedigreeCardProps) {
 const router = useRouter();
 const [isEditing, setIsEditing] = useState(false);
 const [status, setStatus] = useState<"idle" |"saving" |"error">("idle");
 const [errorMsg, setErrorMsg] = useState("");

 const [sireName, setSireName] = useState(pedigree?.sireName ??"");
 const [damName, setDamName] = useState(pedigree?.damName ??"");
 const [sireId, setSireId] = useState<string | null>(pedigree?.sireId ?? null);
 const [damId, setDamId] = useState<string | null>(pedigree?.damId ?? null);
 const [sculptor, setSculptor] = useState(pedigree?.sculptor ??"");
 const [castNumber, setCastNumber] = useState(pedigree?.castNumber ??"");
 const [editionSize, setEditionSize] = useState(pedigree?.editionSize ??"");
 const [lineageNotes, setLineageNotes] = useState(pedigree?.lineageNotes ??"");

 // Search state for sire/dam lookups
 const [sireResults, setSireResults] = useState<HorseSearchResult[]>([]);
 const [damResults, setDamResults] = useState<HorseSearchResult[]>([]);
 const [showSireDropdown, setShowSireDropdown] = useState(false);
 const [showDamDropdown, setShowDamDropdown] = useState(false);
 const sireRef = useRef<HTMLDivElement>(null);
 const damRef = useRef<HTMLDivElement>(null);

 // Debounced search for sire
 useEffect(() => {
 if (!sireName || sireName.length < 2 || sireId) {
 setSireResults([]);
 return;
 }
 const timer = setTimeout(async () => {
 const results = await searchPublicHorses(sireName);
 setSireResults(results);
 setShowSireDropdown(results.length > 0);
 }, 300);
 return () => clearTimeout(timer);
 }, [sireName, sireId]);

 // Debounced search for dam
 useEffect(() => {
 if (!damName || damName.length < 2 || damId) {
 setDamResults([]);
 return;
 }
 const timer = setTimeout(async () => {
 const results = await searchPublicHorses(damName);
 setDamResults(results);
 setShowDamDropdown(results.length > 0);
 }, 300);
 return () => clearTimeout(timer);
 }, [damName, damId]);

 // Close dropdowns on outside click
 useEffect(() => {
 const handleClick = (e: MouseEvent) => {
 if (sireRef.current && !sireRef.current.contains(e.target as Node)) {
 setShowSireDropdown(false);
 }
 if (damRef.current && !damRef.current.contains(e.target as Node)) {
 setShowDamDropdown(false);
 }
 };
 document.addEventListener("mousedown", handleClick);
 return () => document.removeEventListener("mousedown", handleClick);
 }, []);

 // Non-owner + no data = don't render at all
 if (!isOwner && !pedigree) return null;

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (status ==="saving") return;

 setStatus("saving");
 setErrorMsg("");

 const result = await savePedigree({
 horseId,
 sireName: sireName || undefined,
 damName: damName || undefined,
 sireId: sireId || null,
 damId: damId || null,
 sculptor: sculptor || undefined,
 castNumber: castNumber || undefined,
 editionSize: editionSize || undefined,
 lineageNotes: lineageNotes || undefined,
 });

 if (result.success) {
 setIsEditing(false);
 setStatus("idle");
 router.refresh();
 } else {
 setErrorMsg(result.error ||"Failed to save.");
 setStatus("error");
 }
 };

 const handleCancel = () => {
 // Revert to original values
 setSireName(pedigree?.sireName ??"");
 setDamName(pedigree?.damName ??"");
 setSireId(pedigree?.sireId ?? null);
 setDamId(pedigree?.damId ?? null);
 setSculptor(pedigree?.sculptor ??"");
 setCastNumber(pedigree?.castNumber ??"");
 setEditionSize(pedigree?.editionSize ??"");
 setLineageNotes(pedigree?.lineageNotes ??"");
 setIsEditing(false);
 setErrorMsg("");
 setStatus("idle");
 };

 const selectSire = (horse: HorseSearchResult) => {
 setSireId(horse.id);
 setSireName(horse.custom_name);
 setShowSireDropdown(false);
 };

 const selectDam = (horse: HorseSearchResult) => {
 setDamId(horse.id);
 setDamName(horse.custom_name);
 setShowDamDropdown(false);
 };

 const clearSireLink = () => {
 setSireId(null);
 };

 const clearDamLink = () => {
 setDamId(null);
 };

 // CTA for owner when no pedigree exists
 if (!pedigree && isOwner && !isEditing) {
 return (
 <div
 className="rounded-lg border border-edge bg-card p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="text-muted py-4 text-center">
 <p>No pedigree data yet.</p>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => setIsEditing(true)}
 id="add-pedigree"
 style={{ marginTop:"var(--space-sm)" }}
 >
 🧬 Add Pedigree
 </button>
 </div>
 </div>
 );
 }

 // Edit form
 if (isEditing) {
 return (
 <div
 className="rounded-lg border border-edge bg-card p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="mb-4 flex items-center justify-between">
 <h3 className="m-0 flex items-center gap-2 text-[calc(1.1rem*var(--font-scale))]">
 <span aria-hidden="true">🧬</span> {pedigree ?"Edit Pedigree" :"Add Pedigree"}
 </h3>
 </div>
 <form onSubmit={handleSave}>
 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 {/* Sire with search */}
 <div className="mb-6" ref={sireRef} style={{ position:"relative" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Sire (Father)</label>
 <input
 className="form-input"
 type="text"
 value={sireName}
 onChange={(e) => {
 setSireName(e.target.value);
 if (sireId) setSireId(null);
 }}
 placeholder="Search or type name…"
 id="pedigree-sire"
 />
 {sireId && (
 <div className="mt-[4px] gap-1" style={{ display:"flex", alignItems:"center" }}>
 <span className="text-forest text-[calc(0.75rem*var(--font-scale))]">
 🔗 Linked to a horse in the system
 </span>
 <button
 type="button"
 onClick={clearSireLink}
 style={{
 background:"none",
 border:"none",
 cursor:"pointer",
 color:"var(--color-text-muted)",
 fontSize:"calc(0.75rem * var(--font-scale))",
 }}
 >
 ✕
 </button>
 </div>
 )}
 {showSireDropdown && sireResults.length > 0 && (
 <div
 style={{
 position:"absolute",
 top:"100%",
 left: 0,
 right: 0,
 zIndex: 50,
 background:"var(--color-bg-card)",
 border:"1px solid var(--color-border)",
 borderRadius:"var(--radius-md)",
 boxShadow:"var(--shadow-lg)",
 maxHeight:"200px",
 overflowY:"auto",
 }}
 >
 {sireResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectSire(h)}
 style={{
 display:"block",
 width:"100%",
 textAlign:"left",
 padding:"var(--space-sm) var(--space-md)",
 background:"none",
 border:"none",
 cursor:"pointer",
 color:"var(--color-text-primary)",
 fontSize:"calc(0.85rem * var(--font-scale))",
 }}
 >
 {h.custom_name} <span className="text-muted">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 {/* Dam with search */}
 <div className="mb-6" ref={damRef} style={{ position:"relative" }}>
 <label className="text-ink mb-1 block text-sm font-semibold">Dam (Mother)</label>
 <input
 className="form-input"
 type="text"
 value={damName}
 onChange={(e) => {
 setDamName(e.target.value);
 if (damId) setDamId(null);
 }}
 placeholder="Search or type name…"
 id="pedigree-dam"
 />
 {damId && (
 <div className="mt-[4px] gap-1" style={{ display:"flex", alignItems:"center" }}>
 <span className="text-forest text-[calc(0.75rem*var(--font-scale))]">
 🔗 Linked to a horse in the system
 </span>
 <button
 type="button"
 onClick={clearDamLink}
 style={{
 background:"none",
 border:"none",
 cursor:"pointer",
 color:"var(--color-text-muted)",
 fontSize:"calc(0.75rem * var(--font-scale))",
 }}
 >
 ✕
 </button>
 </div>
 )}
 {showDamDropdown && damResults.length > 0 && (
 <div
 style={{
 position:"absolute",
 top:"100%",
 left: 0,
 right: 0,
 zIndex: 50,
 background:"var(--color-bg-card)",
 border:"1px solid var(--color-border)",
 borderRadius:"var(--radius-md)",
 boxShadow:"var(--shadow-lg)",
 maxHeight:"200px",
 overflowY:"auto",
 }}
 >
 {damResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectDam(h)}
 style={{
 display:"block",
 width:"100%",
 textAlign:"left",
 padding:"var(--space-sm) var(--space-md)",
 background:"none",
 border:"none",
 cursor:"pointer",
 color:"var(--color-text-primary)",
 fontSize:"calc(0.85rem * var(--font-scale))",
 }}
 >
 {h.custom_name} <span className="text-muted">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Sculptor / Artist</label>
 <input
 className="form-input"
 type="text"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 placeholder="Sculptor name"
 id="pedigree-sculptor"
 />
 </div>

 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Cast Number</label>
 <input
 className="form-input"
 type="text"
 value={castNumber}
 onChange={(e) => setCastNumber(e.target.value)}
 placeholder="e.g. 3"
 id="pedigree-cast"
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Edition Size</label>
 <input
 className="form-input"
 type="text"
 value={editionSize}
 onChange={(e) => setEditionSize(e.target.value)}
 placeholder="e.g. 10"
 id="pedigree-edition"
 />
 </div>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Lineage Notes</label>
 <textarea
 className="form-input"
 value={lineageNotes}
 onChange={(e) => setLineageNotes(e.target.value)}
 placeholder="Additional lineage details…"
 maxLength={500}
 rows={2}
 id="pedigree-notes"
 />
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-danger mb-4">{errorMsg}</div>}

 <div className="mt-6 flex justify-end gap-2">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleCancel}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={status ==="saving"}
 >
 {status ==="saving" ?"Saving…" :"Save Pedigree"}
 </button>
 </div>
 </form>
 </div>
 );
 }

 // Read-only display
 return (
 <div
 className="rounded-lg border border-edge bg-card p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="mb-4 flex items-center justify-between">
 <h3 className="m-0 flex items-center gap-2 text-[calc(1.1rem*var(--font-scale))]">
 <span aria-hidden="true">🧬</span> Pedigree
 </h3>
 {isOwner && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setIsEditing(true)}
 style={{
 fontSize:"calc(0.8rem * var(--font-scale))",
 padding:"var(--space-xs) var(--space-md)",
 }}
 >
 ✏️ Edit
 </button>
 )}
 </div>

 {pedigree!.sireName && (
 <div className="flex justify-between border-b border-[var(--color-border,rgba(0,0,0,0.06))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Sire</span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-medium">
 {pedigree!.sireId ? (
 <Link
 href={`/community/${pedigree!.sireId}`}
 className="text-forest"
 style={{ textDecoration:"none" }}
 >
 {pedigree!.sireName} 🔗
 </Link>
 ) : (
 pedigree!.sireName
 )}
 </span>
 </div>
 )}
 {pedigree!.damName && (
 <div className="flex justify-between border-b border-[var(--color-border,rgba(0,0,0,0.06))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Dam</span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-medium">
 {pedigree!.damId ? (
 <Link
 href={`/community/${pedigree!.damId}`}
 className="text-forest"
 style={{ textDecoration:"none" }}
 >
 {pedigree!.damName} 🔗
 </Link>
 ) : (
 pedigree!.damName
 )}
 </span>
 </div>
 )}
 {pedigree!.sculptor && (
 <div className="flex justify-between border-b border-[var(--color-border,rgba(0,0,0,0.06))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Sculptor</span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-medium">{pedigree!.sculptor}</span>
 </div>
 )}
 {(pedigree!.castNumber || pedigree!.editionSize) && (
 <div className="flex justify-between border-b border-[var(--color-border,rgba(0,0,0,0.06))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Cast / Edition</span>
 <span className="text-[calc(0.9rem*var(--font-scale))] font-medium">
 {pedigree!.castNumber && pedigree!.editionSize
 ? `#${pedigree!.castNumber} of ${pedigree!.editionSize}`
 : pedigree!.castNumber
 ? `#${pedigree!.castNumber}`
 : `Edition of ${pedigree!.editionSize}`}
 </span>
 </div>
 )}
 {pedigree!.lineageNotes && (
 <div className="text-muted mt-4 rounded-md bg-[rgba(0,0,0,0.03)] px-4 py-2 text-[calc(0.85rem*var(--font-scale))] whitespace-pre-wrap italic">
 {pedigree!.lineageNotes}
 </div>
 )}
 </div>
 );
}
