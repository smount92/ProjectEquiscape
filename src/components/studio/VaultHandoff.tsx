"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { recordCommissionInVault } from "@/app/actions/art-studio";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/studio/terms";

/**
 * The vault hand-off.
 *
 * When a commission finishes, offer the COMMISSIONER one click to file
 * what it cost into their horse's financial vault. This is the moment
 * they know the number and care about it; asking later means they never
 * do it.
 *
 * It lands in `financial_vault.commission_cost`, deliberately not in
 * `purchase_price` — "what I paid to acquire this horse" and "what I have
 * invested in having it painted" are different numbers, and merging them
 * would corrupt the Blue Book comparisons and the insurance report.
 *
 * The vault is owner-only at the database. Only the commissioner sees
 * this, and only for a horse they still own.
 */
export default function VaultHandoff({
    commissionId,
    horseId,
    horseName,
    price,
    alreadyRecorded,
}: {
    commissionId: string;
    horseId: string | null;
    horseName: string | null;
    price: number | null;
    alreadyRecorded: boolean;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [total, setTotal] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (alreadyRecorded || done) {
        return (
            <div className="border-success/30 bg-success/10 rounded-lg border p-4 text-sm leading-relaxed">
                <p className="m-0">
                    ✅ Filed into {horseName ? <strong>{horseName}</strong> : "the horse"}&rsquo;s
                    vault
                    {total != null && (
                        <>
                            {" "}
                            — <strong>{formatMoney(total)}</strong> invested in commissioned work
                            so far
                        </>
                    )}
                    .{" "}
                    {horseId && (
                        <Link href={`/stable/${horseId}`} className="text-forest hover:underline">
                            Open the vault →
                        </Link>
                    )}
                </p>
            </div>
        );
    }

    if (!horseId) {
        return (
            <div className="border-input bg-muted/40 rounded-lg border p-4">
                <h3 className="mb-1 font-serif text-base font-bold">💰 Record what this cost</h3>
                <p className="text-muted-foreground m-0 text-sm leading-relaxed">
                    This commission isn&rsquo;t linked to a horse in your stable, so there&rsquo;s
                    no vault to file it into. Ask the artist to link it, or add the cost by hand
                    from the horse&rsquo;s own page.
                </p>
            </div>
        );
    }

    return (
        <div className="border-input bg-muted/40 rounded-lg border p-4">
            <h3 className="mb-1 font-serif text-base font-bold">💰 Record what this cost</h3>
            <p className="text-secondary-foreground mb-4 text-sm leading-relaxed">
                File <strong>{formatMoney(price)}</strong> into{" "}
                <strong>{horseName ?? "this horse"}</strong>&rsquo;s vault as commissioned work.
                It sits alongside the purchase price rather than replacing it, so what you paid
                for the horse and what you&rsquo;ve invested in it stay separate figures. Only you
                can see the vault.
            </p>

            {error && (
                <p className="text-destructive border-destructive/30 bg-destructive/10 mb-4 rounded-md border px-4 py-2 text-sm">
                    {error}
                </p>
            )}

            <Button
                disabled={busy || price == null}
                onClick={async () => {
                    setBusy(true);
                    setError(null);
                    const result = await recordCommissionInVault(commissionId);
                    setBusy(false);
                    if (!result.success) {
                        setError(result.error ?? "That didn't save.");
                        return;
                    }
                    setTotal(result.total ?? null);
                    setDone(true);
                    router.refresh();
                }}
            >
                {busy ? "Filing…" : `Add ${formatMoney(price)} to the vault`}
            </Button>
        </div>
    );
}
