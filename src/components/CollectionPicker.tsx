"use client";

import { useState, useEffect, useRef } from"react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getCollectionsAction, createCollectionAction } from"@/app/actions/collections";
import { Input } from "@/components/ui/input";

interface Collection {
 id: string;
 name: string;
 description: string | null;
}

interface CollectionPickerProps {
 selectedCollectionIds: string[];
 onSelect: (ids: string[]) => void;
}

export default function CollectionPicker({ selectedCollectionIds, onSelect }: CollectionPickerProps) {
 const [collections, setCollections] = useState<Collection[]>([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [newName, setNewName] = useState("");
 const [newDesc, setNewDesc] = useState("");
 const [newIsPublic, setNewIsPublic] = useState(false);
 const [creating, setCreating] = useState(false);
 const nameInputRef = useRef<HTMLInputElement>(null);

 // Fetch user's collections
 useEffect(() => {
 async function fetchCollections() {
 try {
 const data = await getCollectionsAction();
 setCollections((data as Collection[]) ?? []);
 } catch (err) {
 console.error("Failed to load collections:", err);
 } finally {
 setLoading(false);
 }
 }
 fetchCollections();
 }, []);

 // Focus name input when modal opens
 useEffect(() => {
 if (showModal && nameInputRef.current) {
 setTimeout(() => nameInputRef.current?.focus(), 100);
 }
 }, [showModal]);

 const handleCreate = async () => {
 if (!newName.trim()) return;
 setCreating(true);

 try {
 const result = await createCollectionAction(newName.trim(), newDesc.trim() || null, newIsPublic);

 if (result.success && result.data) {
 const newCollection = result.data as Collection;
 setCollections((prev) => [...prev, newCollection].sort((a, b) => a.name.localeCompare(b.name)));
 // Auto-select the new collection
 onSelect([...selectedCollectionIds, newCollection.id]);
 setShowModal(false);
 setNewName("");
 setNewDesc("");
 setNewIsPublic(false);
 } else {
 console.error("Failed to create collection:", result.error);
 }
 } catch (err) {
 console.error(err);
 } finally {
 setCreating(false);
 }
 };

 const handleToggle = (collectionId: string) => {
 if (selectedCollectionIds.includes(collectionId)) {
 onSelect(selectedCollectionIds.filter((id) => id !== collectionId));
 } else {
 onSelect([...selectedCollectionIds, collectionId]);
 }
 };

 const selectedNames = collections.filter((c) => selectedCollectionIds.includes(c.id)).map((c) => c.name);

 return (
 <div className="mb-6">
 <label className="text-foreground mb-1 block text-sm font-semibold">
 📁 Collections <span className="font-normal opacity-[0.6]">(Optional — multi-select)</span>
 </label>

 {loading ? (
 <div className="text-muted-foreground text-sm">Loading collections…</div>
 ) : collections.length === 0 ? (
 <div className="text-muted-foreground mb-2 text-sm">No collections yet. Create one to organize your models.</div>
 ) : (
 <div
 className="flex max-h-[180px] flex-col gap-1 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-input,rgb(250 250 249))] p-2"
 >
 {collections.map((c) => (
 <label
 key={c.id}
 className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-[background] duration-150 ${
 selectedCollectionIds.includes(c.id)
 ? "bg-emerald-100/70"
 : "bg-transparent"
 }`}
 >
 <Input
 type="checkbox"
 checked={selectedCollectionIds.includes(c.id)}
 onChange={() => handleToggle(c.id)}
 className="h-4 w-4 shrink-0 accent-[var(--color-accent-primary)]"
 />
 <span
 className={`text-sm ${selectedCollectionIds.includes(c.id) ? "font-semibold" : "font-normal"}`}
 >
 📁 {c.name}
 </span>
 </label>
 ))}
 </div>
 )}

 <div className="mt-2 flex items-center gap-2">
 {selectedNames.length > 0 && (
 <div
 className="text-xs font-medium text-[var(--color-accent-primary)]"
 >
 ✓ In: {selectedNames.join(",")}
 </div>
 )}
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 onClick={() => setShowModal(true)}
 aria-label="Create new collection"
 id="create-collection-btn"
 >
 + New
 </button>
 </div>

 <span className="text-muted-foreground mt-1 block text-xs">
 Organize your models into collections like &quot;Childhood Herd&quot;, &quot;Show String&quot;, or
 &quot;Wishlist&quot;.
 </span>

 {/* ---- Create Collection Modal ---- */}
 <Dialog open={showModal} onOpenChange={setShowModal}>
 <DialogContent className="sm:max-w-[480px]">
 <DialogHeader>
 <DialogTitle>📁 New Collection</DialogTitle>
 </DialogHeader>

 <div className="flex flex-col gap-4">
 <div>
 <label
 htmlFor="new-collection-name"
 className="text-foreground mb-1 block text-sm font-semibold"
 >
 Collection Name *
 </label>
 <Input
 ref={nameInputRef}
 id="new-collection-name"
 type="text"
 placeholder="e.g. Childhood Herd, Show String…"
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 maxLength={60}
 onKeyDown={(e) => {
 if (e.key ==="Enter") handleCreate();
 }}
 />
 </div>

 <div>
 <label
 htmlFor="new-collection-desc"
 className="text-foreground mb-1 block text-sm font-semibold"
 >
 Description <span className="opacity-[0.6]">(Optional)</span>
 </label>
 <Input
 id="new-collection-desc"
 type="text"
 placeholder="A short note about this collection…"
 value={newDesc}
 onChange={(e) => setNewDesc(e.target.value)}
 maxLength={200}
 />
 </div>

 <div className="flex items-center gap-2">
 <Input
 id="new-collection-public"
 type="checkbox"
 checked={newIsPublic}
 onChange={(e) => setNewIsPublic(e.target.checked)}
 className="h-4 w-4"
 />
 <label
 htmlFor="new-collection-public"
 className="text-foreground m-0 block text-sm font-semibold"
 >
 🌐 Make public on profile
 </label>
 </div>
 </div>

 <div className="flex justify-end gap-4 pt-2">
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
 onClick={() => setShowModal(false)}
 >
 Cancel
 </button>
 <button
 type="button"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleCreate}
 disabled={creating || !newName.trim()}
 >
 {creating ?"Creating…" :"Create Collection"}
 </button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
