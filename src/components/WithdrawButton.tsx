"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { withdrawEntry } from"@/app/actions/shows";

export default function WithdrawButton({ entryId }: { entryId: string }) {
 const router = useRouter();
 const [busy, setBusy] = useState(false);

 const handleWithdraw = async () => {
 if (!confirm("Remove your entry from this show?")) return;
 setBusy(true);
 await withdrawEntry(entryId);
 router.refresh();
 };

 return (
 <button
 className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-2 py-[2px] text-xs font-semibold text-[var(--color-error,#ef4444)] no-underline transition-all"
 onClick={handleWithdraw}
 disabled={busy}
 title="Withdraw your entry"
 >
 {busy ?"…" :"✕ Withdraw"}
 </button>
 );
}
