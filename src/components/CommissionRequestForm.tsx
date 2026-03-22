"use client";

import { useState, useEffect } from"react";
import { useRouter } from"next/navigation";
import { createClient } from"@/lib/supabase/client";
import { createCommission } from"@/app/actions/art-studio";
import type { ArtistProfile } from"@/app/actions/art-studio";

export default function CommissionRequestForm({ artist }: { artist: ArtistProfile }) {
 const router = useRouter();
 const [commissionType, setCommissionType] = useState("");
 const [description, setDescription] = useState("");
 const [budget, setBudget] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
 const [selectedHorseId, setSelectedHorseId] = useState<string>("");

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

 const typeOptions =
 artist.acceptingTypes.length > 0
 ? artist.acceptingTypes
 : artist.specialties.length > 0
 ? artist.specialties
 : ["Custom Paint","Other"];

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!commissionType || !description.trim()) {
 setError("Please fill in all required fields.");
 return;
 }

 setSaving(true);
 setError(null);

 const result = await createCommission({
 artistId: artist.userId,
 commissionType,
 description: description.trim(),
 budget: budget ? parseFloat(budget) : undefined,
 horseId: selectedHorseId || undefined,
 });

 if (result.success && result.commissionId) {
 router.push(`/studio/commission/${result.commissionId}`);
 } else {
 setError(result.error ||"Failed to submit request.");
 setSaving(false);
 }
 };

 return (
 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Commission Type *</label>
 <select
 className="form-input"
 value={commissionType}
 onChange={(e) => setCommissionType(e.target.value)}
 required
 title="Commission type"
 >
 <option value="">Select a type…</option>
 {typeOptions.map((t) => (
 <option key={t} value={t}>
 {t}
 </option>
 ))}
 </select>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Link a Horse (optional)</label>
 <select
 className="form-input"
 value={selectedHorseId}
 onChange={(e) => setSelectedHorseId(e.target.value)}
 title="Link a horse"
 >
 <option value="">No horse — artist will create or I&apos;ll send one later</option>
 {horses.map((h) => (
 <option key={h.id} value={h.id}>
 {h.name}
 </option>
 ))}
 </select>
 <span className="text-muted mt-1 block text-xs">
 Select the model you&apos;re sending in for this commission.
 </span>
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Description *</label>
 <textarea
 className="form-input"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe what you'd like — colors, breed, reference photos, any details that help the artist understand your vision…"
 rows={6}
 maxLength={5000}
 required
 />
 </div>

 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Your Budget ($)</label>
 <input
 type="number"
 className="form-input"
 value={budget}
 onChange={(e) => setBudget(e.target.value)}
 placeholder={artist.priceRangeMin ? `Starting from $${artist.priceRangeMin}` :"Optional"}
 min={0}
 step="0.01"
 />
 {(artist.priceRangeMin || artist.priceRangeMax) && (
 <span
 className="text-muted mt-[4] block text-xs"
 >
 Artist&apos;s range: ${artist.priceRangeMin ||"?"} – ${artist.priceRangeMax ||"?"}
 </span>
 )}
 </div>

 {error && (
 <p
 className="mb-4 text-center text-sm text-[#ef4444]"
 >
 {error}
 </p>
 )}

 <button
 type="submit"
 className="inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={saving}
 id="submit-commission-btn"
 >
 {saving ?"Submitting…" :"🎨 Submit Commission Request"}
 </button>
 </form>
 );
}
