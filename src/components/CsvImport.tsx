"use client";

import { useState, useCallback, useRef, useEffect } from"react";
import Papa from"papaparse";
import fuzzysort from"fuzzysort";
import type { CsvRow, MatchResult, ReferenceMatch } from"@/lib/types/csv-import";
import { executeBatchImport } from"@/app/actions/csv-import";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DictRelease = { i: string; n: string; m: string | null; c: string | null; mn: string | null; mf: string | null };
type DictResin = { i: string; n: string; s: string };
interface RefDict {
 releases: DictRelease[];
 resins: DictResin[];
}

// ============================================================
// Column mapping presets — auto-detect common CSV headers
// ============================================================

const HEADER_MAP: Record<string, string> = {
 name:"name",
"horse name":"name",
 model:"name",
"model name":"name",
 horse:"name",
 mold:"mold",
"mold name":"mold",
"mold/model":"mold",
 moldname:"mold",
 sculpt:"mold",
 manufacturer:"manufacturer",
 brand:"manufacturer",
 maker:"manufacturer",
 company:"manufacturer",
 condition:"condition",
"condition grade":"condition",
 grade:"condition",
 finish:"finish_type",
"finish type":"finish_type",
 type:"finish_type",
"purchase price":"purchase_price",
 price:"purchase_price",
 paid:"purchase_price",
 cost:"purchase_price",
"estimated value":"estimated_value",
 value:"estimated_value",
 worth:"estimated_value",
"current value":"estimated_value",
 notes:"notes",
 note:"notes",
 comments:"notes",
 description:"notes",
};

