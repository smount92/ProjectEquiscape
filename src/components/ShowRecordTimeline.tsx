"use client";

import { useState } from "react";
import { deleteShowRecord } from "@/app/actions/provenance";
import ShowRecordForm from "@/components/ShowRecordForm";

interface ShowRecordDisplay {
    id: string;
    showName: string;
    showDate: string | null;
    division: string | null;
    placing: string | null;
    ribbonColor: string | null;
    judgeName: string | null;
    isNan: boolean;
    notes: string | null;
    // NEW: Beta feedback fields
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
        <div className="show-record-timeline" id="show-records">
            <div className="show-record-timeline-header">
                <h3>
                    <span aria-hidden="true">🏅</span> Show Records
                    {records.length > 0 && ` (${records.length})`}
                </h3>
                {isOwner && (
                    <button
                        className="btn btn-primary show-record-add-btn"
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
                <div className="show-record-empty">
                    {isOwner
                        ? "No show records yet. Add your first win! 🏆"
                        : "No show records yet."}
                </div>
            ) : (
                <div className="show-record-list">
                    {records.map((record) => (
                        <div
                            key={record.id}
                            className={`show-record-item ${getRibbonClass(record.ribbonColor)}`}
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
                                    <div className="show-record-title">
                                        {record.showName}
                                        {record.isNan && (
                                            <span className="show-record-nan-badge">
                                                ⭐ NAN
                                            </span>
                                        )}
                                    </div>

                                    <div className="show-record-meta">
                                        <span>📅 {formatShowDate(record.showDate, record.showDateText)}</span>
                                        {record.placing && <span>🎖️ {record.placing}</span>}
                                        {record.division && <span>📂 {record.division}</span>}
                                        {record.judgeName && <span>👤 {record.judgeName}</span>}
                                        {record.showLocation && <span>📍 {record.showLocation}</span>}
                                    </div>

                                    {/* Advanced details row */}
                                    {(record.sectionName || record.awardCategory || record.competitionLevel) && (
                                        <div className="show-record-meta" style={{ marginTop: "var(--space-xs)" }}>
                                            {record.sectionName && <span>🏷️ {record.sectionName}</span>}
                                            {record.awardCategory && <span>🎯 {record.awardCategory}</span>}
                                            {record.competitionLevel && <span>📊 {record.competitionLevel}</span>}
                                        </div>
                                    )}

                                    {record.notes && (
                                        <div className="show-record-notes">{record.notes}</div>
                                    )}

                                    {isOwner && (
                                        <div className="show-record-actions">
                                            <button
                                                onClick={() => handleEdit(record)}
                                                title="Edit"
                                                aria-label="Edit record"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="delete"
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
