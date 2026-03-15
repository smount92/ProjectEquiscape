"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
import type { Division } from "@/app/actions/competition";
import { updateEvent, getEventJudges, addEventJudge, removeEventJudge, searchUsers } from "@/app/actions/events";

type TabId = "details" | "classes" | "judges";

interface EventData {
    name: string;
    description: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    isAllDay: boolean;
    isVirtual: boolean;
    locationName: string;
    locationAddress: string;
    region: string;
    virtualUrl: string;
    judgingMethod: "community_vote" | "expert_judge";
}

interface JudgeInfo {
    id: string;
    userId: string;
    aliasName: string;
    avatarUrl: string | null;
}

export default function ManageEventPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.id as string;
    const supabase = createClient();

    const [activeTab, setActiveTab] = useState<TabId>("classes");
    const [isLoading, setIsLoading] = useState(true);
    const [eventName, setEventName] = useState("");
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Event details state
    const [eventData, setEventData] = useState<EventData>({
        name: "", description: "", startsAt: "", endsAt: "", timezone: "America/New_York",
        isAllDay: false, isVirtual: false, locationName: "", locationAddress: "",
        region: "", virtualUrl: "", judgingMethod: "community_vote",
    });
    const [detailsSaved, setDetailsSaved] = useState(false);

    // Judge state
    const [judges, setJudges] = useState<JudgeInfo[]>([]);
    const [newJudgeAlias, setNewJudgeAlias] = useState("");
    const [judgeError, setJudgeError] = useState("");
    const [judgeSuccess, setJudgeSuccess] = useState("");
    const [userSuggestions, setUserSuggestions] = useState<{ id: string; aliasName: string; avatarUrl: string | null }[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Inline editing state (class list)
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
            .select("id, name, description, starts_at, ends_at, timezone, is_all_day, is_virtual, location_name, location_address, region, virtual_url, judging_method, created_by")
            .eq("id", eventId)
            .single();

        if (!event || (event as { created_by: string }).created_by !== user.id) {
            setError("Event not found or you don't have permission to manage it.");
            setIsLoading(false);
            return;
        }

        const ev = event as Record<string, unknown>;
        setEventName(ev.name as string);
        setEventData({
            name: (ev.name as string) || "",
            description: (ev.description as string) || "",
            startsAt: (ev.starts_at as string) || "",
            endsAt: (ev.ends_at as string) || "",
            timezone: (ev.timezone as string) || "America/New_York",
            isAllDay: (ev.is_all_day as boolean) || false,
            isVirtual: (ev.is_virtual as boolean) || false,
            locationName: (ev.location_name as string) || "",
            locationAddress: (ev.location_address as string) || "",
            region: (ev.region as string) || "",
            virtualUrl: (ev.virtual_url as string) || "",
            judgingMethod: (ev.judging_method as "community_vote" | "expert_judge") || "community_vote",
        });

        const divs = await getEventDivisions(eventId);
        setDivisions(divs);

        // Load judges
        const judgeList = await getEventJudges(eventId);
        setJudges(judgeList);

        setIsLoading(false);
    }, [eventId, router, supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Debounced user search for judge autocomplete ──
    useEffect(() => {
        if (newJudgeAlias.trim().length < 2) {
            setUserSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await searchUsers(newJudgeAlias);
            setUserSuggestions(results);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [newJudgeAlias]);

    // ── Event Details Save ──

    const handleSaveDetails = async () => {
        setIsSaving(true);
        setError(null);
        setDetailsSaved(false);
        const result = await updateEvent(eventId, {
            name: eventData.name,
            description: eventData.description,
            startsAt: eventData.startsAt,
            endsAt: eventData.endsAt || undefined,
            timezone: eventData.timezone,
            isAllDay: eventData.isAllDay,
            isVirtual: eventData.isVirtual,
            locationName: eventData.locationName,
            locationAddress: eventData.locationAddress,
            region: eventData.region,
            virtualUrl: eventData.virtualUrl,
            judgingMethod: eventData.judgingMethod,
        });
        if (result.success) {
            setEventName(eventData.name);
            setDetailsSaved(true);
            setTimeout(() => setDetailsSaved(false), 3000);
        } else {
            setError(result.error || "Failed to update event.");
        }
        setIsSaving(false);
    };

    // ── Judge Management ──

    const handleAddJudge = async () => {
        if (!newJudgeAlias.trim()) return;
        setJudgeError("");
        setJudgeSuccess("");
        const result = await addEventJudge(eventId, newJudgeAlias.trim());
        if (result.success) {
            setNewJudgeAlias("");
            setJudgeSuccess("Judge added!");
            setTimeout(() => setJudgeSuccess(""), 3000);
            const judgeList = await getEventJudges(eventId);
            setJudges(judgeList);
        } else {
            setJudgeError(result.error || "Failed to add judge.");
        }
    };

    const handleRemoveJudge = async (judgeId: string) => {
        if (!confirm("Remove this judge?")) return;
        const result = await removeEventJudge(judgeId);
        if (result.success) {
            const judgeList = await getEventJudges(eventId);
            setJudges(judgeList);
        } else {
            setJudgeError(result.error || "Failed to remove judge.");
        }
    };

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
                    <p>Loading event…</p>
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

    const tabs: { id: TabId; label: string; icon: string; hidden?: boolean }[] = [
        { id: "details", label: "Edit Details", icon: "📝" },
        { id: "classes", label: "Class List", icon: "📋" },
        { id: "judges", label: "Judges", icon: "🧑‍⚖️", hidden: eventData.judgingMethod !== "expert_judge" },
    ];

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                    <div>
                        <Link href={`/community/events/${eventId}`} style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-xs)", display: "inline-block" }}>
                            ← Back to Event
                        </Link>
                        <h1>⚙️ Manage Event</h1>
                        <p style={{ color: "var(--color-text-secondary)" }}>{eventName}</p>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <span className="horse-card-badge" style={{ background: "var(--color-accent-primary-glow)", color: "var(--color-accent-primary)", fontWeight: 600 }}>
                            {divisions.length} Division{divisions.length !== 1 ? "s" : ""} · {totalClasses} Class{totalClasses !== 1 ? "es" : ""} · {totalEntries} Entr{totalEntries !== 1 ? "ies" : "y"}
                        </span>
                    </div>
                </div>

                {/* Tab Bar */}
                <div style={{
                    display: "flex",
                    gap: "var(--space-xs)",
                    marginBottom: "var(--space-xl)",
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: "0",
                }}>
                    {tabs.filter(t => !t.hidden).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: "var(--space-sm) var(--space-md)",
                                background: "none",
                                border: "none",
                                borderBottom: activeTab === tab.id ? "2px solid var(--color-accent-primary)" : "2px solid transparent",
                                color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                cursor: "pointer",
                                fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="form-error" style={{ marginBottom: "var(--space-lg)" }}>
                        ⚠️ {error}
                        <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
                    </div>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* TAB: Edit Details                       */}
                {/* ═══════════════════════════════════════ */}
                {activeTab === "details" && (
                    <div className="card" style={{ padding: "var(--space-xl)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                            <div className="form-group">
                                <label className="form-label">Event Name</label>
                                <input
                                    className="form-input"
                                    value={eventData.name}
                                    onChange={e => setEventData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Event name"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    value={eventData.description}
                                    onChange={e => setEventData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Describe your event…"
                                    rows={3}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                                <div className="form-group">
                                    <label className="form-label">Starts At</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={eventData.startsAt ? eventData.startsAt.slice(0, 16) : ""}
                                        onChange={e => setEventData(prev => ({ ...prev, startsAt: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ends At (optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={eventData.endsAt ? eventData.endsAt.slice(0, 16) : ""}
                                        onChange={e => setEventData(prev => ({ ...prev, endsAt: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                                <div className="form-group">
                                    <label className="form-label">Region</label>
                                    <input
                                        className="form-input"
                                        value={eventData.region}
                                        onChange={e => setEventData(prev => ({ ...prev, region: e.target.value }))}
                                        placeholder="e.g. Northeast US"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Timezone</label>
                                    <select
                                        className="form-input"
                                        value={eventData.timezone}
                                        onChange={e => setEventData(prev => ({ ...prev, timezone: e.target.value }))}
                                    >
                                        <option value="America/New_York">Eastern</option>
                                        <option value="America/Chicago">Central</option>
                                        <option value="America/Denver">Mountain</option>
                                        <option value="America/Los_Angeles">Pacific</option>
                                        <option value="Europe/London">UK/GMT</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "var(--space-lg)", flexWrap: "wrap" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={eventData.isAllDay} onChange={e => setEventData(prev => ({ ...prev, isAllDay: e.target.checked }))} />
                                    All-day event
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={eventData.isVirtual} onChange={e => setEventData(prev => ({ ...prev, isVirtual: e.target.checked }))} />
                                    Virtual event
                                </label>
                            </div>

                            {!eventData.isVirtual && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                                    <div className="form-group">
                                        <label className="form-label">Location Name</label>
                                        <input className="form-input" value={eventData.locationName} onChange={e => setEventData(prev => ({ ...prev, locationName: e.target.value }))} placeholder="Venue name" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Location Address</label>
                                        <input className="form-input" value={eventData.locationAddress} onChange={e => setEventData(prev => ({ ...prev, locationAddress: e.target.value }))} placeholder="Full address" />
                                    </div>
                                </div>
                            )}

                            {eventData.isVirtual && (
                                <div className="form-group">
                                    <label className="form-label">Virtual URL</label>
                                    <input className="form-input" value={eventData.virtualUrl} onChange={e => setEventData(prev => ({ ...prev, virtualUrl: e.target.value }))} placeholder="https://..." />
                                </div>
                            )}

                            {/* Judging Method */}
                            <div className="form-group">
                                <label className="form-label">Judging Method</label>
                                <div style={{ display: "flex", gap: "var(--space-md)" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer", padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-md)", border: eventData.judgingMethod === "community_vote" ? "2px solid var(--color-accent-primary)" : "1px solid var(--color-border)", background: eventData.judgingMethod === "community_vote" ? "rgba(var(--color-accent-primary-rgb, 61, 90, 62), 0.1)" : "transparent" }}>
                                        <input type="radio" name="judging" value="community_vote" checked={eventData.judgingMethod === "community_vote"} onChange={() => setEventData(prev => ({ ...prev, judgingMethod: "community_vote" }))} />
                                        🗳️ Community Vote
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", cursor: "pointer", padding: "var(--space-sm) var(--space-md)", borderRadius: "var(--radius-md)", border: eventData.judgingMethod === "expert_judge" ? "2px solid var(--color-accent-primary)" : "1px solid var(--color-border)", background: eventData.judgingMethod === "expert_judge" ? "rgba(var(--color-accent-primary-rgb, 61, 90, 62), 0.1)" : "transparent" }}>
                                        <input type="radio" name="judging" value="expert_judge" checked={eventData.judgingMethod === "expert_judge"} onChange={() => setEventData(prev => ({ ...prev, judgingMethod: "expert_judge" }))} />
                                        🏅 Expert Judge
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                                <button className="btn btn-primary" onClick={handleSaveDetails} disabled={isSaving || !eventData.name.trim()}>
                                    {isSaving ? "Saving…" : "💾 Save Details"}
                                </button>
                                {detailsSaved && (
                                    <span style={{ color: "#22c55e", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                        ✅ Saved!
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* TAB: Class List (existing content)      */}
                {/* ═══════════════════════════════════════ */}
                {activeTab === "classes" && (
                    <>
                        {/* Division Tree */}
                        <div className="division-tree">
                            {divisions.map((div, divIndex) => (
                                <div key={div.id} className="division-card">
                                    {/* Division Header */}
                                    <div className="division-header">
                                        <div className="division-reorder">
                                            <button className="reorder-btn" onClick={() => handleMoveDivision(divIndex, -1)} disabled={divIndex === 0} title="Move up">▲</button>
                                            <button className="reorder-btn" onClick={() => handleMoveDivision(divIndex, 1)} disabled={divIndex === divisions.length - 1} title="Move down">▼</button>
                                        </div>

                                        {editingDivision === div.id ? (
                                            <div className="inline-edit">
                                                <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveDivision(div.id)} autoFocus placeholder="Division name" />
                                                <button className="btn btn-primary" onClick={() => handleSaveDivision(div.id)} disabled={isSaving} style={{ padding: "var(--space-xs) var(--space-md)" }}>Save</button>
                                                <button className="btn btn-ghost" onClick={() => setEditingDivision(null)} style={{ padding: "var(--space-xs) var(--space-md)" }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="division-name">📋 {div.name}</span>
                                                <span className="division-count">{div.classes.length} class{div.classes.length !== 1 ? "es" : ""}</span>
                                                <div className="division-actions">
                                                    <button className="action-btn" onClick={() => { setEditingDivision(div.id); setEditName(div.name); }} title="Edit">✏️</button>
                                                    <button className="action-btn action-btn-danger" onClick={() => handleDeleteDivision(div.id, div.name)} title="Delete">🗑️</button>
                                                    <button className="btn btn-ghost" onClick={() => { setAddingClassToDivision(div.id); setNewClassName(""); setNewClassNumber(""); }} style={{ padding: "var(--space-xs) var(--space-sm)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>+ Class</button>
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
                                                        <input className="form-input" value={editClassNumber} onChange={(e) => setEditClassNumber(e.target.value)} placeholder="#" style={{ width: "60px" }} />
                                                        <input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSaveClass(cls.id)} autoFocus placeholder="Class name" />
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
                                                <input className="form-input" value={newClassNumber} onChange={(e) => setNewClassNumber(e.target.value)} placeholder="#" style={{ width: "60px" }} />
                                                <input className="form-input" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddClass(div.id)} autoFocus placeholder="Class name (e.g. Arabian/Part-Arabian)" style={{ flex: 1 }} />
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
                    </>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* TAB: Judges                             */}
                {/* ═══════════════════════════════════════ */}
                {activeTab === "judges" && (
                    <div className="card" style={{ padding: "var(--space-xl)" }}>
                        <h3 style={{ marginBottom: "var(--space-md)" }}>
                            🧑‍⚖️ <span className="text-gradient">Assigned Judges</span>
                        </h3>
                        <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-lg)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                            Add users by their alias to grant them access to the Expert Judging Panel. They&apos;ll be able to assign placings during the &quot;Judging&quot; phase.
                        </p>

                        {/* Add Judge Form */}
                        <div style={{ position: "relative", marginBottom: "var(--space-lg)" }}>
                            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                                <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
                                    <input
                                        className="form-input"
                                        value={newJudgeAlias}
                                        onChange={e => { setNewJudgeAlias(e.target.value); setJudgeError(""); }}
                                        onKeyDown={e => e.key === "Enter" && handleAddJudge()}
                                        placeholder="Search by user alias…"
                                        autoComplete="off"
                                    />
                                    {/* Autocomplete dropdown */}
                                    {userSuggestions.length > 0 && newJudgeAlias.trim().length >= 2 && (
                                        <div style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: 0,
                                            right: 0,
                                            zIndex: 50,
                                            background: "var(--color-surface-elevated)",
                                            border: "1px solid var(--color-border)",
                                            borderRadius: "var(--radius-md)",
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                                            marginTop: 4,
                                            maxHeight: 240,
                                            overflow: "auto",
                                        }}>
                                            {userSuggestions.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setNewJudgeAlias(u.aliasName);
                                                        setUserSuggestions([]);
                                                    }}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "var(--space-sm)",
                                                        width: "100%",
                                                        padding: "var(--space-sm) var(--space-md)",
                                                        background: "none",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        color: "var(--color-text-primary)",
                                                        fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                                                        textAlign: "left",
                                                        borderBottom: "1px solid var(--color-border)",
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                                                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                                                >
                                                    <div style={{
                                                        width: 28, height: 28, borderRadius: "50%",
                                                        background: "var(--color-accent-primary-glow)",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: "0.75rem", flexShrink: 0,
                                                        overflow: "hidden",
                                                    }}>
                                                        {u.avatarUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={u.avatarUrl} alt={u.aliasName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                        ) : "👤"}
                                                    </div>
                                                    <span>@{u.aliasName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {isSearching && (
                                        <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-xs) * var(--font-scale))" }}>
                                            Searching…
                                        </div>
                                    )}
                                </div>
                                <button className="btn btn-primary" onClick={handleAddJudge} disabled={!newJudgeAlias.trim()}>
                                    + Add Judge
                                </button>
                            </div>
                            <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 4 }}>
                                Type 2+ characters to search. Click a result to select, then "Add Judge".
                            </p>
                        </div>

                        {judgeError && <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>{judgeError}</div>}
                        {judgeSuccess && <div style={{ color: "#22c55e", marginBottom: "var(--space-md)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>✅ {judgeSuccess}</div>}

                        {/* Judge List */}
                        {judges.length === 0 ? (
                            <div style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "var(--space-xl)" }}>
                                No judges assigned yet. Add judges by their user alias above.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                                {judges.map(judge => (
                                    <div key={judge.id} style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "var(--space-md)",
                                        padding: "var(--space-sm) var(--space-md)",
                                        background: "rgba(var(--color-surface-rgb, 30, 30, 30), 0.5)",
                                        borderRadius: "var(--radius-sm)",
                                    }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: "50%",
                                            background: "var(--color-accent-primary-glow)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "1rem", flexShrink: 0,
                                            overflow: "hidden",
                                        }}>
                                            {judge.avatarUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={judge.avatarUrl} alt={judge.aliasName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                "🧑‍⚖️"
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                                @{judge.aliasName}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => handleRemoveJudge(judge.id)}
                                            style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-accent-danger)" }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Copy Modal */}
                {showCopyModal && createPortal(
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
                    </div>,
                    document.body)}
            </div>
        </div>
    );
}
