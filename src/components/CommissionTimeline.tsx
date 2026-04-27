"use client";

import { useState, useRef, useEffect } from"react";
import { useRouter } from"next/navigation";
import { createClient } from"@/lib/supabase/client";
import { addCommissionUpdate, updateCommissionStatus } from"@/app/actions/art-studio";
import type { CommissionUpdate } from"@/app/actions/art-studio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/social";

const UPDATE_ICONS: Record<string, string> = {
 wip_photo:"📸",
 status_change:"🔄",
 message:"💬",
 revision_request:"✏️",
 approval:"✅",
 milestone:"🏆",
};

// Status transition rules (mirrors server-side VALID_TRANSITIONS)
const ARTIST_TRANSITIONS: Record<string, { label: string; emoji: string; style:"primary" |"ghost" |"danger" }[]> = {
 requested: [
 { label:"Accept", emoji:"✅", style:"primary" },
 { label:"Decline", emoji:"❌", style:"danger" },
 ],
 accepted: [
 { label:"Start Work", emoji:"🎨", style:"primary" },
 { label:"Awaiting Shipment", emoji:"📦", style:"ghost" },
 { label:"Cancel", emoji:"🚫", style:"danger" },
 ],
 in_progress: [{ label:"Submit for Review", emoji:"📤", style:"primary" }],
 revision: [{ label:"Resume Work", emoji:"🎨", style:"primary" }],
 review: [], // Client actions handled separately
 completed: [{ label:"Ship to Client", emoji:"📦", style:"primary" }],
 shipping: [
 { label:"Model Received", emoji:"📥", style:"primary" },
 { label:"Mark Delivered", emoji:"✅", style:"primary" },
 ],
};

const TRANSITION_MAP: Record<string, string> = {
 Accept:"accepted",
 Decline:"declined",
"Start Work":"in_progress",
"Awaiting Shipment":"shipping",
 Cancel:"cancelled",
"Submit for Review":"review",
"Resume Work":"in_progress",
"Model Received":"in_progress",
"Ship to Client":"shipping",
"Mark Delivered":"delivered",
};

const STATUS_LABELS: Record<string, string> = {
 requested:"Requested",
 accepted:"Accepted",
 declined:"Declined",
 cancelled:"Cancelled",
 in_progress:"In Progress",
 review:"Under Review",
 revision:"Revision Requested",
 completed:"Completed",
 shipping:"Shipping",
 delivered:"Delivered",
};

