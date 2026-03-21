"use client";

import { useState, useEffect } from"react";
import { createClient } from"@/lib/supabase/client";

export default function LinkHorseToCommission({ commissionId }: { commissionId: string }) {
 const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
 const [selectedHorseId, setSelectedHorseId] = useState("");
 const [saving, setSaving] = useState(false);
 const [done, setDone] = useState(false);

 useEffect(() => {
 const supabase = createClient();
 (async () => {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) return;
 const { data } = await supabase
 .from("user_horses")
 .select("id, custom_name")
 .eq("owner_id", user.id)
 .order("custom_name")
 .limit(200);
 if (data) {
 setHorses(
 (data as { id: string; custom_name: string }[]).map((h) => ({
 id: h.id,
 name: h.custom_name,
 })),
 );
 }
 })();
 }, []);

 const handleLink = async () => {
 if (!selectedHorseId) return;
 setSaving(true);
 const { linkHorseToCommission } = await import("@/app/actions/art-studio");
 const result = await linkHorseToCommission(commissionId, selectedHorseId);
 if (result.success) {
 setDone(true);
 }
 setSaving(false);
 };

 if (done) {
 return (
 <div className="mt-4 mb-6 rounded-lg border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.08)] px-6 py-4 text-sm leading-relaxed">
 ✅ Horse linked! WIP photos will appear on its Hoofprint™ upon delivery.
 </div>
 );
 }

 return (
 <div className="bg-card border-edge mb-6 rounded-lg border p-6 shadow-md transition-all">
 <h3 className="mb-2">🔗 Link a Horse from Your Stable</h3>
 <p className="text-muted mb-4 text-sm">
 Link a horse so WIP photos are added to its Hoofprint™ when this commission is delivered.
 </p>
 <div className="gap-2" style={{ display:"flex", alignItems:"center" }}>
 <select
 className="form-input"
 value={selectedHorseId}
 onChange={(e) => setSelectedHorseId(e.target.value)}
 style={{ flex: 1 }}
 >
 <option value="">Select a horse…</option>
 {horses.map((h) => (
 <option key={h.id} value={h.id}>
 {h.name}
 </option>
 ))}
 </select>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleLink}
 disabled={!selectedHorseId || saving}
 >
 {saving ?"…" :"Link"}
 </button>
 </div>
 </div>
 );
}
