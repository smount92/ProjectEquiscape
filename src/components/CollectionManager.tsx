"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { updateCollectionAction, deleteCollectionAction } from"@/app/actions/collections";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

 return (
 <>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 onClick={() => setShowModal(true)}
 >
 ⚙️ Manage Collection
 </button>

 <Dialog open={showModal} onOpenChange={setShowModal}>
 <DialogContent className="sm:max-w-[480px]">
 <DialogHeader>
 <DialogTitle>Manage Collection</DialogTitle>
 </DialogHeader>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Name</label>
 <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" />
 </div>
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">Description</label>
 <textarea
 className="inline-flex min-h-[36px] w-full resize-y rounded-md border border-input bg-transparent px-4 py-2 text-sm no-underline transition-all"
 rows={3}
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe this collection…"
 />
 </div>
 {error && (
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {error}
 </p>
 )}
 <div className="mt-6 flex justify-between">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-red-700 no-underline transition-all"
 onClick={handleDelete}
 disabled={saving}
 >
 🗑️ Delete
 </button>
 <div className="flex gap-2">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 onClick={() => setShowModal(false)}
 >
 Cancel
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleSave}
 disabled={saving || !name.trim()}
 >
 {saving ?"Saving…" :"Save"}
 </button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </>
 );
}
