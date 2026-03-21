"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addCommissionUpdate, updateCommissionStatus } from "@/app/actions/art-studio";
import type { CommissionUpdate } from "@/app/actions/art-studio";

const UPDATE_ICONS: Record<string, string> = {
    wip_photo: "📸",
    status_change: "🔄",
    message: "💬",
    revision_request: "✏️",
    approval: "✅",
    milestone: "🏆",
};

// Status transition rules (mirrors server-side VALID_TRANSITIONS)
const ARTIST_TRANSITIONS: Record<string, { label: string; emoji: string; style: "primary" | "ghost" | "danger" }[]> = {
    requested: [
        { label: "Accept", emoji: "✅", style: "primary" },
        { label: "Decline", emoji: "❌", style: "danger" },
    ],
    accepted: [
        { label: "Start Work", emoji: "🎨", style: "primary" },
        { label: "Awaiting Shipment", emoji: "📦", style: "ghost" },
        { label: "Cancel", emoji: "🚫", style: "danger" },
    ],
    in_progress: [
        { label: "Submit for Review", emoji: "📤", style: "primary" },
    ],
    revision: [
        { label: "Resume Work", emoji: "🎨", style: "primary" },
    ],
    review: [],  // Client actions handled separately
    completed: [
        { label: "Ship to Client", emoji: "📦", style: "primary" },
    ],
    shipping: [
        { label: "Model Received", emoji: "📥", style: "primary" },
        { label: "Mark Delivered", emoji: "✅", style: "primary" },
    ],
};

const TRANSITION_MAP: Record<string, string> = {
    "Accept": "accepted",
    "Decline": "declined",
    "Start Work": "in_progress",
    "Awaiting Shipment": "shipping",
    "Cancel": "cancelled",
    "Submit for Review": "review",
    "Resume Work": "in_progress",
    "Model Received": "in_progress",
    "Ship to Client": "shipping",
    "Mark Delivered": "delivered",
};

