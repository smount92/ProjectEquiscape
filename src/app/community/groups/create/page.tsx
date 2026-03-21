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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content" style={{ maxWidth: 640 }}>
                <h1 style={{ marginBottom: "var(--space-xl)" }}>🏛️ Create Group</h1>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Group Name *</label>
                        <input className="form-input" value={name} onChange={e => autoSlug(e.target.value)} placeholder="Pacific Northwest Model Horse Collectors" required />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">URL Slug</label>
                        <input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="pnw-collectors" />
                        <small style={{ color: "var(--color-text-muted)" }}>modelhorsehub.com/community/groups/{slug || "your-slug"}</small>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Description</label>
                        <textarea className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group about?" style={{ resize: "vertical" }} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Group Type *</label>
                            <select className="form-input" value={groupType} onChange={e => setGroupType(e.target.value)}>
                                {Object.entries(GROUP_TYPE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-ink mb-1">Region</label>
                            <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Pacific Northwest" />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-ink mb-1">Visibility</label>
                        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                            {["public", "restricted", "private"].map(v => (
                                <button key={v} type="button" className={`studio-status-btn ${visibility === v ? `active-${v === "public" ? "open" : v === "restricted" ? "waitlist" : "closed"}` : ""}`}
                                    onClick={() => setVisibility(v)}>
                                    {v === "public" ? "🌐 Public" : v === "restricted" ? "🔒 Restricted" : "🔐 Private"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}

                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
                        <button type="submit" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" disabled={saving || !name.trim()}>
                            {saving ? "Creating..." : "Create Group"}
                        </button>
                        <button type="button" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => router.push("/community/groups")}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
