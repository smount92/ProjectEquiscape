"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSuggestion } from "@/app/actions/catalog-suggestions";

const MAKERS = ["Breyer", "Stone", "Hartland", "Hagen-Renaker", "Peter Stone", "Artist Resin", "Other"];
const ITEM_TYPES = [
    { value: "release", label: "Release (specific color/year of a mold)" },
    { value: "mold", label: "Mold (sculpture, not a specific release)" },
    { value: "resin", label: "Artist Resin" },
    { value: "tack", label: "Tack / Accessory" },
];

export default function SuggestNewEntryForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [title, setTitle] = useState("");
    const [maker, setMaker] = useState("");
    const [customMaker, setCustomMaker] = useState("");
    const [itemType, setItemType] = useState("release");
    const [scale, setScale] = useState("");
    const [color, setColor] = useState("");
    const [year, setYear] = useState("");
    const [moldName, setMoldName] = useState("");
    const [reason, setReason] = useState("");

    const handleSubmit = () => {
        if (!title.trim()) { setError("Title is required."); return; }
        if (!reason.trim() || reason.trim().length < 10) { setError("Please provide a reason (at least 10 characters)."); return; }

        const effectiveMaker = maker === "Other" ? customMaker.trim() : maker;

        startTransition(async () => {
            setError(null);
            const result = await createSuggestion({
                catalogItemId: null, // null = new entry suggestion
                suggestionType: "addition",
                fieldChanges: {
                    title: title.trim(),
                    maker: effectiveMaker || undefined,
                    item_type: itemType,
                    scale: scale || undefined,
                    color: color || undefined,
                    year: year ? parseInt(year, 10) : undefined,
                    mold_name: moldName || undefined,
                },
                reason: reason.trim(),
            });

            if (result.success) {
                setSuccess(true);
            } else {
                setError(result.error || "Failed to submit suggestion.");
            }
        });
    };

    if (success) {
        return (
            <div style={{ textAlign: "center", padding: "var(--space-xl)" }}>
                <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>✅</div>
                <h2 style={{ fontFamily: "var(--font-display)", marginBottom: "var(--space-sm)" }}>
                    Suggestion Submitted!
                </h2>
                <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-lg)" }}>
                    Your new entry suggestion is now pending review. The community can vote and discuss it.
                </p>
                <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={() => router.push("/catalog/suggestions")}>
                        View All Suggestions
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setSuccess(false); setTitle(""); setReason(""); }}>
                        Submit Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* Title */}
            <div className="form-group">
                <label className="form-label" htmlFor="new-entry-title">Title / Name *</label>
                <input
                    id="new-entry-title"
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Breyer #712 — Misty of Chincoteague"
                    maxLength={200}
                />
            </div>

            {/* Item Type */}
            <div className="form-group">
                <label className="form-label" htmlFor="new-entry-type">Entry Type</label>
                <select
                    id="new-entry-type"
                    className="form-input"
                    value={itemType}
                    onChange={e => setItemType(e.target.value)}
                >
                    {ITEM_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Maker */}
            <div className="form-group">
                <label className="form-label" htmlFor="new-entry-maker">Maker / Manufacturer</label>
                <select
                    id="new-entry-maker"
                    className="form-input"
                    value={maker}
                    onChange={e => setMaker(e.target.value)}
                >
                    <option value="">— Select —</option>
                    {MAKERS.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                {maker === "Other" && (
                    <input
                        className="form-input"
                        style={{ marginTop: "var(--space-xs)" }}
                        value={customMaker}
                        onChange={e => setCustomMaker(e.target.value)}
                        placeholder="Enter maker name"
                        maxLength={100}
                    />
                )}
            </div>

            {/* Two-column row: Scale + Color */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div className="form-group">
                    <label className="form-label" htmlFor="new-entry-scale">Scale</label>
                    <select id="new-entry-scale" className="form-input" value={scale} onChange={e => setScale(e.target.value)}>
                        <option value="">— Select —</option>
                        <option value="Traditional">Traditional</option>
                        <option value="Classic">Classic</option>
                        <option value="Stablemate">Stablemate</option>
                        <option value="Paddock Pal">Paddock Pal</option>
                        <option value="Mini Whinnies">Mini Whinnies</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="new-entry-color">Color</label>
                    <input
                        id="new-entry-color"
                        className="form-input"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        placeholder="e.g. Bay, Palomino"
                        maxLength={100}
                    />
                </div>
            </div>

            {/* Two-column row: Mold + Year */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
                <div className="form-group">
                    <label className="form-label" htmlFor="new-entry-mold">Mold Name</label>
                    <input
                        id="new-entry-mold"
                        className="form-input"
                        value={moldName}
                        onChange={e => setMoldName(e.target.value)}
                        placeholder="e.g. Family Arabian Stallion"
                        maxLength={200}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="new-entry-year">Year</label>
                    <input
                        id="new-entry-year"
                        type="number"
                        className="form-input"
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        placeholder="e.g. 1995"
                        min={1950}
                        max={2030}
                    />
                </div>
            </div>

            {/* Reason */}
            <div className="form-group">
                <label className="form-label" htmlFor="new-entry-reason">Reason / Evidence *</label>
                <textarea
                    id="new-entry-reason"
                    className="form-textarea"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Explain why this entry should be added. Include sources if available (e.g. 'Listed in the 2019 Breyer dealer catalog, page 12')."
                    style={{ resize: "vertical" }}
                />
                <span style={{ fontSize: "calc(0.7rem * var(--font-scale))", color: "var(--color-text-muted)", textAlign: "right", display: "block", marginTop: 4 }}>
                    {reason.length}/2000
                </span>
            </div>

            {error && <p className="form-error">{error}</p>}

            {/* Actions */}
            <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => router.back()} disabled={isPending}>Cancel</button>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={isPending || !title.trim() || !reason.trim()}
                >
                    {isPending ? "Submitting…" : "📗 Submit Suggestion"}
                </button>
            </div>
        </div>
    );
}
