"use client";

/**
 * "Import results": a horse's past placings from a spreadsheet. Download
 * the template, drop the file in, read the preview and the row problems,
 * import. Same shape as the stable's CSV import, one horse at a time —
 * every row belongs to this horse, so there is no name matching to get
 * wrong. Parsing happens here for the preview and again on the server.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

import { importShowRecords } from "@/app/actions/records-import";
import { IMPORT_MAX_ROWS, parseImportRows, TEMPLATE_COLUMNS, TEMPLATE_PATH, type ImportParseResult } from "@/lib/records/import";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ShowRecordsImport({ horseId, horseName }: { horseId: string; horseName: string }) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [parsed, setParsed] = useState<ImportParseResult | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ imported: number; skipped: number; warning?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setRows([]);
        setParsed(null);
        setFileName(null);
        setParseError(null);
        setDone(null);
        setError(null);
        if (fileRef.current) fileRef.current.value = "";
    };

    const onFile = (file: File | undefined) => {
        reset();
        if (!file) return;
        setFileName(file.name);
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                if (result.errors.length > 0 && result.data.length === 0) {
                    setParseError(`Could not read the file: ${result.errors[0].message}`);
                    return;
                }
                const data = result.data.slice(0, IMPORT_MAX_ROWS + 1);
                setRows(data);
                setParsed(parseImportRows(data));
            },
            error: (err) => setParseError(`Could not read the file: ${err.message}`),
        });
    };

    const submit = async () => {
        if (!parsed || parsed.records.length === 0 || busy) return;
        setBusy(true);
        setError(null);
        const result = await importShowRecords(horseId, rows.slice(0, IMPORT_MAX_ROWS));
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "The import did not go through.");
            return;
        }
        setDone({ imported: result.imported ?? 0, skipped: (result.problems ?? []).filter((p) => p.rowNumber > 0).length, warning: result.warning });
        router.refresh();
    };

    const fatal = parsed?.problems.filter((p) => p.rowNumber === 0) ?? [];
    const rowProblems = parsed?.problems.filter((p) => p.rowNumber > 0) ?? [];
    const preview = parsed?.records.slice(0, 8) ?? [];

    return (
        <>
            <Button variant="outline" size="wide" onClick={() => setOpen(true)} id="import-show-records">
                📥 Import results
            </Button>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) reset();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Import show results for {horseName}</DialogTitle>
                        <DialogDescription>
                            One row per placing. Only the show name and the placing are needed; every other column can stay blank.
                            Rows land as self-reported records, the same as the form.
                        </DialogDescription>
                    </DialogHeader>

                    {done ? (
                        <div className="flex flex-col gap-3">
                            <p className="m-0 text-base font-semibold">
                                {done.imported} placing{done.imported === 1 ? "" : "s"} added to {horseName}.
                                {done.skipped > 0 && ` ${done.skipped} row${done.skipped === 1 ? " was" : "s were"} skipped.`}
                            </p>
                            {done.warning && <p className="text-warning m-0 text-sm">{done.warning}</p>}
                            {rowProblems.length > 0 && (
                                <ul className="text-secondary-foreground m-0 list-disc pl-5 text-sm">
                                    {rowProblems.slice(0, 20).map((p) => (
                                        <li key={`${p.rowNumber}-${p.message}`}>
                                            Row {p.rowNumber}: {p.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={reset}>
                                    Import another file
                                </Button>
                                <Button onClick={() => window.location.reload()}>Done</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="border-input bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                                <div className="text-sm">
                                    <strong>1.</strong> Fill in the template, one placing per row.
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

                            <label className="border-input bg-muted/40 block rounded-lg border p-3 text-sm">
                                <strong>2.</strong> Choose the filled-in file (.csv — Excel and Google Sheets both save as CSV).
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    className="mt-2 block w-full text-sm"
                                    onChange={(e) => onFile(e.target.files?.[0])}
                                />
                            </label>

                            {parseError && <p className="text-destructive m-0 text-sm">{parseError}</p>}

                            {parsed && fatal.length > 0 && (
                                <div className="border-destructive/40 bg-destructive/10 rounded-lg border p-3 text-sm">
                                    {fatal.map((p) => (
                                        <p key={p.message} className="m-0">
                                            {p.message}
                                        </p>
                                    ))}
                                    <p className="text-muted-foreground m-0 mt-1 text-xs">
                                        The template&rsquo;s columns are: {TEMPLATE_COLUMNS.map((c) => c.header).join(", ")}.
                                    </p>
                                </div>
                            )}

                            {parsed && fatal.length === 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="m-0 text-sm">
                                        <strong>3.</strong> {fileName}: {parsed.records.length} placing{parsed.records.length === 1 ? "" : "s"} ready
                                        {rowProblems.length > 0 && `, ${rowProblems.length} row${rowProblems.length === 1 ? "" : "s"} with a problem`}
                                        {parsed.unknownHeaders.length > 0 && (
                                            <span className="text-muted-foreground block text-xs">
                                                Ignored columns: {parsed.unknownHeaders.join(", ")}
                                            </span>
                                        )}
                                    </p>
                                    {preview.length > 0 && (
                                        <div className="border-input overflow-x-auto rounded-lg border">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-muted/60 text-left">
                                                        <th className="px-2 py-1">Show</th>
                                                        <th className="px-2 py-1">Date</th>
                                                        <th className="px-2 py-1">Class</th>
                                                        <th className="px-2 py-1">Placing</th>
                                                        <th className="px-2 py-1">Size</th>
                                                        <th className="px-2 py-1">Card</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {preview.map(({ rowNumber, record }) => (
                                                        <tr key={rowNumber} className="border-input border-t">
                                                            <td className="px-2 py-1">{record.showName}</td>
                                                            <td className="px-2 py-1">{record.showDate ?? record.showDateText ?? "—"}</td>
                                                            <td className="px-2 py-1">{[record.division, record.className].filter(Boolean).join(" · ") || "—"}</td>
                                                            <td className="px-2 py-1">{record.placing}</td>
                                                            <td className="px-2 py-1">{record.classSize ?? "—"}</td>
                                                            <td className="px-2 py-1">{record.qualifierProgram ? `${record.qualifierProgram.toUpperCase()} ${record.qualifierCard ?? ""}` : "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {parsed.records.length > preview.length && (
                                                <p className="text-muted-foreground m-0 px-2 py-1 text-xs">…and {parsed.records.length - preview.length} more.</p>
                                            )}
                                        </div>
                                    )}
                                    {rowProblems.length > 0 && (
                                        <ul className="text-destructive m-0 list-disc pl-5 text-xs">
                                            {rowProblems.slice(0, 20).map((p) => (
                                                <li key={`${p.rowNumber}-${p.message}`}>
                                                    Row {p.rowNumber}: {p.message}
                                                </li>
                                            ))}
                                            {rowProblems.length > 20 && <li>…and {rowProblems.length - 20} more.</li>}
                                        </ul>
                                    )}
                                    {error && <p className="text-destructive m-0 text-sm">{error}</p>}
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="outline" onClick={() => setOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={submit} disabled={busy || parsed.records.length === 0} id="import-show-records-go">
                                            {busy ? "Importing…" : `Import ${parsed.records.length} placing${parsed.records.length === 1 ? "" : "s"}`}
                                        </Button>
                                    </div>
                                    {rowProblems.length > 0 && (
                                        <p className="text-muted-foreground m-0 text-xs">
                                            Rows with a problem are skipped; fix them in the sheet and import that file again.
                                        </p>
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
