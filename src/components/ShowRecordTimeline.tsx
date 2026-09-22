"use client";

import { useState } from"react";
import Link from"next/link";
import { deleteShowRecord } from"@/app/actions/provenance";
import ShowRecordForm from"@/components/ShowRecordForm";
import ShowRecordsImport from "@/components/ShowRecordsImport";
import { filterLedger, groupByYear, LEDGER_FILTER_FROM, LEDGER_PREVIEW, summarizeLedger } from "@/lib/records/ledger";
import { Button } from "@/components/ui/button";
import type { PaperView } from "@/app/actions/papers";
import PaperDialog from "@/components/passport/PaperDialog";
import PaperThumbs from "@/components/passport/PaperThumbs";
import LinkifiedText from "@/components/LinkifiedText";
import { RECORD_PAPER_KINDS } from "@/lib/papers/validate";
import { isQualifierProgram, qualifierChip, qualifierTitle } from "@/lib/records/qualifiers";

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
 /** Scored judging (206): the weighted total, when the class was scored. */
 scoreTotal?: number | null;
 /** The entry photo AS JUDGED (207) — frozen at publish; galleries change, records don't. */
 entryPhotoUrl?: string | null;
 /** Qualification card (210): "nan" | "omeq"; colour; year; printed ID. */
 qualifierProgram?: string | null;
 qualifierCard?: string | null;
 qualifierYear?: number | null;
 qualifierCardId?: string | null;
}