export default function CommissionTimeline({
 commissionId,
 updates,
 isArtist,
 isClient,
 commissionStatus,
}: {
 commissionId: string;
 updates: CommissionUpdate[];
 isArtist: boolean;
 isClient: boolean;
 commissionStatus: string;
}) {
 const router = useRouter();
 const [showForm, setShowForm] = useState(false);
 const [updateType, setUpdateType] = useState<string>("message");
 const [title, setTitle] = useState("");
 const [body, setBody] = useState("");
 const [isVisibleToClient, setIsVisibleToClient] = useState(true);
 const [saving, setSaving] = useState(false);
 const [acting, setActing] = useState(false);
 const [statusNote, setStatusNote] = useState("");
 const [attachFile, setAttachFile] = useState<File | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const [userId, setUserId] = useState<string | null>(null);

 // Fetch current user ID for storage path
 useEffect(() => {
 const supabase = createClient();
 supabase.auth.getUser().then(({ data: { user } }) => {
 if (user) setUserId(user.id);
 });
 }, []);

 // ── Upload photo to storage ──
 const uploadPhoto = async (file: File): Promise<string | null> => {
 if (!userId) return null;
 try {
 const supabase = createClient();
 const ext = file.name.split(".").pop()?.toLowerCase() ||"webp";
 // Path must match storage RLS: {userId}/commissions/{filename}
 const path = `${userId}/commissions/${commissionId}_${Date.now()}.${ext}`;
 const { error: upErr } = await supabase.storage
 .from("horse-images")
 .upload(path, file, { contentType: file.type });

 if (upErr) {
 console.error("WIP upload failed:", upErr.message);
 setUploadError(`Upload failed: ${upErr.message}`);
 return null;
 }

 const { data: pubUrl } = supabase.storage.from("horse-images").getPublicUrl(path);
 return pubUrl.publicUrl;
 } catch (err) {
 console.error("WIP upload error:", err);
 setUploadError("Upload failed unexpectedly.");
 return null;
 }
 };

 // ── Post an update (message, WIP, milestone) ──
 const handleAddUpdate = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!body.trim() && !attachFile && updateType !=="approval") return;
 setSaving(true);
 setUploadError(null);

 // Upload photo if attached
 let imageUrls: string[] = [];
 if (attachFile) {
 const url = await uploadPhoto(attachFile);
 if (url) imageUrls = [url];
 }

 await addCommissionUpdate(commissionId, {
 updateType: updateType as"wip_photo" |"message" |"milestone" |"revision_request" |"approval",
 title: title.trim() || undefined,
 body: body.trim() || undefined,
 imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
 isVisibleToClient,
 });

 setShowForm(false);
 setTitle("");
 setBody("");
 setAttachFile(null);
 setSaving(false);
 router.refresh();
 };

 // ── Artist status transition ──
 const handleStatusAction = async (label: string) => {
 const newStatus = TRANSITION_MAP[label];
 if (!newStatus) return;

 // Confirmation for destructive actions
 if (label ==="Decline" || label ==="Cancel") {
 if (!confirm(`Are you sure you want to ${label.toLowerCase()} this commission?`)) return;
 }

 setActing(true);
 await updateCommissionStatus(commissionId, newStatus, statusNote.trim() || undefined);
 setStatusNote("");
 router.refresh();
 setActing(false);
 };

 // ── Client review actions ──
 const handleClientAction = async (action:"revision_request" |"approval") => {
 setActing(true);
 if (action ==="approval") {
 await updateCommissionStatus(commissionId,"completed");
 } else {
 await addCommissionUpdate(commissionId, {
 updateType:"revision_request",
 title:"Revision Requested",
 body: statusNote.trim() ||"The client has requested revisions.",
 });
 }
 setStatusNote("");
 router.refresh();
 setActing(false);
 };

 // Available actions for current status
 const artistActions = isArtist ? ARTIST_TRANSITIONS[commissionStatus] || [] : [];
 const isTerminal = ["delivered","declined","cancelled"].includes(commissionStatus);

 return (
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border p-6 shadow-md transition-all">
 {/* ── Header ── */}
 <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
 <h2 className="m-0 text-lg">📋 Timeline</h2>
 {(isArtist || isClient) && !isTerminal && !showForm && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => setShowForm(true)}
 >
 + Add Update
 </button>
 )}
 </div>

 {/* ── Artist Status Actions ── */}
 {isArtist && artistActions.length > 0 && (
 <div
 className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-parchment p-4"
 >
 <div className="text-muted mb-2 text-sm font-semibold">
 🎨 Actions — {STATUS_LABELS[commissionStatus] || commissionStatus}
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Input
 type="text"
 className="min-w-[150px] flex-1 text-sm"
 placeholder="Optional note…"
 value={statusNote}
 onChange={(e) => setStatusNote(e.target.value)}
 />
 {artistActions.map((action) => (
 <button
 key={action.label}
 className={`btn ${action.style === "primary" ? "btn-primary" : "btn-ghost"} text-sm ${
 action.style === "danger" ? "text-red-700 border-red-200" : ""
 }`}
 onClick={() => handleStatusAction(action.label)}
 disabled={acting}
 >
 {action.emoji} {action.label}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* ── Client Review Actions ── */}
 {isClient && commissionStatus ==="review" && (
 <div
 className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-purple-200 bg-purple-50/50 p-4"
 >
 <div className="mb-2 text-sm font-semibold">
 🔎 The artist has submitted this for your review
 </div>
 <Input
 type="text"
 className="mb-2 text-sm"
 placeholder="Add revision notes (optional)…"
 value={statusNote}
 onChange={(e) => setStatusNote(e.target.value)}
 />
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={() => handleClientAction("approval")}
 disabled={acting}
 >
 ✅ Approve
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-muted no-underline transition-all"
 onClick={() => handleClientAction("revision_request")}
 disabled={acting}
 >
 ✏️ Request Revision
 </button>
 </div>
 </div>
 )}

 {/* ── Add Update Form ── */}
 {showForm && (
 <form
 onSubmit={handleAddUpdate}
 className="bg-card border-edge mb-6 rounded-lg border p-4 shadow-md transition-all"
 >
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Update Type</label>
 <select
 className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={updateType}
 onChange={(e) => setUpdateType(e.target.value)}
 title="Update type"
 >
 <option value="message">💬 Message</option>
 <option value="wip_photo">📸 WIP Photo</option>
 <option value="milestone">🏆 Milestone</option>
 </select>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Title (optional)</label>
 <Input
 type="text"
 
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. Base coat applied"
 />
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Details</label>
 <Textarea
 
 value={body}
 onChange={(e) => setBody(e.target.value)}
 placeholder="Describe the update…"
 rows={3}
 />
 </div>

 {/* Photo attachment — available for all update types */}
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 📎 Attach Photo{""}
 {updateType !=="wip_photo" && <span className="opacity-[0.6]">(optional)</span>}
 </label>
 <Input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 
 onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
 title="Attach photo"
 />
 {attachFile && (
 <p className="text-muted mt-[4] text-xs">
 📎 {attachFile.name} ({(attachFile.size / 1024).toFixed(0)} KB)
 </p>
 )}
 {uploadError && (
 <p className="text-red-700 mt-2 mt-[4] flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {uploadError}
 </p>
 )}
 </div>

 {isArtist && (
 <label
 className="mb-2 flex cursor-pointer items-center gap-1 text-sm"
 >
 <Input
 type="checkbox"
 checked={isVisibleToClient}
 onChange={(e) => setIsVisibleToClient(e.target.checked)}
 />
 Visible to client
 </label>
 )}

 <div className="flex gap-2">
 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 disabled={saving}
 >
 {saving ?"Posting…" :"Post Update"}
 </button>
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-muted no-underline transition-all"
 onClick={() => {
 setShowForm(false);
 setUploadError(null);
 }}
 >
 Cancel
 </button>
 </div>
 </form>
 )}

 {/* ── Timeline Events ── */}
 {updates.length === 0 ? (
 <p className="text-muted p-6 text-center">
 No updates yet.
 </p>
 ) : (
 <div className="grid gap-4">
 {updates.map((update) => (
 <div key={update.id} className="commission-relative pb-6">
 <div className="gap-4-dot grid">{UPDATE_ICONS[update.updateType] ||"📋"}</div>
 <div className="gap-4-content grid">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-2.5">
 <UserAvatar
 src={update.authorAvatarUrl}
 alias={update.authorAlias}
 size="sm"
 href={`/profile/${encodeURIComponent(update.authorAlias)}`}
 />
 <div>
 {update.title && (
 <div className="text-sm font-bold text-ink">
 {update.title}
 </div>
 )}
 <div className="text-muted mt-[2] text-xs">
 @{update.authorAlias} ·{""}
 {new Date(update.createdAt).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 hour:"2-digit",
 minute:"2-digit",
 })}
 {!update.isVisibleToClient && isArtist && (
 <span className="ml-[6] opacity-[0.5]">🔒 Private</span>
 )}
 </div>
 </div>
 </div>
 {update.requiresPayment && (
 <span className="text-xs font-semibold text-amber-500">
 💰 Payment Due
 </span>
 )}
 </div>
 {update.body && (
 <p className="mt-1 text-sm leading-normal whitespace-pre-wrap">
 {update.body}
 </p>
 )}
 {/* ── Render attached images ── */}
 {update.imageUrls && update.imageUrls.length > 0 && (
 <div
 className="mt-2 flex flex-wrap gap-2"
 >
 {update.imageUrls.map((url, idx) => (
 <a
 key={idx}
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="block max-w-[280px] overflow-hidden rounded-md border border-edge"
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={url}
 alt={`${update.updateType ==="wip_photo" ?"WIP" :"Attached"} photo ${idx + 1}`}
 className="block h-auto max-h-[220px] w-full object-cover"
 />
 </a>
 ))}
 </div>
 )}
 {update.oldStatus && update.newStatus && (
 <div className="text-muted mt-1 text-sm">
 {STATUS_LABELS[update.oldStatus] || update.oldStatus} →{""}
 <strong>{STATUS_LABELS[update.newStatus] || update.newStatus}</strong>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
