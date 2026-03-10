"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCollectionAction, deleteCollectionAction } from "@/app/actions/collections";

interface CollectionManagerProps {
    collection: {
        id: string;
        name: string;
        description: string | null;
    };
}

export default function CollectionManager({ collection }: CollectionManagerProps) {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState(collection.name);
    const [description, setDescription] = useState(collection.description || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSave() {
        if (!name.trim()) return;
        setSaving(true);
        setError("");
        const result = await updateCollectionAction(collection.id, {
            name: name.trim(),
            description: description.trim() || undefined,
        });
        setSaving(false);
        if (result.success) {
            setShowModal(false);
            router.refresh();
        } else {
            setError(result.error || "Failed to update");
        }
    }

    async function handleDelete() {
        if (!confirm("Delete this collection? All horses will be unassigned (not deleted).")) return;
        setSaving(true);
        const result = await deleteCollectionAction(collection.id);
        setSaving(false);
        if (result.success) {
            router.push("/dashboard");
        } else {
            setError(result.error || "Failed to delete");
        }
    }

    if (!showModal) {
        return (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>
                ⚙️ Manage Collection
            </button>
        );
    }

    return (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <h3 style={{ marginBottom: "var(--space-lg)" }}>Manage Collection</h3>
                <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />
                </div>
                {error && <p className="form-error">{error}</p>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-lg)" }}>
                    <button className="btn btn-ghost" style={{ color: "red" }} onClick={handleDelete} disabled={saving}>
                        🗑️ Delete
                    </button>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