const MHH_FIELDS = [
 { value:"", label:"— Skip —" },
 { value:"name", label:"Name" },
 { value:"mold", label:"Mold / Model" },
 { value:"manufacturer", label:"Manufacturer" },
 { value:"condition", label:"Condition" },
 { value:"finish_type", label:"Finish Type" },
 { value:"purchase_price", label:"Purchase Price" },
 { value:"estimated_value", label:"Estimated Value" },
 { value:"notes", label:"Notes" },
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
 .then((data: RefDict) => {
 dictRef.current = data;
 })
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
 [handleFile],
 );

 const handleFileInput = useCallback(
 (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) handleFile(file);
 },
 [handleFile],
 );

 // ── Step 2: Column Mapping ───────────────────────────────────
 const handleMappingChange = (csvCol: string, mhhField: string) => {
 setColumnMapping((prev) => ({ ...prev, [csvCol]: mhhField }));
 };

 const proceedToMatch = async () => {
 setIsMatching(true);

 // Build mapped rows from CSV data + column mapping
 const mappedRows = csvData.map((row) => {
 const mapped: {
 name: string;
 mold: string;
 manufacturer: string;
 condition: string;
 finish_type: string;
 purchase_price: string;
 estimated_value: string;
 notes: string;
 [key: string]: string;
 } = {
 name:"",
 mold:"",
 manufacturer:"",
 condition:"",
 finish_type:"",
 purchase_price:"",
 estimated_value:"",
 notes:"",
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
 const display = [r.mf, r.m ? `#${r.m}` : null,"—", r.n, r.mn].filter(Boolean).join("");
 const searchText = [r.n, r.mn, r.c, r.m, r.mf].filter(Boolean).join("");
 return {
 id: r.i,
 display,
 searchText,
 manufacturer: r.mf ??"Unknown",
 mold_name: r.mn ??"Unknown",
 release_name: r.n,
 };
 });

 const resinTargets = dict.resins.map((r) => {
 const display = `${r.s} — ${r.n}`;
 const searchText = `${r.n} ${r.s}`;
 return { id: r.i, display, searchText, sculptor_alias: r.s, resin_name: r.n };
 });

 const results: MatchResult[] = mappedRows.map((row, index) => {
 const searchQuery = [row.name, row.mold, row.manufacturer].filter(Boolean).join("").trim();

 if (!searchQuery) {
 return {
 csvRow: row as unknown as Record<string, string>,
 rowIndex: index,
 status:"no_match" as const,
 matches: [],
 selectedMatch: null,
 customName: row.name || `Import Row ${index + 1}`,
 };
 }

 const releaseResults = fuzzysort.go(searchQuery, releaseTargets, {
 key:"searchText",
 limit: 3,
 threshold: -2000,
 });
 const resinResults = fuzzysort.go(searchQuery, resinTargets, {
 key:"searchText",
 limit: 3,
 threshold: -2000,
 });

 const allMatches: ReferenceMatch[] = [];
 for (const res of releaseResults) {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const obj = res.obj as any;
 allMatches.push({
 id: obj.id,
 score: res.score,
 display: obj.display,
 manufacturer: obj.manufacturer,
 mold_name: obj.mold_name,
 release_name: obj.release_name,
 table:"catalog_items",
 });
 }
 for (const res of resinResults) {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const obj = res.obj as any;
 allMatches.push({
 id: obj.id,
 score: res.score,
 display: obj.display,
 manufacturer: obj.sculptor_alias,
 mold_name: obj.resin_name,
 release_name: obj.resin_name,
 table:"catalog_items",
 });
 }

 allMatches.sort((a, b) => b.score - a.score);
 const topMatches = allMatches.slice(0, 3);
 const bestScore = topMatches[0]?.score ?? -Infinity;
 const status = bestScore >= -50 ?"perfect" : topMatches.length > 0 ?"review" :"no_match";

 return {
 csvRow: row as unknown as Record<string, string>,
 rowIndex: index,
 status: status as"perfect" |"review" |"no_match",
 matches: topMatches,
 selectedMatch: status ==="perfect" ? topMatches[0] : null,
 customName: row.name || `Import Row ${index + 1}`,
 };
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
 : r,
 ),
 );
 };

 const handleCustomNameChange = (rowIndex: number, name: string) => {
 setMatchResults((prev) => prev.map((r) => (r.rowIndex === rowIndex ? { ...r, customName: name } : r)));
 };

 const perfectCount = matchResults.filter((r) => r.status ==="perfect").length;
 const reviewCount = matchResults.filter((r) => r.status ==="review").length;
 const noMatchCount = matchResults.filter((r) => r.status ==="no_match").length;

 // Publish to feed toggle — defaults to off for batch imports
 const [publishToFeed, setPublishToFeed] = useState(false);

 // ── Step 4: Import ──────────────────────────────────────────
 const handleImport = async () => {
 setIsImporting(true);

 const confirmedRows = matchResults.map((r) => ({
 customName: r.customName,
 condition: (r.csvRow as Record<string, string>).condition ||"",
 finishType: (r.csvRow as Record<string, string>).finish_type ||"",
 purchasePrice: (r.csvRow as Record<string, string>).purchase_price ||"",
 estimatedValue: (r.csvRow as Record<string, string>).estimated_value ||"",
 notes: (r.csvRow as Record<string, string>).notes ||"",
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
 <div className="relative mb-12 flex justify-center gap-12">
 {[
 { num: 1, label:"Upload" },
 { num: 2, label:"Map Columns" },
 { num: 3, label:"Review Matches" },
 { num: 4, label:"Import" },
 ].map((s) => (
 <div
 key={s.num}
 className={`csv-step-dot ${step >= s.num ?"active" :""} ${step === s.num ?"current" :""}`}
 >
 <span className="bg-card border-edge text-muted flex h-[36px] w-[36px] items-center justify-center rounded-full rounded-lg border border-[2px] text-sm font-bold shadow-md transition-all">
 {s.num}
 </span>
 <span className="text-muted text-xs font-medium transition-all">{s.label}</span>
 </div>
 ))}
 </div>

 {/* ═══ Step 1: Upload ═══ */}
 {step === 1 && (
 <div className="animate-fade-in-up mx-auto max-w-[900px]">
 <h2>📄 Upload Your CSV</h2>
 <p className="mb-8 text-base leading-[1.6] text-[var(--color-text-secondary)]">
 Export your spreadsheet as CSV and upload it here. We&apos;ll match your models against our
 10,500+ reference database.
 </p>

 <div
 className={`csv-dropzone ${dragOver ?"dragover" :""}`}
 onDragOver={(e) => {
 e.preventDefault();
 setDragOver(true);
 }}
 onDragLeave={() => setDragOver(false)}
 onDrop={handleDrop}
 onClick={() => fileInputRef.current?.click()}
 >
 <div className="mb-4 text-[3rem] opacity-[0.7]">📁</div>
 <p className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-edge bg-card p-8 text-center transition-all">
 Drag &amp; drop your CSV file here
 <br />
 <span className="text-forest text-sm underline">or click to browse</span>
 </p>
 <input
 ref={fileInputRef}
 type="file"
 accept=".csv"
 onChange={handleFileInput}
 style={{ display:"none" }}
 id="csv-file-input"
 />
 </div>

 {parseError && (
 <div className="text-danger mt-4 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-6 py-4 text-sm">
 {parseError}
 </div>
 )}

 <div className="mt-6 text-center">
 <a
 href="/templates/mhh_import_template.csv"
 download
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 📥 Download CSV Template
 </a>
 </div>
 </div>
 )}

 {/* ═══ Step 2: Column Mapping ═══ */}
 {step === 2 && (
 <div className="animate-fade-in-up mx-auto max-w-[900px]">
 <h2>🔗 Map Your Columns</h2>
 <p className="mb-8 text-base leading-[1.6] text-[var(--color-text-secondary)]">
 We detected <strong>{csvHeaders.length}</strong> columns and <strong>{csvData.length}</strong>{""}
 rows. Map each column to a Model Horse Hub field.
 </p>

 <div className="mb-8 flex flex-col gap-4">
 {csvHeaders.map((header) => (
 <div
 key={header}
 className="bg-card border-edge flex items-center gap-4 rounded-lg rounded-md border px-6 py-4 shadow-md transition-all"
 >
 <span className="text-ink min-w-0 flex-1 overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap">
 {header}
 </span>
 <span className="text-muted shrink-0 text-base">
 →
 </span>
 <select
 className="bg-input border-edge-input text-ink flex-1 cursor-pointer rounded-sm border px-4 py-2 font-sans text-sm"
 value={columnMapping[header] ||""}
 onChange={(e) => handleMappingChange(header, e.target.value)}
 id={`mapping-${header.replace(/\s+/g,"-")}`}
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
 <div className="border-edge overflow-x-auto rounded-md border">
 <table className="bg-elevated text-ink border-edge border-b px-4 py-2 text-left font-semibold whitespace-nowrap">
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

 <div className="border-edge flex items-center justify-between gap-4 border-t pt-6">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setStep(1)}
 >
 ← Back
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={proceedToMatch}
 disabled={isMatching || !Object.values(columnMapping).some((v) => v ==="name")}
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

 {!Object.values(columnMapping).some((v) => v ==="name") && (
 <p className="text-warning mt-4 text-center text-sm">
 ⚠️ You must map at least one column to <strong>Name</strong> to proceed.
 </p>
 )}
 </div>
 )}

 {/* ═══ Step 3: Reconciliation ═══ */}
 {step === 3 && (
 <div className="animate-fade-in-up mx-auto max-w-[900px]">
 <h2>🔍 Review Matches</h2>
 <p className="mb-8 text-base leading-[1.6] text-[var(--color-text-secondary)]">
 We matched your {matchResults.length} rows against the reference database. Review and confirm
 the matches below.
 </p>

 {/* Match summary badges */}
 <div className="mb-8 flex flex-wrap gap-4">
 <span className="bg-[rgba(92,224,160,0.12)] text-success border-[rgba(92,224,160,0.25)] perfect border">
 ✅ {perfectCount} perfect
 </span>
 <span className="bg-[rgba(92,224,160,0.12)] text-success border-[rgba(92,224,160,0.25)] review border">
 ⚠️ {reviewCount} review
 </span>
 <span className="bg-[rgba(92,224,160,0.12)] text-success border-[rgba(92,224,160,0.25)] no-match border">
 ❌ {noMatchCount} no match
 </span>
 </div>

 {/* Match cards */}
 <div className="mb-8 flex max-h-[600px] flex-col gap-4 overflow-y-auto pr-2">
 {matchResults.map((result) => (
 <div
 key={result.rowIndex}
 className={`csv-match-card ${result.status}`}
 id={`match-row-${result.rowIndex}`}
 >
 <div className="px-6 py-6">
 <span className="shrink-0 text-xl">
 {result.status ==="perfect" ?"✅" : result.status ==="review" ?"⚠️" :"❌"}
 </span>
 <input
 className="bg-input border-edge-input text-ink flex-1 rounded-sm border px-4 py-2 font-sans text-base font-semibold"
 value={result.customName}
 onChange={(e) => handleCustomNameChange(result.rowIndex, e.target.value)}
 placeholder="Horse name..."
 />
 </div>

 {/* CSV row preview */}
 <div className="mb-4 flex flex-wrap gap-1">
 {Object.entries(result.csvRow)
 .filter(([, v]) => v)
 .slice(0, 4)
 .map(([k, v]) => (
 <span
 key={k}
 className="bg-elevated text-muted rounded-sm px-[8px] py-[2px] text-xs"
 >
 {k}: {v}
 </span>
 ))}
 </div>

 {/* Match options */}
 {result.matches.length > 0 && (
 <div className="flex flex-col gap-2">
 {result.matches.map((match) => (
 <label
 key={match.id}
 className="flex cursor-pointer items-start gap-2 rounded-sm px-4 py-2 transition-colors"
 >
 <input
 type="radio"
 name={`match-${result.rowIndex}`}
 checked={result.selectedMatch?.id === match.id}
 onChange={() => handleSelectMatch(result.rowIndex, match)}
 />
 <span className="transition-colors-text flex cursor-pointer items-start gap-2 rounded-sm px-4 py-2">
 <span className="text-ink text-sm">{match.display}</span>
 <span className="text-muted text-xs tabular-nums">
 Score: {match.score > 0 ? `+${match.score}` : match.score}
 </span>
 </span>
 </label>
 ))}
 <label className="flex cursor-pointer items-start gap-2 rounded-sm px-4 py-2 transition-colors">
 <input
 type="radio"
 name={`match-${result.rowIndex}`}
 checked={result.selectedMatch === null}
 onChange={() => handleSelectMatch(result.rowIndex, null)}
 />
 <span className="transition-colors-text flex cursor-pointer items-start gap-2 rounded-sm px-4 py-2">
 <span className="text-ink text-sm">
 Custom / Unknown — no reference link
 </span>
 </span>
 </label>
 </div>
 )}

 {result.matches.length === 0 && (
 <p className="text-muted text-sm italic">
 No matches found in the reference database. This model will be imported as
 custom/unknown.
 </p>
 )}
 </div>
 ))}
 </div>

 <div className="border-edge flex items-center justify-between gap-4 border-t pt-6">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={() => setStep(2)}
 >
 ← Back
 </button>
 <div className="items-end gap-2" style={{ display:"flex", flexDirection:"column" }}>
 <label
 className="gap-2 text-sm"
 style={{ display:"flex", alignItems:"center", cursor:"pointer" }}
 >
 <input
 type="checkbox"
 checked={publishToFeed}
 onChange={(e) => setPublishToFeed(e.target.checked)}
 />
 <span>Publish imported models to the community feed</span>
 </label>
 <span className="text-muted mt-1 block text-xs" style={{ textAlign:"right" }}>
 Models without photos will be excluded regardless.
 </span>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
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
 <div className="animate-fade-in-up mx-auto max-w-[900px]">
 {importResult?.success ? (
 <div className="text-success">
 <div className="csv-success-icon">🎉</div>
 <h2>Import Complete!</h2>
 <p className="text-ink-light mb-8 text-base">
 Successfully imported <strong>{importResult.imported}</strong> model
 {importResult.imported !== 1 ?"s" :""} to your stable.
 </p>
 <div className="flex flex-wrap justify-center gap-4">
 <a
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 >
 🐴 View Your Stable
 </a>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
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
 <div className="bg-card border-edge rounded-lg border px-8 py-12 text-center shadow-md transition-all">
 <div className="mb-6 text-[4rem]">❌</div>
 <h2>Import Failed</h2>
 <p>{importResult?.error ||"An unexpected error occurred."}</p>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={() => setStep(3)}
 >
 ← Back to Review
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