const STATUS_LABELS: Record<string, string> = {
    requested: "Requested",
    accepted: "Accepted",
    declined: "Declined",
    cancelled: "Cancelled",
    in_progress: "In Progress",
    review: "Under Review",
    revision: "Revision Requested",
    completed: "Completed",
    shipping: "Shipping",
    delivered: "Delivered",
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
            const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
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

            const { data: pubUrl } = supabase.storage
                .from("horse-images")
                .getPublicUrl(path);
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
        if (!body.trim() && !attachFile && updateType !== "approval") return;
        setSaving(true);
        setUploadError(null);

        // Upload photo if attached
        let imageUrls: string[] = [];
        if (attachFile) {
            const url = await uploadPhoto(attachFile);
            if (url) imageUrls = [url];
        }

        await addCommissionUpdate(commissionId, {
            updateType: updateType as "wip_photo" | "message" | "milestone" | "revision_request" | "approval",
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
        if (label === "Decline" || label === "Cancel") {
            if (!confirm(`Are you sure you want to ${label.toLowerCase()} this commission?`)) return;
        }

        setActing(true);
        await updateCommissionStatus(commissionId, newStatus, statusNote.trim() || undefined);
        setStatusNote("");
        router.refresh();
        setActing(false);
    };

    // ── Client review actions ──
    const handleClientAction = async (action: "revision_request" | "approval") => {
        setActing(true);
        if (action === "approval") {
            await updateCommissionStatus(commissionId, "completed");
        } else {
            await addCommissionUpdate(commissionId, {
                updateType: "revision_request",
                title: "Revision Requested",
                body: statusNote.trim() || "The client has requested revisions.",
            });
        }
        setStatusNote("");
        router.refresh();
        setActing(false);
    };

    // Available actions for current status
    const artistActions = isArtist ? (ARTIST_TRANSITIONS[commissionStatus] || []) : [];
    const isTerminal = ["delivered", "declined", "cancelled"].includes(commissionStatus);

    return (
        <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up p-6">
            {/* ── Header ── */}
            <div className="justify-between mb-6" style={{ display: "flex", alignItems: "center" }}>
                <h2 className="text-[calc(1.1rem*var(--font-scale))] m-0" >
                    📋 Timeline
                </h2>
                {(isArtist || isClient) && !isTerminal && !showForm && (
                    <button
                        className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                        onClick={() => setShowForm(true)}
                        style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                    >
                        + Add Update
                    </button>
                )}
            </div>

            {/* ── Artist Status Actions ── */}
            {isArtist && artistActions.length > 0 && (
                <div className="commission-actions-bar" style={{
                    padding: "var(--space-md)",
                    marginBottom: "var(--space-lg)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border)",
                }}>
                    <div className="text-[calc(0.8rem*var(--font-scale))] text-muted mb-2 font-semibold" >
                        🎨 Actions — {STATUS_LABELS[commissionStatus] || commissionStatus}
                    </div>
                    <div className="gap-2" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Optional note…"
                            value={statusNote}
                            onChange={e => setStatusNote(e.target.value)}
                            style={{ flex: 1, minWidth: 150, fontSize: "calc(0.8rem * var(--font-scale))" }}
                        />
                        {artistActions.map(action => (
                            <button
                                key={action.label}
                                className={`btn ${action.style === "primary" ? "btn-primary" : action.style === "danger" ? "btn-ghost" : "btn-ghost"}`}
                                onClick={() => handleStatusAction(action.label)}
                                disabled={acting}
                                style={{
                                    fontSize: "calc(0.8rem * var(--font-scale))",
                                    ...(action.style === "danger" ? { color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" } : {}),
                                }}
                            >
                                {action.emoji} {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Client Review Actions ── */}
            {isClient && commissionStatus === "review" && (
                <div className="commission-actions-bar" style={{
                    padding: "var(--space-md)",
                    marginBottom: "var(--space-lg)",
                    borderRadius: "var(--radius-lg)",
                    background: "rgba(139, 92, 246, 0.06)",
                    border: "1px solid rgba(139, 92, 246, 0.2)",
                }}>
                    <div className="text-[calc(0.85rem*var(--font-scale))] font-semibold mb-2" >
                        🔎 The artist has submitted this for your review
                    </div>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Add revision notes (optional)…"
                        value={statusNote}
                        onChange={e => setStatusNote(e.target.value)}
                        style={{ marginBottom: "var(--space-sm)", fontSize: "calc(0.8rem * var(--font-scale))" }}
                    />
                    <div className="gap-2" style={{ display: "flex" }}>
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                            onClick={() => handleClientAction("approval")}
                            disabled={acting}
                            style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                        >
                            ✅ Approve
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                            onClick={() => handleClientAction("revision_request")}
                            disabled={acting}
                            style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                        >
                            ✏️ Request Revision
                        </button>
                    </div>
                </div>
            )}

            {/* ── Add Update Form ── */}
            {showForm && (
                <form onSubmit={handleAddUpdate} className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all p-4 mb-6 bg-card">
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Update Type</label>
                        <select
                            className="form-input"
                            value={updateType}
                            onChange={e => setUpdateType(e.target.value)}
                        >
                            <option value="message">💬 Message</option>
                            <option value="wip_photo">📸 WIP Photo</option>
                            <option value="milestone">🏆 Milestone</option>
                        </select>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Title (optional)</label>
                        <input
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Base coat applied"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Details</label>
                        <textarea
                            className="form-input"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Describe the update…"
                            rows={3}
                        />
                    </div>

                    {/* Photo attachment — available for all update types */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">
                            📎 Attach Photo {updateType !== "wip_photo" && <span className="opacity-[0.6]" >(optional)</span>}
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="form-input"
                            onChange={e => setAttachFile(e.target.files?.[0] || null)}
                        />
                        {attachFile && (
                            <p className="text-[calc(0.75rem*var(--font-scale))] text-muted mt-[4]" >
                                📎 {attachFile.name} ({(attachFile.size / 1024).toFixed(0)} KB)
                            </p>
                        )}
                        {uploadError && (
                            <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm mt-[4]">{uploadError}</p>
                        )}
                    </div>

                    {isArtist && (
                        <label className="gap-1 text-[calc(0.8rem*var(--font-scale))] mb-2" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={isVisibleToClient}
                                onChange={e => setIsVisibleToClient(e.target.checked)}
                            />
                            Visible to client
                        </label>
                    )}

                    <div className="gap-2" style={{ display: "flex" }}>
                        <button type="submit" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm text-[calc(0.8rem*var(--font-scale))]" disabled={saving}>
                            {saving ? "Posting…" : "Post Update"}
                        </button>
                        <button type="button" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge text-[calc(0.8rem*var(--font-scale))]" onClick={() => { setShowForm(false); setUploadError(null); }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* ── Timeline Events ── */}
            {updates.length === 0 ? (
                <p className="text-muted p-6" style={{ textAlign: "center" }}>
                    No updates yet.
                </p>
            ) : (
                <div className="grid gap-4">
                    {updates.map(update => (
                        <div key={update.id} className="commission-relative pb-6">
                            <div className="grid gap-4-dot">
                                {UPDATE_ICONS[update.updateType] || "📋"}
                            </div>
                            <div className="grid gap-4-content">
                                <div className="justify-between items-start" style={{ display: "flex" }}>
                                    <div>
                                        {update.title && (
                                            <div className="font-bold text-[calc(0.9rem*var(--font-scale))]" >
                                                {update.title}
                                            </div>
                                        )}
                                        <div className="text-[calc(0.75rem*var(--font-scale))] text-muted mt-[2]" >
                                            @{update.authorAlias} · {new Date(update.createdAt).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                            })}
                                            {!update.isVisibleToClient && isArtist && (
                                                <span className="ml-[6] opacity-[0.5]" >🔒 Private</span>
                                            )}
                                        </div>
                                    </div>
                                    {update.requiresPayment && (
                                        <span className="text-[calc(0.7rem*var(--font-scale))] text-[var(--color-accent-warm)] font-semibold" >
                                            💰 Payment Due
                                        </span>
                                    )}
                                </div>
                                {update.body && (
                                    <p className="mt-1 leading-normal whitespace-pre-wrap text-[calc(0.85rem*var(--font-scale))]" >
                                        {update.body}
                                    </p>
                                )}
                                {/* ── Render attached images ── */}
                                {update.imageUrls && update.imageUrls.length > 0 && (
                                    <div style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "var(--space-sm)",
                                        marginTop: "var(--space-sm)",
                                    }}>
                                        {update.imageUrls.map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: "block",
                                                    borderRadius: "var(--radius-md)",
                                                    overflow: "hidden",
                                                    border: "1px solid var(--color-border)",
                                                    maxWidth: 280,
                                                }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={url}
                                                    alt={`${update.updateType === "wip_photo" ? "WIP" : "Attached"} photo ${idx + 1}`}
                                                    style={{
                                                        width: "100%",
                                                        height: "auto",
                                                        display: "block",
                                                        maxHeight: 220,
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {update.oldStatus && update.newStatus && (
                                    <div className="mt-1 text-[calc(0.8rem*var(--font-scale))] text-muted" >
                                        {STATUS_LABELS[update.oldStatus] || update.oldStatus} → <strong>{STATUS_LABELS[update.newStatus] || update.newStatus}</strong>
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
