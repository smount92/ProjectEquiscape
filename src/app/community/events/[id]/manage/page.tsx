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
        name: "",
        description: "",
        startsAt: "",
        endsAt: "",
        timezone: "America/New_York",
        isAllDay: false,
        isVirtual: false,
        locationName: "",
        locationAddress: "",
        region: "",
        virtualUrl: "",
        judgingMethod: "community_vote",
    });
    const [detailsSaved, setDetailsSaved] = useState(false);

    // Judge state
    const [judges, setJudges] = useState<JudgeInfo[]>([]);
    const [newJudgeAlias, setNewJudgeAlias] = useState("");
    const [judgeError, setJudgeError] = useState("");
    const [judgeSuccess, setJudgeSuccess] = useState("");
    const [userSuggestions, setUserSuggestions] = useState<
        { id: string; aliasName: string; avatarUrl: string | null }[]
    >([]);
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
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }

        const { data: event } = await supabase
            .from("events")
            .select(
                "id, name, description, starts_at, ends_at, timezone, is_all_day, is_virtual, location_name, location_address, region, virtual_url, judging_method, created_by",
            )
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

    useEffect(() => {
        loadData();
    }, [loadData]);

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
        await reorderDivisions(newOrder.map((d) => d.id));
    };

    // ── Class CRUD ──

    const handleAddClass = async (divisionId: string) => {
        if (!newClassName.trim()) return;
        setIsSaving(true);
        const division = divisions.find((d) => d.id === divisionId);
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
        const div = divisions.find((d) => d.id === divisionId);
        if (!div) return;
        const newOrder = [...div.classes];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= newOrder.length) return;
        [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
        await reorderClasses(newOrder.map((c) => c.id));
        await loadData();
    };

    // ── Copy from event ──

    const loadUserEvents = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
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
            <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
                <div
                    className="bg-bg-card border-edge border-edge rounded-lg border p-12 p-[var(--space-3xl)] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ textAlign: "center" }}
                >
                    <div
                        className="hover:no-underline-min-h)] leading-none-spinner m-[0 auto var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                        style={{ borderTopColor: "var(--color-accent-primary)" }}
                    />
                    <p>Loading event…</p>
                </div>
            </div>
        );
    }

    if (error && !eventName) {
        return (
            <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
                <div
                    className="bg-bg-card border-edge border-edge rounded-lg border p-12 p-[var(--space-3xl)] shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                    style={{ textAlign: "center" }}
                >
                    <p className="text-danger">{error}</p>
                    <Link
                        href="/community/events"
                        className="hover:no-underline-min-h)] text-ink-light border-edge mt-4 inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                    >
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
        <div className="mx-auto max-w-[var(--max-width)] px-6 px-[0] py-12 py-[0]">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div className="mb-6 items-start justify-between gap-4" style={{ display: "flex", flexWrap: "wrap" }}>
                    <div>
                        <Link href={`/community/events/${eventId}`} className="text-muted mb-1 inline-block text-sm">
                            ← Back to Event
                        </Link>
                        <h1>⚙️ Manage Event</h1>
                        <p className="text-ink-light">{eventName}</p>
                    </div>
                    <div className="gap-2" style={{ display: "flex" }}>
                        <span className="horse-bg-card border-edge transition-all-badge text-forest rounded-lg border bg-[var(--color-accent-primary-glow)] p-12 font-semibold shadow-md max-[480px]:rounded-[var(--radius-md)]">
                            {divisions.length} Division{divisions.length !== 1 ? "s" : ""} · {totalClasses} Class
                            {totalClasses !== 1 ? "es" : ""} · {totalEntries} Entr{totalEntries !== 1 ? "ies" : "y"}
                        </span>
                    </div>
                </div>

                {/* Tab Bar */}
                <div
                    style={{
                        display: "flex",
                        gap: "var(--space-xs)",
                        marginBottom: "var(--space-xl)",
                        borderBottom: "1px solid var(--color-border)",
                        paddingBottom: "0",
                    }}
                >
                    {tabs
                        .filter((t) => !t.hidden)
                        .map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: "var(--space-sm) var(--space-md)",
                                    background: "none",
                                    border: "none",
                                    borderBottom:
                                        activeTab === tab.id
                                            ? "2px solid var(--color-accent-primary)"
                                            : "2px solid transparent",
                                    color:
                                        activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
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
                    <div className="text-danger mt-2 mb-6 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
                        ⚠️ {error}
                        <button
                            onClick={() => setError(null)}
                            style={{
                                marginLeft: "auto",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "inherit",
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* TAB: Edit Details                       */}
                {/* ═══════════════════════════════════════ */}
                {activeTab === "details" && (
                    <div className="bg-bg-card border-edge border-edge rounded-lg border p-8 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                        <div className="gap-6" style={{ display: "flex", flexDirection: "column" }}>
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Event Name</label>
                                <input
                                    className="form-input"
                                    value={eventData.name}
                                    onChange={(e) => setEventData((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Event name"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Description</label>
                                <textarea
                                    className="form-input"
                                    value={eventData.description}
                                    onChange={(e) => setEventData((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Describe your event…"
                                    rows={3}
                                />
                            </div>

                            <div className="grid-cols-2 gap-4" style={{ display: "grid" }}>
                                <div className="mb-6">
                                    <label className="text-ink mb-1 block text-sm font-semibold">Starts At</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={eventData.startsAt ? eventData.startsAt.slice(0, 16) : ""}
                                        onChange={(e) =>
                                            setEventData((prev) => ({ ...prev, startsAt: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="text-ink mb-1 block text-sm font-semibold">
                                        Ends At (optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={eventData.endsAt ? eventData.endsAt.slice(0, 16) : ""}
                                        onChange={(e) => setEventData((prev) => ({ ...prev, endsAt: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid-cols-2 gap-4" style={{ display: "grid" }}>
                                <div className="mb-6">
                                    <label className="text-ink mb-1 block text-sm font-semibold">Region</label>
                                    <input
                                        className="form-input"
                                        value={eventData.region}
                                        onChange={(e) => setEventData((prev) => ({ ...prev, region: e.target.value }))}
                                        placeholder="e.g. Northeast US"
                                    />
                                </div>
                                <div className="mb-6">
                                    <label className="text-ink mb-1 block text-sm font-semibold">Timezone</label>
                                    <select
                                        className="form-input"
                                        value={eventData.timezone}
                                        onChange={(e) =>
                                            setEventData((prev) => ({ ...prev, timezone: e.target.value }))
                                        }
                                    >
                                        <option value="America/New_York">Eastern</option>
                                        <option value="America/Chicago">Central</option>
                                        <option value="America/Denver">Mountain</option>
                                        <option value="America/Los_Angeles">Pacific</option>
                                        <option value="Europe/London">UK/GMT</option>
                                    </select>
                                </div>
                            </div>

                            <div className="gap-6" style={{ display: "flex", flexWrap: "wrap" }}>
                                <label
                                    className="gap-1"
                                    style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={eventData.isAllDay}
                                        onChange={(e) =>
                                            setEventData((prev) => ({ ...prev, isAllDay: e.target.checked }))
                                        }
                                    />
                                    All-day event
                                </label>
                                <label
                                    className="gap-1"
                                    style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={eventData.isVirtual}
                                        onChange={(e) =>
                                            setEventData((prev) => ({ ...prev, isVirtual: e.target.checked }))
                                        }
                                    />
                                    Virtual event
                                </label>
                            </div>

                            {!eventData.isVirtual && (
                                <div className="grid-cols-2 gap-4" style={{ display: "grid" }}>
                                    <div className="mb-6">
                                        <label className="text-ink mb-1 block text-sm font-semibold">
                                            Location Name
                                        </label>
                                        <input
                                            className="form-input"
                                            value={eventData.locationName}
                                            onChange={(e) =>
                                                setEventData((prev) => ({ ...prev, locationName: e.target.value }))
                                            }
                                            placeholder="Venue name"
                                        />
                                    </div>
                                    <div className="mb-6">
                                        <label className="text-ink mb-1 block text-sm font-semibold">
                                            Location Address
                                        </label>
                                        <input
                                            className="form-input"
                                            value={eventData.locationAddress}
                                            onChange={(e) =>
                                                setEventData((prev) => ({ ...prev, locationAddress: e.target.value }))
                                            }
                                            placeholder="Full address"
                                        />
                                    </div>
                                </div>
                            )}

                            {eventData.isVirtual && (
                                <div className="mb-6">
                                    <label className="text-ink mb-1 block text-sm font-semibold">Virtual URL</label>
                                    <input
                                        className="form-input"
                                        value={eventData.virtualUrl}
                                        onChange={(e) =>
                                            setEventData((prev) => ({ ...prev, virtualUrl: e.target.value }))
                                        }
                                        placeholder="https://..."
                                    />
                                </div>
                            )}

                            {/* Judging Method */}
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Judging Method</label>
                                <div className="gap-4" style={{ display: "flex" }}>
                                    <label
                                        className="p-[var(--space-sm) var(--space-md)] gap-1 rounded-md"
                                        style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                                    >
                                        <input
                                            type="radio"
                                            name="judging"
                                            value="community_vote"
                                            checked={eventData.judgingMethod === "community_vote"}
                                            onChange={() =>
                                                setEventData((prev) => ({ ...prev, judgingMethod: "community_vote" }))
                                            }
                                        />
                                        🗳️ Community Vote
                                    </label>
                                    <label
                                        className="p-[var(--space-sm) var(--space-md)] gap-1 rounded-md"
                                        style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                                    >
                                        <input
                                            type="radio"
                                            name="judging"
                                            value="expert_judge"
                                            checked={eventData.judgingMethod === "expert_judge"}
                                            onChange={() =>
                                                setEventData((prev) => ({ ...prev, judgingMethod: "expert_judge" }))
                                            }
                                        />
                                        🏅 Expert Judge
                                    </label>
                                </div>
                            </div>

                            <div className="gap-2" style={{ display: "flex", alignItems: "center" }}>
                                <button
                                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                    onClick={handleSaveDetails}
                                    disabled={isSaving || !eventData.name.trim()}
                                >
                                    {isSaving ? "Saving…" : "💾 Save Details"}
                                </button>
                                {detailsSaved && <span className="text-sm text-[#22c55e]">✅ Saved!</span>}
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
                        <div className="flex flex-col gap-4">
                            {divisions.map((div, divIndex) => (
                                <div
                                    key={div.id}
                                    className="bg-bg-card border-edge border-edge overflow-hidden rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
                                >
                                    {/* Division Header */}
                                    <div className="bg-glass border-edge flex flex-wrap items-center gap-2 border-b px-6 py-4">
                                        <div className="division-reorder max-sm:hidden">
                                            <button
                                                className="border-edge text-muted hover:border-forest hover:text-forest flex h-[18px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
                                                onClick={() => handleMoveDivision(divIndex, -1)}
                                                disabled={divIndex === 0}
                                                title="Move up"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                className="border-edge text-muted hover:border-forest hover:text-forest flex h-[18px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
                                                onClick={() => handleMoveDivision(divIndex, 1)}
                                                disabled={divIndex === divisions.length - 1}
                                                title="Move down"
                                            >
                                                ▼
                                            </button>
                                        </div>

                                        {editingDivision === div.id ? (
                                            <div className="flex flex-1 items-center gap-1">
                                                <input
                                                    className="form-input"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleSaveDivision(div.id)}
                                                    autoFocus
                                                    placeholder="Division name"
                                                />
                                                <button
                                                    className="hover:no-underline-min-h)] bg-forest text-inverse p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                                    onClick={() => handleSaveDivision(div.id)}
                                                    disabled={isSaving}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="hover:no-underline-min-h)] text-ink-light border-edge p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                                    onClick={() => setEditingDivision(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-ink text-[calc(var(--font-size-md)*var(--font-scale))] font-bold">
                                                    📋 {div.name}
                                                </span>
                                                <span className="text-muted ml-1 text-xs">
                                                    {div.classes.length} class{div.classes.length !== 1 ? "es" : ""}
                                                </span>
                                                <div className="ml-auto flex items-center gap-1">
                                                    <button
                                                        className="cursor-pointer rounded-sm border-0 bg-transparent p-[4px] text-[0.9rem] transition-colors"
                                                        onClick={() => {
                                                            setEditingDivision(div.id);
                                                            setEditName(div.name);
                                                        }}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        className="action-inline-flex hover:no-underline-min-h)] hover:bg-[var(--color-surface-glass-hover)]-danger min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md rounded-sm border border-0 border-[transparent] bg-transparent p-[4px] px-8 py-2 font-sans text-base text-[0.9rem] leading-none font-semibold no-underline transition-all transition-colors duration-150"
                                                        onClick={() => handleDeleteDivision(div.id, div.name)}
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                    <button
                                                        className="hover:no-underline-min-h)] text-ink-light border-edge p-[var(--space-xs) var(--space-sm)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base text-xs leading-none font-semibold no-underline transition-all duration-150"
                                                        onClick={() => {
                                                            setAddingClassToDivision(div.id);
                                                            setNewClassName("");
                                                            setNewClassNumber("");
                                                        }}
                                                    >
                                                        + Class
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Classes */}
                                    <div className="px-[0] py-1">
                                        {div.classes.map((cls, clsIndex) => (
                                            <div key={cls.id} className="border-b-0">
                                                <div className="flex flex-col gap-[2px]">
                                                    <button
                                                        className="border-edge text-muted hover:border-forest hover:text-forest flex h-[14px] h-[18px] w-[20px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.5rem] text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
                                                        onClick={() => handleMoveClass(div.id, clsIndex, -1)}
                                                        disabled={clsIndex === 0}
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        className="border-edge text-muted hover:border-forest hover:text-forest flex h-[14px] h-[18px] w-[20px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.5rem] text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
                                                        onClick={() => handleMoveClass(div.id, clsIndex, 1)}
                                                        disabled={clsIndex === div.classes.length - 1}
                                                    >
                                                        ▼
                                                    </button>
                                                </div>

                                                {editingClass === cls.id ? (
                                                    <div className="flex flex-1 items-center gap-1">
                                                        <input
                                                            className="form-input w-[60px]"
                                                            value={editClassNumber}
                                                            onChange={(e) => setEditClassNumber(e.target.value)}
                                                            placeholder="#"
                                                        />
                                                        <input
                                                            className="form-input"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onKeyDown={(e) =>
                                                                e.key === "Enter" && handleSaveClass(cls.id)
                                                            }
                                                            autoFocus
                                                            placeholder="Class name"
                                                        />
                                                        <button
                                                            className="hover:no-underline-min-h)] bg-forest text-inverse p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                                            onClick={() => handleSaveClass(cls.id)}
                                                            disabled={isSaving}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            className="hover:no-underline-min-h)] text-ink-light border-edge p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                                            onClick={() => setEditingClass(null)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-muted min-w-[40px] font-mono text-xs font-semibold">
                                                            {cls.classNumber || "—"}
                                                        </span>
                                                        <span className="flex-1 text-[var(--color-text-secondary)]">
                                                            {cls.name}
                                                        </span>
                                                        {cls.isNanQualifying && (
                                                            <span
                                                                className="bg-[rgba(245, 158, 11, 0.15)] inline-flex items-center gap-[2px] rounded-full px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap text-[#f59e0b]"
                                                                title="NAN Qualifying"
                                                            >
                                                                ⭐ NAN
                                                            </span>
                                                        )}
                                                        {(cls.entryCount || 0) > 0 && (
                                                            <span className="text-forest inline-flex items-center rounded-full bg-[var(--color-accent-primary-glow)] px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap">
                                                                {cls.entryCount} entr
                                                                {cls.entryCount === 1 ? "y" : "ies"}
                                                            </span>
                                                        )}
                                                        <div className="flex gap-[2px] opacity-0 transition-opacity">
                                                            <button
                                                                className="cursor-pointer rounded-sm border-0 bg-transparent p-[2px] p-[4px] text-xs text-[0.9rem] transition-colors"
                                                                onClick={() =>
                                                                    handleToggleNan(cls.id, cls.isNanQualifying)
                                                                }
                                                                title={cls.isNanQualifying ? "Remove NAN" : "Mark NAN"}
                                                            >
                                                                {cls.isNanQualifying ? "⭐" : "☆"}
                                                            </button>
                                                            <button
                                                                className="cursor-pointer rounded-sm border-0 bg-transparent p-[2px] p-[4px] text-xs text-[0.9rem] transition-colors"
                                                                onClick={() => {
                                                                    setEditingClass(cls.id);
                                                                    setEditName(cls.name);
                                                                    setEditClassNumber(cls.classNumber || "");
                                                                }}
                                                                title="Edit"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                className="action-inline-flex hover:no-underline-min-h)] hover:bg-[var(--color-surface-glass-hover)]-danger min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md rounded-sm border border-0 border-[transparent] bg-transparent p-[2px] p-[4px] px-8 py-2 font-sans text-base text-xs text-[0.9rem] leading-none font-semibold no-underline transition-all transition-colors duration-150"
                                                                onClick={() => handleDeleteClass(cls.id, cls.name)}
                                                                title="Delete"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}

                                        {/* Add class inline form */}
                                        {addingClassToDivision === div.id && (
                                            <div className="bg-glass animate-fade-in-up border-b-0">
                                                <input
                                                    className="form-input w-[60px]"
                                                    value={newClassNumber}
                                                    onChange={(e) => setNewClassNumber(e.target.value)}
                                                    placeholder="#"
                                                />
                                                <input
                                                    className="form-input flex-1"
                                                    value={newClassName}
                                                    onChange={(e) => setNewClassName(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddClass(div.id)}
                                                    autoFocus
                                                    placeholder="Class name (e.g. Arabian/Part-Arabian)"
                                                />
                                                <button
                                                    className="hover:no-underline-min-h)] bg-forest text-inverse p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                                    onClick={() => handleAddClass(div.id)}
                                                    disabled={isSaving || !newClassName.trim()}
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    className="hover:no-underline-min-h)] text-ink-light border-edge p-[var(--space-xs) var(--space-md)] inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                                    onClick={() => setAddingClassToDivision(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}

                                        {div.classes.length === 0 && addingClassToDivision !== div.id && (
                                            <div className="text-muted border-b-0" style={{ fontStyle: "italic" }}>
                                                No classes yet — click &quot;+ Class&quot; to add one
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Division */}
                        <div className="bg-bg-card border-edge border-edge mt-6 rounded-lg border p-6 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                            <div className="gap-2" style={{ display: "flex", alignItems: "center" }}>
                                <input
                                    className="form-input"
                                    value={newDivisionName}
                                    onChange={(e) => setNewDivisionName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddDivision()}
                                    placeholder="New division name (e.g. OF Plastic Halter)"
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                    onClick={handleAddDivision}
                                    disabled={isSaving || !newDivisionName.trim()}
                                >
                                    + Add Division
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6 gap-2" style={{ display: "flex", flexWrap: "wrap" }}>
                            <button
                                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                onClick={loadUserEvents}
                                disabled={isSaving}
                            >
                                📋 Copy From Another Event…
                            </button>
                        </div>
                    </>
                )}

                {/* ═══════════════════════════════════════ */}
                {/* TAB: Judges                             */}
                {/* ═══════════════════════════════════════ */}
                {activeTab === "judges" && (
                    <div className="bg-bg-card border-edge border-edge rounded-lg border p-8 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
                        <h3 className="mb-4">
                            🧑‍⚖️ <span className="text-forest">Assigned Judges</span>
                        </h3>
                        <p className="text-muted mb-6 text-sm">
                            Add users by their alias to grant them access to the Expert Judging Panel. They&apos;ll be
                            able to assign placings during the &quot;Judging&quot; phase.
                        </p>

                        {/* Add Judge Form */}
                        <div className="mb-6" style={{ position: "relative" }}>
                            <div className="gap-2" style={{ display: "flex", alignItems: "center" }}>
                                <div className="max-w-[300] flex-1" style={{ position: "relative" }}>
                                    <input
                                        className="form-input"
                                        value={newJudgeAlias}
                                        onChange={(e) => {
                                            setNewJudgeAlias(e.target.value);
                                            setJudgeError("");
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddJudge()}
                                        placeholder="Search by user alias…"
                                        autoComplete="off"
                                    />
                                    {/* Autocomplete dropdown */}
                                    {userSuggestions.length > 0 && newJudgeAlias.trim().length >= 2 && (
                                        <div
                                            style={{
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
                                            }}
                                        >
                                            {userSuggestions.map((u) => (
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
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background =
                                                            "var(--color-surface-hover)")
                                                    }
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                                >
                                                    <div
                                                        style={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: "50%",
                                                            background: "var(--color-accent-primary-glow)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: "0.75rem",
                                                            flexShrink: 0,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {u.avatarUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={u.avatarUrl}
                                                                alt={u.aliasName}
                                                                className="h-full w-full"
                                                                style={{ objectFit: "cover" }}
                                                            />
                                                        ) : (
                                                            "👤"
                                                        )}
                                                    </div>
                                                    <span>@{u.aliasName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {isSearching && (
                                        <div
                                            className="text-muted top-[50%] right-[8] translate-y-[-50%] text-xs"
                                            style={{ position: "absolute" }}
                                        >
                                            Searching…
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                    onClick={handleAddJudge}
                                    disabled={!newJudgeAlias.trim()}
                                >
                                    + Add Judge
                                </button>
                            </div>
                            <p className="text-muted mt-[4] text-[calc(0.75rem*var(--font-scale))]">
                                Type 2+ characters to search. Click a result to select, then "Add Judge".
                            </p>
                        </div>

                        {judgeError && <div className="comment-error mb-4">{judgeError}</div>}
                        {judgeSuccess && <div className="mb-4 text-sm text-[#22c55e]">✅ {judgeSuccess}</div>}

                        {/* Judge List */}
                        {judges.length === 0 ? (
                            <div className="text-muted p-8" style={{ textAlign: "center" }}>
                                No judges assigned yet. Add judges by their user alias above.
                            </div>
                        ) : (
                            <div className="gap-2" style={{ display: "flex", flexDirection: "column" }}>
                                {judges.map((judge) => (
                                    <div
                                        key={judge.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "var(--space-md)",
                                            padding: "var(--space-sm) var(--space-md)",
                                            background: "rgba(var(--color-surface-rgb, 30, 30, 30), 0.5)",
                                            borderRadius: "var(--radius-sm)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "50%",
                                                background: "var(--color-accent-primary-glow)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "1rem",
                                                flexShrink: 0,
                                                overflow: "hidden",
                                            }}
                                        >
                                            {judge.avatarUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={judge.avatarUrl}
                                                    alt={judge.aliasName}
                                                    className="h-full w-full"
                                                    style={{ objectFit: "cover" }}
                                                />
                                            ) : (
                                                "🧑‍⚖️"
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold">@{judge.aliasName}</div>
                                        </div>
                                        <button
                                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                            onClick={() => handleRemoveJudge(judge.id)}
                                            style={{
                                                fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                                                color: "var(--color-accent-danger)",
                                            }}
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
                {showCopyModal &&
                    createPortal(
                        <div className="modal-overlay" onClick={() => setShowCopyModal(false)}>
                            <div className="modal-content max-sm:max-w-full" onClick={(e) => e.stopPropagation()}>
                                <h3>📋 Copy Division Tree From…</h3>
                                <p className="text-ink-light mb-4 text-sm">
                                    This will copy all divisions and classes from the selected event. Existing divisions
                                    in this event will NOT be removed.
                                </p>
                                {userEvents.length === 0 ? (
                                    <p className="text-muted">No other events found.</p>
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
                                                <option key={ev.id} value={ev.id}>
                                                    {ev.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="justify-end gap-2" style={{ display: "flex" }}>
                                            <button
                                                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                                                onClick={() => setShowCopyModal(false)}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                                                onClick={handleCopy}
                                                disabled={!selectedSourceEvent}
                                            >
                                                Copy Classes
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );
}
