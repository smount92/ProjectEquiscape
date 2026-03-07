"use client";

import { useState } from "react";
import { addShowRecord, updateShowRecord } from "@/app/actions/provenance";

const RIBBON_COLORS = [
    { value: "", label: "Select ribbon…" },
    { value: "Blue", label: "🔵 Blue (1st)" },
    { value: "Red", label: "🔴 Red (2nd)" },
    { value: "Yellow", label: "🟡 Yellow (3rd)" },
    { value: "White", label: "⚪ White (4th)" },
    { value: "Pink", label: "🩷 Pink (5th)" },
    { value: "Green", label: "🟢 Green (6th)" },
    { value: "Purple", label: "🟣 Purple (7th/8th)" },
    { value: "Grand Champion", label: "🏆 Grand Champion" },
    { value: "Reserve Grand Champion", label: "🥈 Reserve Grand Champion" },
    { value: "NAN Top Ten", label: "⭐ NAN Top Ten" },
    { value: "NAN Card", label: "🌟 NAN Card" },
    { value: "Other", label: "Other" },
];

interface ShowRecordFormProps {
    horseId: string;
    existingRecord?: {
        id: string;
        showName: string;
        showDate: string | null;
        division: string | null;
        placing: string | null;
        ribbonColor: string | null;
        judgeName: string | null;
        isNan: boolean;
        notes: string | null;
    };
    onSave: () => void;
    onCancel: () => void;
}

export default function ShowRecordForm({
    horseId,
    existingRecord,
    onSave,
    onCancel,
}: ShowRecordFormProps) {
    const isEdit = !!existingRecord;

    const [showName, setShowName] = useState(existingRecord?.showName ?? "");
    const [showDate, setShowDate] = useState(existingRecord?.showDate ?? "");
    const [division, setDivision] = useState(existingRecord?.division ?? "");
    const [placing, setPlacing] = useState(existingRecord?.placing ?? "");
    const [ribbonColor, setRibbonColor] = useState(existingRecord?.ribbonColor ?? "");
    const [judgeName, setJudgeName] = useState(existingRecord?.judgeName ?? "");
    const [isNan, setIsNan] = useState(existingRecord?.isNan ?? false);
    const [notes, setNotes] = useState(existingRecord?.notes ?? "");
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showName.trim() || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const formData = {
            showName,
            showDate: showDate || undefined,
            division: division || undefined,
            placing: placing || undefined,
            ribbonColor: ribbonColor || undefined,
            judgeName: judgeName || undefined,
            isNan,
            notes: notes || undefined,
        };

        const result = isEdit
            ? await updateShowRecord(existingRecord!.id, formData)
            : await addShowRecord({ horseId, ...formData });

        if (result.success) {
            onSave();
        } else {
            setErrorMsg(result.error || "Failed to save.");
            setStatus("error");
        }
    };

    return (
        <div className="show-record-form-overlay">
            <div className="show-record-form-title">
                {isEdit ? "✏️ Edit Show Record" : "🏅 Add Show Record"}
            </div>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">
                        Show Name <span style={{ color: "#e74c6f" }}>*</span>
                    </label>
                    <input
                        className="form-input"
                        type="text"
                        value={showName}
                        onChange={(e) => setShowName(e.target.value)}
                        placeholder="e.g. NAMHSA Nationals 2025"
                        maxLength={200}
                        required
                        id="show-record-name"
                    />
                </div>

                <div className="show-record-form-row">
                    <div className="form-group">
                        <label className="form-label">Show Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={showDate}
                            onChange={(e) => setShowDate(e.target.value)}
                            id="show-record-date"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Division</label>
                        <input
                            className="form-input"
                            type="text"
                            value={division}
                            onChange={(e) => setDivision(e.target.value)}
                            placeholder="e.g. OF Breyer Traditional"
                            id="show-record-division"
                        />
                    </div>
                </div>

                <div className="show-record-form-row">
                    <div className="form-group">
                        <label className="form-label">Placing</label>
                        <input
                            className="form-input"
                            type="text"
                            value={placing}
                            onChange={(e) => setPlacing(e.target.value)}
                            placeholder="e.g. 1st, NAN Top Ten"
                            id="show-record-placing"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ribbon Color</label>
                        <select
                            className="form-select"
                            value={ribbonColor}
                            onChange={(e) => setRibbonColor(e.target.value)}
                            id="show-record-ribbon"
                        >
                            {RIBBON_COLORS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Judge</label>
                    <input
                        className="form-input"
                        type="text"
                        value={judgeName}
                        onChange={(e) => setJudgeName(e.target.value)}
                        placeholder="Judge name (optional)"
                        id="show-record-judge"
                    />
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <input
                        type="checkbox"
                        checked={isNan}
                        onChange={(e) => setIsNan(e.target.checked)}
                        id="show-record-nan"
                        style={{ width: 18, height: 18, accentColor: "#F59E0B" }}
                    />
                    <label htmlFor="show-record-nan" className="form-label" style={{ marginBottom: 0 }}>
                        ⭐ NAN Achievement
                    </label>
                </div>

                <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea
                        className="form-input"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes (optional)"
                        maxLength={500}
                        rows={2}
                        id="show-record-notes"
                    />
                </div>

                {status === "error" && errorMsg && (
                    <div className="comment-error" style={{ marginBottom: "var(--space-md)" }}>
                        {errorMsg}
                    </div>
                )}

                <div className="show-record-form-actions">
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!showName.trim() || status === "saving"}
                    >
                        {status === "saving" ? "Saving…" : isEdit ? "Update" : "Add Record"}
                    </button>
                </div>
            </form>
        </div>
    );
}
