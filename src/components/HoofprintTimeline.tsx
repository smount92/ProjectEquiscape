"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import Link from"next/link";
import { motion } from"framer-motion";
import { addTimelineEvent, deleteTimelineEvent, updateLifeStage } from"@/app/actions/hoofprint";
import type { TimelineEvent, OwnershipRecord } from"@/app/actions/hoofprint";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface HoofprintTimelineProps {
 horseId: string;
 timeline: TimelineEvent[];
 ownershipChain: OwnershipRecord[];
 lifeStage: string;
 isOwner: boolean;
 currentUserId?: string;
}

const EVENT_ICONS: Record<string, string> = {
 acquired:"🏠",
 stage_update:"🎨",
 customization:"✂️",
 photo_update:"📸",
 show_result:"🏆",
 listed:"💲",
 sold:"🤝",
 transferred:"📦",
 note:"📝",
 status_change:"🔒",
 condition_change:"📊",
};

const STAGE_LABELS: Record<string, string> = {
 blank:"Blank / Unpainted",
 stripped:"Stripped / Body",
 in_progress:"Work in Progress",
 completed:"Completed",
 for_sale:"Listed for Sale",
 parked:"Parked — Off-Platform Sale",
};

const STAGE_ICONS: Record<string, string> = {
 blank:"🎨",
 stripped:"🛁",
 in_progress:"🔧",
 completed:"✅",
 for_sale:"💲",
 parked:"🔒",
};

export default function HoofprintTimeline({
 horseId,
 timeline,
 ownershipChain,
 lifeStage,
 isOwner,
 currentUserId,
}: HoofprintTimelineProps) {
 const router = useRouter();
 const [showForm, setShowForm] = useState(false);
 const [formState, setFormState] = useState({
 title:"",
 description:"",
 });
 const [saving, setSaving] = useState(false);
 const [stageUpdating, setStageUpdating] = useState(false);

 const handleAddEvent = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!formState.title.trim()) return;
 setSaving(true);
 const result = await addTimelineEvent({
 horseId,
 eventType:"note",
 title: formState.title.trim(),
 description: formState.description.trim() || undefined,
 });
 if (result.success) {
 setFormState({ title:"", description:"" });
 setShowForm(false);
 router.refresh();
 }
 setSaving(false);
 };

 const handleDelete = async (eventId: string) => {
 if (!confirm("Delete this timeline event?")) return;
 await deleteTimelineEvent(eventId, horseId);
 router.refresh();
 };

 const handleStageChange = async (newStage: string) => {
 setStageUpdating(true);
 await updateLifeStage(horseId, newStage as"blank" |"stripped" |"in_progress" |"completed" |"for_sale");
 router.refresh();
 setStageUpdating(false);
 };

 return (
 <div className="mt-8">
 {/* Header */}
 <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <h2 className="text-xl font-bold">
 🐾 <span className="text-forest">Hoofprint™</span>
 </h2>
 <span className={`hoofprint-stage-badge stage-${lifeStage}`}>
 {STAGE_ICONS[lifeStage] ||"📋"} {STAGE_LABELS[lifeStage] || lifeStage}
 </span>
 </div>
 <div className="flex items-center gap-2">
 {isOwner && (
 <>
 <select
 className="flex h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-auto min-w-[140px] text-sm"
 value={lifeStage}
 onChange={(e) => handleStageChange(e.target.value)}
 disabled={stageUpdating}
 title="Life stage"
 >
 <option value="blank">🎨 Blank</option>
 <option value="stripped">🛁 Stripped / Body</option>
 <option value="in_progress">🔧 In Progress</option>
 <option value="completed">✅ Completed</option>
 <option value="for_sale">💲 For Sale</option>
 </select>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setShowForm(!showForm)}
 >
 {showForm ?"Cancel" :"📝 Add Note"}
 </button>
 </>
 )}
 </div>
 </div>

 {/* Ownership Chain */}
 {ownershipChain.length > 0 && (
 <div className="bg-stone-50 border-[rgb(245 245 244)] mb-6 flex flex-wrap items-center gap-2 rounded-lg border p-4">
 <span className="text-stone-500 mr-1 text-xs">Chain of Custody:</span>
 {ownershipChain.map((owner, i) => (
 <span key={owner.id} className="inline-flex items-center gap-1">
 {i > 0 && <span className="text-stone-500 text-[0.8rem]">→</span>}
 {owner.ownerId ? (
 <Link
 href={`/profile/${encodeURIComponent(owner.ownerAlias)}`}
 className={`ownership-link ${!owner.releasedAt ?"current" :""}`}
 >
 @{owner.ownerAlias}
 <span className="text-[0.6rem] opacity-[0.7]">
 {owner.acquisitionType !=="original" ? ` (${owner.acquisitionType})` :""}
 </span>
 </Link>
 ) : (
 <span className="border-[var(--color-accent, #f59e0b)] border">{owner.ownerAlias}</span>
 )}
 </span>
 ))}
 </div>
 )}

 {/* Add Event Form */}
 {showForm && (
 <form
 onSubmit={handleAddEvent}
 className="bg-stone-50 border-[rgb(245 245 244)] mb-6 rounded-lg border p-4"
 >
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Title</label>
 <Input
 type="text"
 
 value={formState.title}
 onChange={(e) => setFormState({ ...formState, title: e.target.value })}
 placeholder="e.g. Won 1st at Breyerfest 2025"
 required
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Description (optional)</label>
 <Textarea
 
 value={formState.description}
 onChange={(e) => setFormState({ ...formState, description: e.target.value })}
 placeholder="Add details..."
 rows={2}
 />
 </div>
 <div className="mt-2 flex items-center gap-4">
 <span className="text-stone-500 text-xs">📝 Notes appear on the Hoofprint™ timeline</span>
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all ml-auto"
 disabled={saving}
 >
 {saving ?"Saving…" :"Add Note"}
 </button>
 </div>
 </form>
 )}

 {/* Timeline */}
 {timeline.length === 0 ? (
 <div className="text-stone-500 p-8 text-center">
 <p>🐾 No timeline events yet.</p>
 {isOwner && (
 <p className="text-sm">
 Add events to build this horse&apos;s Hoofprint!
 </p>
 )}
 </div>
 ) : (
 <motion.div
  className="relative pl-[32px]"
  initial="hidden"
  animate="visible"
  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
 >
 {timeline.map((event) => (
 <motion.div key={event.id} className="relative pb-6" variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 200, damping: 25 } } }}>
 <div className="pb-6-dot relative">{EVENT_ICONS[event.eventType] ||"📋"}</div>
 <div className="flex items-start justify-between">
 <div>
 <div className="pb-6-title relative">
 {event.title}
 {!event.isPublic && (
 <span className="ml-[6px] text-[0.65rem] opacity-[0.5]">🔒 Private</span>
 )}
 </div>
 <div className="pb-6-meta relative">
 {event.eventDate &&
 new Date(event.eventDate).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 })}
 {" ·"}by @{event.userAlias}
 </div>
 {event.description && <div className="pb-6-desc relative">{event.description}</div>}
 </div>
 {/* Only user-authored notes (from posts) can be deleted */}
 {isOwner &&
 currentUserId &&
 event.userId === currentUserId &&
 event.sourceTable ==="posts" && (
 <button
 className="text-[0.7rem] p-[2px_6px] opacity-50"
 onClick={() => handleDelete(event.id)}
 title="Delete note"
 >
 🗑
 </button>
 )}
 </div>
 </motion.div>
 ))}
 </motion.div>
 )}
 </div>
 );
}
