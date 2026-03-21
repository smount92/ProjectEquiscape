"use client";

import { useState } from"react";
import { dismissReport, actionReport } from"@/app/actions/moderation";
import { useRouter } from"next/navigation";

export default function ReportActions({ reportId }: { reportId: string }) {
 const router = useRouter();
 const [saving, setSaving] = useState(false);

 const handleDismiss = async () => {
 setSaving(true);
 await dismissReport(reportId);
 router.refresh();
 };

 const handleAction = async () => {
 const notes = prompt("Admin notes (what action was taken):");
 if (!notes) return;
 setSaving(true);
 await actionReport(reportId, notes);
 router.refresh();
 };

 return (
 <div className="mt-1 gap-1" style={{ display:"flex" }}>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 onClick={handleDismiss}
 disabled={saving}
 >
 ✅ Dismiss
 </button>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleAction}
 disabled={saving}
 >
 ⚡ Take Action
 </button>
 </div>
 );
}
