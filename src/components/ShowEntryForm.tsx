"use client";

import { useState } from "react";
import { enterShow } from "@/app/actions/shows";

interface ShowEntryFormProps {
    showId: string;
    userHorses: { id: string; name: string }[];
}

export default function ShowEntryForm({ showId, userHorses }: ShowEntryFormProps) {
    const [selectedHorse, setSelectedHorse] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHorse || status === "submitting") return;

        setStatus("submitting");
        setErrorMsg("");

        const result = await enterShow(showId, selectedHorse);
        if (result.success) {
            setStatus("success");
            setSelectedHorse("");
            setTimeout(() => setStatus("idle"), 3000);
        } else {
            setErrorMsg(result.error || "Failed to enter show.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    if (userHorses.length === 0) {
        return (
            <div className="show-entry-form-empty">
                <p style={{ color: "var(--color-text-muted)" }}>
                    You need at least one public horse to enter shows.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="show-entry-form">
            <select
                className="form-input"
                value={selectedHorse}
                onChange={(e) => setSelectedHorse(e.target.value)}
                required
            >
                <option value="">Select a horse to enter…</option>
                {userHorses.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                ))}
            </select>
            <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!selectedHorse || status === "submitting"}
            >
                {status === "submitting" ? "Entering…" : "🐴 Enter Show"}
            </button>
            {status === "success" && (
                <span className="comment-success">✅ Entered!</span>
            )}
            {status === "error" && errorMsg && (
                <span className="comment-error">{errorMsg}</span>
            )}
        </form>
    );
}
