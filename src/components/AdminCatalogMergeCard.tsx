"use client";

/**
 * Admin console — catalog duplicate merge. Front for
 * mergeCatalogItems: repoints every reference from the duplicate to
 * the canonical entry, logs to the changelog, deletes the duplicate.
 * Accepts UUIDs or slugs. Born from the North Light incident (two
 * suggestion batches, same 20 sculpts, two owner-SQL repairs).
 */

import { useState } from "react";

import { mergeCatalogItems } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminCatalogMergeCard() {
    const [duplicate, setDuplicate] = useState("");
    const [canonical, setCanonical] = useState("");
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
