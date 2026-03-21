"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getCollectionsAction, createCollectionAction } from "@/app/actions/collections";

interface Collection {
  id: string;
  name: string;
  description: string | null;
}

interface CollectionPickerProps {
  selectedCollectionIds: string[];
  onSelect: (ids: string[]) => void;
}

export default function CollectionPicker({
  selectedCollectionIds,
  onSelect,
}: CollectionPickerProps) {
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
      const result = await createCollectionAction(
        newName.trim(),
        newDesc.trim() || null,
        newIsPublic
      );

      if (result.success && result.data) {
        const newCollection = result.data as Collection;
        setCollections((prev) =>
          [...prev, newCollection].sort((a, b) => a.name.localeCompare(b.name))
        );
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

  const selectedNames = collections
    .filter((c) => selectedCollectionIds.includes(c.id))
    .map((c) => c.name);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-ink mb-1">
        📁 Collections <span style={{ opacity: 0.6, fontWeight: 400 }}>(Optional — multi-select)</span>
      </label>

      {loading ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
          Loading collections…
        </div>
      ) : collections.length === 0 ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))", marginBottom: "var(--space-sm)" }}>
          No collections yet. Create one to organize your models.
        </div>
      ) : (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xs)",
          maxHeight: 180,
          overflowY: "auto",
          padding: "var(--space-sm)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-bg-input, rgba(0,0,0,0.03))",
        }}>
          {collections.map((c) => (
            <label
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                padding: "var(--space-xs) var(--space-sm)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                background: selectedCollectionIds.includes(c.id)
                  ? "rgba(44, 85, 69, 0.12)"
                  : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              <input
                type="checkbox"
                checked={selectedCollectionIds.includes(c.id)}
                onChange={() => handleToggle(c.id)}
                style={{ width: 16, height: 16, flexShrink: 0, accentColor: "var(--color-accent-primary)" }}
              />
              <span style={{
                fontSize: "calc(var(--font-size-sm) * var(--font-scale))",
                fontWeight: selectedCollectionIds.includes(c.id) ? 600 : 400,
              }}>
                📁 {c.name}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center" style={{ marginTop: "var(--space-sm)" }}>
        {selectedNames.length > 0 && (
          <div style={{
            fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
            color: "var(--color-accent-primary)",
            fontWeight: 500,
          }}>
            ✓ In: {selectedNames.join(", ")}
          </div>
        )}
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge whitespace-nowrap text-[calc(var(--font-size-sm)*var(--font-scale))!important] p-[var(--space-sm) var(--space-md) !important] border border-dashed border-[var(--color-border)!important] hover:border-[var(--color-accent-primary) hover:!important] hover:text-[var(--color-accent-primary) hover:!important]"
          onClick={() => setShowModal(true)}
          aria-label="Create new collection"
          id="create-collection-btn"
        >
          + New
        </button>
      </div>

      <span className="block mt-1 text-xs text-muted">
        Organize your models into collections like &quot;Childhood Herd&quot;, &quot;Show String&quot;, or &quot;Wishlist&quot;.
      </span>

      {/* ---- Create Collection Modal ---- */}
      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content max-sm:max-w-full max-w-[480px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create new collection"
          >
            <div className="modal-sticky top-0 z-[100] h-[var(--header max-sm:py-[0] max-sm:px-4-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all">
              <h3>📁 New Collection</h3>
              <button
                type="button"
                className="bg-transparent border-0 text-muted text-[1.2rem] cursor-pointer p-1 rounded-md transition-all duration-150"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-8 flex flex-col gap-4">
              <div className="mb-6">
                <label htmlFor="new-collection-name" className="block text-sm font-semibold text-ink mb-1">
                  Collection Name *
                </label>
                <input
                  ref={nameInputRef}
                  id="new-collection-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Childhood Herd, Show String…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={60}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>

              <div className="mb-6">
                <label htmlFor="new-collection-desc" className="block text-sm font-semibold text-ink mb-1">
                  Description <span style={{ opacity: 0.6 }}>(Optional)</span>
                </label>
                <input
                  id="new-collection-desc"
                  type="text"
                  className="form-input"
                  placeholder="A short note about this collection…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="mb-6" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <input
                  id="new-collection-public"
                  type="checkbox"
                  checked={newIsPublic}
                  onChange={(e) => setNewIsPublic(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                <label htmlFor="new-collection-public" className="block text-sm font-semibold text-ink mb-1" style={{ margin: 0 }}>
                  🌐 Make public on profile
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating…" : "Create Collection"}
              </button>
            </div>
          </div>
        </div>,
        document.body)}
    </div>
  );
}
