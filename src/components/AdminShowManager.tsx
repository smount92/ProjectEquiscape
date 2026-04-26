"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { updateShowStatus, deleteShow } from"@/app/actions/shows";

interface AdminShow {
 id: string;
 title: string;
 status: string;
 endAt: string | null;
 entryCount: number;
}

export default function AdminShowManager({ shows }: { shows: AdminShow[] }) {
 const router = useRouter();
 const [busy, setBusy] = useState<string | null>(null);

 const handleStatusChange = async (showId: string, newStatus: string) => {
 setBusy(showId);
 await updateShowStatus(showId, newStatus as"open" |"judging" |"closed");
 router.refresh();
 setBusy(null);
 };

 const handleDelete = async (showId: string, title: string) => {
 if (!confirm(`Delete"${title}" and all its entries? This cannot be undone.`)) return;
 setBusy(showId);
 await deleteShow(showId);
 router.refresh();
 setBusy(null);
 };

 if (shows.length === 0) {
 return <p className="text-stone-500">No shows yet. Create one above.</p>;
 }

 return (
 <div className="flex flex-col gap-2">
 {shows.map((show) => (
 <div
 key={show.id}
 className="flex flex-wrap items-center gap-2 border-b border-input py-4 last:border-b-0"
 >
 <div className="min-w-[200px] flex-1">
 <div className="font-semibold">{show.title}</div>
 <div className="text-stone-500 text-xs">
 🐴 {show.entryCount} entries
 {show.endAt && <> · ⏰ {new Date(show.endAt).toLocaleDateString()}</>}
 </div>
 </div>
 <select
 value={show.status}
 onChange={(e) => handleStatusChange(show.id, e.target.value)}
 className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-auto min-w-[120px]"
 disabled={busy === show.id}
 title={`Status for ${show.title}`}
 >
 <option value="open">🟢 Open</option>
 <option value="judging">🟡 Judging</option>
 <option value="closed">🔴 Closed</option>
 </select>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-red-700 no-underline transition-all"
 onClick={() => handleDelete(show.id, show.title)}
 disabled={busy === show.id}
 >
 🗑 Delete
 </button>
 </div>
 ))}
 </div>
 );
}
