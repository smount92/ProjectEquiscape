"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    createShowString,
    addShowStringEntry,
    removeShowStringEntry,
    getShowStringEntries,
    deleteShowString,
    duplicateShowString,
    detectConflicts,
    type ShowString,
    type ShowStringEntry,
} from "@/app/actions/competition";
import { batchRecordResults } from "@/app/actions/shows";

interface Props {
    showStrings: ShowString[];
    horses: { id: string; name: string }[];
}

export default function ShowStringManager({ showStrings, horses }: Props) {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDate, setNewDate] = useState("");
    const [activeStringId, setActiveStringId] = useState<string | null>(null);
    const [entries, setEntries] = useState<ShowStringEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [conflicts, setConflicts] = useState<{ entryA: string; entryB: string; reason: string }[]>([]);

    // Add entry form state
    const [entryHorseId, setEntryHorseId] = useState("");
    const [entryClassName, setEntryClassName] = useState("");
    const [entryDivision, setEntryDivision] = useState("");
    const [entryTimeSlot, setEntryTimeSlot] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Batch results state
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState<Record<string, { placing: string; ribbon: string }>>({});
    const [savingResults, setSavingResults] = useState(false);
    const [resultsSaved, setResultsSaved] = useState(false);

    async function handleCreate() {
        if (!newName.trim()) return;
        setSaving(true);
        const result = await createShowString({ name: newName, showDate: newDate || undefined });
        if (result.success) {
            setNewName("");
            setNewDate("");
            setCreating(false);
            router.refresh();
        } else {
            setError(result.error || "Failed to create");
        }
        setSaving(false);
    }

    async function handleSelectString(id: string) {
        if (activeStringId === id) {
            setActiveStringId(null);
            setEntries([]);
            setConflicts([]);
            return;
        }
        setActiveStringId(id);
        setLoadingEntries(true);
        const data = await getShowStringEntries(id);
        setEntries(data);
        const { conflicts: c } = await detectConflicts(id);
        setConflicts(c);
        setLoadingEntries(false);
    }

    async function handleAddEntry() {
        if (!activeStringId || !entryHorseId || !entryClassName.trim()) return;
        setSaving(true);
        const result = await addShowStringEntry({
            showStringId: activeStringId,
            horseId: entryHorseId,
            className: entryClassName.trim(),
            division: entryDivision.trim() || undefined,
            timeSlot: entryTimeSlot.trim() || undefined,
        });
        if (result.success) {
            setEntryHorseId("");
            setEntryClassName("");
            setEntryDivision("");
            setEntryTimeSlot("");
            // Refresh entries
            const data = await getShowStringEntries(activeStringId);
            setEntries(data);
            const { conflicts: c } = await detectConflicts(activeStringId);
            setConflicts(c);
            router.refresh();
        } else {
            setError(result.error || "Failed to add entry");
        }
        setSaving(false);
    }

    async function handleRemoveEntry(entryId: string) {
        if (!activeStringId) return;
        await removeShowStringEntry(entryId);
        const data = await getShowStringEntries(activeStringId);
        setEntries(data);
        const { conflicts: c } = await detectConflicts(activeStringId);
        setConflicts(c);
        router.refresh();
    }

    async function handleDeleteString(id: string) {
        if (!confirm("Delete this show string and all its entries?")) return;
        await deleteShowString(id);
        if (activeStringId === id) {
            setActiveStringId(null);
            setEntries([]);
            setConflicts([]);
        }
        router.refresh();
    }

    return (
        <div>
            {error && <p className="form-error">{error}</p>}

            {/* Create New */}
            {!creating ? (
                <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ marginBottom: "var(--space-lg)" }}>
                    + New Show String
                </button>
            ) : (
                <div className="glass-card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
                    <h3 style={{ marginBottom: "var(--space-md)" }}>Create Show String</h3>
                    <div className="form-row-2col">
                        <div className="form-group">
                            <label className="form-label">Show Name *</label>
                            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Spring Fling 2026" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Show Date</label>
                            <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                            {saving ? "Creating..." : "Create"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Show Strings List */}
            {showStrings.length === 0 ? (
                <div className="empty-state">
                    <p>No show strings yet. Create one to start planning!</p>
                </div>
            ) : (
                <div className="show-string-list">
                    {showStrings.map(ss => (
                        <div key={ss.id} className={`show-string-item ${activeStringId === ss.id ? "active" : ""}`}>
                            <div className="show-string-header" onClick={() => handleSelectString(ss.id)} style={{ cursor: "pointer" }}>
                                <div>
                                    <strong>{ss.name}</strong>
                                    {ss.showDate && (
                                        <span style={{ marginLeft: "var(--space-sm)", color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))" }}>
                                            📅 {new Date(ss.showDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                                    <span className="studio-tab-badge">{ss.entryCount}</span>
                                    <button className="btn btn-ghost btn-sm" onClick={async (e) => { e.stopPropagation(); setSaving(true); await duplicateShowString(ss.id); setSaving(false); router.refresh(); }} title="Duplicate" disabled={saving}>📋</button>
                                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleDeleteString(ss.id); }} title="Delete">🗑️</button>
                                </div>
                            </div>

                            {/* Expanded: entries + add form */}
                            {activeStringId === ss.id && (
                                <div className="show-string-detail">
                                    {loadingEntries ? (
                                        <p style={{ color: "var(--color-text-muted)" }}>Loading entries...</p>
                                    ) : (
                                        <>
                                            {/* Ring Conflict Visual Timeline */}
                                            {conflicts.length > 0 && (
                                                <div style={{ marginBottom: "var(--space-md)" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                                                        <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-[rgba(239,68,68,0.15)] text-[#ef4444] text-xs font-semibold">⚠️ {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""}</span>
                                                    </div>
                                                    {/* Timeline visualization */}
                                                    <div className="flex gap-0.5 items-stretch h-8 rounded-md overflow-hidden bg-surface-secondary">
                                                        {entries.map(entry => {
                                                            const isConflict = conflicts.some(
                                                                c => c.entryA === entry.id || c.entryB === entry.id
                                                            );
                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    className={`flex-1 flex items-center justify-center text-xs font-semibold text-white transition-opacity relative ${isConflict ? "bg-[#ef4444] animate-pulse" : "bg-accent-primary"}`}
                                                                    title={`${entry.horseName} — ${entry.className}${entry.timeSlot ? ` @ ${entry.timeSlot}` : ""}`}
                                                                >
                                                                    {entry.className.slice(0, 3)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ marginTop: "var(--space-xs)" }}>
                                                        {conflicts.map((c, i) => (
                                                            <div key={i} className="conflict-warning" style={{ fontSize: "calc(0.75rem * var(--font-scale))" }}>
                                                                ⚠️ {c.reason}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Entries Table */}
                                            {entries.length > 0 ? (
                                                <div className="show-string-entries">
                                                    {entries.map(entry => (
                                                        <div key={entry.id} className="show-string-entry-row">
                                                            <span className="entry-horse">🐴 {entry.horseName}</span>
                                                            <span className="entry-class">{entry.className}</span>
                                                            {entry.division && <span className="entry-division">{entry.division}</span>}
                                                            {entry.timeSlot && <span className="entry-timeslot">🕐 {entry.timeSlot}</span>}
                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveEntry(entry.id)} title="Remove">✕</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))" }}>No entries yet. Add horses below.</p>
                                            )}

                                            {/* Add Entry Form */}
                                            <div className="add-entry-form">
                                                <h4>Add Entry</h4>
                                                <div className="form-row-2col">
                                                    <div className="form-group">
                                                        <label className="form-label">Horse *</label>
                                                        <select className="form-input" value={entryHorseId} onChange={e => setEntryHorseId(e.target.value)}>
                                                            <option value="">Select horse...</option>
                                                            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Class *</label>
                                                        <input className="form-input" value={entryClassName} onChange={e => setEntryClassName(e.target.value)} placeholder="e.g. Arabian Stallion" />
                                                    </div>
                                                </div>
                                                <div className="form-row-2col">
                                                    <div className="form-group">
                                                        <label className="form-label">Division</label>
                                                        <input className="form-input" value={entryDivision} onChange={e => setEntryDivision(e.target.value)} placeholder="e.g. Breed" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Time Slot</label>
                                                        <input className="form-input" value={entryTimeSlot} onChange={e => setEntryTimeSlot(e.target.value)} placeholder="e.g. 10:00 AM" />
                                                    </div>
                                                </div>
                                                <button className="btn btn-primary btn-sm" onClick={handleAddEntry} disabled={saving || !entryHorseId || !entryClassName.trim()}>
                                                    {saving ? "Adding..." : "+ Add Entry"}
                                                </button>
                                            </div>

                                            {/* ── Batch Results Section ── */}
                                            {entries.length > 0 && (
                                                <div style={{ marginTop: "var(--space-lg)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-md)" }}>
                                                    {!showResults ? (
                                                        <button
                                                            className="btn btn-ghost"
                                                            onClick={() => {
                                                                setShowResults(true);
                                                                setResultsSaved(false);
                                                                // Initialize results map
                                                                const init: Record<string, { placing: string; ribbon: string }> = {};
                                                                entries.forEach(e => { init[e.id] = { placing: "", ribbon: "" }; });
                                                                setResults(init);
                                                            }}
                                                        >
                                                            🏆 Enter Results
                                                        </button>
                                                    ) : (
                                                        <div>
                                                            <h4 style={{ marginBottom: "var(--space-sm)" }}>🏆 Batch Results</h4>
                                                            <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.8rem * var(--font-scale))", marginBottom: "var(--space-sm)" }}>
                                                                Tab through to enter placing and ribbon for each entry. Results will be saved as show records.
                                                            </p>
                                                            <table className="results-grid">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Horse</th>
                                                                        <th>Class</th>
                                                                        <th style={{ width: 100 }}>Placing</th>
                                                                        <th style={{ width: 120 }}>Ribbon</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {entries.map(entry => (
                                                                        <tr key={entry.id}>
                                                                            <td>{entry.horseName}</td>
                                                                            <td>{entry.className}{entry.division ? ` (${entry.division})` : ""}</td>
                                                                            <td>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="1st"
                                                                                    value={results[entry.id]?.placing || ""}
                                                                                    onChange={e => setResults(prev => ({
                                                                                        ...prev,
                                                                                        [entry.id]: { ...prev[entry.id], placing: e.target.value }
                                                                                    }))}
                                                                                />
                                                                            </td>
                                                                            <td>
                                                                                <select
                                                                                    value={results[entry.id]?.ribbon || ""}
                                                                                    onChange={e => setResults(prev => ({
                                                                                        ...prev,
                                                                                        [entry.id]: { ...prev[entry.id], ribbon: e.target.value }
                                                                                    }))}
                                                                                >
                                                                                    <option value="">—</option>
                                                                                    <option value="Blue">🥇 Blue</option>
                                                                                    <option value="Red">🥈 Red</option>
                                                                                    <option value="Yellow">🥉 Yellow</option>
                                                                                    <option value="White">⬜ White</option>
                                                                                    <option value="Pink">🩷 Pink</option>
                                                                                    <option value="Green">💚 Green</option>
                                                                                    <option value="Champion">🏆 Champion</option>
                                                                                    <option value="Reserve">🎖️ Reserve</option>
                                                                                    <option value="Top Ten">🔟 Top Ten</option>
                                                                                </select>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>

                                                            {/* NAN Rollup Summary */}
                                                            {(() => {
                                                                const filled = Object.values(results).filter(r => r.placing || r.ribbon);
                                                                const champs = Object.values(results).filter(r => r.ribbon === "Champion").length;
                                                                const reserves = Object.values(results).filter(r => r.ribbon === "Reserve").length;
                                                                const topTens = Object.values(results).filter(r => r.ribbon === "Top Ten").length;
                                                                const points = champs * 4 + reserves * 3 + topTens * 2 + (filled.length - champs - reserves - topTens);
                                                                if (filled.length === 0) return null;
                                                                return (
                                                                    <div className="results-summary">
                                                                        <div className="results-summary-stat">
                                                                            <span className="stat-value">{filled.length}</span>
                                                                            <span className="stat-label">Results</span>
                                                                        </div>
                                                                        <div className="results-summary-stat">
                                                                            <span className="stat-value">{champs}🏆 {reserves}🎖️ {topTens}🔟</span>
                                                                            <span className="stat-label">Major Ribbons</span>
                                                                        </div>
                                                                        <div className="results-summary-stat">
                                                                            <span className="stat-value">~{points}</span>
                                                                            <span className="stat-label">Est. NAN Points</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
                                                                <button
                                                                    className="btn btn-primary"
                                                                    disabled={savingResults}
                                                                    onClick={async () => {
                                                                        setSavingResults(true);
                                                                        const activeStr = showStrings.find(s => s.id === activeStringId);
                                                                        const records = entries
                                                                            .filter(e => results[e.id]?.placing || results[e.id]?.ribbon)
                                                                            .map(e => ({
                                                                                horseId: e.horseId,
                                                                                showName: activeStr?.name || "Unknown Show",
                                                                                showDate: activeStr?.showDate || null,
                                                                                division: e.division || null,
                                                                                className: e.className,
                                                                                placing: results[e.id]?.placing || null,
                                                                                ribbonColor: results[e.id]?.ribbon || null,
                                                                            }));
                                                                        if (records.length > 0) {
                                                                            await batchRecordResults(records);
                                                                        }
                                                                        setSavingResults(false);
                                                                        setResultsSaved(true);
                                                                        router.refresh();
                                                                    }}
                                                                >
                                                                    {savingResults ? "Saving..." : `💾 Save ${Object.values(results).filter(r => r.placing || r.ribbon).length} Results`}
                                                                </button>
                                                                <button className="btn btn-ghost" onClick={() => setShowResults(false)}>Cancel</button>
                                                                {resultsSaved && <span style={{ color: "var(--color-accent-primary)", fontWeight: 600 }}>✅ Saved!</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
