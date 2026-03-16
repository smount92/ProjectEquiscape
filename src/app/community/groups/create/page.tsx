"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/app/actions/groups";

import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
export default function CreateGroupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [groupType, setGroupType] = useState("general");
    const [region, setRegion] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    function autoSlug(value: string) {
        setName(value);
        setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");

        const result = await createGroup({
            name: name.trim(),
            slug,
            description: description.trim() || undefined,
            groupType,
            region: region.trim() || undefined,
            visibility,
        });

        if (result.success && result.slug) {
            router.push(`/community/groups/${result.slug}`);
        } else {
            setError(result.error || "Failed to create group");
            setSaving(false);
        }
    }

    return (
        <div className="page-container">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <h1 style={{ marginBottom: "var(--space-xl)" }}>🏛️ Create Group</h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Group Name *</label>
                        <input className="form-input" value={name} onChange={e => autoSlug(e.target.value)} placeholder="Pacific Northwest Model Horse Collectors" required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">URL Slug</label>
                        <input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="pnw-collectors" />
                        <small style={{ color: "var(--color-text-muted)" }}>modelhorsehub.com/community/groups/{slug || "your-slug"}</small>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group about?" style={{ resize: "vertical" }} />
                    </div>

                    <div className="form-row-2col">
                        <div className="form-group">
                            <label className="form-label">Group Type *</label>
                            <select className="form-input" value={groupType} onChange={e => setGroupType(e.target.value)}>
                                {Object.entries(GROUP_TYPE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Region</label>
                            <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Pacific Northwest" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Visibility</label>
                        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                            {["public", "restricted", "private"].map(v => (
                                <button key={v} type="button" className={`studio-status-btn ${visibility === v ? `active-${v === "public" ? "open" : v === "restricted" ? "waitlist" : "closed"}` : ""}`}
                                    onClick={() => setVisibility(v)}>
                                    {v === "public" ? "🌐 Public" : v === "restricted" ? "🔒 Restricted" : "🔐 Private"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="form-error">{error}</p>}

                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
                        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                            {saving ? "Creating..." : "Create Group"}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => router.push("/community/groups")}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
