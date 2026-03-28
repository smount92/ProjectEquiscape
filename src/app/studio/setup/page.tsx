"use client";

import { useState, useEffect, useCallback } from"react";
import { useRouter } from"next/navigation";
import { getArtistProfile, createArtistProfile, updateArtistProfile } from"@/app/actions/art-studio";
import type { ArtistProfile } from"@/app/actions/art-studio";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import FocusLayout from"@/components/layouts/FocusLayout";

// ── Option Lists ──
const SPECIALTIES = [
"Custom Painting (OF)",
"Custom Painting (Resin)",
"Prepping",
"Hairing",
"Tack Making",
"Etching/Dremmeling",
"Body Mods",
"Glazework",
"Pastels",
"Oils",
"Acrylics",
"Props",
"Other Animals",
"Dolls/Riders",
];

const MEDIUMS = ["Acrylics","Oils","Pastels","Airbrush","Prismacolor Pencils","Chalk","Epoxy","Mixed Media"];

const SCALES = [
"Traditional (1:9)",
"Classic (1:12)",
"Stablemate (1:32)",
"Paddock Pal (1:24)",
"Micro Mini",
"Other",
];

const COMMISSION_TYPES = [
"Custom Paint",
"Resin Prep & Paint",
"Hair Job",
"Tack Order",
"Body Mod",
"Full Custom",
"Repair / Touch-up",
"Other",
];

