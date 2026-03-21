"use client";

import { useState } from "react";
import { saveExpertPlacings } from "@/app/actions/shows";

interface Entry {
    id: string;
    horseName: string;
    ownerAlias: string;
    placing?: string;
}

export default function AssignPlacings({
    eventId,
    entries,
    onSave,
}: {
    eventId?: string;
    entries: Entry[];
    onSave?: (placings: { entryId: string; placing: string }[]) => Promise<void>;
}) {
    const [placings, setPlacings] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        entries.forEach(e => { if (e.placing) init[e.id] = e.placing; });
        return init;
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSaved(false);
        const data = Object.entries(placings)
            .filter(([, v]) => v)
            .map(([entryId, placing]) => ({ entryId, placing }));

        if (onSave) {
            await onSave(data);
        } else if (eventId) {
            const result = await saveExpertPlacings(eventId, data);
            if (!result.success) {
                setError(result.error || "Failed to save.");
                setSaving(false);
                return;
            }
        }
        setSaving(false);
        setSaved(true);
    };

    if (entries.length === 0) return null;

    return (
        <div className="glass-bg-card border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-lg)", marginTop: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>🏅 Assign Placings</h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-md)" }}>
                As the event host, assign placings to each entry below.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {entries.map(entry => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span style={{ flex: 1 }}>
                            <strong>{entry.horseName}</strong>
                            <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-xs)" }}>
                                by @{entry.ownerAlias}
                            </span>
                        </span>
                        <select
                            className="form-input"
                            style={{ width: 140 }}
                            value={placings[entry.id] || ""}
                            onChange={e => setPlacings(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        >
                            <option value="">—</option>
                            <option value="1st">🥇 1st</option>
                            <option value="2nd">🥈 2nd</option>
                            <option value="3rd">🥉 3rd</option>
                            <option value="4th">4th</option>
                            <option value="5th">5th</option>
                            <option value="HM">HM</option>
                            <option value="Champion">🏆 Champion</option>
                            <option value="Reserve">🎖️ Reserve</option>
                        </select>
                    </div>
                ))}
            </div>

            {error && <div className="comment-error" style={{ marginTop: "var(--space-sm)" }}>{error}</div>}

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
                <button
                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                    onClick={handleSave}
                    disabled={saving || Object.values(placings).filter(v => v).length === 0}
                    style={{ width: "100%" }}
                >
                    {saving ? "Saving…" : `💾 Save ${Object.values(placings).filter(v => v).length} Placings`}
                </button>
                {saved && <span style={{ color: "var(--color-accent-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>✅ Saved!</span>}
            </div>
        </div>
    );
}
