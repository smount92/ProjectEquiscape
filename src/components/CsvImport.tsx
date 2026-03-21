"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import fuzzysort from "fuzzysort";
import type { CsvRow, MatchResult, ReferenceMatch } from "@/lib/types/csv-import";
import { executeBatchImport } from "@/app/actions/csv-import";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DictRelease = { i: string; n: string; m: string | null; c: string | null; mn: string | null; mf: string | null };
type DictResin = { i: string; n: string; s: string };
interface RefDict { releases: DictRelease[]; resins: DictResin[] }

// ============================================================
// Column mapping presets — auto-detect common CSV headers
// ============================================================

const HEADER_MAP: Record<string, string> = {
    name: "name",
    "horse name": "name",
    model: "name",
    "model name": "name",
    horse: "name",
    mold: "mold",
    "mold name": "mold",
    "mold/model": "mold",
    moldname: "mold",
    sculpt: "mold",
    manufacturer: "manufacturer",
    brand: "manufacturer",
    maker: "manufacturer",
    company: "manufacturer",
    condition: "condition",
    "condition grade": "condition",
    grade: "condition",
    finish: "finish_type",
    "finish type": "finish_type",
    type: "finish_type",
    "purchase price": "purchase_price",
    price: "purchase_price",
    paid: "purchase_price",
    cost: "purchase_price",
    "estimated value": "estimated_value",
    value: "estimated_value",
    worth: "estimated_value",
    "current value": "estimated_value",
    notes: "notes",
    note: "notes",
    comments: "notes",
    description: "notes",
};

const MHH_FIELDS = [
    { value: "", label: "— Skip —" },
    { value: "name", label: "Name" },
    { value: "mold", label: "Mold / Model" },
    { value: "manufacturer", label: "Manufacturer" },
    { value: "condition", label: "Condition" },
    { value: "finish_type", label: "Finish Type" },
    { value: "purchase_price", label: "Purchase Price" },
    { value: "estimated_value", label: "Estimated Value" },
    { value: "notes", label: "Notes" },
];

// ============================================================
// Main Component
// ============================================================

