"use client";

import { useState, useEffect } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import Link from"next/link";
import { claimTransfer } from"@/app/actions/hoofprint";
import { getParkedHorseByPin, claimParkedHorse } from"@/app/actions/parked-export";
import { Input } from "@/components/ui/input";
import FocusLayout from"@/components/layouts/FocusLayout";

export default function ClaimPage() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [code, setCode] = useState("");
 const [claiming, setClaiming] = useState(false);
 const [lookingUp, setLookingUp] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<{ horseName: string; horseId: string } | null>(null);

 // PIN-based preview state
 const [preview, setPreview] = useState<{
 name: string;
 photo: string | null;
 finish: string;
 condition: string;
 timelineCount: number;
 ownerCount: number;
 transferId: string;
 } | null>(null);
 const [isPinMode, setIsPinMode] = useState(false);

 // Auto-fill from URL query param
 useEffect(() => {
 const pin = searchParams.get("pin");
 if (pin) {
 setCode(pin.toUpperCase());
 setIsPinMode(true);
 // Auto-lookup
 handlePinLookup(pin.toUpperCase());
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 const handlePinLookup = async (pinValue: string) => {
 setLookingUp(true);
 setError(null);
 const result = await getParkedHorseByPin(pinValue);
 if (result.success && result.horse) {
 setPreview(result.horse);
 setIsPinMode(true);
 } else {
 setError(result.error ||"Invalid PIN.");
 setPreview(null);
 }
 setLookingUp(false);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = code.trim();
 if (trimmed.length < 6) {
 setError("Please enter a valid 6-character code.");
 return;
 }

 setError(null);

 // If we already have a preview from a PIN lookup, claim via PIN
 if (isPinMode && preview) {
 setClaiming(true);
 const result = await claimParkedHorse(trimmed);
 if (result.success && result.horseName && result.horseId) {
 setSuccess({ horseName: result.horseName, horseId: result.horseId });
 } else {
 setError(result.error ||"Failed to claim.");
 }
 setClaiming(false);
 return;
 }

 // Try PIN lookup first, then fall back to transfer code
 setLookingUp(true);
 const pinResult = await getParkedHorseByPin(trimmed);
 if (pinResult.success && pinResult.horse) {
 setPreview(pinResult.horse);
 setIsPinMode(true);
 setLookingUp(false);
 return;
 }

 // Fall back to standard transfer code claim
 setLookingUp(false);
 setClaiming(true);
 const result = await claimTransfer(trimmed);
 if (result.success && result.horseName && result.horseId) {
 setSuccess({ horseName: result.horseName, horseId: result.horseId });
 } else {
 setError(result.error ||"Invalid code or PIN.");
 }
 setClaiming(false);
 };

 const handleClaim = async () => {
 setClaiming(true);
 setError(null);
 const result = await claimParkedHorse(code.trim());
 if (result.success && result.horseName && result.horseId) {
 setSuccess({ horseName: result.horseName, horseId: result.horseId });
 } else {
 setError(result.error ||"Failed to claim.");
 }
 setClaiming(false);
 };

 if (success) {
 return (
 <FocusLayout title="Claim a Horse" description="Enter a transfer code or Certificate of Authenticity PIN.">
 <div className="bg-[#FEFCF8] border-edge animate-fade-in-up mx-auto max-w-[500px] rounded-lg border shadow-md transition-all text-center p-8">
 <div className="mb-4 text-[3rem]">🎉</div>
 <h1 className="font-serif text-3xl font-bold text-ink">Welcome to your stable!</h1>
 <p className="text-ink-light mt-4 mb-8">
 <strong>{success.horseName}</strong> has been successfully transferred to your account. The full
 Hoofprint™ history has been preserved.
 </p>
 <div className="flex flex-wrap justify-center gap-4">
 <Link
 href={`/stable/${success.horseId}`}
 className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90"
 >
 🐴 View Passport
 </Link>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all hover:bg-[#F4EFE6]"
 >
 ← Dashboard
 </Link>
 </div>
 <p className="text-center text-sm text-muted-foreground mt-8 border-t border-edge pt-4">
 ⭐ Had a good experience? You can leave a review from the seller&apos;s profile.
 </p>
 </div>
 </FocusLayout>
 );
 }

 return (
 <FocusLayout title="Claim a Horse" description="Enter a transfer code or Certificate of Authenticity PIN.">
 <div className="bg-[#FEFCF8] border-edge animate-fade-in-up mx-auto max-w-[520px] rounded-lg border shadow-md transition-all p-8">
 <div className="mb-8 text-center">
 <div className="mb-2 text-[2.5rem]">📦</div>
 <h1 className="font-serif text-3xl font-bold text-ink">
 Claim a Horse
 </h1>
 <p className="text-ink-light mt-2 text-sm">
 Enter a transfer code or Certificate of Authenticity PIN to claim a horse.
 </p>
 </div>

 {/* Preview Card (CoA PIN lookup result) */}
 {preview && (
 <div className="rounded-xl border border-edge p-6 mb-6 bg-[#FEFCF8] shadow-sm transition-all text-left">
 <div className="flex items-center gap-6">
 {preview.photo ? (
 <img
 src={preview.photo}
 alt={preview.name}
 className="w-20 h-20 rounded-lg object-cover shadow-sm bg-[#F4EFE6]"
 />
 ) : (
 <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[#F4EFE6] text-[2rem]">
 🐴
 </div>
 )}
 <div className="flex-1">
 <h3 className="mb-1 text-lg font-bold text-ink">
 {preview.name}
 </h3>
 <p className="text-muted-foreground text-sm">
 {preview.finish} · {preview.condition}
 </p>
 </div>
 </div>

 <div className="flex gap-6 mt-4 pt-4 border-t border-edge">
 <div className="flex-1 text-center">
 <span className="text-forest text-[1.2rem] font-bold">{preview.timelineCount}</span>
 <br />
 <span className="text-muted-foreground text-xs">Hoofprint Events</span>
 </div>
 <div className="flex-1 text-center">
 <span className="text-forest text-[1.2rem] font-bold">{preview.ownerCount}</span>
 <br />
 <span className="text-muted-foreground text-xs">
 Previous Owner{preview.ownerCount !== 1 ?"s" :""}
 </span>
 </div>
 </div>

 <button
 className="inline-flex w-full min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90 mt-6"
 onClick={handleClaim}
 disabled={claiming}
 id="claim-horse-btn"
 >
 {claiming ?"Claiming…" :"🐴 Claim This Horse"}
 </button>
 </div>
 )}

 {/* Code Input */}
 {!preview && (
 <form onSubmit={handleSubmit} className="text-left">
 <div className="mb-6">
 <label className="text-ink mb-2 block text-sm font-semibold">Transfer Code or PIN</label>
 <Input
 type="text"
 value={code}
 onChange={(e) => {
 setCode(e.target.value.toUpperCase());
 setIsPinMode(false);
 setPreview(null);
 }}
 placeholder="ABC123"
 maxLength={6}
 className="font-mono text-3xl font-extrabold text-center tracking-[0.3em] h-16 rounded-lg bg-[#FEFCF8] border-edge text-ink"
 autoFocus
 />
 </div>

 {error && (
 <p
 className="mb-4 text-sm text-[#ef4444] text-center"
 >
 {error}
 </p>
 )}

 <button
 type="submit"
 className="inline-flex w-full min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90"
 disabled={claiming || lookingUp || code.trim().length < 6}
 >
 {lookingUp ?"Looking up…" : claiming ?"Claiming…" :"🐴 Look Up & Claim"}
 </button>
 </form>
 )}

 {error && preview && (
 <p className="mt-4 text-sm text-red-700 text-center font-medium">
 {error}
 </p>
 )}

 <p className="text-muted-foreground mt-6 text-xs text-center border-t border-edge pt-4">
 The horse&apos;s full Hoofprint™ history will transfer with it.
 <br />
 Photos, show records, and provenance are preserved forever.
 </p>
 </div>
 </FocusLayout>
 );
}
