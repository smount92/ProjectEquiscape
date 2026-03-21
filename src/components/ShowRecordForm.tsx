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

export default function ShowRecordForm({ horseId, existingRecord, onSave, onCancel }: ShowRecordFormProps) {
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
        !!(
            existingRecord?.showLocation ||
            existingRecord?.sectionName ||
            existingRecord?.awardCategory ||
            existingRecord?.competitionLevel
        ),
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
        <div className="rounded-lg border border-edge bg-card p-6 shadow-md transition-all">
            <div className="mb-4 text-[calc(1rem*var(--font-scale))] font-semibold">
                {isEdit ? "✏️ Edit Show Record" : "🏅 Add Show Record"}
            </div>
            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">
                        Show Name <span className="text-[#e74c6f]">*</span>
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

                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                    <div className="mb-6">
                        <label className="text-ink mb-1 block text-sm font-semibold">Show Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={showDate}
                            onChange={(e) => setShowDate(e.target.value)}
                            id="show-record-date"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="text-ink mb-1 block text-sm font-semibold">Division / Section</label>
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
                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Class Name</label>
                    <input
                        className="form-input"
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g. OF Stock Horse Mare, CM Decorator"
                        id="show-record-class-name"
                    />
                    <small className="text-muted text-[var(--font-size-xs)]">
                        Individual class name (not division or section callbacks).
                    </small>
                </div>

                {/* Fuzzy Date fallback */}
                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Approximate Date</label>
                    <input
                        className="form-input"
                        type="text"
                        value={showDateText}
                        onChange={(e) => setShowDateText(e.target.value)}
                        placeholder="e.g. Spring 2023, BreyerFest 2015"
                        id="show-record-date-text"
                    />
                    <small className="text-muted text-[var(--font-size-xs)]">
                        Use this when you don&apos;t know the exact date.
                    </small>
                </div>

                <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                    <div className="mb-6">
                        <label className="text-ink mb-1 block text-sm font-semibold">Placing</label>
                        <input
                            className="form-input"
                            type="text"
                            value={placing}
                            onChange={(e) => setPlacing(e.target.value)}
                            placeholder="e.g. 1st, NAN Top Ten"
                            id="show-record-placing"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="text-ink mb-1 block text-sm font-semibold">Ribbon Color</label>
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

                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Judge</label>
                    <input
                        className="form-input"
                        type="text"
                        value={judgeName}
                        onChange={(e) => setJudgeName(e.target.value)}
                        placeholder="Judge name (optional)"
                        id="show-record-judge"
                    />
                </div>

                <div className="mb-6 gap-2" style={{ display: "flex", alignItems: "center" }}>
                    <input
                        type="checkbox"
                        checked={isNan}
                        onChange={(e) => setIsNan(e.target.checked)}
                        id="show-record-nan"
                        style={{ width: 18, height: 18, accentColor: "#F59E0B" }}
                    />
                    <label htmlFor="show-record-nan" className="text-ink mb-0 mb-1 block text-sm font-semibold">
                        ⭐ NAN Achievement
                    </label>
                </div>

                <div className="mb-6">
                    <label className="text-ink mb-1 block text-sm font-semibold">Notes</label>
                    <textarea
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-4 py-2 text-sm font-semibold no-underline transition-all"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes (optional)"
                        maxLength={500}
                        rows={2}
                        id="show-record-notes"
                    />
                </div>

                {/* Advanced Details Toggle */}
                <div className="mb-6">
                    <button
                        type="button"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ width: "100%" }}
                        id="show-record-advanced-toggle"
                    >
                        {showAdvanced ? "▾ Hide" : "▸ Show"} Advanced Details
                    </button>
                </div>

                {showAdvanced && (
                    <>
                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Location</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={showLocation}
                                    onChange={(e) => setShowLocation(e.target.value)}
                                    placeholder="e.g. Dallas TX, Ontario Canada"
                                    id="show-record-location"
                                />
                            </div>
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Section</label>
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

                        <div className="grid grid-cols-2 gap-4 max-[600px]:grid-cols-1">
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Award Category</label>
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
                            <div className="mb-6">
                                <label className="text-ink mb-1 block text-sm font-semibold">Competition Level</label>
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

                {status === "error" && errorMsg && <div className="comment-error mb-4">{errorMsg}</div>}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                        disabled={!showName.trim() || status === "saving"}
                    >
                        {status === "saving" ? "Saving…" : isEdit ? "Update" : "Add Record"}
                    </button>
                </div>
            </form>
        </div>
    );
}
