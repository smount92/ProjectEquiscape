"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { savePedigree } from"@/app/actions/provenance";
import { searchPublicHorses } from"@/app/actions/horse";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
 className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="text-stone-500 py-4 text-center">
 <p>No pedigree data yet.</p>
 <button
 className="mt-2 inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => setIsEditing(true)}
 id="add-pedigree"
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
 className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
 <h3 className="m-0 flex items-center gap-2 text-lg">
 <span aria-hidden="true">🧬</span> {pedigree ?"Edit Pedigree" :"Add Pedigree"}
 </h3>
 </div>
 <form onSubmit={handleSave}>
 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 {/* Sire with search */}
 <div className="relative mb-6" ref={sireRef}>
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Sire (Father)</label>
 <Input
 
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
 <div className="mt-1 flex items-center gap-1">
 <span className="text-forest text-xs">
 🔗 Linked to a horse in the system
 </span>
 <button
 type="button"
 onClick={clearSireLink}
 className="cursor-pointer border-0 bg-transparent text-xs text-stone-500"
 >
 ✕
 </button>
 </div>
 )}
 {showSireDropdown && sireResults.length > 0 && (
 <div className="absolute top-full right-0 left-0 z-50 max-h-[200px] overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">

 {sireResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectSire(h)}
 className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2 text-left text-sm text-stone-900 hover:bg-stone-50"
 >
 {h.custom_name} <span className="text-stone-500">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 {/* Dam with search */}
 <div className="relative mb-6" ref={damRef}>
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Dam (Mother)</label>
 <Input
 
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
 <div className="mt-1 flex items-center gap-1">
 <span className="text-forest text-xs">
 🔗 Linked to a horse in the system
 </span>
 <button
 type="button"
 onClick={clearDamLink}
 className="cursor-pointer border-0 bg-transparent text-xs text-stone-500"
 >
 ✕
 </button>
 </div>
 )}
 {showDamDropdown && damResults.length > 0 && (
 <div className="absolute top-full right-0 left-0 z-50 max-h-[200px] overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">

 {damResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectDam(h)}
 className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2 text-left text-sm text-stone-900 hover:bg-stone-50"
 >
 {h.custom_name} <span className="text-stone-500">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Sculptor / Artist</label>
 <Input
 
 type="text"
 value={sculptor}
 onChange={(e) => setSculptor(e.target.value)}
 placeholder="Sculptor name"
 id="pedigree-sculptor"
 />
 </div>

 <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Cast Number</label>
 <Input
 
 type="text"
 value={castNumber}
 onChange={(e) => setCastNumber(e.target.value)}
 placeholder="e.g. 3"
 id="pedigree-cast"
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Edition Size</label>
 <Input
 
 type="text"
 value={editionSize}
 onChange={(e) => setEditionSize(e.target.value)}
 placeholder="e.g. 10"
 id="pedigree-edition"
 />
 </div>
 </div>

 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Lineage Notes</label>
 <Textarea
 
 value={lineageNotes}
 onChange={(e) => setLineageNotes(e.target.value)}
 placeholder="Additional lineage details…"
 maxLength={500}
 rows={2}
 id="pedigree-notes"
 />
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-red-700 mb-4">{errorMsg}</div>}

 <div className="mt-6 flex justify-end gap-2">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={handleCancel}
 >
 Cancel
 </button>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
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
 className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
 <h3 className="m-0 flex items-center gap-2 text-lg">
 <span aria-hidden="true">🧬</span> Pedigree
 </h3>
 {isOwner && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-4 py-1 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setIsEditing(true)}
 >
 ✏️ Edit
 </button>
 )}
 </div>

 {pedigree!.sireName && (
 <div className="flex justify-between border-b border-[var(--color-border,rgb(245 245 244))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-stone-500 text-sm">Sire</span>
 <span className="text-sm font-medium">
 {pedigree!.sireId ? (
 <Link
 href={`/community/${pedigree!.sireId}`}
 className="text-forest no-underline"
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
 <div className="flex justify-between border-b border-[var(--color-border,rgb(245 245 244))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-stone-500 text-sm">Dam</span>
 <span className="text-sm font-medium">
 {pedigree!.damId ? (
 <Link
 href={`/community/${pedigree!.damId}`}
 className="text-forest no-underline"
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
 <div className="flex justify-between border-b border-[var(--color-border,rgb(245 245 244))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-stone-500 text-sm">Sculptor</span>
 <span className="text-sm font-medium">{pedigree!.sculptor}</span>
 </div>
 )}
 {(pedigree!.castNumber || pedigree!.editionSize) && (
 <div className="flex justify-between border-b border-[var(--color-border,rgb(245 245 244))] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-stone-500 text-sm">Cast / Edition</span>
 <span className="text-sm font-medium">
 {pedigree!.castNumber && pedigree!.editionSize
 ? `#${pedigree!.castNumber} of ${pedigree!.editionSize}`
 : pedigree!.castNumber
 ? `#${pedigree!.castNumber}`
 : `Edition of ${pedigree!.editionSize}`}
 </span>
 </div>
 )}
 {pedigree!.lineageNotes && (
 <div className="text-stone-500 mt-4 rounded-md bg-stone-50 px-4 py-2 text-sm whitespace-pre-wrap italic">
 {pedigree!.lineageNotes}
 </div>
 )}
 </div>
 );
}
