"use client";

/**
 * "Import results": a horse's past placings from a spreadsheet. Download
 * the template, drop the file in (CSV or Excel), check the column mapping
 * when the headers are not ours, fix a cell in the preview, import; undo
 * the whole file if it was wrong. One horse at a time — every row belongs
 * to this horse, so there is no name matching to get wrong. Parsing
 * happens here for the preview and again on the server.
 */
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

import { importShowRecords, undoShowRecordsImport } from "@/app/actions/records-import";
import { IMPORT_MAX_ROWS, parseImportRows, TEMPLATE_COLUMNS, TEMPLATE_PATH, type ImportedRecord } from "@/lib/records/import";
import { applyHeaderMap, findDuplicates, guessHeaderMap, headerMapStorageKey, mapHasRequired, type HeaderMap, type RecordFingerprintInput } from "@/lib/records/importTools";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** The cells you can fix in the preview without going back to the sheet. */
const EDITABLE: { key: keyof ImportedRecord; label: string; width: string }[] = [
    { key: "showName", label: "Show", width: "min-w-[10rem]" },
    { key: "showDate", label: "Date", width: "min-w-[7rem]" },
    { key: "className", label: "Class", width: "min-w-[9rem]" },
    { key: "placing", label: "Placing", width: "min-w-[6rem]" },
    { key: "classSize", label: "Size", width: "min-w-[4rem]" },
];

const headerOf = (key: keyof ImportedRecord) => TEMPLATE_COLUMNS.find((c) => c.key === key)!.header;

async function readFile(file: File): Promise<{ rows: Record<string, string>[]; error?: string }> {
    const name = file.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls|ods)$/.test(name)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) return { rows: [], error: "The workbook has no sheets." };
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
        return { rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")]))) };
    }
    return new Promise((resolve) => {
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                if (result.errors.length > 0 && result.data.length === 0) {
                    resolve({ rows: [], error: `Could not read the file: ${result.errors[0].message}` });
                    return;
                }
                resolve({ rows: result.data });
            },
            error: (err) => resolve({ rows: [], error: `Could not read the file: ${err.message}` }),
        });
    });
}

