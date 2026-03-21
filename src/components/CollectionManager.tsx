"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={() => setShowModal(true)}>
                ⚙️ Manage Collection
            </button>
        );
    }

    return createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content max-sm:max-w-full" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <h3 style={{ marginBottom: "var(--space-lg)" }}>Manage Collection</h3>
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1">Name</label>
                    <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1">Description</label>
                    <textarea className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />
                </div>
                {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-lg)" }}>
                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" style={{ color: "red" }} onClick={handleDelete} disabled={saving}>
                        🗑️ Delete
                    </button>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={handleSave} disabled={saving || !name.trim()}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body);
}
