"use client";

import { useState } from"react";
import { featureHorse } from"@/app/actions/admin";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function FeatureHorseForm() {
 const [horseId, setHorseId] = useState("");
 const [title, setTitle] = useState("Horse of the Week");
 const [description, setDescription] = useState("");
 const [status, setStatus] = useState<"idle" |"saving" |"saved" |"error">("idle");
 const [errorMsg, setErrorMsg] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!horseId.trim() || !title.trim() || status ==="saving") return;

 setStatus("saving");
 setErrorMsg("");

 const result = await featureHorse({
 horseId: horseId.trim(),
 title: title.trim(),
 description: description.trim() || undefined,
 });

 if (result.success) {
 setStatus("saved");
 setHorseId("");
 setDescription("");
 setTimeout(() => setStatus("idle"), 3000);
 } else {
 setErrorMsg(result.error ||"Failed to feature horse.");
 setStatus("error");
 setTimeout(() => setStatus("idle"), 3000);
 }
 };

 return (
 <form onSubmit={handleSubmit} className="flex max-w-[500px] flex-col gap-4">
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Horse ID (UUID)</label>
 <Input
 type="text"
 
 value={horseId}
 onChange={(e) => setHorseId(e.target.value)}
 placeholder="Paste the public horse ID here…"
 required
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Title</label>
 <Input
 type="text"
 
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 required
 />
 </div>
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Description (optional)</label>
 <Textarea
 
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Why is this horse being featured?"
 rows={2}
 />
 </div>

 {status ==="error" && errorMsg && <div className="mt-2 text-sm text-red-700 mb-4">{errorMsg}</div>}

 {status ==="saved" && (
 <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-[#22C55E]">
 ✅ Horse featured successfully!
 </div>
 )}

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
 disabled={status ==="saving"}
 >
 {status ==="saving" ?"Featuring…" :"🌟 Feature This Horse"}
 </button>
 </form>
 );
}
