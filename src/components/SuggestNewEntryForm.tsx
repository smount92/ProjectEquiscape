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
            <div className="p-8" style={{ textAlign: "center" }}>
                <div className="text-[3rem] mb-4" >✅</div>
                <h2 className="mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    Suggestion Submitted!
                </h2>
                <p className="text-muted mb-6" >
                    Your new entry suggestion is now pending review. The community can vote and discuss it.
                </p>
                <div className="gap-4" style={{ display: "flex", justifyContent: "center" }}>
                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" onClick={() => router.push("/catalog/suggestions")}>
                        View All Suggestions
                    </button>
                    <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => { setSuccess(false); setTitle(""); setReason(""); }}>
                        Submit Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="gap-4" style={{ display: "flex", flexDirection: "column" }}>
            {/* Title */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-title">Title / Name *</label>
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
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-type">Entry Type</label>
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
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-maker">Maker / Manufacturer</label>
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
            <div className="grid-cols-2 gap-4" style={{ display: "grid" }}>
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-scale">Scale</label>
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
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-color">Color</label>
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
            <div className="grid-cols-2 gap-4" style={{ display: "grid" }}>
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-mold">Mold Name</label>
                    <input
                        id="new-entry-mold"
                        className="form-input"
                        value={moldName}
                        onChange={e => setMoldName(e.target.value)}
                        placeholder="e.g. Family Arabian Stallion"
                        maxLength={200}
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-year">Year</label>
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
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="new-entry-reason">Reason / Evidence *</label>
                <textarea
                    id="new-entry-reason"
                    className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Explain why this entry should be added. Include sources if available (e.g. 'Listed in the 2019 Breyer dealer catalog, page 12')."
                    style={{ resize: "vertical" }}
                />
                <span className="text-[calc(0.7rem*var(--font-scale))] text-muted mt-[4]" style={{ textAlign: "right", display: "block" }}>
                    {reason.length}/2000
                </span>
            </div>

            {error && <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm">{error}</p>}

            {/* Actions */}
            <div className="gap-4 justify-end" style={{ display: "flex" }}>
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge" onClick={() => router.back()} disabled={isPending}>Cancel</button>
                <button
                    className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                    onClick={handleSubmit}
                    disabled={isPending || !title.trim() || !reason.trim()}
                >
                    {isPending ? "Submitting…" : "📗 Submit Suggestion"}
                </button>
            </div>
        </div>
    );
}
