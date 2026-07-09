"use client";

import { useState } from"react";
import { dismissReport, actionReport } from"@/app/actions/moderation";
import { useRouter } from"next/navigation";
import { Button } from "@/components/ui/button";

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
 <div className="mt-1 flex gap-1">
 <Button variant="outline" size="wide"
 onClick={handleDismiss}
 disabled={saving}
 >
 ✅ Dismiss
 </Button>
 <Button
 onClick={handleAction}
 disabled={saving}
 >
 ⚡ Take Action
 </Button>
 </div>
 );
}
