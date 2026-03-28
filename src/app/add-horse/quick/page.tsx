"use client";

import { useState, useEffect } from"react";
import Link from"next/link";
import { useRouter } from"next/navigation";
import { quickAddHorse } from"@/app/actions/horse";
import UnifiedReferenceSearch from"@/components/UnifiedReferenceSearch";
import type { CatalogItem } from"@/app/actions/reference";
import { createClient } from"@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";

const FINISH_TYPES = ["OF","Custom","Artist Resin"];
const CONDITION_GRADES = [
"Mint",
"Near Mint",
"Excellent",
"Very Good",
"Good",
"Body Quality",
"Fair",
"Poor",
"Play Grade",
"Not Graded",
];

interface RecentAdd {
 id: string;
 name: string;
 finish: string;
 condition: string;
 timestamp: number;
}

export default function QuickAddPage() {
 const router = useRouter();
 const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
 const [customName, setCustomName] = useState("");
 const [finishType, setFinishType] = useState("OF");
 const [conditionGrade, setConditionGrade] = useState("Mint");
 const [collectionId, setCollectionId] = useState("");
 const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
 const [isAdding, setIsAdding] = useState(false);
 const [recentAdds, setRecentAdds] = useState<RecentAdd[]>([]);
 const [error, setError] = useState<string | null>(null);

 // Load user collections
 useEffect(() => {
 async function loadCollections() {
 const supabase = createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase
 .from("user_collections")
 .select("id, name")
 .eq("user_id", user.id)
 .order("name");
 if (data) setCollections(data as { id: string; name: string }[]);
 }
 loadCollections();
 }, []);

 const handleAdd = async () => {
 setIsAdding(true);
 setError(null);
 try {
 const result = await quickAddHorse({
 catalogId: selectedCatalog?.id,
 customName: customName.trim() || undefined,
 finishType,
 conditionGrade,
 collectionId: collectionId || undefined,
 });

 if (!result.success) {
 setError(result.error ||"Failed to add horse.");
 return;
 }

 setRecentAdds((prev) =>
 [
 {
 id: result.horseId!,
 name: result.horseName!,
 finish: finishType,
 condition: conditionGrade,
 timestamp: Date.now(),
 },
 ...prev,
 ].slice(0, 10),
 );

 // Don't clear catalog selection — supports"Duplicate as New"
 } catch {
 setError("An unexpected error occurred.");
 } finally {
 setIsAdding(false);
 }
 };

 const handleDuplicate = () => {
 // Keep catalog, reset only finish for a different variant
 setFinishType("OF");
 setConditionGrade("Mint");
 setCustomName("");
 };

 const timeSince = (ts: number) => {
 const secs = Math.floor((Date.now() - ts) / 1000);
 if (secs < 5) return"just now";
 if (secs < 60) return `${secs}s ago`;
 return `${Math.floor(secs / 60)}m ago`;
 };

 return (
  <FocusLayout title="Quick Add" description="Rapidly add horses to your stable.">
 <div className="animate-fade-in-up mx-auto max-w-[640]">
 <div className="mb-6 flex items-center justify-between">
 <h1>
 ⚡ <span className="text-forest">Quick Add</span>
 </h1>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 >
 ← Back
 </Link>
 </div>

 <div className="bg-white border-stone-200 rounded-lg border p-8 shadow-md transition-all">
 {/* Catalog Search */}
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">🔍 Search Catalog</label>
 <UnifiedReferenceSearch
 selectedCatalogId={selectedCatalog?.id || null}
 onCatalogSelect={(catalogId, item) => {
 setSelectedCatalog(item);
 setCustomName("");
 }}
 onCustomEntry={(name) => {
 setSelectedCatalog(null);
 setCustomName(name);
 }}
 />
 {selectedCatalog && (
 <div className="ring-2 ring-forest bg-forest/5">
 ✅ {selectedCatalog.maker} — {selectedCatalog.title}
 <span className="text-stone-500 text-xs"> ({selectedCatalog.itemType})</span>
 </div>
 )}
 {!selectedCatalog && customName && (
 <div className="ring-2 ring-forest bg-forest/5">✍️ Custom entry: {customName}</div>
 )}
 </div>

 {/* Custom Name (optional if catalog selected) */}
 {!selectedCatalog && (
 <div className="mb-6">
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Name</label>
 <Input
 
 type="text"
 value={customName}
 onChange={(e) => setCustomName(e.target.value)}
 placeholder="e.g. My Black Beauty"
 />
 </div>
 )}

 {/* Quick Selectors Row */}
 <div className="quick-add-selectors max-sm:grid-cols-1">
 <div>
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Finish</label>
 <select
 className="flex h-9 w-full rounded-md border border-edge bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={finishType}
 onChange={(e) => setFinishType(e.target.value)}
 id="quick-finish"
 >
 {FINISH_TYPES.map((f) => (
 <option key={f} value={f}>
 {f}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Condition</label>
 <select
 className="flex h-9 w-full rounded-md border border-edge bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={conditionGrade}
 onChange={(e) => setConditionGrade(e.target.value)}
 id="quick-condition"
 >
 {CONDITION_GRADES.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-stone-900 mb-1 block text-sm font-semibold">Collection</label>
 <select
 className="flex h-9 w-full rounded-md border border-edge bg-[#FEFCF8] px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
 value={collectionId}
 onChange={(e) => setCollectionId(e.target.value)}
 id="quick-collection"
 >
 <option value="">— None —</option>
 {collections.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Error */}
 {error && (
 <div className="text-red-700 mt-2 mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm">
 ⚠️ {error}
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex flex-wrap items-center gap-4">
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleAdd}
 disabled={isAdding || (!selectedCatalog && !customName.trim())}
 id="quick-add-submit"
 >
 {isAdding ?"Adding…" :"🐴 Add to Stable"}
 </button>
 {selectedCatalog && recentAdds.length > 0 && (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={handleDuplicate}
 id="quick-duplicate"
 >
 + Duplicate as New Finish
 </button>
 )}
 </div>
 </div>

 {/* Link to full form */}
 <div className="text-stone-500 mt-4 text-center text-sm">
 Need photos or more details?{""}
 <Link href="/add-horse" className="text-forest">
 Use the full intake form →
 </Link>
 </div>

 {/* Recent Adds */}
 {recentAdds.length > 0 && (
 <div className="border-stone-200 mt-8 rounded-lg border bg-white p-6">
 <h3 className="mb-2 text-base">Recently Added</h3>
 {recentAdds.map((item) => (
 <div
 key={item.id}
 className="border-stone-200 rounded-lg-item mt-8 border bg-white p-6"
 >
 <span>✅ {item.name}</span>
 <span className="text-stone-500">
 {item.finish} · {item.condition} — {timeSince(item.timestamp)}
 </span>
 <Link
 href={`/stable/${item.id}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-4 py-1 text-xs font-semibold text-stone-600 no-underline transition-all"
 >
 View →
 </Link>
 </div>
 ))}
 <button
 className="inline-flex min-h-[36px] mt-4 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
 onClick={() => router.push("/dashboard")}
 >
 ← Back to Dashboard ({recentAdds.length} added)
 </button>
 </div>
 )}
 </div>
 </FocusLayout>
 );
}
