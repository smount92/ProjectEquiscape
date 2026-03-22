"use client";

import { useState, useEffect } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import Link from"next/link";
import { claimTransfer } from"@/app/actions/hoofprint";
import { getParkedHorseByPin, claimParkedHorse } from"@/app/actions/parked-export";

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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div
 className="bg-card border-edge animate-fade-in-up mx-auto max-w-[500px] rounded-lg border shadow-md transition-all"
 style={{ textAlign:"center" }}
 >
 <div className="mb-4 text-[3rem]">🎉</div>
 <h1 className="text-[calc(1.5rem*var(--font-scale))]">Welcome to your stable!</h1>
 <p className="text-muted mt-2 mb-6">
 <strong>{success.horseName}</strong> has been successfully transferred to your account. The full
 Hoofprint™ history has been preserved.
 </p>
 <div className="gap-2" style={{ display:"flex", justifyContent:"center", flexWrap:"wrap" }}>
 <Link
 href={`/stable/${success.horseId}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 🐴 View Passport
 </Link>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Dashboard
 </Link>
 </div>
 <p
 style={{
 textAlign:"center",
 fontSize:"calc(var(--font-size-sm) * var(--font-scale))",
 color:"var(--color-text-muted)",
 marginTop:"var(--space-lg)",
 borderTop:"1px solid var(--color-border)",
 paddingTop:"var(--space-md)",
 }}
 >
 ⭐ Had a good experience? You can leave a review from the seller&apos;s profile.
 </p>
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="bg-card border-edge animate-fade-in-up mx-auto max-w-[520px] rounded-lg border shadow-md transition-all">
 <div className="mb-6" style={{ textAlign:"center" }}>
 <div className="mb-2 text-[2.5rem]">📦</div>
 <h1 className="text-[calc(1.3rem*var(--font-scale))]">
 <span className="text-forest">Claim a Horse</span>
 </h1>
 <p className="text-muted mt-1 text-[calc(0.85rem*var(--font-scale))]">
 Enter a transfer code or Certificate of Authenticity PIN to claim a horse.
 </p>
 </div>

 {/* Preview Card (CoA PIN lookup result) */}
 {preview && (
 <div
 className="rounded-lg border border-edge bg-card p-6 shadow-sm border-edge rounded-lg border shadow-md transition-all"
 style={{
 border:"1px solid var(--color-border)",
 borderRadius:"var(--radius-lg)",
 padding:"var(--space-lg)",
 marginBottom:"var(--space-lg)",
 background:"var(--color-bg-elevated)",
 }}
 >
 <div className="gap-6" style={{ display:"flex", alignItems:"center" }}>
 {preview.photo ? (
 <img
 src={preview.photo}
 alt={preview.name}
 style={{
 width: 80,
 height: 80,
 borderRadius:"var(--radius-md)",
 objectFit:"cover",
 }}
 />
 ) : (
 <div
 style={{
 width: 80,
 height: 80,
 borderRadius:"var(--radius-md)",
 background:"var(--color-bg-card)",
 display:"flex",
 alignItems:"center",
 justifyContent:"center",
 fontSize:"2rem",
 }}
 >
 🐴
 </div>
 )}
 <div className="flex-1">
 <h3 className="mb-[4] text-[calc(1.1rem*var(--font-scale))] font-bold">
 {preview.name}
 </h3>
 <p className="text-muted text-sm">
 {preview.finish} · {preview.condition}
 </p>
 </div>
 </div>

 <div
 style={{
 display:"flex",
 gap:"var(--space-lg)",
 marginTop:"var(--space-md)",
 paddingTop:"var(--space-md)",
 borderTop:"1px solid var(--color-border)",
 }}
 >
 <div className="flex-1" style={{ textAlign:"center" }}>
 <span className="text-forest text-[1.2rem] font-bold">{preview.timelineCount}</span>
 <br />
 <span className="text-muted text-xs">Hoofprint Events</span>
 </div>
 <div className="flex-1" style={{ textAlign:"center" }}>
 <span className="text-forest text-[1.2rem] font-bold">{preview.ownerCount}</span>
 <br />
 <span className="text-muted text-xs">
 Previous Owner{preview.ownerCount !== 1 ?"s" :""}
 </span>
 </div>
 </div>

 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 onClick={handleClaim}
 disabled={claiming}
 style={{ width:"100%", marginTop:"var(--space-lg)" }}
 id="claim-horse-btn"
 >
 {claiming ?"Claiming…" :"🐴 Claim This Horse"}
 </button>
 </div>
 )}

 {/* Code Input */}
 {!preview && (
 <form onSubmit={handleSubmit}>
 <div className="mb-6">
 <label className="text-ink mb-1 block text-sm font-semibold">Transfer Code or PIN</label>
 <input
 type="text"
 className="form-input"
 value={code}
 onChange={(e) => {
 setCode(e.target.value.toUpperCase());
 setIsPinMode(false);
 setPreview(null);
 }}
 placeholder="ABC123"
 maxLength={6}
 style={{
 fontFamily:"monospace",
 fontSize:"1.8rem",
 fontWeight: 800,
 textAlign:"center",
 letterSpacing:"0.3em",
 padding:"var(--space-md)",
 }}
 autoFocus
 />
 </div>

 {error && (
 <p
 className="mb-4 text-[calc(0.8rem*var(--font-scale))] text-[#ef4444]"
 style={{ textAlign:"center" }}
 >
 {error}
 </p>
 )}

 <button
 type="submit"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 disabled={claiming || lookingUp || code.trim().length < 6}
 style={{ width:"100%" }}
 >
 {lookingUp ?"Looking up…" : claiming ?"Claiming…" :"🐴 Look Up & Claim"}
 </button>
 </form>
 )}

 {error && preview && (
 <p
 className="mt-4 text-[calc(0.8rem*var(--font-scale))] text-[#ef4444]"
 style={{ textAlign:"center" }}
 >
 {error}
 </p>
 )}

 <p className="text-muted mt-4 text-[calc(0.75rem*var(--font-scale))]" style={{ textAlign:"center" }}>
 The horse&apos;s full Hoofprint™ history will transfer with it.
 <br />
 Photos, show records, and provenance are preserved forever.
 </p>
 </div>
 </div>
 );
}
