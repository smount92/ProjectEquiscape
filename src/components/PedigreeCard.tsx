"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { savePedigree } from "@/app/actions/provenance";
import { searchPublicHorses } from "@/app/actions/horse";

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

export default function PedigreeCard({
    horseId,
    pedigree,
    isOwner,
}: PedigreeCardProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const [sireName, setSireName] = useState(pedigree?.sireName ?? "");
    const [damName, setDamName] = useState(pedigree?.damName ?? "");
    const [sireId, setSireId] = useState<string | null>(pedigree?.sireId ?? null);
    const [damId, setDamId] = useState<string | null>(pedigree?.damId ?? null);
    const [sculptor, setSculptor] = useState(pedigree?.sculptor ?? "");
    const [castNumber, setCastNumber] = useState(pedigree?.castNumber ?? "");
    const [editionSize, setEditionSize] = useState(pedigree?.editionSize ?? "");
    const [lineageNotes, setLineageNotes] = useState(pedigree?.lineageNotes ?? "");

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
        if (status === "saving") return;

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
            setErrorMsg(result.error || "Failed to save.");
            setStatus("error");
        }
    };

    const handleCancel = () => {
        // Revert to original values
        setSireName(pedigree?.sireName ?? "");
        setDamName(pedigree?.damName ?? "");
        setSireId(pedigree?.sireId ?? null);
        setDamId(pedigree?.damId ?? null);
        setSculptor(pedigree?.sculptor ?? "");
        setCastNumber(pedigree?.castNumber ?? "");
        setEditionSize(pedigree?.editionSize ?? "");
        setLineageNotes(pedigree?.lineageNotes ?? "");
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
            <div className="bg-[var(--color-bg-card border border-edge rounded-lg p-12 shadow-md transition-all-bg,rgba(0,0,0,0.05))] border border-[var(--color-border,rgba(0,0,0,0.08))] rounded-lg p-6" id="pedigree-card">
                <div className="text-center py-4 text-muted">
                    <p>No pedigree data yet.</p>
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                        onClick={() => setIsEditing(true)}
                        id="add-pedigree"
                        style={{ marginTop: "var(--space-sm)" }}
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
            <div className="bg-[var(--color-bg-card border border-edge rounded-lg p-12 shadow-md transition-all-bg,rgba(0,0,0,0.05))] border border-[var(--color-border,rgba(0,0,0,0.08))] rounded-lg p-6" id="pedigree-card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 m-0 text-[calc(1.1rem*var(--font-scale))]">
                        <span aria-hidden="true">🧬</span> {pedigree ? "Edit Pedigree" : "Add Pedigree"}
                    </h3>
                </div>
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                        {/* Sire with search */}
                        <div className="mb-6" ref={sireRef} style={{ position: "relative" }}>
                            <label className="block text-sm font-semibold text-ink mb-1">Sire (Father)</label>
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
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginTop: "4px" }}>
                                    <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-accent-primary)" }}>
                                        🔗 Linked to a horse in the system
                                    </span>
                                    <button type="button" onClick={clearSireLink} style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))",
                                    }}>✕</button>
                                </div>
                            )}
                            {showSireDropdown && sireResults.length > 0 && (
                                <div style={{
                                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                                    background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
                                    maxHeight: "200px", overflowY: "auto",
                                }}>
                                    {sireResults.map(h => (
                                        <button key={h.id} type="button" onClick={() => selectSire(h)} style={{
                                            display: "block", width: "100%", textAlign: "left",
                                            padding: "var(--space-sm) var(--space-md)",
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--color-text-primary)",
                                            fontSize: "calc(0.85rem * var(--font-scale))",
                                        }}>
                                            {h.custom_name} <span style={{ color: "var(--color-text-muted)" }}>({h.finish_type})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Dam with search */}
                        <div className="mb-6" ref={damRef} style={{ position: "relative" }}>
                            <label className="block text-sm font-semibold text-ink mb-1">Dam (Mother)</label>
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
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginTop: "4px" }}>
                                    <span style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-accent-primary)" }}>
                                        🔗 Linked to a horse in the system
                                    </span>
                                    <button type="button" onClick={clearDamLink} style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))",
                                    }}>✕</button>
                                </div>
                            )}
                            {showDamDropdown && damResults.length > 0 && (
                                <div style={{
                                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                                    background: "var(--color-bg-card)", border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
                                    maxHeight: "200px", overflowY: "auto",
                                }}>
                                    {damResults.map(h => (
                                        <button key={h.id} type="button" onClick={() => selectDam(h)} style={{
                                            display: "block", width: "100%", textAlign: "left",
                                            padding: "var(--space-sm) var(--space-md)",
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "var(--color-text-primary)",
                                            fontSize: "calc(0.85rem * var(--font-scale))",
                                        }}>
                                            {h.custom_name} <span style={{ color: "var(--color-text-muted)" }}>({h.finish_type})</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Sculptor / Artist</label>
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
                            <label className="block text-sm font-semibold text-ink mb-1">Cast Number</label>
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
                            <label className="block text-sm font-semibold text-ink mb-1">Edition Size</label>
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
                        <label className="block text-sm font-semibold text-ink mb-1">Lineage Notes</label>
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

                    {status === "error" && errorMsg && (
                        <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>
                            {errorMsg}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                            disabled={status === "saving"}
                        >
                            {status === "saving" ? "Saving…" : "Save Pedigree"}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // Read-only display
    return (
        <div className="bg-[var(--color-bg-card border border-edge rounded-lg p-12 shadow-md transition-all-bg,rgba(0,0,0,0.05))] border border-[var(--color-border,rgba(0,0,0,0.08))] rounded-lg p-6" id="pedigree-card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 m-0 text-[calc(1.1rem*var(--font-scale))]">
                    <span aria-hidden="true">🧬</span> Pedigree
                </h3>
                {isOwner && (
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                        onClick={() => setIsEditing(true)}
                        style={{ fontSize: "calc(0.8rem * var(--font-scale))", padding: "var(--space-xs) var(--space-md)" }}
                    >
                        ✏️ Edit
                    </button>
                )}
            </div>

            {pedigree!.sireName && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border,rgba(0,0,0,0.06))] last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
                    <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Sire</span>
                    <span className="font-medium text-[calc(0.9rem*var(--font-scale))]">
                        {pedigree!.sireId ? (
                            <Link href={`/community/${pedigree!.sireId}`} style={{ color: "var(--color-accent-primary)", textDecoration: "none" }}>
                                {pedigree!.sireName} 🔗
                            </Link>
                        ) : pedigree!.sireName}
                    </span>
                </div>
            )}
            {pedigree!.damName && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border,rgba(0,0,0,0.06))] last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
                    <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Dam</span>
                    <span className="font-medium text-[calc(0.9rem*var(--font-scale))]">
                        {pedigree!.damId ? (
                            <Link href={`/community/${pedigree!.damId}`} style={{ color: "var(--color-accent-primary)", textDecoration: "none" }}>
                                {pedigree!.damName} 🔗
                            </Link>
                        ) : pedigree!.damName}
                    </span>
                </div>
            )}
            {pedigree!.sculptor && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border,rgba(0,0,0,0.06))] last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
                    <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Sculptor</span>
                    <span className="font-medium text-[calc(0.9rem*var(--font-scale))]">{pedigree!.sculptor}</span>
                </div>
            )}
            {(pedigree!.castNumber || pedigree!.editionSize) && (
                <div className="flex justify-between py-2 border-b border-[var(--color-border,rgba(0,0,0,0.06))] last:border-b-0 max-[600px]:flex-col max-[600px]:gap-1">
                    <span className="text-muted text-[calc(0.85rem*var(--font-scale))]">Cast / Edition</span>
                    <span className="font-medium text-[calc(0.9rem*var(--font-scale))]">
                        {pedigree!.castNumber && pedigree!.editionSize
                            ? `#${pedigree!.castNumber} of ${pedigree!.editionSize}`
                            : pedigree!.castNumber
                                ? `#${pedigree!.castNumber}`
                                : `Edition of ${pedigree!.editionSize}`}
                    </span>
                </div>
            )}
            {pedigree!.lineageNotes && (
                <div className="mt-4 py-2 px-4 bg-[rgba(0,0,0,0.03)] rounded-md text-[calc(0.85rem*var(--font-scale))] text-muted italic whitespace-pre-wrap">{pedigree!.lineageNotes}</div>
            )}
        </div>
    );
}
