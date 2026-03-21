"use client";

import { useState } from "react";
import { featureHorse } from "@/app/actions/admin";

export default function FeatureHorseForm() {
    const [horseId, setHorseId] = useState("");
    const [title, setTitle] = useState("Horse of the Week");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!horseId.trim() || !title.trim() || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const result = await featureHorse({
            horseId: horseId.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
        });

        if (result.success) {
            setStatus("saved");
            setHorseId("");
            setDescription("");
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setErrorMsg(result.error || "Failed to feature horse.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-[500px]">
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Horse ID (UUID)</label>
                <input
                    type="text"
                    className="form-input"
                    value={horseId}
                    onChange={(e) => setHorseId(e.target.value)}
                    placeholder="Paste the public horse ID here…"
                    required
                />
            </div>
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Title</label>
                <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
            </div>
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Description (optional)</label>
                <textarea
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Why is this horse being featured?"
                    rows={2}
                />
            </div>

            {status === "error" && errorMsg && (
                <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>
                    {errorMsg}
                </div>
            )}

            {status === "saved" && (
                <div className="bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[#22C55E] py-2 px-4 rounded-md text-[calc(0.85rem*var(--font-scale))]" style={{ marginBottom: "var(--space-md)" }}>
                    ✅ Horse featured successfully!
                </div>
            )}

            <button type="submit" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" disabled={status === "saving"}>
                {status === "saving" ? "Featuring…" : "🌟 Feature This Horse"}
            </button>
        </form>
    );
}
