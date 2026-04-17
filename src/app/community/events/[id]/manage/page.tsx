"use client";

import { useState, useEffect, useCallback } from"react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { useRouter, useParams } from"next/navigation";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";
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
} from"@/app/actions/competition";
import type { Division } from"@/app/actions/competition";
import { updateEvent, getEventJudges, addEventJudge, removeEventJudge, searchUsers } from"@/app/actions/events";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

type TabId ="details" |"classes" |"judges";

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
 judgingMethod:"community_vote" |"expert_judge";
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
 name:"",
 description:"",
 startsAt:"",
 endsAt:"",
 timezone:"America/New_York",
 isAllDay: false,
 isVirtual: false,
 locationName:"",
 locationAddress:"",
 region:"",
 virtualUrl:"",
 judgingMethod:"community_vote",
 });
 const [detailsSaved, setDetailsSaved] = useState(false);

 // Judge state
 const [judges, setJudges] = useState<JudgeInfo[]>([]);
 const [newJudgeAlias, setNewJudgeAlias] = useState("");
 const [judgeError, setJudgeError] = useState("");
 const [judgeSuccess, setJudgeSuccess] = useState("");
 const [coiWarnings, setCoiWarnings] = useState<string[]>([]);
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
 name: (ev.name as string) ||"",
 description: (ev.description as string) ||"",
 startsAt: (ev.starts_at as string) ||"",
 endsAt: (ev.ends_at as string) ||"",
 timezone: (ev.timezone as string) ||"America/New_York",
 isAllDay: (ev.is_all_day as boolean) || false,
 isVirtual: (ev.is_virtual as boolean) || false,
 locationName: (ev.location_name as string) ||"",
 locationAddress: (ev.location_address as string) ||"",
 region: (ev.region as string) ||"",
 virtualUrl: (ev.virtual_url as string) ||"",
 judgingMethod: (ev.judging_method as"community_vote" |"expert_judge") ||"community_vote",
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
 setError(result.error ||"Failed to update event.");
 }
 setIsSaving(false);
 };

 // ── Judge Management ──

 const handleAddJudge = async () => {
 if (!newJudgeAlias.trim()) return;
 setJudgeError("");
 setJudgeSuccess("");
 setCoiWarnings([]);
 const result = await addEventJudge(eventId, newJudgeAlias.trim());
 if (result.success) {
 setNewJudgeAlias("");
 setJudgeSuccess("Judge added!");
 if (result.coiWarnings && result.coiWarnings.length > 0) {
 setCoiWarnings(result.coiWarnings);
 }
 setTimeout(() => setJudgeSuccess(""), 5000);
 const judgeList = await getEventJudges(eventId);
 setJudges(judgeList);
 } else {
 setJudgeError(result.error ||"Failed to add judge.");
 }
 };

 const handleRemoveJudge = async (judgeId: string) => {
 if (!confirm("Remove this judge?")) return;
 const result = await removeEventJudge(judgeId);
 if (result.success) {
 const judgeList = await getEventJudges(eventId);
 setJudges(judgeList);
 } else {
 setJudgeError(result.error ||"Failed to remove judge.");
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
 setError(result.error ||"Failed to create division.");
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
 if (!confirm(`Delete division"${divName}" and all its classes? This cannot be undone.`)) return;
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
 setError(result.error ||"Failed to create class.");
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
 if (!confirm(`Delete class"${className}"? Entries in this class will also be removed.`)) return;
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
 setError(result.error ||"Failed to copy.");
 }
 setIsSaving(false);
 };

 // ── Render ──

 if (isLoading) {
 return (
 <ExplorerLayout title="Manage Event" description="Manage your event details, divisions, and classes.">
 <div
 className="bg-white border-stone-200 rounded-lg border p-12 text-center shadow-md transition-all"
 >
 <div
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 border-t-[var(--color-accent-primary)] bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 />
 <p>Loading event…</p>
 </div>
 </ExplorerLayout>
 );
 }

 if (error && !eventName) {
 return (
 <ExplorerLayout title="Manage Event" description="Manage your event details, divisions, and classes.">
 <div
 className="bg-white border-stone-200 rounded-lg border p-12 text-center shadow-md transition-all"
 >
 <p className="text-red-700">{error}</p>
 <Link
 href="/community/events"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 >
 ← Back to Events
 </Link>
 </div>
 </ExplorerLayout>
 );
 }

 const totalClasses = divisions.reduce((sum, d) => sum + d.classes.length, 0);
 const totalEntries = divisions.reduce((sum, d) => sum + d.classes.reduce((s, c) => s + (c.entryCount || 0), 0), 0);

 const tabs: { id: TabId; label: string; icon: string; hidden?: boolean }[] = [
 { id:"details", label:"Edit Details", icon:"📝" },
 { id:"classes", label:"Class List", icon:"📋" },
 { id:"judges", label:"Judges", icon:"🧑‍⚖️", hidden: eventData.judgingMethod !=="expert_judge" },
 ];

 return (
 <ExplorerLayout title="Manage Event" description="Manage your event details, divisions, and classes.">
 <div className="animate-fade-in-up">
 {/* Header */}
 <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
 <div>
 <Link href={`/community/events/${eventId}`} className="text-stone-500 mb-1 inline-block text-sm">
 ← Back to Event
 </Link>
 <h1>⚙️ Manage Event</h1>
 <p className="text-stone-600">{eventName}</p>
 </div>
 <div className="flex gap-2">
 <span className="rounded-md bg-[var(--color-accent-primary)] px-2 py-0.5 text-xs font-bold text-white">
 {divisions.length} Division{divisions.length !== 1 ?"s" :""} · {totalClasses} Class
 {totalClasses !== 1 ?"es" :""} · {totalEntries} Entr{totalEntries !== 1 ?"ies" :"y"}
 </span>
 </div>
 </div>

 {/* Tab Bar */}
 <div className="flex gap-[var(--space-xs)] mb-[var(--space-xl)] overflow-x-auto border-b border-[#E0D5C1] pb-0 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
 {tabs
 .filter((t) => !t.hidden)
 .map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`cursor-pointer border-0 border-b-2 bg-transparent px-[var(--space-md)] py-[var(--space-sm)] text-sm transition-all duration-200 ${
 activeTab === tab.id
 ? "border-b-[var(--color-accent-primary)] font-semibold text-stone-900"
 : "border-b-transparent font-normal text-stone-500"
 }`}
 >
 {tab.icon} {tab.label}
 </button>
 ))}
 </div>

 {error && (
 <div className="text-red-700 mt-2 mb-6 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 ⚠️ {error}
 <button
 onClick={() => setError(null)}
 className="ml-auto cursor-pointer border-0 bg-transparent text-inherit"
 >
 ✕
 </button>
 </div>
 )}

 {/* ═══════════════════════════════════════ */}
 {/* TAB: Edit Details */}
 {/* ═══════════════════════════════════════ */}
 {activeTab ==="details" && (
 <div className="bg-white border-stone-200 rounded-lg border p-8 shadow-md transition-all">
 <div className="flex flex-col gap-6">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Event Name</label>
 <Input
 
 value={eventData.name}
 onChange={(e) => setEventData((prev) => ({ ...prev, name: e.target.value }))}
 placeholder="Event name"
 />
 </div>

 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Description</label>
 <Textarea
 
 value={eventData.description}
 onChange={(e) => setEventData((prev) => ({ ...prev, description: e.target.value }))}
 placeholder="Describe your event…"
 rows={3}
 />
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Starts At</label>
 <Input
 type="datetime-local"
 
 value={eventData.startsAt ? eventData.startsAt.slice(0, 16) :""}
 onChange={(e) =>
 setEventData((prev) => ({ ...prev, startsAt: e.target.value }))
 }
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Ends At (optional)
 </label>
 <Input
 type="datetime-local"
 
 value={eventData.endsAt ? eventData.endsAt.slice(0, 16) :""}
 onChange={(e) => setEventData((prev) => ({ ...prev, endsAt: e.target.value }))}
 />
 </div>
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Region</label>
 <Input
 
 value={eventData.region}
 onChange={(e) => setEventData((prev) => ({ ...prev, region: e.target.value }))}
 placeholder="e.g. Northeast US"
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Timezone</label>
 <select
 className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={eventData.timezone}
 onChange={(e) =>
 setEventData((prev) => ({ ...prev, timezone: e.target.value }))
 }
 title="Timezone"
 >
 <option value="America/New_York">Eastern</option>
 <option value="America/Chicago">Central</option>
 <option value="America/Denver">Mountain</option>
 <option value="America/Los_Angeles">Pacific</option>
 <option value="Europe/London">UK/GMT</option>
 </select>
 </div>
 </div>

 <div className="flex flex-wrap gap-6">
 <label
 className="flex cursor-pointer items-center gap-1"
 >
 <Input
 type="checkbox"
 checked={eventData.isAllDay}
 onChange={(e) =>
 setEventData((prev) => ({ ...prev, isAllDay: e.target.checked }))
 }
 />
 All-day event
 </label>
 <label
 className="flex cursor-pointer items-center gap-1"
 >
 <Input
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
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Location Name
 </label>
 <Input
 
 value={eventData.locationName}
 onChange={(e) =>
 setEventData((prev) => ({ ...prev, locationName: e.target.value }))
 }
 placeholder="Venue name"
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">
 Location Address
 </label>
 <Input
 
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
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Virtual URL</label>
 <Input
 
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
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Judging Method</label>
 <div className="flex gap-4">
 <label
 className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-2"
 >
 <Input
 type="radio"
 name="judging"
 value="community_vote"
 checked={eventData.judgingMethod ==="community_vote"}
 onChange={() =>
 setEventData((prev) => ({ ...prev, judgingMethod:"community_vote" }))
 }
 />
 🗳️ Community Vote
 </label>
 <label
 className="flex cursor-pointer items-center gap-1 rounded-md px-3 py-2"
 >
 <Input
 type="radio"
 name="judging"
 value="expert_judge"
 checked={eventData.judgingMethod ==="expert_judge"}
 onChange={() =>
 setEventData((prev) => ({ ...prev, judgingMethod:"expert_judge" }))
 }
 />
 🏅 Expert Judge
 </label>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSaveDetails}
 disabled={isSaving || !eventData.name.trim()}
 >
 {isSaving ?"Saving…" :"💾 Save Details"}
 </button>
 {detailsSaved && <span className="text-sm text-[#22c55e]">✅ Saved!</span>}
 </div>
 </div>
 </div>
 )}

 {/* ═══════════════════════════════════════ */}
 {/* TAB: Class List (existing content) */}
 {/* ═══════════════════════════════════════ */}
 {activeTab ==="classes" && (
 <>
 {/* Division Tree */}
 <div className="flex flex-col gap-4">
 {divisions.map((div, divIndex) => (
 <div
 key={div.id}
 className="bg-white border-stone-200 overflow-hidden rounded-lg border shadow-md transition-all"
 >
 {/* Division Header */}
 <div className="bg-stone-50 border-stone-200 flex flex-wrap items-center gap-2 border-b px-6 py-4">
 <div className="division-reorder max-sm:hidden">
 <button
 className="border-stone-200 text-stone-500 hover:border-emerald-700 hover:text-forest flex h-[18px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
 onClick={() => handleMoveDivision(divIndex, -1)}
 disabled={divIndex === 0}
 title="Move up"
 >
 ▲
 </button>
 <button
 className="border-stone-200 text-stone-500 hover:border-emerald-700 hover:text-forest flex h-[18px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
 onClick={() => handleMoveDivision(divIndex, 1)}
 disabled={divIndex === divisions.length - 1}
 title="Move down"
 >
 ▼
 </button>
 </div>

 {editingDivision === div.id ? (
 <div className="flex flex-1 items-center gap-1">
 <Input
 
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 onKeyDown={(e) => e.key ==="Enter" && handleSaveDivision(div.id)}
 autoFocus
 placeholder="Division name"
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleSaveDivision(div.id)}
 disabled={isSaving}
 >
 Save
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setEditingDivision(null)}
 >
 Cancel
 </button>
 </div>
 ) : (
 <>
 <span className="text-stone-900 text-base font-bold">
 📋 {div.name}
 </span>
 <span className="text-stone-500 ml-1 text-xs">
 {div.classes.length} class{div.classes.length !== 1 ?"es" :""}
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
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-red-300 bg-transparent px-6 py-2 text-sm font-semibold text-red-600 no-underline transition-all hover:bg-red-50"
 onClick={() => handleDeleteDivision(div.id, div.name)}
 title="Delete"
 >
 🗑️
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
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
 <div className="px-0 py-1">
 {div.classes.map((cls, clsIndex) => (
 <div key={cls.id} className="border-b-0">
 <div className="flex flex-col gap-[2px]">
 <button
 className="border-stone-200 text-stone-500 hover:border-emerald-700 hover:text-forest flex h-[14px] h-[18px] w-[20px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.5rem] text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
 onClick={() => handleMoveClass(div.id, clsIndex, -1)}
 disabled={clsIndex === 0}
 >
 ▲
 </button>
 <button
 className="border-stone-200 text-stone-500 hover:border-emerald-700 hover:text-forest flex h-[14px] h-[18px] w-[20px] w-[24px] cursor-pointer items-center justify-center rounded-sm border bg-transparent p-0 font-sans text-[0.5rem] text-[0.6rem] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-[0.3]"
 onClick={() => handleMoveClass(div.id, clsIndex, 1)}
 disabled={clsIndex === div.classes.length - 1}
 >
 ▼
 </button>
 </div>

 {editingClass === cls.id ? (
 <div className="flex flex-1 items-center gap-1">
 <Input
 className="w-[60px]"
 value={editClassNumber}
 onChange={(e) => setEditClassNumber(e.target.value)}
 placeholder="#"
 />
 <Input
 
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 onKeyDown={(e) =>
 e.key ==="Enter" && handleSaveClass(cls.id)
 }
 autoFocus
 placeholder="Class name"
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleSaveClass(cls.id)}
 disabled={isSaving}
 >
 Save
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setEditingClass(null)}
 >
 Cancel
 </button>
 </div>
 ) : (
 <>
 <span className="text-stone-500 min-w-[40px] font-mono text-xs font-semibold">
 {cls.classNumber ||"—"}
 </span>
 <span className="flex-1 text-[var(--color-text-secondary)]">
 {cls.name}
 </span>
 {cls.isNanQualifying && (
 <span
 className="bg-amber-100/60 inline-flex items-center gap-[2px] rounded-full px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap text-[#f59e0b]"
 title="NAN Qualifying"
 >
 ⭐ NAN
 </span>
 )}
 {(cls.entryCount || 0) > 0 && (
 <span className="text-forest inline-flex items-center rounded-full bg-[var(--color-accent-primary-glow)] px-[6px] py-[1px] text-xs font-semibold whitespace-nowrap">
 {cls.entryCount} entr
 {cls.entryCount === 1 ?"y" :"ies"}
 </span>
 )}
 <div className="flex gap-[2px] opacity-0 transition-opacity">
 <button
 className="cursor-pointer rounded-sm border-0 bg-transparent p-[2px] p-[4px] text-xs text-[0.9rem] transition-colors"
 onClick={() =>
 handleToggleNan(cls.id, cls.isNanQualifying)
 }
 title={cls.isNanQualifying ?"Remove NAN" :"Mark NAN"}
 >
 {cls.isNanQualifying ?"⭐" :"☆"}
 </button>
 <button
 className="cursor-pointer rounded-sm border-0 bg-transparent p-[2px] p-[4px] text-xs text-[0.9rem] transition-colors"
 onClick={() => {
 setEditingClass(cls.id);
 setEditName(cls.name);
 setEditClassNumber(cls.classNumber ||"");
 }}
 title="Edit"
 >
 ✏️
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-red-300 bg-transparent px-6 py-2 text-sm font-semibold text-red-600 no-underline transition-all hover:bg-red-50"
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
 <div className="bg-stone-50 animate-fade-in-up border-b-0">
 <Input
 className="w-[60px]"
 value={newClassNumber}
 onChange={(e) => setNewClassNumber(e.target.value)}
 placeholder="#"
 />
 <Input
 className="flex-1"
 value={newClassName}
 onChange={(e) => setNewClassName(e.target.value)}
 onKeyDown={(e) => e.key ==="Enter" && handleAddClass(div.id)}
 autoFocus
 placeholder="Class name (e.g. Arabian/Part-Arabian)"
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => handleAddClass(div.id)}
 disabled={isSaving || !newClassName.trim()}
 >
 Add
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setAddingClassToDivision(null)}
 >
 Cancel
 </button>
 </div>
 )}

 {div.classes.length === 0 && addingClassToDivision !== div.id && (
 <div className="text-stone-500 italic border-b-0">
 No classes yet — click &quot;+ Class&quot; to add one
 </div>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Add Division */}
 <div className="bg-white border-stone-200 mt-6 rounded-lg border p-6 shadow-md transition-all">
 <div className="flex items-center gap-2">
 <Input
 className="flex-1"
 value={newDivisionName}
 onChange={(e) => setNewDivisionName(e.target.value)}
 onKeyDown={(e) => e.key ==="Enter" && handleAddDivision()}
 placeholder="New division name (e.g. OF Plastic Halter)"
 />
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleAddDivision}
 disabled={isSaving || !newDivisionName.trim()}
 >
 + Add Division
 </button>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="mt-6 flex flex-wrap gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={loadUserEvents}
 disabled={isSaving}
 >
 📋 Copy From Another Event…
 </button>
 </div>
 </>
 )}

 {/* ═══════════════════════════════════════ */}
 {/* TAB: Judges */}
 {/* ═══════════════════════════════════════ */}
 {activeTab ==="judges" && (
 <div className="bg-white border-stone-200 rounded-lg border p-8 shadow-md transition-all">
 <h3 className="mb-4">
 🧑‍⚖️ <span className="text-forest">Assigned Judges</span>
 </h3>
 <p className="text-stone-600 mb-6 text-sm">
 Add users by their alias to grant them access to the Expert Judging Panel. They&apos;ll be
 able to assign placings during the &quot;Judging&quot; phase.
 </p>

 {/* Add Judge Form */}
 <div className="relative mb-6">
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <div className="relative max-w-[300] flex-1">
 <Input
 
 value={newJudgeAlias}
 onChange={(e) => {
 setNewJudgeAlias(e.target.value);
 setJudgeError("");
 }}
 onKeyDown={(e) => e.key ==="Enter" && handleAddJudge()}
 placeholder="Search by user alias…"
 autoComplete="off"
 />
 {/* Autocomplete dropdown */}
 {userSuggestions.length > 0 && newJudgeAlias.trim().length >= 2 && (
 <div
 className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[240px] overflow-auto rounded-md border border-stone-200 bg-white shadow-lg"
 >
 {userSuggestions.map((u) => (
 <button
 key={u.id}
 type="button"
 onClick={() => {
 setNewJudgeAlias(u.aliasName);
 setUserSuggestions([]);
 }}
 className="flex w-full cursor-pointer items-center gap-[var(--space-sm)] border-0 border-b border-stone-200 bg-transparent px-[var(--space-md)] py-[var(--space-sm)] text-left text-sm text-stone-900 hover:bg-[rgb(250 250 249)]"
 >
 <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-primary-glow)] text-xs">
 {u.avatarUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={u.avatarUrl}
 alt={u.aliasName}
 className="h-full w-full object-cover"
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
 className="text-stone-500 absolute top-1/2 right-2 -translate-y-1/2 text-xs"
 >
 Searching…
 </div>
 )}
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleAddJudge}
 disabled={!newJudgeAlias.trim()}
 >
 + Add Judge
 </button>
 </div>
 <p className="text-stone-500 mt-[4] text-xs">
 Type 2+ characters to search. Click a result to select, then"Add Judge".
 </p>
 </div>

 {judgeError && <div className="mt-2 text-sm text-red-700 mb-4">{judgeError}</div>}
 {judgeSuccess && <div className="mb-4 text-sm text-[#22c55e]">✅ {judgeSuccess}</div>}

 {coiWarnings.length > 0 && (
 <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
 <strong>⚠️ Potential Conflict of Interest:</strong>
 <ul className="mt-1 mb-0 list-disc pl-5">
 {coiWarnings.map((c, i) => <li key={i}>{c}</li>)}
 </ul>
 <p className="mt-2 mb-0 text-xs text-amber-600">
 This is a warning only — the host can still proceed. Helping maintain show fairness per NAMHSA guidelines.
 </p>
 </div>
 )}

 {/* Judge List */}
 {judges.length === 0 ? (
 <div className="p-8 text-center text-stone-500">
 No judges assigned yet. Add judges by their user alias above.
 </div>
 ) : (
 <div className="flex flex-col gap-2">
 {judges.map((judge) => (
 <div
 key={judge.id}
 className="flex items-center gap-[var(--space-md)] rounded-sm bg-[rgb(250 250 249)] px-[var(--space-md)] py-[var(--space-sm)]"
 >
 <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-primary-glow)] text-base">
 {judge.avatarUrl ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={judge.avatarUrl}
 alt={judge.aliasName}
 className="h-full w-full object-cover"
 />
 ) : (
"🧑‍⚖️"
 )}
 </div>
 <div className="flex-1">
 <div className="text-sm font-semibold">@{judge.aliasName}</div>
 </div>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-xs font-semibold text-red-700 no-underline transition-all"
 onClick={() => handleRemoveJudge(judge.id)}
 >
 Remove
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>📋 Copy Division Tree From…</DialogTitle>
 <DialogDescription>
 This will copy all divisions and classes from the selected event. Existing divisions
 in this event will NOT be removed.
 </DialogDescription>
 </DialogHeader>
 {userEvents.length === 0 ? (
 <p className="text-stone-500">No other events found.</p>
 ) : (
 <>
 <select
 className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mb-4"
 value={selectedSourceEvent}
 onChange={(e) => setSelectedSourceEvent(e.target.value)}
 title="Source event"
 >
 <option value="">Select an event…</option>
 {userEvents.map((ev) => (
 <option key={ev.id} value={ev.id}>
 {ev.name}
 </option>
 ))}
 </select>
 <div className="flex justify-end gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setShowCopyModal(false)}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleCopy}
 disabled={!selectedSourceEvent}
 >
 Copy Classes
 </button>
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>
 </div>
 </ExplorerLayout>
 );
}