export default function ShowRecordsImport({
    horseId,
    horseName,
    existing = [],
}: {
    horseId: string;
    horseName: string;
    /** The placings already on the horse, for the duplicate check in the preview. */
    existing?: RecordFingerprintInput[];
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [map, setMap] = useState<HeaderMap>({});
    const [showMapping, setShowMapping] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [includeDuplicates, setIncludeDuplicates] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ imported: number; skipped: number; duplicates: number; batchId: string | null; warning?: string } | null>(null);
    const [undone, setUndone] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setFileName(null);
        setRawRows([]);
        setHeaders([]);
        setMap({});
        setShowMapping(false);
        setParseError(null);
        setIncludeDuplicates(false);
        setDone(null);
        setUndone(null);
        setError(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    // Rows on the template's headers, the parse, and the duplicate set — all derived.
    const rows = useMemo(() => applyHeaderMap(rawRows, map), [rawRows, map]);
    const parsed = useMemo(() => (rows.length ? parseImportRows(rows) : null), [rows]);
    const dupes = useMemo(() => (parsed ? findDuplicates(parsed.records, existing) : new Set<number>()), [parsed, existing]);
    const fatal = parsed?.problems.filter((p) => p.rowNumber === 0) ?? [];
    const rowProblems = parsed?.problems.filter((p) => p.rowNumber > 0) ?? [];
    const problemByRow = new Map(rowProblems.map((p) => [p.rowNumber, p.message]));
    const ready = parsed ? parsed.records.filter((r) => includeDuplicates || !dupes.has(r.rowNumber)).length : 0;

    /** A mapping used before is remembered per header set; the guess stands otherwise. */
    const rememberedMap = (hs: string[]): HeaderMap | null => {
        try {
            const saved = localStorage.getItem(headerMapStorageKey(hs));
            return saved ? (JSON.parse(saved) as HeaderMap) : null;
        } catch {
            return null;
        }
    };

    const onFile = async (file: File | undefined) => {
        reset();
        if (!file) return;
        setFileName(file.name);
        const { rows: data, error: readError } = await readFile(file);
        if (readError) {
            setParseError(readError);
            return;
        }
        if (data.length === 0) {
            setParseError("The file has no data rows.");
            return;
        }
        const hs = [...new Set(data.flatMap((r) => Object.keys(r)))].filter((h) => h.trim());
        const guess = rememberedMap(hs) ?? guessHeaderMap(hs);
        setRawRows(data.slice(0, IMPORT_MAX_ROWS + 1));
        setHeaders(hs);
        setMap(guess);
        // Show the mapping only when the file is not our template.
        setShowMapping(!hs.every((h) => TEMPLATE_COLUMNS.some((c) => c.header.toLowerCase() === h.trim().toLowerCase())));
    };

    const setMapping = (fileHeader: string, key: keyof ImportedRecord | "") => {
        setMap((prev) => {
            const next: HeaderMap = { ...prev };
            // one file column per template column
            for (const h of Object.keys(next)) if (key && next[h] === key && h !== fileHeader) next[h] = "";
            next[fileHeader] = key;
            try {
                localStorage.setItem(headerMapStorageKey(headers), JSON.stringify(next));
            } catch {
                // fine
            }
            return next;
        });
    };

    /** Edit a cell in the preview: write it back to the raw row so the parse re-runs. */
    const editCell = (rowNumber: number, key: keyof ImportedRecord, value: string) => {
        const index = rowNumber - 2;
        setRawRows((prev) => {
            const next = prev.slice();
            const row = { ...next[index] };
            const fileHeader = Object.entries(map).find(([, k]) => k === key)?.[0] ?? headerOf(key);
            row[fileHeader] = value;
            if (!(fileHeader in map)) setMap((m) => ({ ...m, [fileHeader]: key }));
            next[index] = row;
            return next;
        });
    };

    const submit = async () => {
        if (!parsed || ready === 0 || busy) return;
        setBusy(true);
        setError(null);
        const result = await importShowRecords(horseId, rows.slice(0, IMPORT_MAX_ROWS), { includeDuplicates });
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "The import did not go through.");
            return;
        }
        setDone({
            imported: result.imported ?? 0,
            skipped: (result.problems ?? []).filter((p) => p.rowNumber > 0).length,
            duplicates: result.duplicates?.length ?? 0,
            batchId: result.batchId ?? null,
            warning: result.warning,
        });
    };

    const undo = async () => {
        if (!done?.batchId || busy) return;
        setBusy(true);
        const result = await undoShowRecordsImport(horseId, done.batchId);
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "Could not undo.");
            return;
        }
        setUndone(result.removed ?? 0);
    };

    return (
        <>
            <Button variant="outline" size="wide" onClick={() => setOpen(true)} id="import-show-records">
                📥 Import results
            </Button>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) {
                        const changed = !!done;
                        reset();
                        if (changed) window.location.reload();
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Import show results for {horseName}</DialogTitle>
                        <DialogDescription>
                            One row per placing. Only the show name and the placing are needed; every other column can stay blank.
                            Rows land as self-reported records, the same as the form.
                        </DialogDescription>
                    </DialogHeader>

                    {done ? (
                        <div className="flex flex-col gap-3" data-testid="import-result">
                            {undone !== null ? (
                                <p className="m-0 text-base font-semibold">
                                    Undone — {undone} placing{undone === 1 ? "" : "s"} removed from {horseName}.
                                </p>
                            ) : (
                                <p className="m-0 text-base font-semibold">
                                    {done.imported} placing{done.imported === 1 ? "" : "s"} added to {horseName}.
                                    {done.duplicates > 0 && ` ${done.duplicates} already on the horse, skipped.`}
                                    {done.skipped > 0 && ` ${done.skipped} row${done.skipped === 1 ? " was" : "s were"} skipped.`}
                                </p>
                            )}
                            {done.warning && <p className="text-warning m-0 text-sm">{done.warning}</p>}
                            {rowProblems.length > 0 && undone === null && (
                                <ul className="text-secondary-foreground m-0 list-disc pl-5 text-sm">
                                    {rowProblems.slice(0, 20).map((p) => (
                                        <li key={`${p.rowNumber}-${p.message}`}>
                                            Row {p.rowNumber}: {p.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {error && <p className="text-destructive m-0 text-sm">{error}</p>}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    {done.batchId && undone === null && (
                                        <Button variant="outline" onClick={undo} disabled={busy} id="undo-show-records-import">
                                            {busy ? "Undoing…" : "↩ Undo this import"}
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={reset}>
                                        Import another file
                                    </Button>
                                    <Button onClick={() => window.location.reload()}>Done</Button>
                                </div>
                            </div>
                            {done.batchId && undone === null && (
                                <p className="text-muted-foreground m-0 text-xs">Undo removes exactly the placings this file added, for seven days.</p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="border-input bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="text-sm">
                                    <strong>1.</strong> Fill in the template, one placing per row — or use a sheet you already keep.
                                    <span className="text-muted-foreground block text-xs">
                                        Dates like 23/03/2024 or 2024-03-23; placings like 1, 1st, Blue, Champion, HM.
                                    </span>
                                </div>
                                <Button asChild variant="outline">
                                    <a href={TEMPLATE_PATH} download>
                                        📄 Download template
                                    </a>
                                </Button>
                            </div>

                            <div
                                className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${dragging ? "border-forest bg-forest/10" : "border-input bg-muted/40"}`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    void onFile(e.dataTransfer.files?.[0]);
                                }}
                                data-testid="import-dropzone"
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xlsm,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    className="sr-only"
                                    id="import-show-records-file"
                                    onChange={(e) => void onFile(e.target.files?.[0])}
                                />
                                <p className="m-0 mb-2">
                                    <strong>2.</strong> Upload the filled-in file.
                                </p>
                                <Button type="button" onClick={() => fileRef.current?.click()} id="import-show-records-choose">
                                    📂 Choose a file
                                </Button>
                                <p className="text-muted-foreground m-0 mt-2 text-xs">
                                    {fileName ? (
                                        <>
                                            Selected: <strong className="text-foreground">{fileName}</strong>
                                        </>
                                    ) : (
                                        "or drag it here · .csv, .xlsx or .ods"
                                    )}
                                </p>
                            </div>

                            {parseError && <p className="text-destructive m-0 text-sm">{parseError}</p>}

                            {headers.length > 0 && (
                                <div className="border-input rounded-lg border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span>
                                            <strong>Columns:</strong>{" "}
                                            {Object.values(map).filter(Boolean).length} of {headers.length} matched
                                            {!mapHasRequired(map) && <span className="text-destructive"> — Show name and Placing must both be matched</span>}
                                        </span>
                                        <button type="button" className="text-forest text-xs font-semibold hover:underline" onClick={() => setShowMapping((v) => !v)}>
                                            {showMapping ? "Hide mapping" : "Check mapping"}
                                        </button>
                                    </div>
                                    {showMapping && (
                                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2" data-testid="import-mapping">
                                            {headers.map((h) => (
                                                <label key={h} className="flex items-center gap-2 text-xs">
                                                    <span className="text-secondary-foreground w-[45%] truncate" title={h}>
                                                        {h}
                                                    </span>
                                                    <span aria-hidden="true">→</span>
                                                    <select
                                                        className="border-input bg-card text-foreground h-8 flex-1 rounded-md border px-2 text-xs"
                                                        value={map[h] ?? ""}
                                                        onChange={(e) => setMapping(h, e.target.value as keyof ImportedRecord | "")}
                                                    >
                                                        <option value="">Ignore</option>
                                                        {TEMPLATE_COLUMNS.map((c) => (
                                                            <option key={c.key} value={c.key}>
                                                                {c.header}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {parsed && fatal.length > 0 && mapHasRequired(map) && (
                                <div className="border-destructive/40 bg-destructive/10 rounded-lg border p-3 text-sm">
                                    {fatal.map((p) => (
                                        <p key={p.message} className="m-0">
                                            {p.message}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {parsed && mapHasRequired(map) && (
                                <div className="flex flex-col gap-2">
                                    <p className="m-0 text-sm">
                                        <strong>3.</strong> {fileName}: {ready} placing{ready === 1 ? "" : "s"} ready
                                        {dupes.size > 0 && !includeDuplicates && `, ${dupes.size} already on the horse`}
                                        {rowProblems.length > 0 && `, ${rowProblems.length} row${rowProblems.length === 1 ? "" : "s"} to fix`}
                                        <span className="text-muted-foreground block text-xs">Fix a cell right here; the row re-checks as you type.</span>
                                    </p>
                                    <div className="border-input max-h-[40vh] overflow-auto rounded-lg border">
                                        <table className="w-full text-xs" data-testid="import-preview">
                                            <thead className="sticky top-0">
                                                <tr className="bg-muted text-left">
                                                    <th className="px-2 py-1">Row</th>
                                                    {EDITABLE.map((c) => (
                                                        <th key={c.key} className="px-2 py-1">
                                                            {c.label}
                                                        </th>
                                                    ))}
                                                    <th className="px-2 py-1">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.slice(0, IMPORT_MAX_ROWS).map((row, i) => {
                                                    const rowNumber = i + 2;
                                                    const problem = problemByRow.get(rowNumber);
                                                    const isDupe = dupes.has(rowNumber);
                                                    const blank = TEMPLATE_COLUMNS.every((c) => !(row[c.header] ?? "").trim());
                                                    if (blank) return null;
                                                    return (
                                                        <tr key={rowNumber} className={`border-input border-t ${problem ? "bg-destructive/5" : isDupe ? "bg-muted/40" : ""}`} data-row={rowNumber}>
                                                            <td className="text-muted-foreground px-2 py-1">{rowNumber}</td>
                                                            {EDITABLE.map((c) => (
                                                                <td key={c.key} className={`px-1 py-0.5 ${c.width}`}>
                                                                    <input
                                                                        className="border-input bg-card text-foreground h-7 w-full rounded border px-1.5 text-xs"
                                                                        value={row[headerOf(c.key)] ?? ""}
                                                                        onChange={(e) => editCell(rowNumber, c.key, e.target.value)}
                                                                        aria-label={`Row ${rowNumber} ${c.label}`}
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-2 py-1">
                                                                {problem ? (
                                                                    <span className="text-destructive">{problem}</span>
                                                                ) : isDupe ? (
                                                                    <span className="text-secondary-foreground">{includeDuplicates ? "Already on the horse — importing anyway" : "Already on the horse — skipped"}</span>
                                                                ) : (
                                                                    <span className="text-success">Ready</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {dupes.size > 0 && (
                                        <label className="flex items-center gap-2 text-xs">
                                            <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} id="import-include-duplicates" />
                                            Import the {dupes.size} placing{dupes.size === 1 ? "" : "s"} the horse already has anyway
                                        </label>
                                    )}
                                    {error && <p className="text-destructive m-0 text-sm">{error}</p>}
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="outline" onClick={() => setOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={submit} disabled={busy || ready === 0} id="import-show-records-go">
                                            {busy ? "Importing…" : `Import ${ready} placing${ready === 1 ? "" : "s"}`}
                                        </Button>
                                    </div>
                                    {rowProblems.length > 0 && (
                                        <p className="text-muted-foreground m-0 text-xs">Rows with a problem are skipped until they are fixed.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
