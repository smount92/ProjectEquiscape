"use client";

import { useState } from"react";
import Link from"next/link";
import { deleteShowRecord } from"@/app/actions/provenance";
import ShowRecordForm from"@/components/ShowRecordForm";
import { Button } from "@/components/ui/button";

interface ShowRecordDisplay {
 id: string;
 showName: string;
 showId?: string | null;
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
 verificationTier: string | null;
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
 if (!dateStr) return"Date unknown";
 return new Date(dateStr +"T00:00:00").toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

function getRibbonClass(ribbon: string | null): string {
 if (!ribbon) return"";
 const lower = ribbon.toLowerCase();
 if (lower.includes("grand champion")) return"ribbon-grand";
 if (lower.includes("reserve grand")) return"ribbon-reserve-grand";
 if (lower.includes("champion")) return"ribbon-champion";
 if (lower.includes("reserve champion")) return"ribbon-reserve-champion";
 const map: Record<string, string> = {
 blue:"ribbon-blue",
 red:"ribbon-red",
 yellow:"ribbon-yellow",
 white:"ribbon-white",
 pink:"ribbon-pink",
 green:"ribbon-green",
 purple:"ribbon-purple",
 brown:"ribbon-brown",
 gray:"ribbon-gray",
"light blue":"ribbon-light-blue",
 };
 return map[lower] ||"";
}

export default function ShowRecordTimeline({ horseId, records: initialRecords, isOwner }: ShowRecordTimelineProps) {
 const [records, setRecords] = useState<ShowRecordDisplay[]>(initialRecords);
 const [formMode, setFormMode] = useState<string | null>(null); // null,"add","edit-{id}"
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
 <div
 className="show-record-timeline rounded-lg border border-input bg-card p-4 shadow-sm transition-all"
 id="show-records"
 >
 <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
 <h3 className="m-0 flex items-center gap-2 text-lg">
 <span aria-hidden="true">🏅</span> Show Records
 {records.length > 0 && ` (${records.length})`}
 </h3>
 {isOwner && (
 <Button
 onClick={handleAdd}
 id="add-show-record"
 >
 + Add Record
 </Button>
 )}
 </div>

 {/* Add Form */}
 {formMode ==="add" && <ShowRecordForm horseId={horseId} onSave={handleSave} onCancel={handleCancel} />}

 {/* Timeline */}
 {records.length === 0 ? (
 <div className="text-secondary-foreground py-6 text-center text-sm">
 {isOwner ?"No show records yet. Add your first win! 🏆" :"No show records yet."}
 </div>
 ) : (
 <div className="relative pl-8">
 {records.map((record) => (
 <div
 key={record.id}
 className={`show-record-item group/record relative mb-4 rounded-md bg-muted p-4 transition-colors hover:bg-muted/70 ${getRibbonClass(record.ribbonColor)}`}
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
 <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
 {record.showId ? (
 <Link href={`/shows/${record.showId}`} className="no-underline hover:text-forest hover:underline">
 {record.showName}
 </Link>
 ) : (
 record.showName
 )}
 {record.isNan && (
 <span className="inline-flex items-center gap-[2px] rounded-sm bg-warning/15 px-2 py-[1px] text-xs font-bold tracking-wider text-warning uppercase">
 ⭐ NAN
 </span>
 )}
 {record.verificationTier === "platform_generated" && (
 <span className="inline-flex items-center gap-[2px] rounded-sm bg-success/15 px-2 py-[1px] text-xs font-bold text-success" title="Record generated by MHH competition engine">
 🛡️ MHH Verified
 </span>
 )}
 {record.verificationTier === "host_verified" && (
 <span className="inline-flex items-center gap-[2px] rounded-sm bg-info/15 px-2 py-[1px] text-xs font-bold text-info" title="Verified by show host or judge">
 ✅ Host Verified
 </span>
 )}
 {(record.verificationTier === "self_reported" || (!record.verificationTier && !record.isNan)) && (
 <span className="inline-flex items-center gap-[2px] rounded-sm bg-muted px-2 py-[1px] text-xs font-medium text-muted-foreground" title="Self-reported by collector">
 📝 Self-Reported
 </span>
 )}
 </div>

 <div className="text-secondary-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm [&_span]:flex [&_span]:items-center [&_span]:gap-1">
 <span>📅 {formatShowDate(record.showDate, record.showDateText)}</span>
 {record.placing && <span>🎖️ {record.placing}</span>}
 {record.division && <span>📂 {record.division}</span>}
 {record.className && <span>📋 {record.className}</span>}
 {record.judgeName && <span>👤 {record.judgeName}</span>}
 {record.showLocation && <span>📍 {record.showLocation}</span>}
 </div>

 {/* Advanced details row */}
 {(record.sectionName || record.awardCategory || record.competitionLevel) && (
 <div className="text-secondary-foreground mt-1 flex flex-wrap gap-x-6 gap-y-2 text-sm [&_span]:flex [&_span]:items-center [&_span]:gap-1">
 {record.sectionName && <span>🏷️ {record.sectionName}</span>}
 {record.awardCategory && <span>🎯 {record.awardCategory}</span>}
 {record.competitionLevel && <span>📊 {record.competitionLevel}</span>}
 </div>
 )}

 {record.notes && (
 <div className="text-secondary-foreground mt-1 text-sm italic">
 {record.notes}
 </div>
 )}

 {isOwner && (
 <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover/record:opacity-100">
 <button
 className="text-muted-foreground hover:text-forest cursor-pointer rounded-sm border-none bg-transparent px-[6px] py-[2px] text-xs transition-colors"
 onClick={() => handleEdit(record)}
 title="Edit"
 aria-label="Edit record"
 >
 ✏️
 </button>
 <button
 className="text-muted-foreground cursor-pointer rounded-sm border-none bg-transparent px-[6px] py-[2px] text-xs transition-colors hover:text-destructive"
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
