"use client";

import { useState } from"react";
import { createPortal } from"react-dom";
import { useRouter } from"next/navigation";
import { updateCollectionAction, deleteCollectionAction } from"@/app/actions/collections";
import { Input } from "@/components/ui/input";

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
 const [description, setDescription] = useState(collection.description ||"");
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
 setError(result.error ||"Failed to update");
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
 setError(result.error ||"Failed to delete");
 }
 }

 if (!showModal) {
 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
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
 <Input  value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Description</label>
 <textarea
 className="inline-flex min-h-[36px] w-full resize-y rounded-md border border-edge bg-transparent px-4 py-2 text-sm no-underline transition-all"
 rows={3}
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe this collection…"
 />
 </div>
 {error && (
 <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
 {error}
 </p>
 )}
 <div className="mt-6 flex justify-between">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-danger no-underline transition-all"
 onClick={handleDelete}
 disabled={saving}
 >
 🗑️ Delete
 </button>
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setShowModal(false)}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleSave}
 disabled={saving || !name.trim()}
 >
 {saving ?"Saving…" :"Save"}
 </button>
 </div>
 </div>
 </div>
 </div>,
 document.body,
 );
}
