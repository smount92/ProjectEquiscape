"use client";

import { useState, useEffect, useRef } from "react";
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
    <div className="form-group">
      <label className="form-label">
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

      <div className="collection-picker-row" style={{ marginTop: "var(--space-sm)" }}>
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
          className="btn btn-ghost collection-create-btn"
          onClick={() => setShowModal(true)}
          aria-label="Create new collection"
          id="create-collection-btn"
        >
          + New
        </button>
      </div>

      <span className="form-hint">
        Organize your models into collections like &quot;Childhood Herd&quot;, &quot;Show String&quot;, or &quot;Wishlist&quot;.
      </span>

      {/* ---- Create Collection Modal ---- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-content collection-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create new collection"
          >
            <div className="modal-header">
              <h3>📁 New Collection</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-collection-name" className="form-label">
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

              <div className="form-group">
                <label htmlFor="new-collection-desc" className="form-label">
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

              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <input
                  id="new-collection-public"
                  type="checkbox"
                  checked={newIsPublic}
                  onChange={(e) => setNewIsPublic(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                <label htmlFor="new-collection-public" className="form-label" style={{ margin: 0 }}>
                  🌐 Make public on profile
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating…" : "Create Collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
