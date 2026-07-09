"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { updateShowStatus } from"@/app/actions/shows";
import { Button } from "@/components/ui/button";

interface CloseShowButtonProps {
 showId: string;
}

export default function CloseShowButton({ showId }: CloseShowButtonProps) {
 const router = useRouter();
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");

 const handleClose = async () => {
 if (
 !confirm(
"Close this show and calculate final results?\n\nThis will:\n• Rank all entries by vote count\n• Assign placings (1st, 2nd, 3rd…)\n• Auto-generate show records for the top 10\n\nThis cannot be undone.",
 )
 )
 return;

 setBusy(true);
 setError("");
 const result = await updateShowStatus(showId,"closed");
 if (result.success) {
 router.refresh();
 } else {
 setError(result.error ||"Failed to close show.");
 }
 setBusy(false);
 };

 return (
 <div
 className="animate-fade-in-up mb-6 rounded-lg border border-teal-300 bg-teal-50 p-6 text-center shadow-md transition-all"
 >
 <div className="mb-2 text-[2rem]">⏰</div>
 <h3 className="mb-1">Entry Period Has Ended</h3>
 <p className="text-muted-foreground mb-4 text-sm">
 Close this show to calculate results and generate show records for the top finishers.
 </p>
 <Button className="min-w-[220px]"
 onClick={handleClose}
 disabled={busy}
 >
 {busy ?"Calculating Results…" :"🏆 Close Show & Calculate Results"}
 </Button>
 {error && (
 <p className="text-red-700 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 {error}
 </p>
 )}
 </div>
 );
}
