"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { claimTransfer } from "@/app/actions/hoofprint";

export default function ClaimPage() {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ horseName: string; horseId: string } | null>(null);

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.trim().length < 6) {
            setError("Please enter a valid 6-character transfer code.");
            return;
        }
        setClaiming(true);
        setError(null);

        const result = await claimTransfer(code.trim());
        if (result.success && result.horseName && result.horseId) {
            setSuccess({ horseName: result.horseName, horseId: result.horseId });
        } else {
            setError(result.error || "Failed to claim transfer.");
        }
        setClaiming(false);
    };

    if (success) {
        return (
            <div className="page-container form-page">
                <div className="card animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", padding: "var(--space-2xl)" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>🎉</div>
                    <h1 style={{ fontSize: "calc(1.5rem * var(--font-scale))" }}>
                        Welcome to your stable!
                    </h1>
                    <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
                        <strong>{success.horseName}</strong> has been successfully transferred to your account.
                        The full Hoofprint™ history has been preserved.
                    </p>
                    <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "center" }}>
                        <Link href={`/stable/${success.horseId}`} className="btn btn-primary">
                            🐴 View Passport
                        </Link>
                        <Link href="/dashboard" className="btn btn-ghost">
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container form-page">
            <div className="card animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto", padding: "var(--space-2xl)" }}>
                <div style={{ textAlign: "center", marginBottom: "var(--space-lg)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-sm)" }}>📦</div>
                    <h1 style={{ fontSize: "calc(1.3rem * var(--font-scale))" }}>
                        <span className="text-gradient">Claim a Horse</span>
                    </h1>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "calc(0.85rem * var(--font-scale))", marginTop: "var(--space-xs)" }}>
                        Enter the 6-character transfer code from the seller to add their horse to your stable.
                    </p>
                </div>

                <form onSubmit={handleClaim}>
                    <div className="form-group">
                        <label className="form-label">Transfer Code</label>
                        <input
                            type="text"
                            className="form-input"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                            maxLength={6}
                            style={{
                                fontFamily: "monospace",
                                fontSize: "1.8rem",
                                fontWeight: 800,
                                textAlign: "center",
                                letterSpacing: "0.3em",
                                padding: "var(--space-md)",
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p style={{ color: "#ef4444", fontSize: "calc(0.8rem * var(--font-scale))", textAlign: "center", marginBottom: "var(--space-md)" }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={claiming || code.trim().length < 6}
                        style={{ width: "100%" }}
                    >
                        {claiming ? "Claiming…" : "🐴 Claim Horse"}
                    </button>
                </form>

                <p style={{ textAlign: "center", fontSize: "calc(0.75rem * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "var(--space-md)" }}>
                    The horse&apos;s full Hoofprint™ history will transfer with it.
                    <br />
                    Photos, show records, and provenance are preserved forever.
                </p>
            </div>
        </div>
    );
}
