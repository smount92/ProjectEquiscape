"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { claimTransfer } from "@/app/actions/hoofprint";
import { getParkedHorseByPin, claimParkedHorse } from "@/app/actions/parked-export";
import { Input } from "@/components/ui/input";
import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

function ClaimInner() {
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
            setError(result.error || "Invalid PIN.");
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
                setError(result.error || "Failed to claim.");
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
            setError(result.error || "Invalid code or PIN.");
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
            setError(result.error || "Failed to claim.");
        }
        setClaiming(false);
    };

    if (success) {
        return (
            <FocusLayout title="Claim a Horse" description="Enter a transfer code or Certificate of Authenticity PIN.">
                <div className="animate-fade-in-up mx-auto max-w-[500px] rounded-lg border border-input bg-card p-8 text-center shadow-md transition-all">
                    <div className="mb-4 text-[3rem]">🎉</div>
                    <h1 className="font-serif text-3xl font-bold text-foreground">Welcome to your stable!</h1>
                    <p className="mt-4 mb-8 text-secondary-foreground">
                        <strong>{success.horseName}</strong> has been successfully transferred to your account. The full
                        Hoofprint history has been preserved.
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
                            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all hover:bg-background"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                    <p className="mt-8 border-t border-input pt-4 text-center text-sm text-muted-foreground">
                        ⭐ Had a good experience? You can leave a review from the seller&apos;s profile.
                    </p>
                </div>
            </FocusLayout>
        );
    }

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="📦"
                title="Claim a Horse"
                subtitle="Enter a transfer code or Certificate of Authenticity PIN"
            />
            <div className="animate-fade-in-up mx-auto max-w-[520px] rounded-lg border border-input bg-card p-8 shadow-md transition-all">
                {/* Preview Card (CoA PIN lookup result) */}
                {preview && (
                    <div className="mb-6 rounded-xl border border-input bg-card p-6 text-left shadow-sm transition-all">
                        <div className="flex items-center gap-6">
                            {preview.photo ? (
                                <img
                                    src={preview.photo}
                                    alt={preview.name}
                                    className="h-20 w-20 rounded-lg bg-background object-cover shadow-sm"
                                />
                            ) : (
                                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-background text-[2rem]">
                                    🐴
                                </div>
                            )}
                            <div className="flex-1">
                                <h3 className="mb-1 text-lg font-bold text-foreground">{preview.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {preview.finish} · {preview.condition}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex gap-6 border-t border-input pt-4">
                            <div className="flex-1 text-center">
                                <span className="text-[1.2rem] font-bold text-forest">{preview.timelineCount}</span>
                                <br />
                                <span className="text-xs text-muted-foreground">Hoofprint Events</span>
                            </div>
                            <div className="flex-1 text-center">
                                <span className="text-[1.2rem] font-bold text-forest">{preview.ownerCount}</span>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                    Previous Owner{preview.ownerCount !== 1 ? "s" : ""}
                                </span>
                            </div>
                        </div>

                        <button
                            className="mt-6 inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90"
                            onClick={handleClaim}
                            disabled={claiming}
                            id="claim-horse-btn"
                        >
                            {claiming ? "Claiming…" : "🐴 Claim This Horse"}
                        </button>
                    </div>
                )}

                {/* Code Input */}
                {!preview && (
                    <form onSubmit={handleSubmit} className="text-left">
                        <div className="mb-6">
                            <label className="mb-2 block text-sm font-semibold text-foreground">
                                Transfer Code or PIN
                            </label>
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
                                className="h-16 rounded-lg border-input bg-card text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-foreground"
                                autoFocus
                            />
                        </div>

                        {error && <p className="mb-4 text-center text-sm text-destructive">{error}</p>}

                        <button
                            type="submit"
                            className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-all hover:bg-forest/90"
                            disabled={claiming || lookingUp || code.trim().length < 6}
                        >
                            {lookingUp ? "Looking up…" : claiming ? "Claiming…" : "🐴 Look Up & Claim"}
                        </button>
                    </form>
                )}

                {error && preview && <p className="mt-4 text-center text-sm font-medium text-red-700">{error}</p>}

                <p className="mt-6 border-t border-input pt-4 text-center text-xs text-muted-foreground">
                    The horse&apos;s full Hoofprint history will transfer with it.
                    <br />
                    Photos, show records, and provenance are preserved forever.
                </p>
            </div>
        </FocusLayout>
    );
}

// Suspense wrapper: this page reads useSearchParams(), and without a
// boundary that bails the whole static build ("missing-suspense-with-
// csr-bailout"). The root loading.tsx used to mask this site-wide; now
// the boundary is explicit and local.
export default function ClaimPage() {
    return (
        <Suspense fallback={null}>
            <ClaimInner />
        </Suspense>
    );
}
