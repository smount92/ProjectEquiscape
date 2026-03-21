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
        <div className="card animate-fade-in-up" style={{ padding: "var(--space-lg)" }}>
            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
                <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", margin: 0 }}>
                    📋 Timeline
                </h2>
                {(isArtist || isClient) && !isTerminal && !showForm && (
                    <button
                        className="btn btn-primary"
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
                    <div style={{ fontSize: "calc(0.8rem * var(--font-scale))", color: "var(--color-text-muted)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>
                        🎨 Actions — {STATUS_LABELS[commissionStatus] || commissionStatus}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
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
                    <div style={{ fontSize: "calc(0.85rem * var(--font-scale))", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
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
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleClientAction("approval")}
                            disabled={acting}
                            style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                        >
                            ✅ Approve
                        </button>
                        <button
                            className="btn btn-ghost"
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
                <form onSubmit={handleAddUpdate} className="card" style={{ padding: "var(--space-md)", marginBottom: "var(--space-lg)", background: "var(--color-bg-card)" }}>
                    <div className="form-group">
                        <label className="form-label">Update Type</label>
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

                    <div className="form-group">
                        <label className="form-label">Title (optional)</label>
                        <input
                            type="text"
                            className="form-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Base coat applied"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Details</label>
                        <textarea
                            className="form-input"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Describe the update…"
                            rows={3}
                        />
                    </div>

                    {/* Photo attachment — available for all update types */}
                    <div className="form-group">
                        <label className="form-label">
                            📎 Attach Photo {updateType !== "wip_photo" && <span style={{ opacity: 0.6 }}>(optional)</span>}
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="form-input"
                            onChange={e => setAttachFile(e.target.files?.[0] || null)}
                        />
                        {attachFile && (
                            <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 4 }}>
                                📎 {attachFile.name} ({(attachFile.size / 1024).toFixed(0)} KB)
                            </p>
                        )}
                        {uploadError && (
                            <p className="form-error" style={{ marginTop: 4 }}>{uploadError}</p>
                        )}
                    </div>

                    {isArtist && (
                        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: "calc(0.8rem * var(--font-scale))", marginBottom: "var(--space-sm)", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={isVisibleToClient}
                                onChange={e => setIsVisibleToClient(e.target.checked)}
                            />
                            Visible to client
                        </label>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            {saving ? "Posting…" : "Post Update"}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setUploadError(null); }} style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* ── Timeline Events ── */}
            {updates.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "var(--space-lg)" }}>
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
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        {update.title && (
                                            <div style={{ fontWeight: 700, fontSize: "calc(0.9rem * var(--font-scale))" }}>
                                                {update.title}
                                            </div>
                                        )}
                                        <div style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 2 }}>
                                            @{update.authorAlias} · {new Date(update.createdAt).toLocaleDateString("en-US", {
                                                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                            })}
                                            {!update.isVisibleToClient && isArtist && (
                                                <span style={{ marginLeft: 6, opacity: 0.5 }}>🔒 Private</span>
                                            )}
                                        </div>
                                    </div>
                                    {update.requiresPayment && (
                                        <span style={{ fontSize: "calc(0.7rem * var(--font-scale))", color: "var(--color-accent-warm)", fontWeight: 600 }}>
                                            💰 Payment Due
                                        </span>
                                    )}
                                </div>
                                {update.body && (
                                    <p style={{ marginTop: "var(--space-xs)", lineHeight: 1.5, whiteSpace: "pre-wrap", fontSize: "calc(0.85rem * var(--font-scale))" }}>
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
                                    <div style={{ marginTop: "var(--space-xs)", fontSize: "calc(0.8rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
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
