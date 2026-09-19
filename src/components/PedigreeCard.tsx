"use client";

import { useState, useEffect, useRef } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { savePedigree } from"@/app/actions/provenance";
import { searchPublicHorses } from"@/app/actions/horse";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { linkHost } from "@/lib/papers/validate";

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
 /** The sire's / dam's own page (213) — a sire/dam list, a registry entry. */
 sireUrl?: string | null;
 damUrl?: string | null;
 /** The breeding program named on the certificate (213). */
 bredBy?: string | null;
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
 const [sireUrl, setSireUrl] = useState(pedigree?.sireUrl ??"");
 const [damUrl, setDamUrl] = useState(pedigree?.damUrl ??"");
 const [bredBy, setBredBy] = useState(pedigree?.bredBy ??"");
 const [savedNote, setSavedNote] = useState<string | null>(null);

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
 sireUrl: sireUrl || null,
 damUrl: damUrl || null,
 bredBy: bredBy || null,
 });

 if (result.success) {
 setSavedNote(result.warning ?? null);
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
 setSireUrl(pedigree?.sireUrl ??"");
 setDamUrl(pedigree?.damUrl ??"");
 setBredBy(pedigree?.bredBy ??"");
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
 className="rounded-lg border border-input bg-card p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="text-muted-foreground py-4 text-center">
 <p>No pedigree data yet.</p>
 <Button className="mt-2"
 onClick={() => setIsEditing(true)}
 id="add-pedigree"
 >
 🧬 Add Pedigree
 </Button>
 </div>
 </div>
 );
 }

 // Edit form
 if (isEditing) {
 return (
 <div
 className="rounded-lg border border-input bg-card p-4 shadow-sm transition-all"
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
 <label className="text-foreground mb-1 block text-sm font-semibold">Sire (Father)</label>
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
 className="cursor-pointer border-0 bg-transparent text-xs text-muted-foreground"
 >
 ✕
 </button>
 </div>
 )}
 <Input
 type="text"
 value={sireUrl}
 onChange={(e) => setSireUrl(e.target.value)}
 placeholder="His page (optional) — a sire list, a registry entry"
 className="mt-2"
 aria-label="Sire's page"
 id="pedigree-sire-url"
 />
 {showSireDropdown && sireResults.length > 0 && (
 <div className="absolute top-full right-0 left-0 z-50 max-h-[200px] overflow-y-auto rounded-md border border-input bg-card shadow-lg">

 {sireResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectSire(h)}
 className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
 >
 {h.custom_name} <span className="text-muted-foreground">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 {/* Dam with search */}
 <div className="relative mb-6" ref={damRef}>
 <label className="text-foreground mb-1 block text-sm font-semibold">Dam (Mother)</label>
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
 className="cursor-pointer border-0 bg-transparent text-xs text-muted-foreground"
 >
 ✕
 </button>
 </div>
 )}
 <Input
 type="text"
 value={damUrl}
 onChange={(e) => setDamUrl(e.target.value)}
 placeholder="Her page (optional) — a dam list, a registry entry"
 className="mt-2"
 aria-label="Dam's page"
 id="pedigree-dam-url"
 />
 {showDamDropdown && damResults.length > 0 && (
 <div className="absolute top-full right-0 left-0 z-50 max-h-[200px] overflow-y-auto rounded-md border border-input bg-card shadow-lg">

 {damResults.map((h) => (
 <button
 key={h.id}
 type="button"
 onClick={() => selectDam(h)}
 className="block w-full cursor-pointer border-0 bg-transparent px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
 >
 {h.custom_name} <span className="text-muted-foreground">({h.finish_type})</span>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>

 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 Bred by <span className="text-muted-foreground font-normal">(optional)</span>
 </label>
 <Input
 type="text"
 value={bredBy}
 onChange={(e) => setBredBy(e.target.value)}
 placeholder="The breeding program on the certificate, e.g. Starrfyre"
 maxLength={120}
 id="pedigree-bred-by"
 className="mb-4"
 />
 <label className="text-foreground mb-1 block text-sm font-semibold">Sculptor / Artist</label>
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
 <label className="text-foreground mb-1 block text-sm font-semibold">Cast Number</label>
 <Input
 
 type="text"
 value={castNumber}
 onChange={(e) => setCastNumber(e.target.value)}
 placeholder="e.g. 3"
 id="pedigree-cast"
 />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Edition Size</label>
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
 <label className="text-foreground mb-1 block text-sm font-semibold">Lineage Notes</label>
 <Textarea
 
 value={lineageNotes}
 onChange={(e) => setLineageNotes(e.target.value)}
 placeholder="Additional lineage details…"
 maxLength={500}
 rows={2}
 id="pedigree-notes"
 />
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-destructive mb-4">{errorMsg}</div>}

 <div className="mt-6 flex justify-end gap-2">
 <Button
 type="button" variant="outline" size="wide"
 onClick={handleCancel}
 >
 Cancel
 </Button>
 <Button
 type="submit"
 disabled={status ==="saving"}
 >
 {status ==="saving" ?"Saving…" :"Save Pedigree"}
 </Button>
 </div>
 </form>
 </div>
 );
 }

 // Read-only display
 return (
 <div
 className="rounded-lg border border-input bg-card p-4 shadow-sm transition-all"
 id="pedigree-card"
 >
 <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
 <h3 className="m-0 flex items-center gap-2 text-lg">
 <span aria-hidden="true">🧬</span> Pedigree
 </h3>
 {savedNote && (
 <span role="status" className="text-warning basis-full text-xs">{savedNote}</span>
 )}
 {isOwner && (
 <Button variant="outline" className="px-4"
 onClick={() => setIsEditing(true)}
 >
 ✏️ Edit
 </Button>
 )}
 </div>

 {pedigree!.sireName && (
 <div className="flex justify-between border-b border-[var(--border)] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted-foreground text-sm">Sire</span>
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
 {pedigree!.sireUrl && (
 <a
 href={pedigree!.sireUrl}
 target="_blank"
 rel="noopener noreferrer nofollow"
 className="text-forest ml-2 text-xs no-underline hover:underline"
 title={pedigree!.sireUrl}
 >
 his page on {linkHost(pedigree!.sireUrl)} ↗
 </a>
 )}
 </span>
 </div>
 )}
 {pedigree!.damName && (
 <div className="flex justify-between border-b border-[var(--border)] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted-foreground text-sm">Dam</span>
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
 {pedigree!.damUrl && (
 <a
 href={pedigree!.damUrl}
 target="_blank"
 rel="noopener noreferrer nofollow"
 className="text-forest ml-2 text-xs no-underline hover:underline"
 title={pedigree!.damUrl}
 >
 her page on {linkHost(pedigree!.damUrl)} ↗
 </a>
 )}
 </span>
 </div>
 )}
 {pedigree!.bredBy && (
 <div className="flex justify-between border-b border-[var(--border)] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted-foreground text-sm">Bred by</span>
 <span className="text-sm font-medium">{pedigree!.bredBy}</span>
 </div>
 )}
 {pedigree!.sculptor && (
 <div className="flex justify-between border-b border-[var(--border)] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted-foreground text-sm">Sculptor</span>
 <span className="text-sm font-medium">{pedigree!.sculptor}</span>
 </div>
 )}
 {(pedigree!.castNumber || pedigree!.editionSize) && (
 <div className="flex justify-between border-b border-[var(--border)] py-2 last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
 <span className="text-muted-foreground text-sm">Cast / Edition</span>
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
 <div className="text-muted-foreground mt-4 rounded-md bg-muted px-4 py-2 text-sm whitespace-pre-wrap italic">
 {pedigree!.lineageNotes}
 </div>
 )}
 </div>
 );
}
