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
    detectConflicts,
    type ShowString,
    type ShowStringEntry,
} from "@/app/actions/competition";

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
                                            {/* Conflicts */}
                                            {conflicts.length > 0 && (
                                                <div className="conflict-warnings">
                                                    {conflicts.map((c, i) => (
                                                        <div key={i} className="conflict-warning">⚠️ {c.reason}</div>
                                                    ))}
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
