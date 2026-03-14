"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveExpertPlacings } from "@/app/actions/shows";

interface EntryForJudging {
    id: string;
    horseName: string;
    ownerAlias: string;
    thumbnailUrl: string | null;
    placing: string | null;
}

const PLACING_OPTIONS = [
    { value: "", label: "—" },
    { value: "1st", label: "🥇 1st" },
    { value: "2nd", label: "🥈 2nd" },
    { value: "3rd", label: "🥉 3rd" },
    { value: "HM", label: "🎗️ HM" },
];

export default function ExpertJudgingPanel({
    showId,
    entries,
}: {
    showId: string;
    entries: EntryForJudging[];
}) {
    const router = useRouter();
    const [placings, setPlacings] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        entries.forEach(e => { init[e.id] = e.placing || ""; });
        return init;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSuccess(false);

        const toSave = Object.entries(placings)
            .filter(([, v]) => v !== "")
            .map(([entryId, placing]) => ({ entryId, placing }));

        if (toSave.length === 0) {
            setError("Please assign at least one placing.");
            setSaving(false);
            return;
        }

        const result = await saveExpertPlacings(showId, toSave);
        if (result.success) {
            setSuccess(true);
            router.refresh();
        } else {
            setError(result.error || "Failed to save placings.");
        }
        setSaving(false);
    };

    return (
        <div className="card animate-fade-in-up" style={{
            marginBottom: "var(--space-lg)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            background: "rgba(245, 158, 11, 0.05)",
        }}>
            <h3 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                🏅 <span className="text-gradient">Expert Judging Panel</span>
            </h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-md)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                As the show host, assign placings to each entry below. Only placed entries will appear in results.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {entries.map(entry => (
                    <div key={entry.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-md)",
                        padding: "var(--space-sm) var(--space-md)",
                        background: "rgba(var(--color-surface-rgb, 30, 30, 30), 0.5)",
                        borderRadius: "var(--radius-sm)",
                    }}>
                        {entry.thumbnailUrl && (
                            <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", overflow: "hidden", flexShrink: 0 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={entry.thumbnailUrl} alt={entry.horseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                🐴 {entry.horseName}
                            </div>
                            <div style={{ color: "var(--color-text-muted)", fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                by @{entry.ownerAlias}
                            </div>
                        </div>
                        <select
                            className="form-input"
                            value={placings[entry.id] || ""}
                            onChange={e => setPlacings(prev => ({ ...prev, [entry.id]: e.target.value }))}
                            style={{ width: 120, flexShrink: 0 }}
                        >
                            {PLACING_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {error && <div className="comment-error" style={{ marginTop: "var(--space-sm)" }}>{error}</div>}
            {success && (
                <div style={{
                    marginTop: "var(--space-sm)",
                    padding: "var(--space-xs) var(--space-sm)",
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#22c55e",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                }}>
                    ✅ Placings saved successfully!
                </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Saving…" : "💾 Save Placings"}
                </button>
            </div>
        </div>
    );
}
