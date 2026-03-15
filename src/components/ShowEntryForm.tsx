"use client";

import { useState } from "react";
import { enterShow } from "@/app/actions/shows";

interface ShowEntryFormProps {
    showId: string;
    userHorses: { id: string; name: string }[];
    classes?: { id: string; name: string; divisionName: string }[];
}

export default function ShowEntryForm({ showId, userHorses, classes }: ShowEntryFormProps) {
    const [selectedHorse, setSelectedHorse] = useState("");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHorse || status === "submitting") return;

        setStatus("submitting");
        setErrorMsg("");

        const result = await enterShow(showId, selectedHorse, selectedClassId || undefined);
        if (result.success) {
            setStatus("success");
            setSelectedHorse("");
            setSelectedClassId("");
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

    // Group classes by division for optgroup rendering
    const divisionGroups: Map<string, { id: string; name: string }[]> = new Map();
    if (classes && classes.length > 0) {
        for (const c of classes) {
            const group = divisionGroups.get(c.divisionName) || [];
            group.push({ id: c.id, name: c.name });
            divisionGroups.set(c.divisionName, group);
        }
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

            {/* Class selection — only if structured classes exist */}
            {divisionGroups.size > 0 && (
                <select
                    className="form-input"
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                >
                    <option value="">Select a class (optional)…</option>
                    {Array.from(divisionGroups.entries()).map(([divName, items]) => (
                        <optgroup key={divName} label={divName}>
                            {items.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            )}

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
