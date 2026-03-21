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
            {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}

            {/* Create New */}
            {!creating ? (
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm mb-6" onClick={() => setCreating(true)}>
                    + New Show String
                </button>
            ) : (
                <div className="glass-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all p-6 mb-6">
                    <h3 className="mb-4" >Create Show String</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Show Name *</label>
                            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Spring Fling 2026" />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Show Date</label>
                            <input className="form-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="gap-2 mt-4" style={{ display: "flex" }}>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleCreate} disabled={saving}>
                            {saving ? "Creating..." : "Create"}
                        </button>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => setCreating(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Show Strings List */}
            {showStrings.length === 0 ? (
                <div className="empty-state">
                    <p>No show strings yet. Create one to start planning!</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {showStrings.map(ss => (
                        <div key={ss.id} className={`show-string-item ${activeStringId === ss.id ? "active" : ""}`}>
                            <div className="flex justify-between items-center py-4 px-6 gap-2" onClick={() => handleSelectString(ss.id)} style={{ cursor: "pointer" }}>
                                <div>
                                    <strong>{ss.name}</strong>
                                    {ss.showDate && (
                                        <span className="ml-2 text-muted text-[calc(0.8rem*var(--font-scale))]" >
                                            📅 {new Date(ss.showDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    )}
                                </div>
                                <div className="gap-2" style={{ display: "flex", alignItems: "center" }}>
                                    <span className="flex items-center gap-1 py-2 px-4 rounded-md border border-[transparent] bg-card max-[480px]:rounded-[var(--radius-md)] text-muted text-[calc(0.85rem*var(--font-scale))] cursor-pointer whitespace-nowrap transition-all-badge">{ss.entryCount}</span>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={async (e) => { e.stopPropagation(); setSaving(true); await duplicateShowString(ss.id); setSaving(false); router.refresh(); }} title="Duplicate" disabled={saving}>📋</button>
                                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={e => { e.stopPropagation(); handleDeleteString(ss.id); }} title="Delete">🗑️</button>
                                </div>
                            </div>

                            {/* Expanded: entries + add form */}
                            {activeStringId === ss.id && (
                                <div className="p-[0 var(--space-lg) var(--space-lg)] border-t border-edge">
                                    {loadingEntries ? (
                                        <p className="text-muted" >Loading entries...</p>
                                    ) : (
                                        <>
                                            {/* Ring Conflict Visual Timeline */}
                                            {conflicts.length > 0 && (
                                                <div className="mb-4" >
                                                    <div className="gap-2 mb-1" style={{ display: "flex", alignItems: "center" }}>
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
                                                                    className={`flex-1 flex items-center justify-center text-xs font-semibold text-white transition-opacity relative ${isConflict ? "bg-[#ef4444] animate-pulse" : "bg-forest"}`}
                                                                    title={`${entry.horseName} — ${entry.className}${entry.timeSlot ? ` @ ${entry.timeSlot}` : ""}`}
                                                                >
                                                                    {entry.className.slice(0, 3)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="mt-1" >
                                                        {conflicts.map((c, i) => (
                                                            <div key={i} className="py-2 px-4 rounded-md bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] text-[#f59e0b] text-[calc(0.8rem*var(--font-scale))] font-semibold text-[calc(0.75rem*var(--font-scale))]">
                                                                ⚠️ {c.reason}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Entries Table */}
                                            {entries.length > 0 ? (
                                                <div className="grid gap-1 m-[var(--space-md) 0]">
                                                    {entries.map(entry => (
                                                        <div key={entry.id} className="flex items-center gap-2 py-2 px-4 rounded-md bg-[rgba(0,0,0,0.03)] text-[calc(0.85rem*var(--font-scale))]">
                                                            <span className="font-bold min-w-[140px]">🐴 {entry.horseName}</span>
                                                            <span className="flex-1">{entry.className}</span>
                                                            {entry.division && <span className="text-[calc(0.75rem*var(--font-scale))] py-[2px] px-[8px] rounded-full bg-[rgba(139,92,246,0.1)] text-[#a78bfa]">{entry.division}</span>}
                                                            {entry.timeSlot && <span className="text-[calc(0.75rem*var(--font-scale))] text-muted">🕐 {entry.timeSlot}</span>}
                                                            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={() => handleRemoveEntry(entry.id)} title="Remove">✕</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-muted text-[calc(0.85rem*var(--font-scale))]" >No entries yet. Add horses below.</p>
                                            )}

                                            {/* Add Entry Form */}
                                            <div className="mt-6 pt-6 border-t border-edge">
                                                <h4>Add Entry</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="mb-6">
                                                        <label className="block text-sm font-semibold text-ink mb-1">Horse *</label>
                                                        <select className="form-input" value={entryHorseId} onChange={e => setEntryHorseId(e.target.value)}>
                                                            <option value="">Select horse...</option>
                                                            {horses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="mb-6">
                                                        <label className="block text-sm font-semibold text-ink mb-1">Class *</label>
                                                        <input className="form-input" value={entryClassName} onChange={e => setEntryClassName(e.target.value)} placeholder="e.g. Arabian Stallion" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="mb-6">
                                                        <label className="block text-sm font-semibold text-ink mb-1">Division</label>
                                                        <input className="form-input" value={entryDivision} onChange={e => setEntryDivision(e.target.value)} placeholder="e.g. Breed" />
                                                    </div>
                                                    <div className="mb-6">
                                                        <label className="block text-sm font-semibold text-ink mb-1">Time Slot</label>
                                                        <input className="form-input" value={entryTimeSlot} onChange={e => setEntryTimeSlot(e.target.value)} placeholder="e.g. 10:00 AM" />
                                                    </div>
                                                </div>
                                                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={handleAddEntry} disabled={saving || !entryHorseId || !entryClassName.trim()}>
                                                    {saving ? "Adding..." : "+ Add Entry"}
                                                </button>
                                            </div>

                                            {/* ── Batch Results Section ── */}
                                            {entries.length > 0 && (
                                                <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                                                    {!showResults ? (
                                                        <button
                                                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
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
                                                            <h4 className="mb-2" >🏆 Batch Results</h4>
                                                            <p className="text-muted text-[calc(0.8rem*var(--font-scale))] mb-2" >
                                                                Tab through to enter placing and ribbon for each entry. Results will be saved as show records.
                                                            </p>
                                                            <table className="bg-[var(--color-surface-secondary)] font-semibold sticky top-0">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Horse</th>
                                                                        <th>Class</th>
                                                                        <th className="w-[100]" >Placing</th>
                                                                        <th className="w-[120]" >Ribbon</th>
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
                                                                    <div className="flex gap-6 p-4 bg-surface-secondary rounded-lg mt-4 flex-wrap">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[calc(1.2rem*var(--font-scale))] font-bold text-forest">{filled.length}</span>
                                                                            <span className="text-xs text-muted">Results</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[calc(1.2rem*var(--font-scale))] font-bold text-forest">{champs}🏆 {reserves}🎖️ {topTens}🔟</span>
                                                                            <span className="text-xs text-muted">Major Ribbons</span>
                                                                        </div>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className="text-[calc(1.2rem*var(--font-scale))] font-bold text-forest">~{points}</span>
                                                                            <span className="text-xs text-muted">Est. NAN Points</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="gap-2 mt-4" style={{ display: "flex" }}>
                                                                <button
                                                                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
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
                                                                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => setShowResults(false)}>Cancel</button>
                                                                {resultsSaved && <span className="text-forest font-semibold" >✅ Saved!</span>}
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
