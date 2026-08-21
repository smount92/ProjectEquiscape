"use client";

/**
 * Admin console — catalog duplicate merge. Front for
 * mergeCatalogItems: repoints every reference from the duplicate to
 * the canonical entry, logs to the changelog, deletes the duplicate.
 * Accepts UUIDs or slugs. Born from the North Light incident (two
 * suggestion batches, same 20 sculpts, two owner-SQL repairs).
 *
 * `prefill` is the handoff from the duplicate sweeper above: it seeds
 * the two boxes and nothing else. The confirm dialog and the button
 * press are still the admin's — a sweeper that could merge on its own
 * would be a sweeper that can delete the wrong catalog entry on its
 * own. Standalone (no prop) the card behaves exactly as it always has.
 *
 * The prefill lands as INITIAL state, not through an effect: the
 * caller remounts this card with a fresh `key` per handoff, which is
 * both the idiomatic reset and the reason picking the same pair twice
 * still refills boxes a previous merge had cleared.
 */

import { useState } from "react";

import { mergeCatalogItems } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MergePrefill {
    duplicate: string;
    canonical: string;
}

export default function AdminCatalogMergeCard({ prefill }: { prefill?: MergePrefill | null } = {}) {
    const [duplicate, setDuplicate] = useState(prefill?.duplicate ?? "");
    const [canonical, setCanonical] = useState(prefill?.canonical ?? "");
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    const run = async () => {
        if (!duplicate.trim() || !canonical.trim()) {
            setNotice({ ok: false, text: "Both fields are required (id or slug)." });
            return;
        }
        if (
            !confirm(
                `Merge "${duplicate.trim()}" INTO "${canonical.trim()}"?\n\nThe duplicate is deleted; every horse, wishlist, and suggestion pointing at it is repointed to the canonical entry. This cannot be undone.`,
            )
        ) {
            return;
        }
        setPending(true);
        setNotice(null);
        const result = await mergeCatalogItems(duplicate, canonical);
        setNotice(
            result.success
                ? { ok: true, text: result.summary ?? "Merged." }
                : { ok: false, text: result.error ?? "Something went wrong." },
        );
        if (result.success) {
            setDuplicate("");
        }
        setPending(false);
    };

    return (
        <div className="rounded-lg border border-input bg-card p-4">
            <h3 className="m-0 mb-1 text-base font-bold">Merge catalog duplicates</h3>
            <p className="m-0 mb-3 text-sm text-muted-foreground">
                Deletes the duplicate and repoints every reference (horses, wishlists, suggestions,
                child molds) to the canonical entry. Paste catalog ids or slugs.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    value={duplicate}
                    onChange={(e) => setDuplicate(e.target.value)}
                    placeholder="Duplicate (id or slug) — gets deleted"
                    aria-label="Duplicate catalog entry"
                    disabled={pending}
                />
                <Input
                    value={canonical}
                    onChange={(e) => setCanonical(e.target.value)}
                    placeholder="Canonical (id or slug) — survives"
                    aria-label="Canonical catalog entry"
                    disabled={pending}
                />
            </div>
            <div className="mt-3">
                <Button
                    variant="destructive-outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => void run()}
                >
                    {pending ? "Merging…" : "Merge"}
                </Button>
            </div>
            {notice && (
                <p
                    role={notice.ok ? "status" : "alert"}
                    className={`m-0 mt-2 text-sm font-medium ${notice.ok ? "text-muted-foreground" : "text-destructive"}`}
                >
                    {notice.text}
                </p>
            )}
        </div>
    );
}
