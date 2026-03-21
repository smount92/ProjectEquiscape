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
            <button
                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
                onClick={() => setShowModal(true)}
            >
                ⚙️ Manage Collection
            </button>
        );
    }

    return createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content max-w-[480] max-sm:max-w-full" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-6">Manage Collection</h3>
                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Name</label>
                    <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Description</label>
                    <textarea
                        className="min-h-[var(--inline-flex hover:no-underline-min-h)] leading-none-min-h)] text-ink bg-input border-edge-input block min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-4 px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150 outline-none"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{ resize: "vertical" }}
                    />
                </div>
                {error && (
                    <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
                        {error}
                    </p>
                )}
                <div className="mt-6 justify-between" style={{ display: "flex" }}>
                    <button
                        className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                        style={{ color: "red" }}
                        onClick={handleDelete}
                        disabled={saving}
                    >
                        🗑️ Delete
                    </button>
                    <div className="gap-2" style={{ display: "flex" }}>
                        <button
                            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
                            onClick={() => setShowModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                            onClick={handleSave}
                            disabled={saving || !name.trim()}
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
