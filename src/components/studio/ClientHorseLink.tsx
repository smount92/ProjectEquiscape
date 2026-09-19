"use client";

/**
 * The commissioner links their own horse.
 *
 * Until now only the artist had the linker, and it could only see the
 * commissioner's PUBLIC horses — while both sides' copy told the other
 * to "link it from their side". A private stable meant no link, no
 * verified credit, no provenance entry. The client always sees their
 * own stable, so this is the reliable path; the server still checks
 * the horse is theirs.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { linkHorseToCommission, type Commission } from "@/app/actions/art-studio";
import { HorseLinker } from "@/components/studio/ArtistControls";

export default function ClientHorseLink({ commission }: { commission: Commission }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const link = async (horseId: string) => {
        setBusy(true);
        setError(null);
        const result = await linkHorseToCommission(commission.id, horseId);
        setBusy(false);
        if (!result.success) {
            setError(result.error ?? "That didn't save.");
            return;
        }
        router.refresh();
    };

    return (
        <div className="border-input bg-muted/40 rounded-lg border p-4" data-testid="client-horse-link">
            <h3 className="mb-1 font-serif text-base font-bold">🐎 Which horse is this for?</h3>
            <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
                Link the horse from your stable now, before delivery. That&rsquo;s what puts the
                artist&rsquo;s verified credit and the making-of on its passport, and lets you file
                the cost into its vault.
            </p>
            <HorseLinker commission={commission} busy={busy} onLink={link} />
            {error && (
                <p className="text-destructive mt-2 text-sm font-semibold" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
