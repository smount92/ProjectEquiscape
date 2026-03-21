"use client";

import { useState } from"react";

export default function ExportButton() {
 const [loading, setLoading] = useState(false);

 const handleExport = async () => {
 setLoading(true);
 try {
 const response = await fetch("/api/export");
 if (!response.ok) throw new Error("Export failed");

 const blob = await response.blob();
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download ="my_digital_stable.csv";
 document.body.appendChild(a);
 a.click();
 a.remove();
 window.URL.revokeObjectURL(url);
 } catch {
 alert("Failed to export. Please try again.");
 } finally {
 setLoading(false);
 }
 };

 return (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={handleExport}
 disabled={loading}
 id="export-csv-button"
 title="Download your entire stable as a CSV file for insurance or backup"
 >
 {loading ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 style={{ width: 14, height: 14 }}
 aria-hidden="true"
 />
 Exporting…
 </>
 ) : (
 <>
 <svg
 width="14"
 height="14"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
 <polyline points="7 10 12 15 17 10" />
 <line x1="12" y1="15" x2="12" y2="3" />
 </svg>
 Export CSV
 </>
 )}
 </button>
 );
}
