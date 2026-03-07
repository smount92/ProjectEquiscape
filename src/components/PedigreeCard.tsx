"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePedigree } from "@/app/actions/provenance";

interface PedigreeData {
    id: string;
    sireName: string | null;
    damName: string | null;
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
    const [sculptor, setSculptor] = useState(pedigree?.sculptor ?? "");
    const [castNumber, setCastNumber] = useState(pedigree?.castNumber ?? "");
    const [editionSize, setEditionSize] = useState(pedigree?.editionSize ?? "");
    const [lineageNotes, setLineageNotes] = useState(pedigree?.lineageNotes ?? "");

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
        setSculptor(pedigree?.sculptor ?? "");
        setCastNumber(pedigree?.castNumber ?? "");
        setEditionSize(pedigree?.editionSize ?? "");
        setLineageNotes(pedigree?.lineageNotes ?? "");
        setIsEditing(false);
        setErrorMsg("");
        setStatus("idle");
    };

    // CTA for owner when no pedigree exists
    if (!pedigree && isOwner && !isEditing) {
        return (
            <div className="pedigree-card" id="pedigree-card">
                <div className="pedigree-empty">
                    <p>No pedigree data yet.</p>
                    <button
                        className="btn btn-primary"
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
            <div className="pedigree-card" id="pedigree-card">
                <div className="pedigree-card-header">
                    <h3>
                        <span aria-hidden="true">🧬</span> {pedigree ? "Edit Pedigree" : "Add Pedigree"}
                    </h3>
                </div>
                <form onSubmit={handleSave}>
                    <div className="show-record-form-row">
                        <div className="form-group">
                            <label className="form-label">Sire (Father)</label>
                            <input
                                className="form-input"
                                type="text"
                                value={sireName}
                                onChange={(e) => setSireName(e.target.value)}
                                placeholder="Sire name"
                                id="pedigree-sire"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dam (Mother)</label>
                            <input
                                className="form-input"
                                type="text"
                                value={damName}
                                onChange={(e) => setDamName(e.target.value)}
                                placeholder="Dam name"
                                id="pedigree-dam"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Sculptor / Artist</label>
                        <input
                            className="form-input"
                            type="text"
                            value={sculptor}
                            onChange={(e) => setSculptor(e.target.value)}
                            placeholder="Sculptor name"
                            id="pedigree-sculptor"
                        />
                    </div>

                    <div className="show-record-form-row">
                        <div className="form-group">
                            <label className="form-label">Cast Number</label>
                            <input
                                className="form-input"
                                type="text"
                                value={castNumber}
                                onChange={(e) => setCastNumber(e.target.value)}
                                placeholder="e.g. 3"
                                id="pedigree-cast"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Edition Size</label>
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

                    <div className="form-group">
                        <label className="form-label">Lineage Notes</label>
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

                    <div className="show-record-form-actions">
                        <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
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
        <div className="pedigree-card" id="pedigree-card">
            <div className="pedigree-card-header">
                <h3>
                    <span aria-hidden="true">🧬</span> Pedigree
                </h3>
                {isOwner && (
                    <button
                        className="btn btn-ghost"
                        onClick={() => setIsEditing(true)}
                        style={{ fontSize: "calc(0.8rem * var(--font-scale))", padding: "var(--space-xs) var(--space-md)" }}
                    >
                        ✏️ Edit
                    </button>
                )}
            </div>

            {pedigree!.sireName && (
                <div className="pedigree-row">
                    <span className="pedigree-label">Sire</span>
                    <span className="pedigree-value">{pedigree!.sireName}</span>
                </div>
            )}
            {pedigree!.damName && (
                <div className="pedigree-row">
                    <span className="pedigree-label">Dam</span>
                    <span className="pedigree-value">{pedigree!.damName}</span>
                </div>
            )}
            {pedigree!.sculptor && (
                <div className="pedigree-row">
                    <span className="pedigree-label">Sculptor</span>
                    <span className="pedigree-value">{pedigree!.sculptor}</span>
                </div>
            )}
            {(pedigree!.castNumber || pedigree!.editionSize) && (
                <div className="pedigree-row">
                    <span className="pedigree-label">Cast / Edition</span>
                    <span className="pedigree-value">
                        {pedigree!.castNumber && pedigree!.editionSize
                            ? `#${pedigree!.castNumber} of ${pedigree!.editionSize}`
                            : pedigree!.castNumber
                                ? `#${pedigree!.castNumber}`
                                : `Edition of ${pedigree!.editionSize}`}
                    </span>
                </div>
            )}
            {pedigree!.lineageNotes && (
                <div className="pedigree-notes">{pedigree!.lineageNotes}</div>
            )}
        </div>
    );
}
