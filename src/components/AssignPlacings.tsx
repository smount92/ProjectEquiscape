"use client";

import { useState } from "react";

interface Entry {
    id: string;
    horseName: string;
    ownerAlias: string;
    placing?: string;
}

export default function AssignPlacings({
    entries,
    onSave,
}: {
    entries: Entry[];
    onSave: (placings: { entryId: string; placing: string }[]) => Promise<void>;
}) {
    const [placings, setPlacings] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const data = Object.entries(placings)
            .filter(([, v]) => v)
            .map(([entryId, placing]) => ({ entryId, placing }));
        await onSave(data);
        setSaving(false);
    };

    return (
        <div className="card" style={{ padding: "var(--space-lg)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>🏅 Assign Placings</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {entries.map(entry => (
                    <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <span style={{ flex: 1 }}>
                            <strong>{entry.horseName}</strong>
                            <span style={{ color: "var(--color-text-muted)", marginLeft: "var(--space-xs)" }}>
                                by {entry.ownerAlias}
                            </span>
                        </span>
                        <select
                            className="form-input"
                            style={{ width: 120 }}
                            value={placings[entry.id] || ""}
                            onChange={e => setPlacings(prev => ({ ...prev, [entry.id]: e.target.value }))}
                        >
                            <option value="">—</option>
                            <option value="1st">🥇 1st</option>
                            <option value="2nd">🥈 2nd</option>
                            <option value="3rd">🥉 3rd</option>
                            <option value="HM">HM</option>
                            <option value="Reserve">Reserve</option>
                        </select>
                    </div>
                ))}
            </div>
            <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: "var(--space-lg)", width: "100%" }}
            >
                {saving ? "Saving…" : "💾 Save Placings"}
            </button>
        </div>
    );
}
