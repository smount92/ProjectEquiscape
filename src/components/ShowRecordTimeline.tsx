"use client";

import { useState } from "react";
import { deleteShowRecord } from "@/app/actions/provenance";
import ShowRecordForm from "@/components/ShowRecordForm";

interface ShowRecordDisplay {
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
}

interface ShowRecordTimelineProps {
    horseId: string;
    records: ShowRecordDisplay[];
    isOwner: boolean;
}

function formatShowDate(dateStr: string | null, dateText: string | null): string {
    // Prefer fuzzy text if no exact date is given (or if exact date looks like a year-start fallback)
    if (dateText && (!dateStr || dateStr.endsWith("-01-01"))) {
        return dateText;
    }
    if (!dateStr) return "Date unknown";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getRibbonClass(ribbon: string | null): string {
    if (!ribbon) return "";
    const lower = ribbon.toLowerCase();
    if (lower.includes("grand champion")) return "ribbon-grand";
    if (lower.includes("reserve grand")) return "ribbon-reserve-grand";
    if (lower.includes("champion")) return "ribbon-champion";
    if (lower.includes("reserve champion")) return "ribbon-reserve-champion";
    const map: Record<string, string> = {
        blue: "ribbon-blue",
        red: "ribbon-red",
        yellow: "ribbon-yellow",
        white: "ribbon-white",
        pink: "ribbon-pink",
        green: "ribbon-green",
        purple: "ribbon-purple",
        brown: "ribbon-brown",
        gray: "ribbon-gray",
        "light blue": "ribbon-light-blue",
    };
    return map[lower] || "";
}

export default function ShowRecordTimeline({
    horseId,
    records: initialRecords,
    isOwner,
}: ShowRecordTimelineProps) {
    const [records, setRecords] = useState<ShowRecordDisplay[]>(initialRecords);
    const [formMode, setFormMode] = useState<string | null>(null); // null, "add", "edit-{id}"
    const [editingRecord, setEditingRecord] = useState<ShowRecordDisplay | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleAdd = () => {
        setEditingRecord(null);
        setFormMode("add");
    };

    const handleEdit = (record: ShowRecordDisplay) => {
        setEditingRecord(record);
        setFormMode(`edit-${record.id}`);
    };

    const handleDelete = async (recordId: string) => {
        if (deletingId) return;
        setDeletingId(recordId);

        const result = await deleteShowRecord(recordId);
        if (result.success) {
            setRecords((prev) => prev.filter((r) => r.id !== recordId));
        }
        setDeletingId(null);
    };

    const handleSave = () => {
        setFormMode(null);
        setEditingRecord(null);
        // Reload page to get fresh data from server
        window.location.reload();
    };

    const handleCancel = () => {
        setFormMode(null);
        setEditingRecord(null);
    };

    return (
        <div className="show-record-timeline bg-[var(--color-card-bg,rgba(0,0,0,0.05))] border border-[var(--color-border,rgba(0,0,0,0.08))] rounded-lg p-6" id="show-records">
            <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2 m-0 text-[calc(1.1rem*var(--font-scale))]">
                    <span aria-hidden="true">🏅</span> Show Records
                    {records.length > 0 && ` (${records.length})`}
                </h3>
                {isOwner && (
                    <button
                        className="btn btn-primary text-[calc(0.8rem*var(--font-scale))] py-1 px-4"
                        onClick={handleAdd}
                        id="add-show-record"
                    >
                        + Add Record
                    </button>
                )}
            </div>

            {/* Add Form */}
            {formMode === "add" && (
                <ShowRecordForm
                    horseId={horseId}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            )}

            {/* Timeline */}
            {records.length === 0 ? (
                <div className="text-center py-6 text-muted text-[calc(0.9rem*var(--font-scale))]">
                    {isOwner
                        ? "No show records yet. Add your first win! 🏆"
                        : "No show records yet."}
                </div>
            ) : (
                <div className="relative pl-8">
                    {records.map((record) => (
                        <div
                            key={record.id}
                            className={`show-record-item group/record relative p-4 mb-4 rounded-md bg-[var(--color-card-bg-hover,rgba(0,0,0,0.03))] transition-colors hover:bg-[rgba(0,0,0,0.06)] ${getRibbonClass(record.ribbonColor)}`}
                            id={`record-${record.id}`}
                        >
                            {/* Edit Form Inline */}
                            {formMode === `edit-${record.id}` ? (
                                <ShowRecordForm
                                    horseId={horseId}
                                    existingRecord={editingRecord!}
                                    onSave={handleSave}
                                    onCancel={handleCancel}
                                />
                            ) : (
                                <>
                                    <div className="font-semibold text-[calc(0.95rem*var(--font-scale))] mb-1 flex items-center gap-2">
                                        {record.showName}
                                        {record.isNan && (
                                            <span className="inline-flex items-center gap-[2px] py-[1px] px-2 rounded-sm bg-[linear-gradient(135deg,rgba(245,158,11,0.2),rgba(234,179,8,0.1))] text-[#F59E0B] text-[calc(0.7rem*var(--font-scale))] font-bold uppercase tracking-wider">
                                                ⭐ NAN
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-y-2 gap-x-6 text-[calc(0.8rem*var(--font-scale))] text-muted [&_span]:flex [&_span]:items-center [&_span]:gap-1">
                                        <span>📅 {formatShowDate(record.showDate, record.showDateText)}</span>
                                        {record.placing && <span>🎖️ {record.placing}</span>}
                                        {record.division && <span>📂 {record.division}</span>}
                                        {record.className && <span>📋 {record.className}</span>}
                                        {record.judgeName && <span>👤 {record.judgeName}</span>}
                                        {record.showLocation && <span>📍 {record.showLocation}</span>}
                                    </div>

                                    {/* Advanced details row */}
                                    {(record.sectionName || record.awardCategory || record.competitionLevel) && (
                                        <div className="flex flex-wrap gap-y-2 gap-x-6 text-[calc(0.8rem*var(--font-scale))] text-muted [&_span]:flex [&_span]:items-center [&_span]:gap-1 mt-1">
                                            {record.sectionName && <span>🏷️ {record.sectionName}</span>}
                                            {record.awardCategory && <span>🎯 {record.awardCategory}</span>}
                                            {record.competitionLevel && <span>📊 {record.competitionLevel}</span>}
                                        </div>
                                    )}

                                    {record.notes && (
                                        <div className="mt-1 text-[calc(0.85rem*var(--font-scale))] text-muted italic">{record.notes}</div>
                                    )}

                                    {isOwner && (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover/record:opacity-100">
                                            <button
                                                className="bg-transparent border-none text-muted cursor-pointer py-[2px] px-[6px] rounded-sm text-[calc(0.75rem*var(--font-scale))] transition-colors hover:text-forest"
                                                onClick={() => handleEdit(record)}
                                                title="Edit"
                                                aria-label="Edit record"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="bg-transparent border-none text-muted cursor-pointer py-[2px] px-[6px] rounded-sm text-[calc(0.75rem*var(--font-scale))] transition-colors hover:text-[#e74c6f]"
                                                onClick={() => handleDelete(record.id)}
                                                disabled={deletingId === record.id}
                                                title="Delete"
                                                aria-label="Delete record"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
