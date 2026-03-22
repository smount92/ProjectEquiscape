"use client";

import { useState } from"react";
import { createPhotoShow } from"@/app/actions/shows";

export default function CreateShowForm() {
 const [title, setTitle] = useState("");
 const [theme, setTheme] = useState("");
 const [description, setDescription] = useState("");
 const [endAt, setEndAt] = useState("");
 const [status, setStatus] = useState<"idle" |"saving" |"saved" |"error">("idle");
 const [errorMsg, setErrorMsg] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!title.trim() || status ==="saving") return;

 setStatus("saving");
 setErrorMsg("");

 const result = await createPhotoShow({
 title: title.trim(),
 theme: theme.trim() || undefined,
 description: description.trim() || undefined,
 endAt: endAt || undefined,
 });

 if (result.success) {
 setStatus("saved");
 setTitle("");
 setTheme("");
 setDescription("");
 setEndAt("");
 setTimeout(() => setStatus("idle"), 3000);
 } else {
 setErrorMsg(result.error ||"Failed to create show.");
 setStatus("error");
 setTimeout(() => setStatus("idle"), 3000);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="flex max-w-[500px] flex-col gap-4">
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Show Title</label>
 <input
 type="text"
 className="form-input"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. Spring Breyer Showcase"
 required
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Theme (optional)</label>
 <input
 type="text"
 className="form-input"
 value={theme}
 onChange={(e) => setTheme(e.target.value)}
 placeholder="e.g. Best OF Breyer"
 />
 </div>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Description (optional)</label>
 <textarea
 className="form-input"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Show rules and details…"
 rows={2}
 />
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Entries Close (optional)</label>
 <input
 type="datetime-local"
 className="form-input"
 value={endAt}
 onChange={(e) => setEndAt(e.target.value)}
 />
 <p className="text-muted mt-[4px] text-[calc(0.75rem*var(--font-scale))]">
 Leave blank for no deadline. Show stays open until manually closed.
 </p>
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-danger mb-4">{errorMsg}</div>}
 {status ==="saved" && (
 <div className="mb-4 rounded-md border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-4 py-2 text-[calc(0.85rem*var(--font-scale))] text-[#22C55E]">
 ✅ Show created!
 </div>
 )}

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={status ==="saving"}
 >
 {status ==="saving" ?"Creating…" :"📸 Create Photo Show"}
 </button>
 </form>
 );
}
