"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
    getEventDivisions,
    createDivision,
    updateDivision,
    deleteDivision,
    createClass,
    updateClass,
    deleteClass,
    reorderDivisions,
    reorderClasses,
    copyDivisionsFromEvent,
} from "@/app/actions/competition";
import type { Division, DivisionClass } from "@/app/actions/competition";

export default function ManageClassesPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;
    const supabase = createClient();

    const [isLoading, setIsLoading] = useState(true);
    const [eventName, setEventName] = useState("");
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Inline editing state
    const [editingDivision, setEditingDivision] = useState<string | null>(null);
    const [editingClass, setEditingClass] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editClassNumber, setEditClassNumber] = useState("");

    // New item state
    const [newDivisionName, setNewDivisionName] = useState("");
    const [addingClassToDivision, setAddingClassToDivision] = useState<string | null>(null);
    const [newClassName, setNewClassName] = useState("");
    const [newClassNumber, setNewClassNumber] = useState("");

    // Copy from modal
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [userEvents, setUserEvents] = useState<{ id: string; name: string }[]>([]);
    const [selectedSourceEvent, setSelectedSourceEvent] = useState("");

    const loadData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }

        const { data: event } = await supabase
            .from("events")
            .select("id, name, created_by")
            .eq("id", eventId)
            .single();

        if (!event || (event as { created_by: string }).created_by !== user.id) {
            setError("Event not found or you don't have permission to manage it.");
            setIsLoading(false);
            return;
        }

        setEventName((event as { name: string }).name);
        const divs = await getEventDivisions(eventId);
        setDivisions(divs);
        setIsLoading(false);
    }, [eventId, router, supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Division CRUD ──

    const handleAddDivision = async () => {
        if (!newDivisionName.trim()) return;
        setIsSaving(true);
        const result = await createDivision({
            eventId,
            name: newDivisionName.trim(),
            sortOrder: divisions.length,
        });
        if (result.success) {
            setNewDivisionName("");
            await loadData();
        } else {
            setError(result.error || "Failed to create division.");
        }
        setIsSaving(false);
    };

    const handleSaveDivision = async (divId: string) => {
        if (!editName.trim()) return;
        setIsSaving(true);
        await updateDivision(divId, { name: editName.trim() });
        setEditingDivision(null);
        await loadData();
        setIsSaving(false);
    };

    const handleDeleteDivision = async (divId: string, divName: string) => {
        if (!confirm(`Delete division "${divName}" and all its classes? This cannot be undone.`)) return;
        setIsSaving(true);
        await deleteDivision(divId);
        await loadData();
        setIsSaving(false);
    };

    const handleMoveDivision = async (index: number, direction: -1 | 1) => {
        const newOrder = [...divisions];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= newOrder.length) return;
        [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
        setDivisions(newOrder);
        await reorderDivisions(newOrder.map(d => d.id));
    };

    // ── Class CRUD ──

    const handleAddClass = async (divisionId: string) => {
        if (!newClassName.trim()) return;
        setIsSaving(true);
        const division = divisions.find(d => d.id === divisionId);
        const result = await createClass({
            divisionId,
            name: newClassName.trim(),
            classNumber: newClassNumber.trim() || undefined,
            sortOrder: division?.classes.length || 0,
        });
        if (result.success) {
            setNewClassName("");
            setNewClassNumber("");
            setAddingClassToDivision(null);
            await loadData();
        } else {
            setError(result.error || "Failed to create class.");
        }
        setIsSaving(false);
    };

    const handleSaveClass = async (classId: string) => {
        if (!editName.trim()) return;
        setIsSaving(true);
        await updateClass(classId, {
            name: editName.trim(),
            classNumber: editClassNumber.trim() || undefined,
        });
        setEditingClass(null);
        await loadData();
        setIsSaving(false);
    };

    const handleDeleteClass = async (classId: string, className: string) => {
        if (!confirm(`Delete class "${className}"? Entries in this class will also be removed.`)) return;
        setIsSaving(true);
        await deleteClass(classId);
        await loadData();
        setIsSaving(false);
    };

    const handleToggleNan = async (classId: string, current: boolean) => {
        await updateClass(classId, { isNanQualifying: !current });
        await loadData();
    };

    const handleMoveClass = async (divisionId: string, index: number, direction: -1 | 1) => {
        const div = divisions.find(d => d.id === divisionId);
        if (!div) return;
        const newOrder = [...div.classes];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= newOrder.length) return;
        [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
        await reorderClasses(newOrder.map(c => c.id));
        await loadData();
    };

    // ── Copy from event ──

    const loadUserEvents = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("events")
            .select("id, name")
            .eq("created_by", user.id)
            .neq("id", eventId)
            .order("created_at", { ascending: false })
            .limit(20);
        setUserEvents((data || []) as { id: string; name: string }[]);
        setShowCopyModal(true);
    };

    const handleCopy = async () => {
        if (!selectedSourceEvent) return;
        setIsSaving(true);
        setShowCopyModal(false);
        const result = await copyDivisionsFromEvent(selectedSourceEvent, eventId);
        if (result.success) {
            await loadData();
        } else {
            setError(result.error || "Failed to copy.");
        }
        setIsSaving(false);
    };

    // ── Render ──

    if (isLoading) {
        return (
            <div className="page-container form-page">
                <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                    <div className="btn-spinner" style={{ margin: "0 auto var(--space-md)", borderTopColor: "var(--color-accent-primary)" }} />
                    <p>Loading class list…</p>
                </div>
            </div>
        );
    }

    if (error && !eventName) {
        return (
            <div className="page-container form-page">
                <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                    <p style={{ color: "var(--color-accent-danger)" }}>{error}</p>
                    <Link href="/community/events" className="btn btn-ghost" style={{ marginTop: "var(--space-md)" }}>
                        ← Back to Events
                    </Link>
                </div>
            </div>
        );
    }

    const totalClasses = divisions.reduce((sum, d) => sum + d.classes.length, 0);
    const totalEntries = divisions.reduce((sum, d) => sum + d.classes.reduce((s, c) => s + (c.entryCount || 0), 0), 0);

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    <div>
                        <Link href={`/community/events/${eventId}`} style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", display: "inline-block" }}>
                            ← Back to Event
                        </Link>
                        <h1>⚙️ Manage Classes</h1>
                        <p style={{ color: "var(--color-text-secondary)" }}>{eventName}</p>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <span className="horse-card-badge" style={{ background: "var(--color-accent-primary-glow)", color: "var(--color-accent-primary)", fontWeight: 600 }}>
                            {divisions.length} Division{divisions.length !== 1 ? "s" : ""} · {totalClasses} Class{totalClasses !== 1 ? "es" : ""} · {totalEntries} Entr{totalEntries !== 1 ? "ies" : "y"}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="form-error" style={{ marginBottom: "var(--space-lg)" }}>
                        ⚠️ {error}
                        <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
                    </div>
                )}

                {/* Division Tree */}
                <div className="division-tree">
                    {divisions.map((div, divIndex) => (
                        <div key={div.id} className="division-card">
                            {/* Division Header */}
                            <div className="division-header">
                                <div className="division-reorder">
                                    <button
                                        className="reorder-btn"
                                        onClick={() => handleMoveDivision(divIndex, -1)}
                                        disabled={divIndex === 0}
                                        title="Move up"
                                    >▲</button>
                                    <button
                                        className="reorder-btn"
                                        onClick={() => handleMoveDivision(divIndex, 1)}
                                        disabled={divIndex === divisions.length - 1}
                                        title="Move down"
                                    >▼</button>
                                </div>

                                {editingDivision === div.id ? (
                                    <div className="inline-edit">
                                        <input
                                            className="form-input"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSaveDivision(div.id)}
                                            autoFocus
                                            placeholder="Division name"
                                        />
                                        <button className="btn btn-primary" onClick={() => handleSaveDivision(div.id)} disabled={isSaving} style={{ padding: "var(--space-xs) var(--space-md)" }}>Save</button>
                                        <button className="btn btn-ghost" onClick={() => setEditingDivision(null)} style={{ padding: "var(--space-xs) var(--space-md)" }}>Cancel</button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="division-name">📋 {div.name}</span>
                                        <span className="division-count">{div.classes.length} class{div.classes.length !== 1 ? "es" : ""}</span>
                                        <div className="division-actions">
                                            <button
                                                className="action-btn"
                                                onClick={() => { setEditingDivision(div.id); setEditName(div.name); }}
                                                title="Edit"
                                            >✏️</button>
                                            <button
                                                className="action-btn action-btn-danger"
                                                onClick={() => handleDeleteDivision(div.id, div.name)}
                                                title="Delete"
                                            >🗑️</button>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => { setAddingClassToDivision(div.id); setNewClassName(""); setNewClassNumber(""); }}
                                                style={{ padding: "var(--space-xs) var(--space-sm)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}
                                            >+ Class</button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Classes */}
                            <div className="class-list">
                                {div.classes.map((cls, clsIndex) => (
                                    <div key={cls.id} className="class-row">
                                        <div className="class-reorder">
                                            <button className="reorder-btn reorder-btn-sm" onClick={() => handleMoveClass(div.id, clsIndex, -1)} disabled={clsIndex === 0}>▲</button>
                                            <button className="reorder-btn reorder-btn-sm" onClick={() => handleMoveClass(div.id, clsIndex, 1)} disabled={clsIndex === div.classes.length - 1}>▼</button>
                                        </div>

                                        {editingClass === cls.id ? (
                                            <div className="inline-edit">
                                                <input
                                                    className="form-input"
                                                    value={editClassNumber}
                                                    onChange={(e) => setEditClassNumber(e.target.value)}
                                                    placeholder="#"
                                                    style={{ width: "60px" }}
                                                />
                                                <input
                                                    className="form-input"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleSaveClass(cls.id)}
                                                    autoFocus
                                                    placeholder="Class name"
                                                />
                                                <button className="btn btn-primary" onClick={() => handleSaveClass(cls.id)} disabled={isSaving} style={{ padding: "var(--space-xs) var(--space-md)" }}>Save</button>
                                                <button className="btn btn-ghost" onClick={() => setEditingClass(null)} style={{ padding: "var(--space-xs) var(--space-md)" }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="class-number">{cls.classNumber || "—"}</span>
                                                <span className="class-name">{cls.name}</span>
                                                {cls.isNanQualifying && <span className="nan-badge" title="NAN Qualifying">⭐ NAN</span>}
                                                {(cls.entryCount || 0) > 0 && (
                                                    <span className="entry-count-badge">{cls.entryCount} entr{cls.entryCount === 1 ? "y" : "ies"}</span>
                                                )}
                                                <div className="class-actions">
                                                    <button className="action-btn action-btn-sm" onClick={() => handleToggleNan(cls.id, cls.isNanQualifying)} title={cls.isNanQualifying ? "Remove NAN" : "Mark NAN"}>
                                                        {cls.isNanQualifying ? "⭐" : "☆"}
                                                    </button>
                                                    <button className="action-btn action-btn-sm" onClick={() => { setEditingClass(cls.id); setEditName(cls.name); setEditClassNumber(cls.classNumber || ""); }} title="Edit">✏️</button>
                                                    <button className="action-btn action-btn-sm action-btn-danger" onClick={() => handleDeleteClass(cls.id, cls.name)} title="Delete">🗑️</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Add class inline form */}
                                {addingClassToDivision === div.id && (
                                    <div className="class-row add-class-row animate-fade-in-up">
                                        <input
                                            className="form-input"
                                            value={newClassNumber}
                                            onChange={(e) => setNewClassNumber(e.target.value)}
                                            placeholder="#"
                                            style={{ width: "60px" }}
                                        />
                                        <input
                                            className="form-input"
                                            value={newClassName}
                                            onChange={(e) => setNewClassName(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAddClass(div.id)}
                                            autoFocus
                                            placeholder="Class name (e.g. Arabian/Part-Arabian)"
                                            style={{ flex: 1 }}
                                        />
                                        <button className="btn btn-primary" onClick={() => handleAddClass(div.id)} disabled={isSaving || !newClassName.trim()} style={{ padding: "var(--space-xs) var(--space-md)" }}>Add</button>
                                        <button className="btn btn-ghost" onClick={() => setAddingClassToDivision(null)} style={{ padding: "var(--space-xs) var(--space-md)" }}>Cancel</button>
                                    </div>
                                )}

                                {div.classes.length === 0 && addingClassToDivision !== div.id && (
                                    <div className="class-row" style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                                        No classes yet — click &quot;+ Class&quot; to add one
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Division */}
                <div className="card" style={{ marginTop: "var(--space-lg)", padding: "var(--space-lg)" }}>
                    <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                        <input
                            className="form-input"
                            value={newDivisionName}
                            onChange={(e) => setNewDivisionName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddDivision()}
                            placeholder="New division name (e.g. OF Plastic Halter)"
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleAddDivision} disabled={isSaving || !newDivisionName.trim()}>
                            + Add Division
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)", flexWrap: "wrap" }}>
                    <button className="btn btn-ghost" onClick={loadUserEvents} disabled={isSaving}>
                        📋 Copy From Another Event…
                    </button>
                </div>

                {/* Copy Modal */}
                {showCopyModal && (
                    <div className="modal-overlay" onClick={() => setShowCopyModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>📋 Copy Division Tree From…</h3>
                            <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-secondary)", marginBottom: "var(--space-md)" }}>
                                This will copy all divisions and classes from the selected event. Existing divisions in this event will NOT be removed.
                            </p>
                            {userEvents.length === 0 ? (
                                <p style={{ color: "var(--color-text-muted)" }}>No other events found.</p>
                            ) : (
                                <>
                                    <select
                                        className="form-select"
                                        value={selectedSourceEvent}
                                        onChange={(e) => setSelectedSourceEvent(e.target.value)}
                                        style={{ marginBottom: "var(--space-md)" }}
                                    >
                                        <option value="">Select an event…</option>
                                        {userEvents.map((ev) => (
                                            <option key={ev.id} value={ev.id}>{ev.name}</option>
                                        ))}
                                    </select>
                                    <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
                                        <button className="btn btn-ghost" onClick={() => setShowCopyModal(false)}>Cancel</button>
                                        <button className="btn btn-primary" onClick={handleCopy} disabled={!selectedSourceEvent}>Copy Classes</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
