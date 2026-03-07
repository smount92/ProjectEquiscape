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
        <form onSubmit={handleSubmit} className="admin-feature-form">
            <div className="form-group">
                <label className="form-label">Horse ID (UUID)</label>
                <input
                    type="text"
                    className="form-input"
                    value={horseId}
                    onChange={(e) => setHorseId(e.target.value)}
                    placeholder="Paste the public horse ID here…"
                    required
                />
            </div>
            <div className="form-group">
                <label className="form-label">Title</label>
                <input
                    type="text"
                    className="form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
            </div>
            <div className="form-group">
                <label className="form-label">Description (optional)</label>
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
                <div className="comment-success" style={{ marginBottom: "var(--space-md)" }}>
                    ✅ Horse featured successfully!
                </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
                {status === "saving" ? "Featuring…" : "🌟 Feature This Horse"}
            </button>
        </form>
    );
}
