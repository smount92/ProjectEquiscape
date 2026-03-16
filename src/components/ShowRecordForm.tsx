"use client";

import { useState } from "react";
import { addShowRecord, updateShowRecord } from "@/app/actions/provenance";

const RIBBON_COLORS = [
    { value: "", label: "Select ribbon/award…" },
    { value: "Blue", label: "🔵 Blue" },
    { value: "Red", label: "🔴 Red" },
    { value: "Yellow", label: "🟡 Yellow" },
    { value: "White", label: "⚪ White" },
    { value: "Pink", label: "🩷 Pink" },
    { value: "Green", label: "🟢 Green" },
    { value: "Purple", label: "🟣 Purple" },
    { value: "Brown", label: "🟤 Brown (8th)" },
    { value: "Gray", label: "🔘 Gray (9th)" },
    { value: "Light Blue", label: "🧊 Light Blue (10th)" },
    { value: "Grand Champion", label: "🏆 Grand Champion" },
    { value: "Reserve Grand Champion", label: "🥈 Reserve Grand Champion" },
    { value: "Champion", label: "🏆 Champion" },
    { value: "Reserve Champion", label: "🥈 Reserve Champion" },
    { value: "Honorable Mention", label: "🎖️ Honorable Mention (HM)" },
    { value: "Top 3", label: "🏅 Top 3" },
    { value: "Top 5", label: "🏅 Top 5" },
    { value: "Top 10", label: "🏅 Top 10" },
    { value: "Participant", label: "🎀 Participant" },
    { value: "Other", label: "Other" },
];

interface ShowRecordFormProps {
    horseId: string;
    existingRecord?: {
        id: string;
        showName: string;
        showDate: string | null;
        division: string | null;
        className: string | null;
        placing: string | null;
        ribbonColor: string | null;
        judgeName: string | null;
        isNan: boolean;
        notes: string | null;
        // Beta feedback fields
        showLocation: string | null;
        sectionName: string | null;
        awardCategory: string | null;
        competitionLevel: string | null;
        showDateText: string | null;
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
    const [className, setClassName] = useState(existingRecord?.className ?? "");
    const [placing, setPlacing] = useState(existingRecord?.placing ?? "");
    const [ribbonColor, setRibbonColor] = useState(existingRecord?.ribbonColor ?? "");
    const [judgeName, setJudgeName] = useState(existingRecord?.judgeName ?? "");
    const [isNan, setIsNan] = useState(existingRecord?.isNan ?? false);
    const [notes, setNotes] = useState(existingRecord?.notes ?? "");
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // NEW: Beta feedback state
    const [showLocation, setShowLocation] = useState(existingRecord?.showLocation ?? "");
    const [sectionName, setSectionName] = useState(existingRecord?.sectionName ?? "");
    const [awardCategory, setAwardCategory] = useState(existingRecord?.awardCategory ?? "");
    const [competitionLevel, setCompetitionLevel] = useState(existingRecord?.competitionLevel ?? "");
    const [showDateText, setShowDateText] = useState(existingRecord?.showDateText ?? "");
    const [showAdvanced, setShowAdvanced] = useState(
        !!(existingRecord?.showLocation || existingRecord?.sectionName ||
            existingRecord?.awardCategory || existingRecord?.competitionLevel)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showName.trim() || status === "saving") return;

        setStatus("saving");
        setErrorMsg("");

        const formData = {
            showName,
            showDate: showDate || null,
            division: division.trim() || null,
            className: className.trim() || null,
            placing: placing.trim() || null,
            ribbonColor: ribbonColor || null,
            judgeName: judgeName.trim() || null,
            isNan,
            notes: notes.trim() || null,
            showLocation: showLocation.trim() || null,
            sectionName: sectionName.trim() || null,
            awardCategory: awardCategory.trim() || null,
            competitionLevel: competitionLevel.trim() || null,
            showDateText: showDateText.trim() || null,
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
                        <label className="form-label">Division / Section</label>
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

                {/* Class Name — between Division and Placing */}
                <div className="form-group">
                    <label className="form-label">Class Name</label>
                    <input
                        className="form-input"
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g. OF Stock Horse Mare, CM Decorator"
                        id="show-record-class-name"
                    />
                    <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                        Individual class name (not division or section callbacks).
                    </small>
                </div>

                {/* Fuzzy Date fallback */}
                <div className="form-group">
                    <label className="form-label">Approximate Date</label>
                    <input
                        className="form-input"
                        type="text"
                        value={showDateText}
                        onChange={(e) => setShowDateText(e.target.value)}
                        placeholder="e.g. Spring 2023, BreyerFest 2015"
                        id="show-record-date-text"
                    />
                    <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                        Use this when you don&apos;t know the exact date.
                    </small>
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
                        className="form-textarea"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes (optional)"
                        maxLength={500}
                        rows={2}
                        id="show-record-notes"
                    />
                </div>

                {/* Advanced Details Toggle */}
                <div className="form-group">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ width: "100%" }}
                        id="show-record-advanced-toggle"
                    >
                        {showAdvanced ? "▾ Hide" : "▸ Show"} Advanced Details
                    </button>
                </div>

                {showAdvanced && (
                    <>
                        <div className="show-record-form-row">
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={showLocation}
                                    onChange={(e) => setShowLocation(e.target.value)}
                                    placeholder="e.g. Dallas TX, Ontario Canada"
                                    id="show-record-location"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={sectionName}
                                    onChange={(e) => setSectionName(e.target.value)}
                                    placeholder="e.g. Halter, Performance"
                                    id="show-record-section"
                                />
                            </div>
                        </div>

                        <div className="show-record-form-row">
                            <div className="form-group">
                                <label className="form-label">Award Category</label>
                                <select
                                    className="form-select"
                                    value={awardCategory}
                                    onChange={(e) => setAwardCategory(e.target.value)}
                                    id="show-record-award-category"
                                >
                                    <option value="">Select category…</option>
                                    <option value="Breed">Breed</option>
                                    <option value="Collectibility">Collectibility</option>
                                    <option value="Workmanship">Workmanship</option>
                                    <option value="Color">Color</option>
                                    <option value="Gender">Gender</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Competition Level</label>
                                <select
                                    className="form-select"
                                    value={competitionLevel}
                                    onChange={(e) => setCompetitionLevel(e.target.value)}
                                    id="show-record-competition-level"
                                >
                                    <option value="">Select level…</option>
                                    <option value="Open">Open</option>
                                    <option value="Novice">Novice</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Youth">Youth</option>
                                </select>
                            </div>
                        </div>
                    </>
                )}

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
