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
        <form onSubmit={handleSubmit} className="admin-feature-form">
            <div className="form-group">
                <label className="form-label">Show Title</label>
                <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Spring Breyer Showcase"
                    required
                />
            </div>
            <div className="form-group">
                <label className="form-label">Theme (optional)</label>
                <input
                    type="text"
                    className="form-input"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="e.g. Best OF Breyer"
                />
            </div>
            <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                    className="form-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Show rules and details…"
                    rows={2}
                />
            </div>

            <div className="form-group">
                <label className="form-label">Entries Close (optional)</label>
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
                <div className="comment-success" style={{ marginBottom: "var(--space-md)" }}>✅ Show created!</div>
            )}

            <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
                {status === "saving" ? "Creating…" : "📸 Create Photo Show"}
            </button>
        </form>
    );
}
