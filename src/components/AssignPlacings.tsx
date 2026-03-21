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
        entries.forEach((e) => {
            if (e.placing) init[e.id] = e.placing;
        });
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
        <div className="glass-bg-card border-edge mt-6 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
            <h3 className="mb-4">🏅 Assign Placings</h3>
            <p className="text-muted mb-4 text-sm">As the event host, assign placings to each entry below.</p>
            <div className="gap-2" style={{ display: "flex", flexDirection: "column" }}>
                {entries.map((entry) => (
                    <div key={entry.id} className="gap-2" style={{ display: "flex", alignItems: "center" }}>
                        <span className="flex-1">
                            <strong>{entry.horseName}</strong>
                            <span className="text-muted ml-1">by @{entry.ownerAlias}</span>
                        </span>
                        <select
                            className="form-input"
                            style={{ width: 140 }}
                            value={placings[entry.id] || ""}
                            onChange={(e) => setPlacings((prev) => ({ ...prev, [entry.id]: e.target.value }))}
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

            {error && <div className="comment-error mt-2">{error}</div>}

            <div className="mt-6 gap-2" style={{ display: "flex", alignItems: "center" }}>
                <button
                    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                    onClick={handleSave}
                    disabled={saving || Object.values(placings).filter((v) => v).length === 0}
                    style={{ width: "100%" }}
                >
                    {saving ? "Saving…" : `💾 Save ${Object.values(placings).filter((v) => v).length} Placings`}
                </button>
                {saved && (
                    <span className="text-forest font-semibold" style={{ whiteSpace: "nowrap" }}>
                        ✅ Saved!
                    </span>
                )}
            </div>
        </div>
    );
}