export default function StudioSetupPage() {
 const router = useRouter();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);
 const [existing, setExisting] = useState<ArtistProfile | null>(null);
 const [userId, setUserId] = useState<string | null>(null);

 // Form state
 const [studioName, setStudioName] = useState("");
 const [studioSlug, setStudioSlug] = useState("");
 const [specialties, setSpecialties] = useState<string[]>([]);
 const [mediums, setMediums] = useState<string[]>([]);
 const [scalesOffered, setScalesOffered] = useState<string[]>([]);
 const [bioArtist, setBioArtist] = useState("");
 const [status, setStatus] = useState("closed");
 const [maxSlots, setMaxSlots] = useState("5");
 const [turnaroundMin, setTurnaroundMin] = useState("");
 const [turnaroundMax, setTurnaroundMax] = useState("");
 const [priceMin, setPriceMin] = useState("");
 const [priceMax, setPriceMax] = useState("");
 const [termsText, setTermsText] = useState("");
 const [paypalMeLink, setPaypalMeLink] = useState("");
 const [acceptingTypes, setAcceptingTypes] = useState<string[]>([]);

 const loadProfile = useCallback(async () => {
 setLoading(true);
 try {
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
  setLoading(false);
  return;
  }
  const { userId: uid } = await res.json();
  if (!uid) {
  setLoading(false);
  return;
  }
  setUserId(uid);

  const profile = await getArtistProfile(uid);
  if (profile) {
  setExisting(profile);
  setStudioName(profile.studioName);
  setStudioSlug(profile.studioSlug);
  setSpecialties(profile.specialties);
  setMediums(profile.mediums);
  setScalesOffered(profile.scalesOffered);
  setBioArtist(profile.bioArtist ||"");
  setStatus(profile.status);
  setMaxSlots(profile.maxSlots?.toString() ||"5");
  setTurnaroundMin(profile.turnaroundMinDays?.toString() ||"");
  setTurnaroundMax(profile.turnaroundMaxDays?.toString() ||"");
  setPriceMin(profile.priceRangeMin?.toString() ||"");
  setPriceMax(profile.priceRangeMax?.toString() ||"");
  setTermsText(profile.termsText ||"");
  setPaypalMeLink(profile.paypalMeLink ||"");
  setAcceptingTypes(profile.acceptingTypes);
  }
 } catch {
  /* ignore */
 }
 setLoading(false);
 }, []);

 useEffect(() => {
 loadProfile();
 }, [loadProfile]);

 useEffect(() => {
 if (!existing && studioName) {
  setStudioSlug(
  studioName
   .toLowerCase()
   .replace(/[^a-z0-9-]/g,"-")
   .replace(/-+/g,"-")
   .replace(/^-|-$/g,""),
  );
 }
 }, [studioName, existing]);

 const toggleArray = (arr: string[], setArr: (v: string[]) => void, val: string) => {
 setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setSaving(true);
 setError(null);
 setSuccess(null);

 const formData = new FormData();
 formData.set("studioName", studioName);
 formData.set("studioSlug", studioSlug);
 formData.set("specialties", JSON.stringify(specialties));
 formData.set("mediums", JSON.stringify(mediums));
 formData.set("scalesOffered", JSON.stringify(scalesOffered));
 formData.set("bioArtist", bioArtist);
 formData.set("status", status);
 formData.set("maxSlots", (parseInt(maxSlots) || 5).toString());
 formData.set("turnaroundMinDays", turnaroundMin);
 formData.set("turnaroundMaxDays", turnaroundMax);
 formData.set("priceRangeMin", priceMin);
 formData.set("priceRangeMax", priceMax);
 formData.set("termsText", termsText);
 formData.set("paypalMeLink", paypalMeLink);
 formData.set("acceptingTypes", JSON.stringify(acceptingTypes));

 const result = existing ? await updateArtistProfile(formData) : await createArtistProfile(formData);

 if (result.success) {
  setSuccess(existing ?"Profile updated!" :"Studio created!");
  if (!existing &&"slug" in result && result.slug) {
  setTimeout(() => router.push(`/studio/${result.slug}`), 1500);
  }
  await loadProfile();
 } else {
  setError(result.error ||"Something went wrong.");
 }
 setSaving(false);
 };

 if (loading) {
 return (
  <FocusLayout title={<><span className="text-forest">Art Studio</span></>}>
  <div className="bg-white border-stone-200 mx-auto max-w-[700px] rounded-lg border p-12 text-center shadow-md transition-all">
   <p className="text-stone-500">Loading studio settings…</p>
  </div>
  </FocusLayout>
 );
 }

 return (
 <FocusLayout
  title={<><span className="text-forest">{existing ?"Edit Your Studio" :"Set Up Your Art Studio"}</span></>}
  description={existing ?"Update your studio profile and commission settings." :"Create your artist profile to start accepting commissions."}
 >
  <div className="bg-white border-stone-200 animate-fade-in-up mx-auto max-w-[700px] rounded-lg border shadow-md transition-all">
  <form onSubmit={handleSubmit}>
   {/* Studio Identity */}
   <fieldset className="border-stone-200 mb-6 rounded-lg border p-6">
   <legend>🏷️ Studio Identity</legend>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Studio Name *</label>
    <Input
    type="text"
    value={studioName}
    onChange={(e) => setStudioName(e.target.value)}
    placeholder="e.g. Painted Ponies Studio"
    required
    maxLength={80}
    />
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Studio URL Slug</label>
    <div className="flex items-center gap-1">
    <span className="text-stone-500 whitespace-nowrap text-sm">/studio/</span>
    <Input
     type="text"
     className="font-mono"
     value={studioSlug}
     onChange={(e) =>
     setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))
     }
     placeholder="painted-ponies"
     maxLength={50}
    />
    </div>
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Artist Bio</label>
    <Textarea
    value={bioArtist}
    onChange={(e) => setBioArtist(e.target.value)}
    placeholder="Tell clients about your style, experience, and what inspires your work…"
    rows={4}
    maxLength={2000}
    />
   </div>
   </fieldset>

   {/* Skills & Services */}
   <fieldset className="border-stone-200 mb-6 rounded-lg border p-6">
   <legend>🛠️ Skills & Services</legend>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Specialties</label>
    <div className="flex flex-wrap gap-1">
    {SPECIALTIES.map((s) => (
     <button
     key={s}
     type="button"
     className={`studio-chip ${specialties.includes(s) ?"active" :""}`}
     onClick={() => toggleArray(specialties, setSpecialties, s)}
     >
     {s}
     </button>
    ))}
    </div>
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Mediums</label>
    <div className="flex flex-wrap gap-1">
    {MEDIUMS.map((m) => (
     <button
     key={m}
     type="button"
     className={`studio-chip ${mediums.includes(m) ?"active" :""}`}
     onClick={() => toggleArray(mediums, setMediums, m)}
     >
     {m}
     </button>
    ))}
    </div>
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Scales Offered</label>
    <div className="flex flex-wrap gap-1">
    {SCALES.map((s) => (
     <button
     key={s}
     type="button"
     className={`studio-chip ${scalesOffered.includes(s) ?"active" :""}`}
     onClick={() => toggleArray(scalesOffered, setScalesOffered, s)}
     >
     {s}
     </button>
    ))}
    </div>
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">
    Commission Types Accepted
    </label>
    <div className="flex flex-wrap gap-1">
    {COMMISSION_TYPES.map((t) => (
     <button
     key={t}
     type="button"
     className={`studio-chip ${acceptingTypes.includes(t) ?"active" :""}`}
     onClick={() => toggleArray(acceptingTypes, setAcceptingTypes, t)}
     >
     {t}
     </button>
    ))}
    </div>
   </div>
   </fieldset>

   {/* Commission Settings */}
   <fieldset className="border-stone-200 mb-6 rounded-lg border p-6">
   <legend>📋 Commission Settings</legend>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Commission Status</label>
    <div className="flex gap-2">
    {(["open","waitlist","closed"] as const).map((s) => (
     <button
     key={s}
     type="button"
     className={`studio-status-btn ${status === s ? `active-${s}` :""}`}
     onClick={() => setStatus(s)}
     >
     {s ==="open" ?"🟢" : s ==="waitlist" ?"🟡" :"🔴"}{""}
     {s.charAt(0).toUpperCase() + s.slice(1)}
     </button>
    ))}
    </div>
   </div>

   <div className="grid grid-cols-2 gap-4">
    <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">
     Max Commission Slots
    </label>
    <Input
     type="number"
     value={maxSlots}
     onChange={(e) => setMaxSlots(e.target.value)}
     onBlur={() => {
     const val = parseInt(maxSlots);
     if (isNaN(val) || val < 1) setMaxSlots("1");
     else if (val > 50) setMaxSlots("50");
     else setMaxSlots(val.toString());
     }}
     placeholder="5"
     min={1}
     max={50}
    />
    </div>
    <div />
   </div>

   <div className="grid grid-cols-2 gap-4">
    <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">
     Turnaround (min days)
    </label>
    <Input
     type="number"
     value={turnaroundMin}
     onChange={(e) => setTurnaroundMin(e.target.value)}
     placeholder="e.g. 14"
     min={1}
    />
    </div>
    <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">
     Turnaround (max days)
    </label>
    <Input
     type="number"
     value={turnaroundMax}
     onChange={(e) => setTurnaroundMax(e.target.value)}
     placeholder="e.g. 60"
     min={1}
    />
    </div>
   </div>

   <div className="grid grid-cols-2 gap-4">
    <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Price Range (min $)</label>
    <Input
     type="number"
     value={priceMin}
     onChange={(e) => setPriceMin(e.target.value)}
     placeholder="e.g. 50"
     min={0}
     step="0.01"
    />
    </div>
    <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Price Range (max $)</label>
    <Input
     type="number"
     value={priceMax}
     onChange={(e) => setPriceMax(e.target.value)}
     placeholder="e.g. 500"
     min={0}
     step="0.01"
    />
    </div>
   </div>
   </fieldset>

   {/* Policies & Payment */}
   <fieldset className="border-stone-200 mb-6 rounded-lg border p-6">
   <legend>💰 Policies & Payment</legend>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">Terms & Conditions</label>
    <Textarea
    value={termsText}
    onChange={(e) => setTermsText(e.target.value)}
    placeholder="Deposit policy, revision limits, turnaround expectations, cancellation rules…"
    rows={5}
    maxLength={5000}
    />
   </div>

   <div className="mb-6">
    <label className="text-stone-900 mb-1 block text-sm font-semibold">PayPal.me Link</label>
    <Input
    type="url"
    value={paypalMeLink}
    onChange={(e) => setPaypalMeLink(e.target.value)}
    placeholder="https://paypal.me/yourstudio"
    />
   </div>
   </fieldset>

   {/* Feedback */}
   {error && (
   <p className="mb-4 text-center text-sm text-[#ef4444]">
    {error}
   </p>
   )}
   {success && (
   <p className="mb-4 text-center text-sm text-[#22c55e]">
    {success}
   </p>
   )}

   <button
   type="submit"
   className="inline-flex w-full min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   disabled={saving || !studioName.trim()}
   id="save-studio-btn"
   >
   {saving ?"Saving…" : existing ?"💾 Save Changes" :"🎨 Create Studio"}
   </button>

   {existing && (
   <div className="mt-4 text-center">
    <a
    href={`/studio/${existing.studioSlug}`}
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
    >
    👁️ View Public Studio Page
    </a>
   </div>
   )}
  </form>
  </div>
 </FocusLayout>
 );
}
