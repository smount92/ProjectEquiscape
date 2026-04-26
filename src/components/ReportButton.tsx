"use client";

import { useState, useEffect } from"react";
import { submitReport, getReportReasons } from"@/app/actions/moderation";

export default function ReportButton({
 targetType,
 targetId,
}: {
 targetType:"post" |"horse" |"user" |"comment" |"message";
 targetId: string;
}) {
 const [showForm, setShowForm] = useState(false);
 const [reason, setReason] = useState("");
 const [details, setDetails] = useState("");
 const [saving, setSaving] = useState(false);
 const [done, setDone] = useState(false);
 const [error, setError] = useState("");
 const [reasons, setReasons] = useState<string[]>([]);

 useEffect(() => {
 if (showForm && reasons.length === 0) {
 getReportReasons().then(setReasons);
 }
 }, [showForm, reasons.length]);

 const handleSubmit = async () => {
 if (!reason) return;
 setSaving(true);
 setError("");
 const result = await submitReport({
 targetType,
 targetId,
 reason,
 details: details.trim() || undefined,
 });
 if (result.success) {
 setDone(true);
 } else {
 setError(result.error ||"Failed to submit report.");
 }
 setSaving(false);
 };

 if (done) {
 return <span className="text-stone-500 text-xs">✅ Reported</span>;
 }

 if (!showForm) {
 return (
 <button
 className="cursor-pointer border-none bg-transparent p-1 text-xs text-stone-500"
 onClick={() => setShowForm(true)}
 title="Report"
 >
 🚩 Report
 </button>
 );
 }

 return (
 <div className="bg-card border-input mt-2 rounded-lg border p-4 shadow-md transition-all">
 <select
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 mb-2 text-sm"
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 title="Report reason"
 >
 <option value="">Select a reason…</option>
 {reasons.map((r) => (
 <option key={r} value={r}>
 {r}
 </option>
 ))}
 </select>
 <textarea
 className="inline-flex min-h-[36px] w-full rounded-md border border-input bg-transparent px-4 py-2 text-sm no-underline transition-all mb-2"
 placeholder="Additional details (optional)"
 value={details}
 onChange={(e) => setDetails(e.target.value)}
 rows={2}
 maxLength={500}
 />
 {error && <p className="mb-1 text-xs text-[#ef4444]">{error}</p>}
 <div className="flex gap-1">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 onClick={handleSubmit}
 disabled={saving || !reason}
 >
 {saving ?"…" :"Submit Report"}
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => setShowForm(false)}
 >
 Cancel
 </button>
 </div>
 </div>
 );
}