export default function CsvImport() {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [csvData, setCsvData] = useState<CsvRow[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const [isMatching, setIsMatching] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: boolean;
        imported?: number;
        error?: string;
    } | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dictRef = useRef<RefDict | null>(null);

    // Fetch reference dictionary on mount (cached for 24h server-side)
    useEffect(() => {
        fetch("/api/reference-dictionary")
            .then((res) => res.json())
            .then((data: RefDict) => { dictRef.current = data; })
            .catch((err) => console.error("[CSV] Failed to load dictionary:", err));
    }, []);

    // ── Step 1: File Upload ──────────────────────────────────────
    const handleFile = useCallback((file: File) => {
        setParseError(null);
        if (!file.name.endsWith(".csv") && !file.name.endsWith(".CSV")) {
            setParseError("Please upload a CSV file.");
            return;
        }

        Papa.parse<CsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                if (result.errors.length > 0) {
                    setParseError(`CSV parse error: ${result.errors[0].message}`);
                    return;
                }
                if (result.data.length === 0) {
                    setParseError("The CSV file is empty or has no data rows.");
                    return;
                }

                const headers = result.meta.fields || [];
                setCsvHeaders(headers);
                setCsvData(result.data);

                // Auto-detect column mappings
                const autoMap: Record<string, string> = {};
                headers.forEach((h) => {
                    const normalized = h.toLowerCase().trim();
                    if (HEADER_MAP[normalized]) {
                        autoMap[h] = HEADER_MAP[normalized];
                    }
                });
                setColumnMapping(autoMap);
                setStep(2);
            },
            error: (err) => {
                setParseError(`Failed to parse CSV: ${err.message}`);
            },
        });
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    // ── Step 2: Column Mapping ───────────────────────────────────
    const handleMappingChange = (csvCol: string, mhhField: string) => {
        setColumnMapping((prev) => ({ ...prev, [csvCol]: mhhField }));
    };

    const proceedToMatch = async () => {
        setIsMatching(true);

        // Build mapped rows from CSV data + column mapping
        const mappedRows = csvData.map((row) => {
            const mapped: { name: string; mold: string; manufacturer: string; condition: string; finish_type: string; purchase_price: string; estimated_value: string; notes: string;[key: string]: string } = {
                name: "",
                mold: "",
                manufacturer: "",
                condition: "",
                finish_type: "",
                purchase_price: "",
                estimated_value: "",
                notes: "",
            };

            for (const [csvCol, mhhField] of Object.entries(columnMapping)) {
                if (mhhField && row[csvCol] !== undefined) {
                    mapped[mhhField] = row[csvCol];
                }
            }

            return mapped;
        });

        // Client-side fuzzy matching using cached dictionary
        if (!dictRef.current) {
            setParseError("Reference dictionary not loaded yet. Please wait and try again.");
            setIsMatching(false);
            return;
        }

        const dict = dictRef.current;

        // Build search targets
        const releaseTargets = dict.releases.map((r) => {
            const display = [r.mf, r.m ? `#${r.m}` : null, "—", r.n, r.mn].filter(Boolean).join(" ");
            const searchText = [r.n, r.mn, r.c, r.m, r.mf].filter(Boolean).join(" ");
            return { id: r.i, display, searchText, manufacturer: r.mf ?? "Unknown", mold_name: r.mn ?? "Unknown", release_name: r.n };
        });

        const resinTargets = dict.resins.map((r) => {
            const display = `${r.s} — ${r.n}`;
            const searchText = `${r.n} ${r.s}`;
            return { id: r.i, display, searchText, sculptor_alias: r.s, resin_name: r.n };
        });

        const results: MatchResult[] = mappedRows.map((row, index) => {
            const searchQuery = [row.name, row.mold, row.manufacturer].filter(Boolean).join(" ").trim();

            if (!searchQuery) {
                return { csvRow: row as unknown as Record<string, string>, rowIndex: index, status: "no_match" as const, matches: [], selectedMatch: null, customName: row.name || `Import Row ${index + 1}` };
            }

            const releaseResults = fuzzysort.go(searchQuery, releaseTargets, { key: "searchText", limit: 3, threshold: -2000 });
            const resinResults = fuzzysort.go(searchQuery, resinTargets, { key: "searchText", limit: 3, threshold: -2000 });

            const allMatches: ReferenceMatch[] = [];
            for (const res of releaseResults) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const obj = res.obj as any;
                allMatches.push({ id: obj.id, score: res.score, display: obj.display, manufacturer: obj.manufacturer, mold_name: obj.mold_name, release_name: obj.release_name, table: "catalog_items" });
            }
            for (const res of resinResults) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const obj = res.obj as any;
                allMatches.push({ id: obj.id, score: res.score, display: obj.display, manufacturer: obj.sculptor_alias, mold_name: obj.resin_name, release_name: obj.resin_name, table: "catalog_items" });
            }

            allMatches.sort((a, b) => b.score - a.score);
            const topMatches = allMatches.slice(0, 3);
            const bestScore = topMatches[0]?.score ?? -Infinity;
            const status = bestScore >= -50 ? "perfect" : topMatches.length > 0 ? "review" : "no_match";

            return { csvRow: row as unknown as Record<string, string>, rowIndex: index, status: status as "perfect" | "review" | "no_match", matches: topMatches, selectedMatch: status === "perfect" ? topMatches[0] : null, customName: row.name || `Import Row ${index + 1}` };
        });

        setIsMatching(false);
        setMatchResults(results);
        setStep(3);
    };

    // ── Step 3: Reconciliation ───────────────────────────────────
    const handleSelectMatch = (rowIndex: number, match: ReferenceMatch | null) => {
        setMatchResults((prev) =>
            prev.map((r) =>
                r.rowIndex === rowIndex
                    ? {
                        ...r,
                        selectedMatch: match,
                        status: match ? ("perfect" as const) : ("no_match" as const),
                    }
                    : r
            )
        );
    };

    const handleCustomNameChange = (rowIndex: number, name: string) => {
        setMatchResults((prev) =>
            prev.map((r) => (r.rowIndex === rowIndex ? { ...r, customName: name } : r))
        );
    };

    const perfectCount = matchResults.filter((r) => r.status === "perfect").length;
    const reviewCount = matchResults.filter((r) => r.status === "review").length;
    const noMatchCount = matchResults.filter((r) => r.status === "no_match").length;

    // Publish to feed toggle — defaults to off for batch imports
    const [publishToFeed, setPublishToFeed] = useState(false);

    // ── Step 4: Import ──────────────────────────────────────────
    const handleImport = async () => {
        setIsImporting(true);

        const confirmedRows = matchResults.map((r) => ({
            customName: r.customName,
            condition: (r.csvRow as Record<string, string>).condition || "",
            finishType: (r.csvRow as Record<string, string>).finish_type || "",
            purchasePrice: (r.csvRow as Record<string, string>).purchase_price || "",
            estimatedValue: (r.csvRow as Record<string, string>).estimated_value || "",
            notes: (r.csvRow as Record<string, string>).notes || "",
            selectedMatch: r.selectedMatch,
        }));

        const result = await executeBatchImport(confirmedRows);
        setImportResult(result);
        setIsImporting(false);
        setStep(4);
    };

    // ── Render ──────────────────────────────────────────────────

    return (
        <div className="mt-8">
            {/* Step Indicator */}
            <div className="flex justify-center gap-12 mb-12 relative">
                {[
                    { num: 1, label: "Upload" },
                    { num: 2, label: "Map Columns" },
                    { num: 3, label: "Review Matches" },
                    { num: 4, label: "Import" },
                ].map((s) => (
                    <div
                        key={s.num}
                        className={`csv-step-dot ${step >= s.num ? "active" : ""} ${step === s.num ? "current" : ""}`}
                    >
                        <span className="flex items-center justify-center w-[36px] h-[36px] rounded-full bg-card border-[2px] border-edge text-muted font-bold text-sm transition-all">{s.num}</span>
                        <span className="text-xs text-muted font-medium transition-all">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* ═══ Step 1: Upload ═══ */}
            {step === 1 && (
                <div className="max-w-[900px] mx-auto animate-fade-in-up">
                    <h2>📄 Upload Your CSV</h2>
                    <p className="text-base text-[var(--color-text-secondary)] mb-8 leading-[1.6]">
                        Export your spreadsheet as CSV and upload it here. We&apos;ll match your models against
                        our 10,500+ reference database.
                    </p>

                    <div
                        className={`csv-dropzone ${dragOver ? "dragover" : ""}`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="text-[3rem] mb-4 opacity-[0.7]">📁</div>
                        <p className="csv-dropzone-text">
                            Drag &amp; drop your CSV file here
                            <br />
                            <span className="text-sm text-forest underline">or click to browse</span>
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileInput}
                            style={{ display: "none" }}
                            id="csv-file-input"
                        />
                    </div>

                    {parseError && <div className="csv-error">{parseError}</div>}

                    <div className="mt-6 text-center">
                        <a href="/templates/mhh_import_template.csv" download className="btn btn-ghost">
                            📥 Download CSV Template
                        </a>
                    </div>
                </div>
            )}

            {/* ═══ Step 2: Column Mapping ═══ */}
            {step === 2 && (
                <div className="max-w-[900px] mx-auto animate-fade-in-up">
                    <h2>🔗 Map Your Columns</h2>
                    <p className="text-base text-[var(--color-text-secondary)] mb-8 leading-[1.6]">
                        We detected <strong>{csvHeaders.length}</strong> columns and{" "}
                        <strong>{csvData.length}</strong> rows. Map each column to a Model Horse Hub field.
                    </p>

                    <div className="flex flex-col gap-4 mb-8">
                        {csvHeaders.map((header) => (
                            <div key={header} className="flex items-center gap-4 py-4 px-6 bg-card border border-edge rounded-md">
                                <span className="flex-1 font-semibold text-sm text-ink min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{header}</span>
                                <span className="csv-mapping-arrow">→</span>
                                <select
                                    className="csv-mapping-select"
                                    value={columnMapping[header] || ""}
                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                    id={`mapping-${header.replace(/\s+/g, "-")}`}
                                >
                                    {MHH_FIELDS.map((f) => (
                                        <option key={f.value} value={f.value}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    {/* Preview first 5 rows */}
                    <div className="mb-8">
                        <h3>Preview (first {Math.min(5, csvData.length)} rows)</h3>
                        <div className="overflow-x-auto rounded-md border border-edge">
                            <table className="bg-elevated py-2 px-4 text-left font-semibold text-ink border-b border-edge whitespace-nowrap">
                                <thead>
                                    <tr>
                                        {csvHeaders.map((h) => (
                                            <th key={h}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvData.slice(0, 5).map((row, i) => (
                                        <tr key={i}>
                                            {csvHeaders.map((h) => (
                                                <td key={h}>{row[h]}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-6 border-t border-edge">
                        <button className="btn btn-ghost" onClick={() => setStep(1)}>
                            ← Back
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={proceedToMatch}
                            disabled={isMatching || !Object.values(columnMapping).some((v) => v === "name")}
                            id="proceed-to-match-btn"
                        >
                            {isMatching ? (
                                <>
                                    <span className="spinner-inline" /> Matching…
                                </>
                            ) : (
                                "Match Against Database →"
                            )}
                        </button>
                    </div>

                    {!Object.values(columnMapping).some((v) => v === "name") && (
                        <p className="text-sm text-warning text-center mt-4">
                            ⚠️ You must map at least one column to <strong>Name</strong> to proceed.
                        </p>
                    )}
                </div>
            )}

            {/* ═══ Step 3: Reconciliation ═══ */}
            {step === 3 && (
                <div className="max-w-[900px] mx-auto animate-fade-in-up">
                    <h2>🔍 Review Matches</h2>
                    <p className="text-base text-[var(--color-text-secondary)] mb-8 leading-[1.6]">
                        We matched your {matchResults.length} rows against the reference database. Review and
                        confirm the matches below.
                    </p>

                    {/* Match summary badges */}
                    <div className="flex gap-4 mb-8 flex-wrap">
                        <span className="bg-[rgba(92, 224, 160, 0.12)] text-success border border-[rgba(92, 224, 160, 0.25)] perfect">✅ {perfectCount} perfect</span>
                        <span className="bg-[rgba(92, 224, 160, 0.12)] text-success border border-[rgba(92, 224, 160, 0.25)] review">⚠️ {reviewCount} review</span>
                        <span className="bg-[rgba(92, 224, 160, 0.12)] text-success border border-[rgba(92, 224, 160, 0.25)] no-match">❌ {noMatchCount} no match</span>
                    </div>

                    {/* Match cards */}
                    <div className="flex flex-col gap-4 mb-8 max-h-[600px] overflow-y-auto pr-2">
                        {matchResults.map((result) => (
                            <div
                                key={result.rowIndex}
                                className={`csv-match-card ${result.status}`}
                                id={`match-row-${result.rowIndex}`}
                            >
                                <div className="p-6 bg-card rounded-md border-l-[4px] border-edge transition-all-header">
                                    <span className="text-xl shrink-0">
                                        {result.status === "perfect"
                                            ? "✅"
                                            : result.status === "review"
                                                ? "⚠️"
                                                : "❌"}
                                    </span>
                                    <input
                                        className="csv-match-name-input"
                                        value={result.customName}
                                        onChange={(e) => handleCustomNameChange(result.rowIndex, e.target.value)}
                                        placeholder="Horse name..."
                                    />
                                </div>

                                {/* CSV row preview */}
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {Object.entries(result.csvRow)
                                        .filter(([, v]) => v)
                                        .slice(0, 4)
                                        .map(([k, v]) => (
                                            <span key={k} className="py-[2px] px-[8px] bg-elevated rounded-sm text-xs text-muted">
                                                {k}: {v}
                                            </span>
                                        ))}
                                </div>

                                {/* Match options */}
                                {result.matches.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {result.matches.map((match) => (
                                            <label key={match.id} className="flex items-start gap-2 py-2 px-4 rounded-sm cursor-pointer transition-colors">
                                                <input
                                                    type="radio"
                                                    name={`match-${result.rowIndex}`}
                                                    checked={result.selectedMatch?.id === match.id}
                                                    onChange={() => handleSelectMatch(result.rowIndex, match)}
                                                />
                                                <span className="flex items-start gap-2 py-2 px-4 rounded-sm cursor-pointer transition-colors-text">
                                                    <span className="text-sm text-ink">{match.display}</span>
                                                    <span className="csv-match-score">
                                                        Score: {match.score > 0 ? `+${match.score}` : match.score}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                        <label className="flex items-start gap-2 py-2 px-4 rounded-sm cursor-pointer transition-colors">
                                            <input
                                                type="radio"
                                                name={`match-${result.rowIndex}`}
                                                checked={result.selectedMatch === null}
                                                onChange={() => handleSelectMatch(result.rowIndex, null)}
                                            />
                                            <span className="flex items-start gap-2 py-2 px-4 rounded-sm cursor-pointer transition-colors-text">
                                                <span className="text-sm text-ink">Custom / Unknown — no reference link</span>
                                            </span>
                                        </label>
                                    </div>
                                )}

                                {result.matches.length === 0 && (
                                    <p className="text-sm text-muted italic">
                                        No matches found in the reference database. This model will be imported as
                                        custom/unknown.
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-6 border-t border-edge">
                        <button className="btn btn-ghost" onClick={() => setStep(2)}>
                            ← Back
                        </button>
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", alignItems: "flex-end" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", cursor: "pointer", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}>
                                <input
                                    type="checkbox"
                                    checked={publishToFeed}
                                    onChange={(e) => setPublishToFeed(e.target.checked)}
                                />
                                <span>Publish imported models to the community feed</span>
                            </label>
                            <span className="form-hint" style={{ textAlign: "right" }}>
                                Models without photos will be excluded regardless.
                            </span>
                            <button
                                className="btn btn-primary"
                                onClick={handleImport}
                                disabled={isImporting}
                                id="import-btn"
                            >
                                {isImporting ? (
                                    <>
                                        <span className="spinner-inline" /> Importing…
                                    </>
                                ) : (
                                    `Import ${matchResults.length} Models →`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Step 4: Import Result ═══ */}
            {step === 4 && (
                <div className="max-w-[900px] mx-auto animate-fade-in-up">
                    {importResult?.success ? (
                        <div className="text-success">
                            <div className="csv-success-icon">🎉</div>
                            <h2>Import Complete!</h2>
                            <p className="csv-success-count">
                                Successfully imported <strong>{importResult.imported}</strong> model
                                {importResult.imported !== 1 ? "s" : ""} to your stable.
                            </p>
                            <div className="flex justify-center gap-4 flex-wrap">
                                <a href="/dashboard" className="btn btn-primary btn-lg">
                                    🐴 View Your Stable
                                </a>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setStep(1);
                                        setCsvData([]);
                                        setCsvHeaders([]);
                                        setColumnMapping({});
                                        setMatchResults([]);
                                        setImportResult(null);
                                    }}
                                >
                                    📄 Import Another CSV
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-[var(--space-3xl)] px-8 bg-card border border-edge rounded-lg">
                            <div className="text-[4rem] mb-6">❌</div>
                            <h2>Import Failed</h2>
                            <p>{importResult?.error || "An unexpected error occurred."}</p>
                            <button className="btn btn-primary" onClick={() => setStep(3)}>
                                ← Back to Review
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
