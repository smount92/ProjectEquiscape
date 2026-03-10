"use client";

import { useState, useRef } from "react";
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
    const [wipFile, setWipFile] = useState<File | null>(null);
    const wipInputRef = useRef<HTMLInputElement>(null);

    const handleAddUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim() && updateType !== "approval") return;
        setSaving(true);

        let photoUrl: string | undefined;
        if (updateType === "wip_photo" && wipFile) {
            try {
                const supabase = createClient();
                const ext = wipFile.name.split('.').pop() || 'webp';
                const path = `wip/${commissionId}/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from("horse-images").upload(path, wipFile);
                if (!uploadError) {
                    const { data: pubUrl } = supabase.storage.from("horse-images").getPublicUrl(path);
                    photoUrl = pubUrl.publicUrl;
                }
            } catch { /* upload is best-effort */ }
        }

        await addCommissionUpdate(commissionId, {
            updateType: updateType as "wip_photo" | "message" | "milestone" | "revision_request" | "approval",
            title: title.trim() || undefined,
            body: photoUrl ? `${body.trim()}\n\n![WIP](${photoUrl})` : (body.trim() || undefined),
            isVisibleToClient,
        });

        setShowForm(false);
        setTitle("");
        setBody("");
        setWipFile(null);
        setSaving(false);
        router.refresh();
    };

    const handleClientAction = async (action: "revision_request" | "approval") => {
        setActing(true);
        if (action === "approval") {
            await updateCommissionStatus(commissionId, "completed");
        } else {
            await addCommissionUpdate(commissionId, {
                updateType: "revision_request",
                title: "Revision Requested",
                body: "The client has requested revisions.",
            });
            // Artist handles the status transition from their end
        }
        router.refresh();
        setActing(false);
    };

    return (
        <div className="card animate-fade-in-up" style={{ padding: "var(--space-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
                <h2 style={{ fontSize: "calc(1.1rem * var(--font-scale))", margin: 0 }}>
                    📋 Timeline
                </h2>
                <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                    {(isArtist || isClient) && !showForm && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowForm(true)}
                            style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}
                        >
                            + Add Update
                        </button>
                    )}
                    {isClient && commissionStatus === "review" && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {/* Add Update Form */}
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

                    {updateType === "wip_photo" && (
                        <div className="form-group">
                            <label className="form-label">Attach Photo</label>
                            <input
                                ref={wipInputRef}
                                type="file"
                                accept="image/*"
                                className="form-input"
                                onChange={e => setWipFile(e.target.files?.[0] || null)}
                            />
                            {wipFile && (
                                <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: 4 }}>
                                    📎 {wipFile.name}
                                </p>
                            )}
                        </div>
                    )}

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
                        <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ fontSize: "calc(0.8rem * var(--font-scale))" }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Timeline Events */}
            {updates.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "var(--space-lg)" }}>
                    No updates yet.
                </p>
            ) : (
                <div className="commission-timeline">
                    {updates.map(update => (
                        <div key={update.id} className="commission-timeline-event">
                            <div className="commission-timeline-dot">
                                {UPDATE_ICONS[update.updateType] || "📋"}
                            </div>
                            <div className="commission-timeline-content">
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
                                {update.oldStatus && update.newStatus && (
                                    <div style={{ marginTop: "var(--space-xs)", fontSize: "calc(0.8rem * var(--font-scale))", color: "var(--color-text-muted)" }}>
                                        {update.oldStatus} → <strong>{update.newStatus}</strong>
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