interface ShowRecordTimelineProps {
 horseId: string;
 records: ShowRecordDisplay[];
 isOwner: boolean;
 /** SHARE-YOUR-PLACING: recordId → public placing-page href for
  *  v2-linked, results-published records (resolved server-side by
  *  the passport page via resolvePlacingHrefs — records store no
  *  entry id, so the match is show + class name). Owner-only UI. */
 placingHrefs?: Record<string, string>;
 /** The horse's papers (213/214); the ones attached to a record render under it. */
 papers?: PaperView[];
 horseName?: string;
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

export default function ShowRecordTimeline({ horseId, records: initialRecords, isOwner, placingHrefs, papers = [], horseName = "this horse" }: ShowRecordTimelineProps) {
 const [records, setRecords] = useState<ShowRecordDisplay[]>(initialRecords);
 const [attaching, setAttaching] = useState<ShowRecordDisplay | null>(null);
 const [formMode, setFormMode] = useState<string | null>(null); // null,"add","edit-{id}"
 const [editingRecord, setEditingRecord] = useState<ShowRecordDisplay | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 // The ledger view (2026-09-21): a summary strip, the newest few, the
 // rest folded by season, and a filter once the list is long.
 const [expanded, setExpanded] = useState(false);
 const [filter, setFilter] = useState("");
 const summary = summarizeLedger(records);
 const filtered = filterLedger(records, filter);
 const folded = records.length > LEDGER_PREVIEW && !expanded && !filter.trim();
 const shown = folded ? filtered.slice(0, LEDGER_PREVIEW) : filtered;
 const groups = !folded && records.length > LEDGER_PREVIEW ? groupByYear(shown) : null;

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


 const renderRecord = (record: ShowRecordDisplay) => (
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
 {isQualifierProgram(record.qualifierProgram) && (
 <span
 className="inline-flex items-center gap-1 rounded-sm bg-forest/10 px-2 py-[1px] text-xs font-bold text-forest"
 title={qualifierTitle(record.qualifierProgram, record.qualifierCard ?? null, record.qualifierCardId ?? null)}
 data-testid="qualifier-chip"
 >
 {qualifierChip(record.qualifierProgram, record.qualifierCard ?? null, record.qualifierYear ?? null)}
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
 {isOwner && placingHrefs?.[record.id] && (
 <Link
 href={placingHrefs[record.id]}
 className="inline-flex items-center gap-1 rounded-sm border border-forest/40 px-2 py-[1px] text-xs font-bold text-forest no-underline transition-colors hover:bg-forest/10"
 title="Open this placing's public share page"
 data-testid="record-share-link"
 >
 Share <span aria-hidden="true">↗</span>
 </Link>
 )}
 </div>

 <div className="text-secondary-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm [&_span]:flex [&_span]:items-center [&_span]:gap-1">
 <span>📅 {formatShowDate(record.showDate, record.showDateText)}</span>
 {record.placing && <span>🎖️ {record.placing}</span>}
 {record.scoreTotal != null && <span title="Scored class — weighted rubric total">🎯 {record.scoreTotal}/100</span>}
 {record.entryPhotoUrl && (
 <a href={record.entryPhotoUrl} target="_blank" rel="noopener noreferrer" title="The photo as judged" className="shrink-0">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={record.entryPhotoUrl} alt="As judged" loading="lazy" className="h-12 w-12 rounded-md border border-input object-cover" />
 </a>
 )}
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
 <div className="text-secondary-foreground mt-1 text-sm">
 <LinkifiedText text={record.notes} />
 </div>
 )}

 {/* The card the show issued, the photo from the table (214). */}
 <PaperThumbs papers={papers.filter((p) => p.showRecordId === record.id)} horseName={horseName} />
 {isOwner && (
 <button
 type="button"
 onClick={() => setAttaching(record)}
 className="text-forest mt-2 cursor-pointer rounded-sm border-none bg-transparent p-0 text-xs font-semibold hover:underline"
 >
 📎 Attach a card or photo
 </button>
 )}

 {isOwner && (
 <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover/record:opacity-100">
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
 );

 return (
 <div
 className="show-record-timeline rounded-lg border border-input bg-card p-4 shadow-sm transition-all"
 id="show-records"
 >
 <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
 <div className="brass-heading">
 <span className="brass-heading-bar" aria-hidden="true" />
 <h3 className="m-0 text-lg">
 Show Records
 {records.length > 0 && ` (${records.length})`}
 </h3>
 </div>
 {isOwner && (
 <div className="flex flex-wrap items-center gap-2">
 <Button
 onClick={handleAdd}
 id="add-show-record"
 >
 + Add Record
 </Button>
 <ShowRecordsImport
 horseId={horseId}
 horseName={horseName}
 existing={records.map((r) => ({ showName: r.showName, showDate: r.showDate, className: r.className, placing: r.placing }))}
 />
 </div>
 )}
 </div>

 {/* Add Form */}
 {formMode ==="add" && <ShowRecordForm horseId={horseId} onSave={handleSave} onCancel={handleCancel} />}

 {attaching && (
 <PaperDialog
 horseId={horseId}
 horseName={horseName}
 paper={null}
 attachTo={{ showRecordId: attaching.id, label: attaching.showName }}
 presetKind="qualification_card"
 kinds={RECORD_PAPER_KINDS}
 onClose={() => setAttaching(null)}
 onSaved={() => {
 setAttaching(null);
 window.location.reload();
 }}
 />
 )}

 {/* Timeline */}
 {records.length === 0 ? (
 <div className="text-secondary-foreground py-6 text-center text-sm">
 {isOwner ?"No show records yet. Add your first win! 🏆" :"No show records yet."}
 </div>
 ) : (
 <div className="relative pl-8">
 <>
 {records.length > 1 && (
 <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md bg-muted/60 px-3 py-2 text-sm" data-testid="record-ledger-summary">
 <span><strong>{summary.total}</strong> placings</span>
 {summary.firsts > 0 && <span><strong>{summary.firsts}</strong> {summary.firsts === 1 ? "first" : "firsts"}</span>}
 {summary.championships > 0 && <span><strong>{summary.championships}</strong> {summary.championships === 1 ? "championship" : "championships"}</span>}
 {summary.cards > 0 && <span><strong>{summary.cards}</strong> {summary.cards === 1 ? "card" : "cards"}</span>}
 <span><strong>{summary.shows}</strong> {summary.shows === 1 ? "show" : "shows"}</span>
 {summary.span && <span className="text-secondary-foreground">{summary.span}</span>}
 </div>
 )}
 {records.length >= LEDGER_FILTER_FROM && (
 <input
 type="search"
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 placeholder="Find a show, class, placing or judge…"
 className="border-input bg-card text-foreground mb-3 h-9 w-full rounded-md border px-3 text-sm"
 aria-label="Filter show records"
 id="record-ledger-filter"
 />
 )}
 {filter.trim() !== "" && filtered.length === 0 && (
 <p className="text-secondary-foreground m-0 mb-3 text-sm">Nothing matches &ldquo;{filter}&rdquo;.</p>
 )}
 {groups
 ? groups.map((g, i) => (
 <details key={g.label} open={i === 0 || groups.length <= 2 || filter.trim() !== ""} className="mb-2" data-testid="record-year-group">
 <summary className="text-secondary-foreground mb-2 cursor-pointer text-xs font-semibold tracking-wider uppercase">
 {g.label} · {g.records.length} {g.records.length === 1 ? "placing" : "placings"}
 </summary>
 {g.records.map(renderRecord)}
 </details>
 ))
 : shown.map(renderRecord)}
 {folded && (
 <button
 type="button"
 onClick={() => setExpanded(true)}
 className="text-forest mt-1 cursor-pointer rounded-sm border-none bg-transparent p-0 text-sm font-semibold hover:underline"
 id="record-ledger-show-all"
 >
 Show all {records.length} placings ↓
 </button>
 )}
 {expanded && records.length > LEDGER_PREVIEW && filter.trim() === "" && (
 <button
 type="button"
 onClick={() => setExpanded(false)}
 className="text-forest mt-1 cursor-pointer rounded-sm border-none bg-transparent p-0 text-sm font-semibold hover:underline"
 >
 Show fewer ↑
 </button>
 )}
 </>
 </div>
 )}
 </div>
 );
}
