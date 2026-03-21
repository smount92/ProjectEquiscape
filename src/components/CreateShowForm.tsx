"use client";

import { useState } from "react";
import { createPhotoShow } from "@/app/actions/shows";

export default function CreateShowForm() {
    const [title, setTitle] = useState("");
    const [theme, setTheme] = useState("");
    const [description, setDescription] = useState("");
    const [endAt, setEndAt] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const result = await createPhotoShow({
            title: title.trim(),
            theme: theme.trim() || undefined,
            description: description.trim() || undefined,
            endAt: endAt || undefined,
        });

        if (result.success) {
            setStatus("saved");
            setTitle("");
            setTheme("");
            setDescription("");
            setEndAt("");
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setErrorMsg(result.error || "Failed to create show.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-[500px]">
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Show Title</label>
                <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Spring Breyer Showcase"
                    required
                />
            </div>
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Theme (optional)</label>
                <input
                    type="text"
                    className="form-input"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g. Best OF Breyer"
                />
            </div>
            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Description (optional)</label>
                <textarea
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Show rules and details…"
                    rows={2}
                />
            </div>

            <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-1">Entries Close (optional)</label>
                <input
                    type="datetime-local"
                    className="form-input"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                />
                <p style={{ fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "4px" }}>
                    Leave blank for no deadline. Show stays open until manually closed.
                </p>
            </div>

            {status === "error" && errorMsg && (
                <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>{errorMsg}</div>
            )}
            {status === "saved" && (
                <div className="bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] text-[#22C55E] py-2 px-4 rounded-md text-[calc(0.85rem*var(--font-scale))]" style={{ marginBottom: "var(--space-md)" }}>✅ Show created!</div>
            )}

            <button type="submit" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm" disabled={status === "saving"}>
                {status === "saving" ? "Creating…" : "📸 Create Photo Show"}
            </button>
        </form>
    );
}
