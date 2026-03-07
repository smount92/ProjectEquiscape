"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Collection {
  id: string;
  name: string;
  description: string | null;
}

interface CollectionPickerProps {
  selectedCollectionId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CollectionPicker({
  selectedCollectionId,
  onSelect,
}: CollectionPickerProps) {
  const supabase = createClient();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_collections")
        .select("id, name, description")
        .eq("user_id", user.id)
        .order("name");

      setCollections((data as Collection[]) ?? []);
      setLoading(false);
    }
    fetchCollections();
  }, [supabase]);

  // Focus name input when modal opens
  useEffect(() => {
    if (showModal && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [showModal]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("user_collections")
      .insert({
        user_id: user.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_public: newIsPublic,
      } as Record<string, unknown>)
      .select("id, name, description")
      .single<Collection>();

    if (!error && data) {
      setCollections((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      onSelect(data.id);
      setShowModal(false);
      setNewName("");
      setNewDesc("");
      setNewIsPublic(false);
    }
    setCreating(false);
  };

  return (
    <div className="form-group">
      <label htmlFor="collection-picker" className="form-label">
        📁 Collection / Folder <span style={{ opacity: 0.6, fontWeight: 400 }}>(Optional)</span>
      </label>

      <div className="collection-picker-row">
        <select
          id="collection-picker"
          className="form-select"
          value={selectedCollectionId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          disabled={loading}
        >
          <option value="">No Collection (Uncategorized)</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              📁 {c.name}
            </option>
          ))}
        </select>

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
